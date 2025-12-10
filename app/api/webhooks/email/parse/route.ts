import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { parseEmail, EmailParseRequest } from '@/lib/api/n8n-client';
import { z } from 'zod';
import { QuoteStatus } from '@prisma/client';

// Validation schema for the request body
const emailParseSchema = z.object({
  emailId: z.string(),
  threadId: z.string(),
  from: z.string().email("Valid sender email is required"),
  subject: z.string(),
  body: z.string(),
  bodyHtml: z.string().optional(),
  receivedAt: z.string(),
  attachments: z.array(
    z.object({
      filename: z.string(),
      contentType: z.string(),
      url: z.string(),
    })
  ).optional(),
  quoteRequestId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate the request body
    const body = await request.json();
    const validationResult = emailParseSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const emailData: EmailParseRequest = validationResult.data;

    // Verify the email thread exists and belongs to the user's organization
    const emailThread = await prisma.emailThread.findFirst({
      where: {
        externalThreadId: emailData.threadId,
        organizationId: session.user.organizationId,
      },
      include: {
        quoteRequest: true,
      },
    });

    if (!emailThread) {
      return NextResponse.json(
        { error: 'Email thread not found or access denied' },
        { status: 404 }
      );
    }

    // Call the n8n webhook to parse the email
    const parseResult = await parseEmail(emailData);
    
    // Save the N8N response to the database
    await prisma.n8nResponse.create({
      data: {
        quoteRequestId: emailThread.quoteRequestId || '',
        messageId: emailData.emailId,
        responseType: 'parse_email',
        responseData: JSON.parse(JSON.stringify(parseResult)) // Ensure data is JSON-serializable
      }
    });

    // Create the email message
    const emailMessage = await prisma.emailMessage.create({
      data: {
        threadId: emailThread.id,
        direction: 'INBOUND',
        from: emailData.from,
        to: "", // This would typically be the organization's email
        subject: emailData.subject,
        body: emailData.body,
        bodyHtml: emailData.bodyHtml,
        externalMessageId: emailData.emailId,
        receivedAt: new Date(emailData.receivedAt),
      },
    });

    // Create attachments if any
    if (emailData.attachments && emailData.attachments.length > 0) {
      for (const attachment of emailData.attachments) {
        await prisma.emailAttachment.create({
          data: {
            messageId: emailMessage.id,
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: 0, // This would be updated with the actual size after downloading
            path: attachment.url,
          },
        });
      }
    }

    // Handle threads that have been converted to orders
    if (emailThread.status === 'CONVERTED_TO_ORDER') {
      // Find the associated order
      const order = await prisma.order.findFirst({
        where: {
          emailThreadId: emailThread.id
        },
        include: {
          supplier: true,
        }
      });
      
      if (order) {
        // Update the email message with order context
        await prisma.emailMessage.update({
          where: { id: emailMessage.id },
          data: {
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              isPostConversion: true,
            },
          },
        });
        
        // Create an activity log entry for the order communication
        await prisma.activityLog.create({
          data: {
            type: 'SYSTEM_UPDATE',
            title: 'New communication on order',
            description: `New email received for order ${order.orderNumber}`,
            entityType: 'Order',
            entityId: order.id,
            userId: session.user.id,
            organizationId: session.user.organizationId,
            metadata: {
              emailThreadId: emailThread.id,
              emailMessageId: emailMessage.id,
              orderNumber: order.orderNumber,
              supplierName: order.supplier?.name || 'Unknown supplier',
              subject: emailData.subject,
            },
          },
        });
      }
    }

    // Update the email thread status
    await prisma.emailThread.update({
      where: { id: emailThread.id },
      data: {
        status: 'RESPONSE_RECEIVED',
        updatedAt: new Date(),
      },
    });

    // If this is a quote response, update the quote request
    if (emailThread.quoteRequest) {
      // Determine if this is a simple acknowledgment or a full quote response
      let newStatus: QuoteStatus;
      
      if (parseResult.extractedData.quoteItems.length > 0 ||
          parseResult.extractedData.totalAmount > 0 ||
          parseResult.confidence > 0.7) {
        // This appears to be a full quote response with pricing details
        newStatus = QuoteStatus.UNDER_REVIEW;
      } else {
        // This appears to be a simple acknowledgment without pricing details
        newStatus = QuoteStatus.RECEIVED;
      }
      
      // Update the quote request status
      await prisma.quoteRequest.update({
        where: { id: emailThread.quoteRequest.id },
        data: {
          status: newStatus,
          responseDate: new Date(),
          totalAmount: parseResult.extractedData.quoteItems.length > 0 ? parseResult.extractedData.totalAmount : undefined,
          notes: parseResult.extractedData.additionalNotes || emailThread.quoteRequest.notes,
          // Ensure pickListId is not accidentally set to an invalid value
          pickListId: emailThread.quoteRequest.pickListId || undefined,
        },
      });
      
      // Log that we updated the quote request status
      console.log(`Updated quote request ${emailThread.quoteRequest.id} status to ${newStatus}`);
      
      // Only process quote items if they were extracted
      if (parseResult.extractedData.quoteItems.length > 0) {
        // Update or create quote request items
        for (const quoteItem of parseResult.extractedData.quoteItems) {
          // Try to find an existing item with the same part number
          const existingItem = await prisma.quoteRequestItem.findFirst({
            where: {
              quoteRequestId: emailThread.quoteRequest.id,
              partNumber: quoteItem.partNumber,
            },
          });

          if (existingItem) {
            // Update the existing item
            await prisma.quoteRequestItem.update({
              where: { id: existingItem.id },
              data: {
                unitPrice: quoteItem.unitPrice,
                totalPrice: quoteItem.totalPrice,
                supplierPartNumber: quoteItem.partNumber,
                leadTime: quoteItem.leadTime ? parseInt(quoteItem.leadTime) : null,
                notes: quoteItem.availability || existingItem.notes,
              },
            });
          } else {
            // Create a new item
            await prisma.quoteRequestItem.create({
              data: {
                quoteRequestId: emailThread.quoteRequest.id,
                partNumber: quoteItem.partNumber,
                description: quoteItem.description,
                quantity: quoteItem.quantity,
                unitPrice: quoteItem.unitPrice,
                totalPrice: quoteItem.totalPrice,
                supplierPartNumber: quoteItem.partNumber,
                leadTime: quoteItem.leadTime ? parseInt(quoteItem.leadTime) : null,
                notes: quoteItem.availability,
              },
            });
          }
        }
        
        // Log the activity
        await prisma.activityLog.create({
          data: {
            type: 'QUOTE_RECEIVED',
            title: 'Quote Response Received',
            description: `Quote response received for ${emailThread.quoteRequest.quoteNumber}`,
            entityType: 'QuoteRequest',
            entityId: emailThread.quoteRequest.id,
            userId: session.user.id,
            organizationId: session.user.organizationId,
            metadata: {
              quoteRequestId: emailThread.quoteRequest.id,
              emailThreadId: emailThread.id,
              emailMessageId: emailMessage.id,
              confidence: parseResult.confidence,
              totalAmount: parseResult.extractedData.totalAmount,
              currency: parseResult.extractedData.currency,
              itemCount: parseResult.extractedData.quoteItems.length,
            },
          },
        });
      } // Close the if (parseResult.extractedData.quoteItems.length > 0) block
    }

    return NextResponse.json({
      success: true,
      extractedData: parseResult.extractedData,
      confidence: parseResult.confidence,
      suggestedActions: parseResult.suggestedActions,
      emailMessageId: emailMessage.id,
    });
  } catch (error) {
    console.error('Error parsing email:', error);
    return NextResponse.json(
      { error: 'Failed to parse email' },
      { status: 500 }
    );
  }
}