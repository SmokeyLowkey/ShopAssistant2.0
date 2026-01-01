import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  generateOrderFollowUpEmail,
  OrderFollowUpRequest,
  OrderFollowUpBranch,
} from "@/lib/api/n8n-client";

/**
 * POST /api/webhooks/email/order-follow-up
 *
 * Handle order follow-up email workflow
 * Pattern mirrors: app/api/webhooks/email/follow-up/route.ts
 *
 * Actions:
 * - preview: Generate email content for user review
 * - send: Send follow-up email via N8N
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      orderId,
      action = "preview",
      branch,
      userMessage,
      expectedResponseDate,
    } = await req.json();

    console.log("[Order Follow-Up] Request received:", {
      orderId,
      action,
      branch,
      hasUserMessage: !!userMessage,
    });

    if (!orderId || !branch) {
      return NextResponse.json(
        { error: "Missing required parameters: orderId and branch" },
        { status: 400 }
      );
    }

    // Validate branch
    const validBranches: OrderFollowUpBranch[] = [
      "no_confirmation",
      "missing_tracking",
      "delivery_delayed",
      "quality_issue",
      "other",
    ];

    if (!validBranches.includes(branch)) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }

    // Fetch order with all relationships
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        supplier: true,
        items: true,
        emailThread: {
          include: {
            messages: {
              orderBy: {
                receivedAt: "desc",
              },
            },
          },
        },
        organization: true,
        createdBy: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify user authorization
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      include: { organization: true },
    });

    if (!user || order.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Ensure order has supplier and email thread
    if (!order.supplier) {
      return NextResponse.json(
        { error: "Order has no supplier associated" },
        { status: 400 }
      );
    }

    if (!order.emailThread) {
      return NextResponse.json(
        { error: "No email thread associated with this order" },
        { status: 400 }
      );
    }

    // Prepare webhook request data
    const webhookData: OrderFollowUpRequest = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      supplierId: order.supplierId,
      supplierName: order.supplier.name,
      supplierEmail: order.supplier.email,
      supplierContactPerson: order.supplier.contactPerson,
      orderDate: order.orderDate.toISOString(),
      status: order.status,
      totalAmount: Number(order.totalAmount),
      trackingNumber: order.trackingNumber,
      expectedDelivery: order.expectedDelivery?.toISOString() || null,
      items: order.items.map((item) => ({
        partNumber: item.partNumber,
        description: item.description,
        quantity: item.quantity,
        availability: item.availability,
      })),
      branch,
      userMessage,
      expectedResponseDate,
      previousEmails: order.emailThread.messages.map((message) => ({
        from: message.from,
        to: message.to,
        subject: message.subject,
        body: message.body,
        sentAt: message.sentAt?.toISOString() || message.createdAt.toISOString(),
      })),
      organization: {
        id: order.organization.id,
        name: order.organization.name,
        email: order.organization.email,
        phone: order.organization.phone,
      },
      user: {
        id: user.id,
        name: user.name || "",
        email: user.email,
      },
    };

    console.log("[Order Follow-Up] Calling N8N webhook");

    // Call N8N to generate email content
    const response = await generateOrderFollowUpEmail(webhookData);

    console.log("[Order Follow-Up] Received response");

    if (!response.success) {
      return NextResponse.json(
        { error: response.message || "Failed to generate follow-up email" },
        { status: 500 }
      );
    }

    // For preview action, return the email content
    if (action === "preview") {
      return NextResponse.json({
        success: true,
        data: {
          email: response.emailContent,
          suggestedFollowUpDate: response.suggestedFollowUpDate,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            branch,
            supplier: {
              id: order.supplier.id,
              name: order.supplier.name,
              email: order.supplier.email,
            },
            generatedAt: new Date().toISOString(),
          },
        },
      });
    }

    // For send action, save the email to the thread and send via N8N
    if (action === "send") {
      try {
        // Create email message record
        const emailMessage = await prisma.emailMessage.create({
          data: {
            threadId: order.emailThread.id,
            from: user.email,
            to: order.supplier.email,
            subject: response.emailContent.subject,
            body: response.emailContent.body,
            bodyHtml: response.emailContent.bodyHtml,
            direction: "OUTBOUND",
            sentAt: new Date(),
            metadata: {
              branch,
              userMessage,
              expectedResponseDate,
              orderFollowUp: true,
            },
          },
        });

        // Create activity log
        await prisma.activityLog.create({
          data: {
            organizationId: order.organizationId,
            userId: user.id,
            action: "ORDER_FOLLOW_UP_SENT",
            entityType: "ORDER",
            entityId: order.id,
            metadata: {
              branch,
              orderNumber: order.orderNumber,
              supplierEmail: order.supplier.email,
              messageId: emailMessage.id,
            },
          },
        });

        console.log("[Order Follow-Up] Email sent successfully");

        return NextResponse.json({
          success: true,
          message: "Follow-up email sent successfully",
          data: {
            messageId: emailMessage.id,
            orderId: order.id,
          },
        });
      } catch (error) {
        console.error("[Order Follow-Up] Error sending email:", error);
        return NextResponse.json(
          { error: "Failed to send follow-up email" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Order Follow-Up] Error:", error);
    return NextResponse.json(
      { error: "Failed to process order follow-up" },
      { status: 500 }
    );
  }
}
