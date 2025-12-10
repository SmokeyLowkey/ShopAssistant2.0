import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateOrderConfirmationEmail, OrderConfirmationRequest } from '@/lib/api/n8n-client';
import { z } from 'zod';

// Validation schema for the request body
const orderConfirmationSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  quoteRequestId: z.string(),
  supplier: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email("Valid supplier email is required"),
  }),
  items: z.array(
    z.object({
      partNumber: z.string(),
      description: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      totalPrice: z.number().positive(),
    })
  ).min(1, "At least one item is required"),
  orderDetails: z.object({
    totalAmount: z.number().positive(),
    currency: z.string(),
    paymentTerms: z.string(),
    deliveryAddress: z.string(),
    requestedDeliveryDate: z.string().optional(),
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
    const validationResult = orderConfirmationSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const orderData: OrderConfirmationRequest = validationResult.data;

    // Verify the order exists and belongs to the user's organization
    const order = await prisma.order.findUnique({
      where: {
        id: orderData.orderId,
        organizationId: session.user.organizationId,
      },
      include: {
        supplier: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or access denied' },
        { status: 404 }
      );
    }

    // Verify the quote request exists and is associated with the order
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: orderData.quoteRequestId,
        organizationId: session.user.organizationId,
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found or access denied' },
        { status: 404 }
      );
    }

    // Call the n8n webhook to generate the order confirmation email
    const emailResult = await generateOrderConfirmationEmail(orderData);

    // Find or create the email thread for this order
    let emailThread = await prisma.emailThread.findUnique({
      where: { quoteRequestId: quoteRequest.id },
    });

    if (!emailThread) {
      // Create a new email thread
      emailThread = await prisma.emailThread.create({
        data: {
          subject: emailResult.emailContent.subject,
          status: 'CONVERTED_TO_ORDER',
          organizationId: session.user.organizationId,
          supplierId: order.supplierId,
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
          status: 'CONVERTED_TO_ORDER',
          updatedAt: new Date(),
        },
      });
    }

    // Link the email thread to the order
    await prisma.order.update({
      where: { id: order.id },
      data: {
        emailThreadId: emailThread.id,
        quoteReference: quoteRequest.quoteNumber,
      },
    });

    // Create the email message
    const emailMessage = await prisma.emailMessage.create({
      data: {
        threadId: emailThread.id,
        direction: 'OUTBOUND',
        from: session.user.email,
        to: orderData.supplier.email,
        subject: emailResult.emailContent.subject,
        body: emailResult.emailContent.body,
        bodyHtml: emailResult.emailContent.bodyHtml,
        externalMessageId: emailResult.messageId,
      },
    });

    // If there's a purchase order attachment, create it
    if (emailResult.purchaseOrderAttachment) {
      await prisma.emailAttachment.create({
        data: {
          messageId: emailMessage.id,
          filename: emailResult.purchaseOrderAttachment.filename,
          contentType: emailResult.purchaseOrderAttachment.contentType,
          size: Buffer.from(emailResult.purchaseOrderAttachment.content, 'base64').length,
          path: `/attachments/${emailMessage.id}/${emailResult.purchaseOrderAttachment.filename}`,
        },
      });
    }

    // Update the quote request status
    await prisma.quoteRequest.update({
      where: { id: quoteRequest.id },
      data: {
        status: 'CONVERTED_TO_ORDER',
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        type: 'ORDER_CREATED',
        title: 'Order Confirmation Email Sent',
        description: `Order confirmation email sent for order ${order.orderNumber} to ${order.supplier.name}`,
        entityType: 'Order',
        entityId: order.id,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        metadata: {
          orderId: order.id,
          quoteRequestId: quoteRequest.id,
          supplierId: order.supplierId,
          emailThreadId: emailThread.id,
          emailMessageId: emailMessage.id,
          totalAmount: orderData.orderDetails.totalAmount,
          currency: orderData.orderDetails.currency,
          itemCount: orderData.items.length,
        },
      },
    });

    return NextResponse.json({
      success: true,
      emailContent: emailResult.emailContent,
      emailThreadId: emailThread.id,
      emailMessageId: emailMessage.id,
      purchaseOrderAttachment: emailResult.purchaseOrderAttachment ? {
        filename: emailResult.purchaseOrderAttachment.filename,
      } : null,
    });
  } catch (error) {
    console.error('Error generating order confirmation email:', error);
    return NextResponse.json(
      { error: 'Failed to generate order confirmation email' },
      { status: 500 }
    );
  }
}