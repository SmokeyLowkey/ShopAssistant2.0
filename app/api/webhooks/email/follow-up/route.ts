import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateFollowUpEmail, FollowUpEmailRequest } from "@/lib/api/n8n-client";
import { QuoteStatus } from "@prisma/client";

// POST /api/webhooks/email/follow-up - Handle follow-up email workflow
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      quoteRequestId,
      messageId,
      action = "preview",
      additionalMessage,
      expectedResponseBy,
      followUpReason = "No response received by expected date",
      workflowBranch = "no_response",
      emailContent,
      supplierId, // Optional supplier ID for multi-supplier quotes
      isApproveAndSend = false // New parameter to detect Approve & Send button
    } = await req.json();
    
    // Log the additionalMessage when the request is received
    console.log(`[FOLLOW-UP] Request received with additionalMessage: ${additionalMessage || 'None'}`);
    console.log(`[FOLLOW-UP] Request received with supplierId: ${supplierId || 'Not provided'}`);
    console.log(`[FOLLOW-UP] Full request body:`, JSON.stringify({ quoteRequestId, messageId, supplierId, workflowBranch }, null, 2));

    if (!quoteRequestId || !messageId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get the quote request with related data
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: quoteRequestId,
      },
      include: {
        supplier: {
          include: {
            auxiliaryEmails: true
          }
        },
        emailThreads: {
          include: {
            emailThread: {
              include: {
                messages: {
                  select: {
                    id: true,
                    to: true,
                    cc: true,
                    bcc: true,
                    from: true,
                    sentAt: true,
                    receivedAt: true,
                    createdAt: true
                  }
                }
              }
            }
          }
        }
      },
    });

    if (!quoteRequest) {
      return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
    }

    // Get the user and organization information
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      include: {
        organization: true,
      },
    });

    if (!user || quoteRequest.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch the original message if it's not a dummy ID
    let originalMessage = null;
    if (messageId && !messageId.includes('dummy')) {
      originalMessage = await prisma.emailMessage.findUnique({
        where: { id: messageId },
      });
      
      // Only return an error if we're in preview mode and the message is required
      if (!originalMessage && action === "preview") {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }
    }
    
    // For send action, we don't need the original message as N8N will handle it
    if (action === "send" && !originalMessage) {
      console.log("No original message found, but continuing with send action");
      // Create a dummy message for the workflow
      originalMessage = {
        body: "No original message content available",
        sentAt: new Date()
      };
    }

    // Determine which supplier to use for this follow-up
    // If supplierId is provided, use that specific supplier; otherwise use primary supplier
    let targetSupplier = quoteRequest.supplier;
    
    console.log(`[FOLLOW-UP] Primary supplier from quoteRequest:`, {
      id: quoteRequest.supplier.id,
      name: quoteRequest.supplier.name,
      email: quoteRequest.supplier.email
    });
    console.log(`[FOLLOW-UP] Requested supplierId:`, supplierId);
    
    if (supplierId && supplierId !== quoteRequest.supplier.id) {
      console.log(`[FOLLOW-UP] Fetching specific supplier: ${supplierId}`);
      // Fetch the specific supplier
      const specificSupplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        include: {
          auxiliaryEmails: true
        }
      });
      
      if (!specificSupplier) {
        console.error(`[FOLLOW-UP] Supplier not found: ${supplierId}`);
        return NextResponse.json(
          { error: "Specified supplier not found" },
          { status: 404 }
        );
      }
      
      console.log(`[FOLLOW-UP] Using specific supplier:`, {
        id: specificSupplier.id,
        name: specificSupplier.name,
        email: specificSupplier.email
      });
      targetSupplier = specificSupplier;
    } else {
      console.log(`[FOLLOW-UP] Using primary supplier from quote request`);
    }

    // Check if supplier has an email
    if (!targetSupplier.email) {
      return NextResponse.json(
        { error: "Supplier does not have an email address" },
        { status: 400 }
      );
    }

    // Filter emailThread by supplier ID to get the correct thread
    const supplierThread = quoteRequest.emailThreads?.find(
      (thread: any) => thread.supplierId === targetSupplier.id
    );

    if (!supplierThread) {
      return NextResponse.json(
        { error: "No email thread found for this supplier" },
        { status: 404 }
      );
    }

    // Determine workflow branch and follow-up reason
    let determinedWorkflowBranch = workflowBranch;
    let emailType = "follow_up";
    let normalizedFollowUpReason = followUpReason;
    
    // Check if this is a send action from the "Approve & Send" button
    // The button is green, so it's likely an approval action
    if (action === "send") {
      // For any send action, force the workflow branch to "accept_quote"
      // This ensures the "Approve & Send" button works correctly
      console.log("Send action detected - forcing workflow branch to accept_quote");
      determinedWorkflowBranch = "accept_quote";
      emailType = "follow_up_accept_quote";
      normalizedFollowUpReason = "follow_up_accept_quote";
    }
    
    // If not an approve action, determine workflow branch from input
    if (!workflowBranch || !["no_response", "needs_revision", "accept_quote"].includes(workflowBranch)) {
      if (followUpReason.toLowerCase().includes('revision')) {
        determinedWorkflowBranch = "needs_revision";
      } else if (followUpReason.toLowerCase().includes('accept')) {
        determinedWorkflowBranch = "accept_quote";
      } else {
        determinedWorkflowBranch = "no_response";
      }
    }
    
    // Determine email type based on workflow branch
    if (determinedWorkflowBranch === "needs_revision") {
      emailType = "follow_up_needs_revision";
      normalizedFollowUpReason = "follow_up_needs_revision";
      
      // Log when the needs_revision branch is selected
      console.log(`[FOLLOW-UP] Using needs_revision branch with additionalMessage: ${additionalMessage || 'None'}`);
    } else if (determinedWorkflowBranch === "accept_quote") {
      emailType = "follow_up_accept_quote";
      normalizedFollowUpReason = "follow_up_accept_quote";
    } else {
      emailType = "follow_up_no_response";
      normalizedFollowUpReason = "follow_up_no_response";
    }
    
    // We'll fetch the most recent edited email later, regardless of email type
    // This section is now handled in the enhanced data section
    let customEmailContent = null;

    // Extract unique email addresses from the email thread
    const threadEmails = new Set<string>();
    
    // Find the most recent message ID for inReplyTo field
    let mostRecentMessageId = "";
    let mostRecentMessageDate = new Date(0); // Initialize with oldest possible date
    
    // Process all messages in the thread to extract email addresses
    if (supplierThread.emailThread?.messages) {
      supplierThread.emailThread.messages.forEach((message: any) => {
        // Track most recent message for inReplyTo
        const messageDate = message.sentAt || message.receivedAt || message.createdAt;
        if (messageDate && new Date(messageDate) > mostRecentMessageDate) {
          mostRecentMessageDate = new Date(messageDate);
          mostRecentMessageId = message.id || "";
        }
        
        // Add 'to' addresses
        if (message.to) {
          // If 'to' is a string, split by commas or semicolons
          if (typeof message.to === 'string') {
            message.to.split(/[,;]/).forEach((email: string) => {
              const trimmedEmail = email.trim();
              if (trimmedEmail && trimmedEmail !== targetSupplier.email) {
                threadEmails.add(trimmedEmail);
              }
            });
          }
        }
        
        // Add 'cc' addresses
        if (message.cc && Array.isArray(message.cc)) {
          message.cc.forEach((email: string) => {
            if (email && email !== targetSupplier.email) {
              threadEmails.add(email);
            }
          });
        }
        
        // Add 'bcc' addresses
        if (message.bcc && Array.isArray(message.bcc)) {
          message.bcc.forEach((email: string) => {
            if (email && email !== targetSupplier.email) {
              threadEmails.add(email);
            }
          });
        }
      });
    }
    
    // Convert Set to Array
    const threadAuxiliaryEmails = Array.from(threadEmails);
    console.log("Thread-specific auxiliary emails:", threadAuxiliaryEmails);
    
    // Use expected response date from request or set to one day from now
    const defaultExpectedResponseBy = new Date();
    defaultExpectedResponseBy.setDate(defaultExpectedResponseBy.getDate() + 1);
    
    // Current timestamp for followUpSentAt
    const followUpSentAt = new Date();
    
    // Create the base email data
    const emailData: FollowUpEmailRequest = {
      quoteRequestId: quoteRequest.id,
      threadId: supplierThread.emailThreadId,
      supplier: {
        id: targetSupplier.id,
        name: targetSupplier.name,
        email: targetSupplier.email,
        auxiliaryEmails: targetSupplier.auxiliaryEmails?.map(ae => ae.email) || []
      },
      previousCommunication: {
        lastContactDate: originalMessage?.sentAt?.toISOString() || new Date().toISOString(),
        messagesSummary: originalMessage?.body || "No previous message content available",
      },
      followUpReason: normalizedFollowUpReason,
      workflowBranch: determinedWorkflowBranch as "no_response" | "needs_revision" | "accept_quote",
      missingInformation: additionalMessage ? [additionalMessage] : []
    };
    
    // Log the missingInformation array when it's created
    if (additionalMessage) {
      console.log(`[FOLLOW-UP] Added additionalMessage to missingInformation array: ${additionalMessage}`);
    };
    
    // Get the most recent content from either EditedEmail or N8nResponse
    // Use type assertion to avoid TypeScript errors
    const enhancedEmailData: any = {
      ...emailData,
      // Ensure these fields are directly in the enhancedEmailData object
      additionalMessage: additionalMessage,
      expectedResponseBy: expectedResponseBy || defaultExpectedResponseBy.toISOString(),
      followUpSentAt: followUpSentAt.toISOString(),
      inReplyTo: mostRecentMessageId,
      user: {
        id: user.id,
        name: user.name || 'User',
        email: user.email,
        role: user.role
      }
    };
    
    // For needs_revision branch, ensure missingInformation is included
    // This is important for the N8N workflow to process the additional message correctly
    if (determinedWorkflowBranch === "needs_revision") {
      enhancedEmailData.missingInformation = additionalMessage ? [additionalMessage] : [];
      console.log(`[FOLLOW-UP] Added missingInformation array for needs_revision branch: ${JSON.stringify(enhancedEmailData.missingInformation)}`);
    }
    
    // First, get the most recent N8nResponse
    console.log("Checking for the most recent N8nResponse");
    const n8nResponse = await prisma.n8nResponse.findFirst({
      where: {
        quoteRequestId: quoteRequest.id,
        responseType: 'follow_up'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Get the most recent EditedEmail regardless of email type
    console.log("Checking for the most recent EditedEmail regardless of type");
    const mostRecentEditedEmail = await prisma.editedEmail.findFirst({
      where: {
        quoteRequestId: quoteRequest.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Determine which source to use based on recency
    let useEditedEmail = false;
    let n8nResponseTime = n8nResponse?.createdAt ? new Date(n8nResponse.createdAt).getTime() : 0;
    let editedEmailTime = mostRecentEditedEmail?.createdAt ? new Date(mostRecentEditedEmail.createdAt).getTime() : 0;
    
    if (mostRecentEditedEmail && n8nResponse) {
      useEditedEmail = editedEmailTime > n8nResponseTime;
      console.log(`EditedEmail created at: ${mostRecentEditedEmail.createdAt}`);
      console.log(`N8nResponse created at: ${n8nResponse.createdAt}`);
      console.log(`Using ${useEditedEmail ? 'EditedEmail' : 'N8nResponse'} as it's more recent`);
    } else {
      useEditedEmail = !!mostRecentEditedEmail;
      console.log(`Using ${useEditedEmail ? 'EditedEmail' : 'N8nResponse'} as it's the only one available`);
    }
    
    // Use the content from the more recent source
    if (useEditedEmail && mostRecentEditedEmail) {
      console.log(`Using EditedEmail with ID: ${mostRecentEditedEmail.id}`);
      // Create email content object
      const emailContent = {
        subject: mostRecentEditedEmail.subject || "",
        body: mostRecentEditedEmail.body || "",
        bodyHtml: mostRecentEditedEmail.bodyHtml || "",
        from: user.email,
        to: targetSupplier.email,
        direction: 'OUTBOUND',
        expectedResponseBy: expectedResponseBy || defaultExpectedResponseBy.toISOString(),
        followUpSentAt: followUpSentAt.toISOString(),
        inReplyTo: mostRecentMessageId,
        followUpReason: normalizedFollowUpReason
      };
      
      // Add email content directly to enhancedEmailData
      enhancedEmailData.emailContent = emailContent;
      
      // Also keep customEmailContent for backward compatibility
      enhancedEmailData.customEmailContent = emailContent;
      
      // Add user information to the enhanced email data
      enhancedEmailData.user = {
        id: user.id,
        name: user.name || 'User',
        email: user.email,
        role: user.role
      };
      
      // If not a send action, update email type and workflow branch based on the EditedEmail
      if (action !== "send") {
        emailType = mostRecentEditedEmail.emailType;
        
        if (emailType === "follow_up_needs_revision") {
          determinedWorkflowBranch = "needs_revision";
          normalizedFollowUpReason = "follow_up_needs_revision";
        } else if (emailType === "follow_up_accept_quote") {
          determinedWorkflowBranch = "accept_quote";
          normalizedFollowUpReason = "follow_up_accept_quote";
        } else if (emailType === "follow_up_no_response") {
          determinedWorkflowBranch = "no_response";
          normalizedFollowUpReason = "follow_up_no_response";
        }
      }
    } else if (n8nResponse && n8nResponse.responseData) {
      console.log(`Using N8nResponse with ID: ${n8nResponse.id}`);
      const responseData = n8nResponse.responseData as any;
      if (responseData.emailContent) {
        // Create email content object
        const emailContent = {
          subject: responseData.emailContent.subject || "",
          body: responseData.emailContent.body || "",
          bodyHtml: responseData.emailContent.bodyHtml || "",
          from: user.email,
          to: targetSupplier.email,
          direction: 'OUTBOUND',
          expectedResponseBy: expectedResponseBy || defaultExpectedResponseBy.toISOString(),
          followUpSentAt: followUpSentAt.toISOString(),
          inReplyTo: mostRecentMessageId,
          followUpReason: normalizedFollowUpReason
        };
        
        // Add email content directly to enhancedEmailData
        enhancedEmailData.emailContent = emailContent;
        
        // Also keep customEmailContent for backward compatibility
        enhancedEmailData.customEmailContent = emailContent;
        
        // Add user information to the enhanced email data
        enhancedEmailData.user = {
          id: user.id,
          name: user.name || 'User',
          email: user.email,
          role: user.role
        };
      }
      
      // If not a send action, update email type and workflow branch based on the N8nResponse
      if (action !== "send" && responseData.emailType) {
        emailType = responseData.emailType;
        
        if (emailType === "follow_up_needs_revision") {
          determinedWorkflowBranch = "needs_revision";
          normalizedFollowUpReason = "follow_up_needs_revision";
        } else if (emailType === "follow_up_accept_quote") {
          determinedWorkflowBranch = "accept_quote";
          normalizedFollowUpReason = "follow_up_accept_quote";
        } else if (emailType === "follow_up_no_response") {
          determinedWorkflowBranch = "no_response";
          normalizedFollowUpReason = "follow_up_no_response";
        }
      }
    }

    try {
      // Call the webhook to generate the email with the enhanced data
      // The customEmailContent will be used directly by the generateFollowUpEmail function
      console.log("Calling generateFollowUpEmail with data:", {
        customEmailContent: enhancedEmailData.customEmailContent ? "Present" : "Not present",
        emailContent: enhancedEmailData.emailContent ? "Present" : "Not present",
        additionalMessage: enhancedEmailData.additionalMessage ? "Present" : "Not present",
        missingInformation: enhancedEmailData.missingInformation ? JSON.stringify(enhancedEmailData.missingInformation) : "Not present",
        workflowBranch: enhancedEmailData.workflowBranch,
        user: enhancedEmailData.user ? "Present" : "Not present"
      });
      
      let emailResponse = await generateFollowUpEmail(enhancedEmailData);
      
      // Validate the response structure
      if (!emailResponse) {
        throw new Error("Email generation failed: Response is null or undefined");
      }
      
      if (!emailResponse.emailContent) {
        console.error("Invalid email response format:", JSON.stringify(emailResponse));
        throw new Error("Email generation failed: Response missing emailContent property");
      }
      
      console.log("Email response processed with subject:", emailResponse.emailContent.subject);

      // Save the N8N response to the database with workflow branch information
      await prisma.n8nResponse.create({
        data: {
          quoteRequestId: quoteRequest.id,
          messageId: messageId,
          responseType: 'follow_up',
          responseData: {
            ...JSON.parse(JSON.stringify(emailResponse)), // Ensure data is JSON-serializable
            workflowBranch: determinedWorkflowBranch,
            followUpReason: normalizedFollowUpReason,
            emailType: emailType
          }
        }
      });
      
      // Only update the quote status when actually sending the email, not for preview
      // We'll handle status updates in the send action below
      if (action === "send") {
        // Determine the appropriate status based on the workflow branch
        let newStatus: QuoteStatus;
        
        switch (determinedWorkflowBranch) {
          case "no_response":
            // For no response follow-ups, keep the current status (likely SENT)
            // No status change needed
            console.log(`No status change for no_response follow-up for quote request ${quoteRequest.id}`);
            break;
            
          case "needs_revision":
            // For revision requests, change status back to SENT (awaiting revised quote)
            newStatus = QuoteStatus.SENT;
            await prisma.quoteRequest.update({
              where: { id: quoteRequest.id },
              data: {
                status: newStatus,
                responseDate: new Date()
              }
            });
            console.log(`Updated quote request ${quoteRequest.id} status to ${newStatus} for needs_revision follow-up`);
            break;
            
          case "accept_quote":
            // For quote acceptance, change status to APPROVED
            newStatus = QuoteStatus.APPROVED;
            await prisma.quoteRequest.update({
              where: { id: quoteRequest.id },
              data: {
                status: newStatus,
                responseDate: new Date()
              }
            });
            console.log(`Updated quote request ${quoteRequest.id} status to ${newStatus} for accept_quote follow-up`);
            break;
            
          default:
            // Default behavior (current implementation)
            newStatus = QuoteStatus.UNDER_REVIEW;
            await prisma.quoteRequest.update({
              where: { id: quoteRequest.id },
              data: {
                status: newStatus,
                responseDate: new Date()
              }
            });
            console.log(`Updated quote request ${quoteRequest.id} status to ${newStatus} (default behavior)`);
            break;
        }
      }

      // If this is just a preview, return the email content with full metadata
      if (action === "preview") {
        // Check if the response has the expected structure
        if (emailResponse && emailResponse.emailContent) {
          return NextResponse.json({
            data: {
              email: {
                subject: emailResponse.emailContent.subject,
                body: emailResponse.emailContent.body,
                bodyHtml: emailResponse.emailContent.bodyHtml
              },
              metadata: {
                quoteRequestId: quoteRequest.id,
                threadId: originalMessage?.threadId || 'unknown',
                messageId: messageId,
                followUpReason: normalizedFollowUpReason,
                workflowBranch: determinedWorkflowBranch,
                supplier: {
                  id: targetSupplier.id,
                  name: targetSupplier.name,
                  email: targetSupplier.email,
                  auxiliaryEmails: targetSupplier.auxiliaryEmails?.map((ae: any) => ae.email) || []
                },
                generatedAt: new Date().toISOString()
              },
              actions: {
                approve: {
                  label: "Send Follow-up",
                  endpoint: "/api/webhooks/email/follow-up",
                  method: "POST",
                  payload: {
                    quoteRequestId: quoteRequest.id,
                    messageId: messageId,
                    action: "send",
                    followUpReason: normalizedFollowUpReason,
                    workflowBranch: determinedWorkflowBranch
                  }
                },
                edit: {
                  label: "Edit Email",
                  endpoint: "/api/webhooks/email/follow-up",
                  method: "POST",
                  payload: {
                    quoteRequestId: quoteRequest.id,
                    messageId: messageId,
                    action: "edit"
                  }
                }
              }
            },
            success: true
          });
        } else {
          // Return the entire response for debugging
          return NextResponse.json({
            data: emailResponse,
            success: true
          });
        }
      }
    } catch (error) {
      console.error("Error generating follow-up email:", error);
      
      // Return a fallback response for preview
      if (action === "preview") {
        return NextResponse.json({
          data: {
            subject: `Follow-up: ${followUpReason}`,
            body: `This is a follow-up regarding your quote request. Reason: ${followUpReason}`,
            bodyHtml: `<p>This is a follow-up regarding your quote request. Reason: ${followUpReason}</p>`
          },
          success: true,
          fallback: true
        });
      }
      
      // For send action, return an error
      return NextResponse.json(
        { error: "Failed to generate follow-up email" },
        { status: 500 }
      );
    }

    // If this is a send action, prepare payload for N8N using edited_emails
    if (action === "send") {
      try {
        console.log("Starting send action with workflowBranch:", determinedWorkflowBranch);
        
        // First try to find an edited email that matches the current workflow branch
        // This ensures we use the most appropriate edited email for the current action
        console.log(`Checking for edited email matching type: ${emailType}`);
        let latestEditedEmail = await prisma.editedEmail.findFirst({
          where: {
            quoteRequestId: quoteRequest.id,
            emailType: emailType
          },
          orderBy: {
            createdAt: "desc"
          }
        });
        
        // If no matching email type is found, fall back to the most recent edited email
        if (!latestEditedEmail) {
          console.log("No matching email type found, falling back to most recent edited email");
          latestEditedEmail = await prisma.editedEmail.findFirst({
            where: {
              quoteRequestId: quoteRequest.id
            },
            orderBy: {
              createdAt: "desc"
            }
          });
        }
        
        if (latestEditedEmail) {
          console.log(`Found latest edited email with ID: ${latestEditedEmail.id}, type: ${latestEditedEmail.emailType}, created at: ${latestEditedEmail.createdAt}`);
        } else {
          console.log("No edited emails found for this quote request");
        }
        
        // Get organization details
        const organization = user.organization;
        if (!organization) {
          return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }
        
        // Prepare email content from edited email or provided content
        let finalEmailContent = {
          subject: "",
          body: "",
          bodyHtml: ""
        };
        
        // Priority order for content:
        // 1. Latest edited email (highest priority)
        // 2. Email content provided in the request
        // 3. Custom email content from enhancedEmailData
        // 4. Generate from N8N (lowest priority)
        
        if (latestEditedEmail) {
          console.log(`Using latest edited email with ID: ${latestEditedEmail.id}`);
          // Use the edited email content with null checks
          finalEmailContent = {
            subject: latestEditedEmail.subject || "",
            body: latestEditedEmail.body || "",
            bodyHtml: latestEditedEmail.bodyHtml || ""
          };
          
          // Update the emailType and workflowBranch based on the edited email
          emailType = latestEditedEmail.emailType;
          
          if (emailType === "follow_up_needs_revision") {
            determinedWorkflowBranch = "needs_revision";
            normalizedFollowUpReason = "follow_up_needs_revision";
          } else if (emailType === "follow_up_accept_quote") {
            determinedWorkflowBranch = "accept_quote";
            normalizedFollowUpReason = "follow_up_accept_quote";
          } else if (emailType === "follow_up_no_response") {
            determinedWorkflowBranch = "no_response";
            normalizedFollowUpReason = "follow_up_no_response";
          }
          
          console.log(`Updated workflowBranch to ${determinedWorkflowBranch} based on edited email type`);
        } else if (emailContent && typeof emailContent === 'object') {
          console.log("Using provided email content from request");
          // Use the emailContent from the request JSON
          finalEmailContent = {
            subject: emailContent.subject || "",
            body: emailContent.body || "",
            bodyHtml: emailContent.bodyHtml || ""
          };
        } else if (enhancedEmailData.customEmailContent) {
          console.log("Using custom email content from enhancedEmailData");
          finalEmailContent = {
            subject: enhancedEmailData.customEmailContent.subject || "",
            body: enhancedEmailData.customEmailContent.body || "",
            bodyHtml: enhancedEmailData.customEmailContent.bodyHtml || ""
          };
        } else {
          console.log("No edited email or provided content found, generating from N8N");
          
          // Create a copy of enhancedEmailData with updated workflowBranch
          const updatedEmailData = {
            ...enhancedEmailData,
            workflowBranch: determinedWorkflowBranch
          };
          
          // Pass the enhancedEmailData to generateFollowUpEmail
          const emailResponse = await generateFollowUpEmail(updatedEmailData as FollowUpEmailRequest);
          
          // Validate the response structure
          if (!emailResponse) {
            throw new Error("Email generation failed: Response is null or undefined");
          }
          
          if (!emailResponse.emailContent) {
            console.error("Invalid email response format:", JSON.stringify(emailResponse));
            throw new Error("Email generation failed: Response missing emailContent property");
          }
          
          console.log("Email response generated successfully with subject:", emailResponse.emailContent.subject);
          finalEmailContent = emailResponse.emailContent;
        }
        
        // Prepare data for the email webhook - mimic the structure from quote-request webhook
        const payload: any = {
          quoteRequestId: quoteRequest.id,
          quoteNumber: quoteRequest.quoteNumber,
          messageId: messageId,
          threadId: supplierThread.emailThreadId,
          action: "send",
          followUpReason: normalizedFollowUpReason,
          workflowBranch: determinedWorkflowBranch,
          supplier: {
            id: targetSupplier.id,
            name: targetSupplier.name,
            email: targetSupplier.email,
            contactPerson: targetSupplier.contactPerson || undefined,
            auxiliaryEmails: targetSupplier.auxiliaryEmails?.map(ae => ae.email) || []
          },
          organization: {
            id: organization.id,
            name: organization.name,
            contactInfo: `${user.name || 'Contact'} | ${user.email} | ${organization.domain || ''}`,
          },
          user: {
            id: user.id,
            name: user.name || 'User',
            email: user.email,
            role: user.role,
          },
          emailThread: {
            id: supplierThread.emailThreadId,
            createdById: user.id,
          },
          emailContent: {
            subject: finalEmailContent.subject || `Follow-up: ${followUpReason}`,
            body: finalEmailContent.body || `Follow-up regarding your quote request. Reason: ${followUpReason}`,
            bodyHtml: finalEmailContent.bodyHtml || `<p>Follow-up regarding your quote request. Reason: ${followUpReason}</p>`,
            from: user.email,
            to: targetSupplier.email,
            direction: 'OUTBOUND',
            expectedResponseBy: expectedResponseBy || defaultExpectedResponseBy.toISOString(),
            followUpSentAt: followUpSentAt.toISOString(),
            inReplyTo: mostRecentMessageId,
            followUpReason: normalizedFollowUpReason
          },
          // Include additionalMessage directly for all workflow branches
          additionalMessage: additionalMessage,
          
          // For needs_revision branch, always include missingInformation array
          // This ensures compatibility with the N8N workflow expectations
          ...(determinedWorkflowBranch === "needs_revision" ? {
            missingInformation: additionalMessage ? [additionalMessage] : []
          } : {}),
          
          // Include the edited email reference if it exists
          editedEmail: latestEditedEmail ? {
            id: latestEditedEmail.id,
            emailType: latestEditedEmail.emailType,
            createdAt: latestEditedEmail.createdAt
          } : undefined
        };
        
        // Include the custom email content in the payload if available
        if (enhancedEmailData.customEmailContent) {
          console.log("Including custom email content in final payload");
          // Make sure customEmailContent includes user information
          payload.customEmailContent = {
            ...enhancedEmailData.customEmailContent,
            from: user.email,
            to: targetSupplier.email,
            direction: 'OUTBOUND',
            expectedResponseBy: expectedResponseBy || defaultExpectedResponseBy.toISOString(),
            followUpSentAt: followUpSentAt.toISOString(),
            inReplyTo: mostRecentMessageId,
            followUpReason: normalizedFollowUpReason
          };
          
          // The additionalMessage and missingInformation are already included in the payload
          // at lines 656-662, so we don't need to add them again here
        }
        
        console.log("Prepared payload for N8N:", {
          ...payload,
          emailContent: "Content included",
          additionalMessage: payload.additionalMessage || "Not present",
          missingInformation: payload.missingInformation ? JSON.stringify(payload.missingInformation) : "Not present",
          workflowBranch: payload.workflowBranch
        });
        
        // Log detailed information about additionalMessage and missingInformation
        console.log(`[FOLLOW-UP] Final payload for ${determinedWorkflowBranch} branch:`);
        console.log(`[FOLLOW-UP] - additionalMessage: ${payload.additionalMessage || 'None'}`);
        console.log(`[FOLLOW-UP] - missingInformation: ${payload.missingInformation ? JSON.stringify(payload.missingInformation) : 'None'}`);
        
        // Save information in an N8N response record with workflow branch information
        const n8nResponseRecord = await prisma.n8nResponse.create({
          data: {
            quoteRequestId: quoteRequest.id,
            messageId: messageId,
            responseType: 'follow_up_workflow_branch',
            responseData: {
              workflowBranch: determinedWorkflowBranch,
              followUpReason: normalizedFollowUpReason,
              emailType: emailType,
              emailContent: payload.emailContent,
              editedEmailId: latestEditedEmail?.id, // Include the edited email ID if available
              usedEditedEmail: !!latestEditedEmail // Flag indicating if we used an edited email
            }
          }
        });
        
        return NextResponse.json({
          data: {
            messageId: messageId,
            n8nResponseId: n8nResponseRecord.id,
            payload
          },
          success: true
        });
      } catch (error) {
        console.error("Error sending follow-up email:", error);
        return NextResponse.json(
          { error: "Failed to send follow-up email" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error handling follow-up email:", error);
    return NextResponse.json(
      { error: "Failed to handle follow-up email" },
      { status: 500 }
    );
  }
}