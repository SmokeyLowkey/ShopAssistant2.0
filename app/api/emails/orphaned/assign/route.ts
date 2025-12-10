import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { hasRole } from "@/lib/auth"

/**
 * POST /api/emails/orphaned/assign
 * Assign an orphaned email thread to a quote request
 */
export async function POST(request: Request) {
  try {
    console.log("Starting orphaned email assignment process")
    
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
    // Use direct role check instead of hasRole helper
    const userRole = session.user.role
    const allowedRoles = ["ADMIN", "MANAGER"]
    const canUpdateEmails = allowedRoles.includes(userRole)
    
    console.log("User role check:", userRole, "Allowed:", canUpdateEmails)

    if (!canUpdateEmails) {
      console.log("User does not have permission to update emails")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { threadId, quoteRequestId } = body
    console.log("Request body parsed:", { threadId, quoteRequestId })

    if (!threadId || !quoteRequestId) {
      console.log("Missing required parameters")
      return NextResponse.json(
        { error: "Thread ID and Quote Request ID are required" },
        { status: 400 }
      )
    }

    // Check if the thread exists and belongs to the user's organization
    console.log("Looking for thread with ID:", threadId)
    console.log("Organization ID:", session.user.organizationId)
    
    const thread = await prisma.emailThread.findFirst({
      where: {
        id: threadId,
        organizationId: session.user.organizationId
      },
      include: {
        quoteRequest: true
      }
    })
    
    console.log("Thread found:", thread ? "Yes" : "No")

    if (!thread) {
      return NextResponse.json(
        { error: "Email thread not found" },
        { status: 404 }
      )
    }
    
    // Check if the quote request exists and belongs to the user's organization
    console.log("Looking for quote request with ID:", quoteRequestId)
    
    const quoteRequest = await prisma.quoteRequest.findFirst({
      where: {
        id: quoteRequestId,
        organizationId: session.user.organizationId
      },
      include: {
        emailThread: true
      }
    })
    
    console.log("Quote request found:", quoteRequest ? "Yes" : "No")
    
    if (!quoteRequest) {
      return NextResponse.json(
        { error: "Quote request not found" },
        { status: 404 }
      )
    }

    // Check if the quote request already has an associated email thread
    if (quoteRequest.emailThread && quoteRequest.emailThread.id) {
      console.log("Quote request already has an associated email thread:", quoteRequest.emailThread.id)
      console.log("Will need to merge threads")
      
      try {
        // Instead of making an HTTP request, use Prisma directly to merge the threads
        console.log(`Moving messages from thread ${threadId} to thread ${quoteRequest.emailThread.id}`)
        
        // Get the source thread to check if it's from an auxiliary email
        const sourceThread = await prisma.emailThread.findUnique({
          where: { id: threadId },
          include: {
            supplier: true,
            messages: {
              take: 1,
              orderBy: { createdAt: 'asc' }
            }
          }
        });
        
        // Check if the source thread is from an auxiliary email
        if (sourceThread && sourceThread.supplier && sourceThread.messages.length > 0) {
          const firstMessage = sourceThread.messages[0];
          const fromEmail = firstMessage.from;
          
          // Helper function to check if an email is in the auxiliaryEmails array
          const isEmailInAuxiliaryEmails = (email: string, auxiliaryEmails: string[]) => {
            return auxiliaryEmails.some(auxEmail =>
              auxEmail === email || auxEmail.replace(/[{}]/g, '') === email
            );
          };
          
          // If the from email is not the supplier's main email, it might be an auxiliary email
          if (sourceThread.supplier.email !== fromEmail &&
              !isEmailInAuxiliaryEmails(fromEmail, sourceThread.supplier.auxiliaryEmails)) {
            console.log(`Found potential new auxiliary email: ${fromEmail} for supplier ${sourceThread.supplier.id}`);
            
            // Get the current auxiliaryEmails array
            const supplier = await prisma.supplier.findUnique({
              where: { id: sourceThread.supplier.id },
              select: { auxiliaryEmails: true }
            });
            
            // Add the new email to the auxiliaryEmails array if it's not already there
            if (supplier) {
              // Process the auxiliaryEmails array to handle potential string format with curly braces
              let currentAuxiliaryEmails = supplier.auxiliaryEmails || [];
              
              // If the array contains strings with curly braces, clean them up
              const cleanedAuxiliaryEmails = currentAuxiliaryEmails.map(email =>
                typeof email === 'string' ? email.replace(/[{}]/g, '') : email
              );
              
              // Add the new email if it's not already in the cleaned array
              if (!cleanedAuxiliaryEmails.includes(fromEmail)) {
                const updatedAuxiliaryEmails = [...currentAuxiliaryEmails, fromEmail];
                
                console.log(`Adding new auxiliary email ${fromEmail} to supplier ${sourceThread.supplier.id}`);
                console.log(`Current auxiliary emails: ${JSON.stringify(currentAuxiliaryEmails)}`);
                console.log(`Updated auxiliary emails: ${JSON.stringify(updatedAuxiliaryEmails)}`);
                
                // Update the supplier with the new auxiliaryEmails array
                await prisma.supplier.update({
                  where: { id: sourceThread.supplier.id },
                  data: {
                    auxiliaryEmails: updatedAuxiliaryEmails
                  }
                });
                
                console.log(`Successfully updated supplier with new auxiliary email`);
              } else {
                console.log(`Email ${fromEmail} is already in the auxiliary emails list`);
              }
            }
            
            console.log(`Updated supplier ${sourceThread.supplier.id} with new auxiliary email: ${fromEmail}`);
          }
        }
        
        // Start a transaction to ensure data consistency
        const result = await prisma.$transaction(async (tx) => {
          // Get all messages from the source thread
          const sourceMessages = await tx.emailMessage.findMany({
            where: { threadId }
          })
          
          console.log(`Found ${sourceMessages.length} messages to move`)
          
          // Move all messages from source thread to target thread
          for (const message of sourceMessages) {
            await tx.emailMessage.update({
              where: { id: message.id },
              data: {
                threadId: quoteRequest.emailThread!.id,
                // Update any other relevant fields
                updatedAt: new Date()
              }
            })
          }
          
          // Ensure the target thread is properly associated with the quote request
          await tx.emailThread.update({
            where: { id: quoteRequest.emailThread!.id },
            data: {
              quoteRequestId: quoteRequest.id,
              updatedAt: new Date()
            }
          })
          
          // Get the source thread details before deleting
          const sourceThread = await tx.emailThread.findUnique({
            where: { id: threadId },
            include: { supplier: true }
          })
          
          console.log("Source thread details:", sourceThread ? JSON.stringify({
            id: sourceThread.id,
            subject: sourceThread.subject,
            supplierId: sourceThread.supplierId
          }) : "Not found")
          
          // Delete the source thread
          await tx.emailThread.delete({
            where: { id: threadId }
          })
          
          // Get the updated target thread
          const updatedTargetThread = await tx.emailThread.findUnique({
            where: { id: quoteRequest.emailThread!.id },
            include: {
              messages: {
                orderBy: {
                  createdAt: 'asc'
                }
              },
              quoteRequest: {
                include: {
                  supplier: true
                }
              },
              supplier: true
            }
          })
          
          console.log("Updated target thread:", updatedTargetThread ?
            `ID: ${updatedTargetThread.id}, QuoteRequestID: ${updatedTargetThread.quoteRequestId}, MessageCount: ${updatedTargetThread.messages.length}` :
            "Not found")
          
          return updatedTargetThread
        })
        
        console.log("Email threads merged successfully")
        
        // Verify the quote request is still properly associated with the thread
        const verifyQuoteRequest = await prisma.quoteRequest.findUnique({
          where: { id: quoteRequestId },
          include: { emailThread: true }
        });
        
        console.log("Verification - Quote Request:", verifyQuoteRequest ?
          `ID: ${verifyQuoteRequest.id}, Has EmailThread: ${verifyQuoteRequest.emailThread ? 'Yes' : 'No'}` :
          "Not found");
        
        if (verifyQuoteRequest && verifyQuoteRequest.emailThread) {
          console.log(`Verification - EmailThread ID: ${verifyQuoteRequest.emailThread.id}`);
        }
        
        return NextResponse.json({
          success: true,
          merged: true,
          thread: result,
          quoteRequest: {
            id: quoteRequest.id,
            quoteNumber: quoteRequest.quoteNumber,
            title: quoteRequest.title
          }
        })
      } catch (error) {
        console.error("Error merging threads:", error)
        return NextResponse.json(
          {
            error: "Failed to merge email threads",
            details: error instanceof Error ? error.message : String(error)
          },
          { status: 500 }
        )
      }
    }

    // First, check if the email thread is already associated with a different quote request
    if (thread.quoteRequestId && thread.quoteRequestId !== quoteRequestId) {
      console.log("Email thread is already associated with a different quote request:", thread.quoteRequestId)
      return NextResponse.json(
        {
          error: "Email thread is already associated with a different quote request",
          details: "Please select a different email thread"
        },
        { status: 400 }
      )
    }
    
    // Update the email thread to associate it with the quote request
    console.log("Updating email thread to associate with quote request")
    
    try {
      // Start a transaction to ensure data consistency
      const result = await prisma.$transaction(async (tx) => {
        // Update the email thread with the quote request ID
        const updatedThread = await tx.emailThread.update({
          where: {
            id: threadId
          },
          data: {
            quoteRequestId
          },
          include: {
            supplier: true,
            quoteRequest: true
          }
        })
        
        console.log("Email thread updated successfully")
        
        return updatedThread
      })
      
      return NextResponse.json({
        success: true,
        thread: result
      })
    } catch (error) {
      console.error("Database error during update:", error)
      
      // Type guard for Prisma errors
      const isPrismaError = (err: unknown): err is { code: string; meta?: { target?: string[] } } => {
        return typeof err === 'object' && err !== null && 'code' in err;
      }
      
      if (isPrismaError(error) && error.code === 'P2002' && error.meta?.target?.includes('quoteRequestId')) {
        return NextResponse.json(
          {
            error: "Quote request already has an associated email thread",
            details: "Each quote request can only be associated with one email thread"
          },
          { status: 400 }
        )
      }
      
      throw error
    }
  } catch (error) {
    console.error("Error assigning orphaned email:", error)
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
    
    return NextResponse.json(
      {
        error: "Failed to assign orphaned email",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}