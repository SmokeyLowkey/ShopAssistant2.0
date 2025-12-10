import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

/**
 * POST /api/emails/merge
 * Merge two email threads by moving all messages from the source thread to the target thread
 * and then deleting the source thread
 */
export async function POST(request: Request) {
  try {
    console.log("Starting email thread merge process")
    
    // Get the current session
    const session = await auth()
    console.log("Session retrieved:", session ? "Session exists" : "No session")

    if (!session?.user) {
      console.log("No authenticated user found")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    console.log("User authenticated:", session.user.email)
    console.log("User role:", session.user.role)
    console.log("Organization ID:", session.user.organizationId)

    // Check if user has permission to update emails
    const userRole = session.user.role
    const allowedRoles = ["ADMIN", "MANAGER"]
    const canUpdateEmails = allowedRoles.includes(userRole)
    
    console.log("User role check:", userRole, "Allowed:", canUpdateEmails)

    if (!canUpdateEmails) {
      console.log("User does not have permission to merge email threads")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { sourceThreadId, targetThreadId } = body
    console.log("Request body parsed:", { sourceThreadId, targetThreadId })

    if (!sourceThreadId || !targetThreadId) {
      console.log("Missing required parameters")
      return NextResponse.json(
        { error: "Source Thread ID and Target Thread ID are required" },
        { status: 400 }
      )
    }

    // Check if the source thread exists and belongs to the user's organization
    console.log("Looking for source thread with ID:", sourceThreadId)
    
    const sourceThread = await prisma.emailThread.findFirst({
      where: {
        id: sourceThreadId,
        organizationId: session.user.organizationId
      },
      include: {
        messages: true,
        quoteRequest: true
      }
    })
    
    console.log("Source thread found:", sourceThread ? "Yes" : "No")

    if (!sourceThread) {
      return NextResponse.json(
        { error: "Source email thread not found" },
        { status: 404 }
      )
    }

    // Check if the target thread exists and belongs to the user's organization
    console.log("Looking for target thread with ID:", targetThreadId)
    
    const targetThread = await prisma.emailThread.findFirst({
      where: {
        id: targetThreadId,
        organizationId: session.user.organizationId
      },
      include: {
        messages: true,
        quoteRequest: true
      }
    })
    
    console.log("Target thread found:", targetThread ? "Yes" : "No")

    if (!targetThread) {
      return NextResponse.json(
        { error: "Target email thread not found" },
        { status: 404 }
      )
    }

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      console.log(`Moving ${sourceThread.messages.length} messages from source thread to target thread`)
      
      // Move all messages from source thread to target thread
      for (const message of sourceThread.messages) {
        await tx.emailMessage.update({
          where: { id: message.id },
          data: { threadId: targetThreadId }
        })
      }
      
      // If the source thread has a quote request and the target thread doesn't,
      // update the target thread to reference the quote request
      if (sourceThread.quoteRequestId && !targetThread.quoteRequestId) {
        await tx.emailThread.update({
          where: { id: targetThreadId },
          data: { quoteRequestId: sourceThread.quoteRequestId }
        })
      }
      
      // Delete the source thread
      await tx.emailThread.delete({
        where: { id: sourceThreadId }
      })
      
      // Get the updated target thread
      const updatedTargetThread = await tx.emailThread.findUnique({
        where: { id: targetThreadId },
        include: {
          messages: {
            orderBy: {
              createdAt: 'asc'
            }
          },
          quoteRequest: true,
          supplier: true
        }
      })
      
      return updatedTargetThread
    })
    
    console.log("Email threads merged successfully")
    
    return NextResponse.json({
      success: true,
      thread: result
    })
  } catch (error) {
    console.error("Error merging email threads:", error)
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
    
    return NextResponse.json(
      {
        error: "Failed to merge email threads",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}