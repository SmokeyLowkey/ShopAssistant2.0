import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateQuoteRequestEmail, QuoteRequestEmailData } from '@/lib/api/n8n-client';
import { z } from 'zod';

// Validation schema for the request body
const quoteRequestSchema = z.object({
  quoteRequestId: z.string().min(1, "Quote request ID is required"),
  supplier: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email("Valid supplier email is required"),
    contactPerson: z.string().optional(),
  }),
  items: z.array(
    z.object({
      partNumber: z.string(),
      description: z.string(),
      quantity: z.number().int().positive(),
    })
  ).min(1, "At least one item is required"),
  requirements: z.object({
    deliveryDate: z.string().optional(),
    specialInstructions: z.string().optional(),
    shippingMethod: z.string().optional(),
  }).optional(),
  organization: z.object({
    name: z.string(),
    contactInfo: z.string(),
  }),
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
    const validationResult = quoteRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    // Get the validated data
    const requestData = validationResult.data;

    // Verify the quote request exists and belongs to the user's organization
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: requestData.quoteRequestId,
        organizationId: session.user.organizationId,
      },
      include: {
        supplier: true,
        organization: true,
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found or access denied' },
        { status: 404 }
      );
    }

    // Create the complete QuoteRequestEmailData object with the quoteNumber
    const quoteRequestData: QuoteRequestEmailData = {
      quoteRequestId: requestData.quoteRequestId,
      quoteNumber: quoteRequest.quoteNumber,
      supplier: requestData.supplier,
      items: requestData.items,
      requirements: requestData.requirements,
      organization: {
        id: quoteRequest.organizationId,
        name: requestData.organization.name,
        contactInfo: requestData.organization.contactInfo
      }
    };

    // Call the n8n webhook to generate the quote request email
    const emailResult = await generateQuoteRequestEmail(quoteRequestData);

    // Create or update the email thread for this quote request
    let emailThread = await prisma.emailThread.findUnique({
      where: { quoteRequestId: quoteRequest.id },
    });

    if (!emailThread) {
      // Create a new email thread
      emailThread = await prisma.emailThread.create({
        data: {
          subject: emailResult.emailContent.subject,
          status: 'DRAFT',
          organizationId: session.user.organizationId,
          supplierId: quoteRequest.supplierId,
          quoteRequestId: quoteRequest.id,
          createdById: session.user.id,
        },
      });
    } else {
      // Update the existing email thread
      emailThread = await prisma.emailThread.update({
        where: { id: emailThread.id },
        data: {
          subject: emailResult.emailContent.subject,
          updatedAt: new Date(),
        },
      });
    }

    // Create the email message
    const emailMessage = await prisma.emailMessage.create({
      data: {
        threadId: emailThread.id,
        direction: 'OUTBOUND',
        from: quoteRequestData.organization.contactInfo,
        to: quoteRequestData.supplier.email,
        subject: emailResult.emailContent.subject,
        body: emailResult.emailContent.body,
        bodyHtml: emailResult.emailContent.bodyHtml,
        externalMessageId: emailResult.messageId,
      },
    });

    // Update the quote request status
    await prisma.quoteRequest.update({
      where: { id: quoteRequest.id },
      data: {
        status: 'SENT',
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        type: 'QUOTE_REQUESTED',
        title: 'Quote Request Email Generated',
        description: `Quote request ${quoteRequest.quoteNumber} email generated for ${quoteRequest.supplier.name}`,
        entityType: 'QuoteRequest',
        entityId: quoteRequest.id,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        metadata: {
          quoteRequestId: quoteRequest.id,
          supplierId: quoteRequest.supplierId,
          emailThreadId: emailThread.id,
          emailMessageId: emailMessage.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      emailContent: emailResult.emailContent,
      emailThreadId: emailThread.id,
      emailMessageId: emailMessage.id,
      suggestedFollowUp: emailResult.suggestedFollowUp,
    });
  } catch (error) {
    console.error('Error generating quote request email:', error);
    return NextResponse.json(
      { error: 'Failed to generate quote request email' },
      { status: 500 }
    );
  }
}