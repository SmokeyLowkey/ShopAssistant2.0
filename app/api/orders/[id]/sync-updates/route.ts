import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { postOrderWebhook } from "@/lib/api/n8n-client";
import { OrderStatus } from "@prisma/client";

/**
 * POST /api/orders/[id]/sync-updates
 *
 * Manually sync order updates by calling N8N webhook to parse email thread
 * for tracking numbers, delivery dates, and status updates.
 *
 * Pattern mirrors: app/api/quote-requests/[id]/prices/route.ts
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orderId } = await params;

    console.log('[Sync Updates API] Request received:', { orderId });

    // Fetch order with all relationships
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        supplier: true,
        orderItems: true,
        emailThread: {
          include: {
            messages: {
              orderBy: {
                receivedAt: 'desc',
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

    // Ensure order has an email thread
    if (!order.emailThread) {
      return NextResponse.json(
        { error: "No email thread associated with this order" },
        { status: 400 }
      );
    }

    // Filter messages to only include those AFTER order creation (post-conversion)
    // These are the messages from supplier after the order was placed
    // Use sentAt or receivedAt (actual email timestamp), NOT createdAt (database insertion time)
    // Use order.createdAt (DATETIME) instead of order.orderDate (DATE) for precise filtering
    const orderCreationDate = new Date(order.createdAt);
    const postConversionMessages = order.emailThread.messages.filter((message) => {
      const messageDate = new Date(message.sentAt || message.receivedAt || message.createdAt);
      return messageDate > orderCreationDate;
    });

    console.log('[Sync Updates API] Message filtering:', {
      orderDate: orderCreationDate.toISOString(),
      totalMessages: order.emailThread.messages.length,
      postConversionMessages: postConversionMessages.length,
    });

    // Prepare webhook payload with ALL updatable order fields
    const webhookData = {
      // Order identification
      orderId: order.id,
      orderNumber: order.orderNumber,
      supplierId: order.supplierId,

      // Order dates
      orderDate: order.orderDate.toISOString(),

      // Current order status and details
      status: order.status,
      totalAmount: Number(order.totalAmount),
      subtotal: order.subtotal ? Number(order.subtotal) : null,
      tax: order.tax ? Number(order.tax) : null,
      shipping: order.shipping ? Number(order.shipping) : null,

      // Fulfillment information
      fulfillmentMethod: order.fulfillmentMethod || 'UNKNOWN',
      partialFulfillment: order.partialFulfillment || false,

      // Pickup details (if applicable)
      pickupLocation: order.pickupLocation,
      pickupDate: order.pickupDate?.toISOString() || null,
      pickupInstructions: order.pickupInstructions,

      // Current tracking information
      currentTracking: {
        trackingNumber: order.trackingNumber,
        shippingCarrier: order.shippingCarrier,
        expectedDelivery: order.expectedDelivery?.toISOString() || null,
        actualDelivery: order.actualDelivery?.toISOString() || null,
      },

      // Supplier information
      supplier: {
        id: order.supplier.id,
        name: order.supplier.name,
        email: order.supplier.email,
        contactPerson: order.supplier.contactPerson,
      },

      // Email thread - ONLY post-conversion messages, NO attachment content
      emailThread: {
        id: order.emailThread.id,
        messages: postConversionMessages.map((message) => ({
          id: message.id,
          from: message.from,
          to: message.to,
          subject: message.subject,
          body: message.body, // Message body included for AI to parse
          bodyHtml: message.bodyHtml, // HTML version if available
          sentAt: message.sentAt?.toISOString() || message.createdAt.toISOString(),
          receivedAt: message.receivedAt?.toISOString() || null,
          direction: message.direction,
          // NOTE: Attachments metadata included but NOT content
          hasAttachments: message.metadata?.attachments?.length > 0 || false,
        })),
      },

      // Order items with current tracking state
      items: order.orderItems.map((item) => ({
        id: item.id,
        partNumber: item.partNumber,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,

        // Item fulfillment details
        fulfillmentMethod: item.fulfillmentMethod,
        availability: item.availability,

        // Current item tracking
        currentTracking: {
          trackingNumber: item.trackingNumber,
          expectedDelivery: item.expectedDelivery?.toISOString() || null,
          actualDelivery: item.actualDelivery?.toISOString() || null,
        },

        // Supplier notes (may contain tracking info)
        supplierNotes: item.supplierNotes,
      })),

      // Organization context
      organization: {
        id: order.organization.id,
        name: order.organization.name,
      },

      // User context (who triggered the sync)
      user: {
        id: user.id,
        name: user.name || '',
        email: user.email,
      },
    };

    console.log('[Sync Updates API] Calling N8N webhook with:', {
      orderId,
      orderNumber: order.orderNumber,
      messageCount: webhookData.emailThread.messages.length,
      itemCount: webhookData.items.length,
    });

    // Call N8N webhook
    const response = await postOrderWebhook(webhookData);

    console.log('[Sync Updates API] Received response:', response);

    if (!response.success) {
      return NextResponse.json(
        { error: response.message || "Failed to sync order updates" },
        { status: 500 }
      );
    }

    let updateCount = 0;

    // Apply order-level updates if provided
    if (response.orderUpdates) {
      const orderUpdateData: any = {};

      if (response.orderUpdates.trackingNumber) {
        orderUpdateData.trackingNumber = response.orderUpdates.trackingNumber;
        updateCount++;
      }

      if (response.orderUpdates.shippingCarrier) {
        orderUpdateData.shippingCarrier = response.orderUpdates.shippingCarrier;
        updateCount++;
      }

      if (response.orderUpdates.expectedDelivery) {
        const newExpectedDelivery = new Date(response.orderUpdates.expectedDelivery);

        // Only update if newer or different from current
        if (!order.expectedDelivery || newExpectedDelivery.getTime() !== order.expectedDelivery.getTime()) {
          orderUpdateData.expectedDelivery = newExpectedDelivery;
          updateCount++;
        }
      }

      // Status update validation: don't downgrade
      if (response.orderUpdates.status) {
        const statusHierarchy: OrderStatus[] = [
          OrderStatus.PENDING,
          OrderStatus.PROCESSING,
          OrderStatus.IN_TRANSIT,
          OrderStatus.DELIVERED,
          OrderStatus.CANCELLED,
        ];

        const currentStatusIndex = statusHierarchy.indexOf(order.status);
        const newStatusIndex = statusHierarchy.indexOf(response.orderUpdates.status as OrderStatus);

        // Only update if new status is higher in hierarchy (or CANCELLED)
        if (
          newStatusIndex > currentStatusIndex ||
          response.orderUpdates.status === OrderStatus.CANCELLED
        ) {
          orderUpdateData.status = response.orderUpdates.status;
          updateCount++;
        }
      }

      // Apply order updates if any
      if (Object.keys(orderUpdateData).length > 0) {
        await prisma.order.update({
          where: { id: orderId },
          data: orderUpdateData,
        });
      }
    }

    // Apply item-level updates if provided
    if (response.itemUpdates && response.itemUpdates.length > 0) {
      const itemUpdatePromises = response.itemUpdates.map(async (itemUpdate) => {
        const updateData: any = {};

        if (itemUpdate.trackingNumber) {
          updateData.trackingNumber = itemUpdate.trackingNumber;
        }

        if (itemUpdate.expectedDelivery) {
          updateData.expectedDelivery = new Date(itemUpdate.expectedDelivery);
        }

        if (itemUpdate.availability) {
          updateData.availability = itemUpdate.availability;
        }

        if (Object.keys(updateData).length > 0) {
          updateCount++;
          return prisma.orderItem.update({
            where: { id: itemUpdate.id },
            data: updateData,
          });
        }
      });

      await Promise.all(itemUpdatePromises.filter(Boolean));
    }

    // Create activity log
    await prisma.activityLog.create({
      data: {
        type: 'SYSTEM_UPDATE',
        title: 'Order Tracking Updated',
        description: `Order ${order.orderNumber} tracking information synced from supplier emails (${updateCount} update(s))`,
        organizationId: order.organizationId,
        userId: user.id,
        entityType: 'ORDER',
        entityId: order.id,
        metadata: {
          source: 'manual_sync',
          updateCount,
          orderNumber: order.orderNumber,
          hasOrderUpdates: !!response.orderUpdates,
          hasItemUpdates: !!response.itemUpdates,
          itemUpdateCount: response.itemUpdates?.length || 0,
        },
      },
    });

    // Fetch updated order
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        supplier: true,
        orderItems: true,
        emailThread: {
          include: {
            messages: {
              orderBy: {
                receivedAt: 'desc',
              },
            },
          },
        },
        organization: true,
        createdBy: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${updateCount} update(s)`,
      updateCount,
      order: updatedOrder,
      supplierMessages: response.supplierMessages,
      suggestedActions: response.suggestedActions,
    });
  } catch (error) {
    console.error('[Sync Updates API] Error:', error);
    return NextResponse.json(
      { error: "Failed to sync order updates" },
      { status: 500 }
    );
  }
}
