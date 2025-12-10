import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { hasRole } from "@/lib/auth"

/**
 * GET /api/emails/orphaned
 * Get all orphaned email threads (threads with supplier ID but no quote request ID)
 */
export async function GET(request: Request) {
  try {
    // Get the current session
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission to read emails
    const canReadEmails = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN", "USER"])

    if (!canReadEmails) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get the URL search params
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""

    // Get orphaned email threads
    // These are threads that have a supplier ID and created by ID, but no quote request ID
    const orphanedThreads = await prisma.emailThread.findMany({
      where: {
        organizationId: session.user.organizationId,
        supplierId: { not: null },
        quoteRequestId: null,
        OR: [
          { subject: { contains: search, mode: "insensitive" } },
          {
            messages: {
              some: {
                from: { contains: search, mode: "insensitive" }
              }
            }
          }
        ]
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            auxiliaryEmails: true
          }
        },
        messages: {
          orderBy: {
            receivedAt: "desc"
          },
          select: {
            id: true,
            direction: true,
            from: true,
            to: true,
            subject: true,
            body: true,
            bodyHtml: true,
            sentAt: true,
            receivedAt: true,
            externalMessageId: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    })

    // Transform the data for the frontend
    const orphanedEmails = orphanedThreads.map(thread => {
      const latestMessage = thread.messages[0]
      
      return {
        id: thread.id,
        subject: thread.subject,
        from: latestMessage?.from || "Unknown",
        to: latestMessage?.to || "",
        body: latestMessage?.body || "",
        bodyHtml: latestMessage?.bodyHtml || "",
        receivedAt: latestMessage?.receivedAt || thread.updatedAt,
        supplier: thread.supplier,
        externalThreadId: thread.externalThreadId,
        messages: thread.messages
      }
    })

    return NextResponse.json({ data: orphanedEmails })
  } catch (error) {
    console.error("Error fetching orphaned emails:", error)
    return NextResponse.json(
      { error: "Failed to fetch orphaned emails" },
      { status: 500 }
    )
  }
}

// Note: The POST method for assigning orphaned emails has been moved to /api/emails/orphaned/assign/route.ts