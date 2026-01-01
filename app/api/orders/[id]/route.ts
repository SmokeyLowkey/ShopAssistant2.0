import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { hasRole } from "@/lib/auth"
import { Prisma, PrismaClient, OrderStatus, Priority } from "@prisma/client"

// Type for transaction prisma client
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// Validation schema for order item update
const orderItemUpdateSchema = z.object({
  id: z.string().optional(), // Existing item ID, if updating
  partId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  isReceived: z.boolean().optional(),
  quantityReceived: z.number().int().optional(),
  receivedDate: z.string().datetime().optional().nullable(),
  // New fulfillment fields
  availability: z.enum(['IN_STOCK', 'BACKORDERED', 'SPECIAL_ORDER', 'UNKNOWN']).optional(),
  fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY', 'SPLIT']).optional(),
  trackingNumber: z.string().optional().nullable(),
  expectedDelivery: z.string().datetime().optional().nullable(),
  actualDelivery: z.string().datetime().optional().nullable(),
})

// Validation schema for updating an order
const updateOrderSchema = z.object({
  orderNumber: z.string().min(3, "Order number must be at least 3 characters").optional(),
  supplierId: z.string().optional(),
  vehicleId: z.string().optional().nullable(),
  status: z.nativeEnum(OrderStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  expectedDelivery: z.string().datetime().optional().nullable(),
  actualDelivery: z.string().datetime().optional().nullable(),
  
  // Financial
  subtotal: z.number().positive().optional(),
  tax: z.number().optional().nullable(),
  shipping: z.number().optional().nullable(),
  total: z.number().positive().optional(),
  
  // Shipping & Fulfillment
  trackingNumber: z.string().optional().nullable(),
  shippingMethod: z.string().optional().nullable(),
  shippingAddress: z.record(z.any()).optional().nullable(),
  fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY', 'SPLIT']).optional(),
  partialFulfillment: z.boolean().optional(),
  pickupLocation: z.string().optional().nullable(),
  pickupDate: z.string().datetime().optional().nullable(),
  shippingCarrier: z.string().optional().nullable(),
  
  // Notes
  notes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  
  // Order items
  orderItems: z.array(orderItemUpdateSchema).optional(),
  
  // Items to remove
  removeItems: z.array(z.string()).optional(),
})

/**
 * GET /api/orders/[id]
 * Get a specific order by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to read orders
    const canReadOrders = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN", "USER"])
    
    if (!canReadOrders) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Await params
    const { id } = await params
    
    // Get the order
    const order = await prisma.order.findUnique({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        supplier: {
          select: {
            id: true,
            supplierId: true,
            name: true,
            type: true,
            contactPerson: true,
            email: true,
            phone: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            vehicleId: true,
            make: true,
            model: true,
            year: true,
            type: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        orderItems: {
          include: {
            part: {
              select: {
                id: true,
                partNumber: true,
                description: true,
                category: true,
                subcategory: true,
                price: true,
                stockQuantity: true,
              },
            },
          },
        },
        emailThread: true,
      },
    })
    
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // DEBUG: Log order timestamps
    console.log('=== API ORDER TIMESTAMPS DEBUG ===');
    console.log('orderDate:', order.orderDate);
    console.log('orderDate type:', typeof order.orderDate);
    console.log('orderDate toISOString:', order.orderDate.toISOString());
    console.log('createdAt:', order.createdAt);
    console.log('createdAt type:', typeof order.createdAt);
    console.log('createdAt toISOString:', order.createdAt.toISOString());

    // Raw query to verify actual database values
    const rawOrder = await prisma.$queryRaw`
      SELECT "orderDate", "createdAt"
      FROM orders
      WHERE id = ${id}
    `;
    console.log('=== RAW QUERY RESULT ===');
    console.log('Raw query result:', rawOrder);

    return NextResponse.json(order)
  } catch (error) {
    console.error("Error fetching order:", error)
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/orders/[id]
 * Update a specific order
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to update orders
    const canUpdateOrders = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN"])
    
    if (!canUpdateOrders) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Await params
    const { id } = await params
    
    // Check if order exists and belongs to the user's organization
    const existingOrder = await prisma.order.findUnique({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        orderItems: true,
      },
    })
    
    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateOrderSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const data = validationResult.data
    
    // Check if orderNumber is being updated and if it already exists
    if (data.orderNumber && data.orderNumber !== existingOrder.orderNumber) {
      const orderWithSameNumber = await prisma.order.findUnique({
        where: {
          organizationId_orderNumber: {
            organizationId: session.user.organizationId,
            orderNumber: data.orderNumber,
          },
        },
      })
      
      if (orderWithSameNumber) {
        return NextResponse.json(
          { error: "Order number already exists in your organization" },
          { status: 400 }
        )
      }
    }
    
    // Verify supplier exists and belongs to the organization if provided
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: data.supplierId,
          organizationId: session.user.organizationId,
        },
      })
      
      if (!supplier) {
        return NextResponse.json(
          { error: "Supplier not found or not in your organization" },
          { status: 400 }
        )
      }
    }
    
    // Verify vehicle exists and belongs to the organization if provided
    if (data.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: data.vehicleId,
          organizationId: session.user.organizationId,
        },
      })
      
      if (!vehicle) {
        return NextResponse.json(
          { error: "Vehicle not found or not in your organization" },
          { status: 400 }
        )
      }
    }
    
    // Verify all parts exist and belong to the organization if adding/updating items
    if (data.orderItems && data.orderItems.length > 0) {
      const partIds = data.orderItems.map(item => item.partId)
      const parts = await prisma.part.findMany({
        where: {
          id: { in: partIds },
          organizationId: session.user.organizationId,
        },
      })
      
      if (parts.length !== partIds.length) {
        return NextResponse.json(
          { error: "One or more parts not found or not in your organization" },
          { status: 400 }
        )
      }
    }
    
    // Update order in a transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Prepare update data
      const updateData: Record<string, any> = {};
      
      // Add fields to update data
      if (data.orderNumber) updateData.orderNumber = data.orderNumber;
      if (data.supplierId) updateData.supplierId = data.supplierId;
      if ('vehicleId' in data) updateData.vehicleId = data.vehicleId;
      if (data.status) updateData.status = data.status;
      if (data.priority) updateData.priority = data.priority;
      
      if (data.expectedDelivery !== undefined) {
        updateData.expectedDelivery = data.expectedDelivery ? new Date(data.expectedDelivery) : null;
      }
      
      if (data.actualDelivery !== undefined) {
        updateData.actualDelivery = data.actualDelivery ? new Date(data.actualDelivery) : null;
      }
      
      if (data.subtotal !== undefined) {
        updateData.subtotal = new Prisma.Decimal(data.subtotal);
      }
      
      if (data.tax !== undefined) {
        updateData.tax = data.tax !== null ? new Prisma.Decimal(data.tax) : null;
      }
      
      if (data.shipping !== undefined) {
        updateData.shipping = data.shipping !== null ? new Prisma.Decimal(data.shipping) : null;
      }
      
      if (data.total !== undefined) {
        updateData.total = new Prisma.Decimal(data.total);
      }
      
      if ('trackingNumber' in data) updateData.trackingNumber = data.trackingNumber;
      if ('shippingMethod' in data) updateData.shippingMethod = data.shippingMethod;
      if ('shippingAddress' in data) updateData.shippingAddress = data.shippingAddress;
      if ('notes' in data) updateData.notes = data.notes;
      if ('internalNotes' in data) updateData.internalNotes = data.internalNotes;
      
      // New fulfillment fields
      if ('fulfillmentMethod' in data) updateData.fulfillmentMethod = data.fulfillmentMethod;
      if ('partialFulfillment' in data) updateData.partialFulfillment = data.partialFulfillment;
      if ('pickupLocation' in data) updateData.pickupLocation = data.pickupLocation;
      if ('shippingCarrier' in data) updateData.shippingCarrier = data.shippingCarrier;
      
      if (data.pickupDate !== undefined) {
        updateData.pickupDate = data.pickupDate ? new Date(data.pickupDate) : null;
      }
      
      // Update the order
      const updatedOrder = await tx.order.update({
        where: {
          id,
        },
        data: updateData,
      })
      
      // Handle order items if provided
      if (data.orderItems && data.orderItems.length > 0) {
        for (const item of data.orderItems) {
          if (item.id) {
            // Update existing item
            const existingItem = existingOrder.orderItems.find(i => i.id === item.id)
            
            if (existingItem) {
              await tx.orderItem.update({
                where: { id: item.id },
                data: {
                  quantity: item.quantity,
                  unitPrice: new Prisma.Decimal(item.unitPrice),
                  totalPrice: new Prisma.Decimal(item.quantity * item.unitPrice),
                  isReceived: item.isReceived,
                  quantityReceived: item.quantityReceived,
                  receivedDate: item.receivedDate ? new Date(item.receivedDate) : null,
                  // New fulfillment fields
                  availability: item.availability,
                  fulfillmentMethod: item.fulfillmentMethod,
                  trackingNumber: item.trackingNumber,
                  expectedDelivery: item.expectedDelivery ? new Date(item.expectedDelivery) : null,
                  actualDelivery: item.actualDelivery ? new Date(item.actualDelivery) : null,
                },
              })
            }
          } else {
            // Create new item
            await tx.orderItem.create({
              data: {
                orderId: id,
                partId: item.partId,
                quantity: item.quantity,
                unitPrice: new Prisma.Decimal(item.unitPrice),
                totalPrice: new Prisma.Decimal(item.quantity * item.unitPrice),
                isReceived: item.isReceived || false,
                quantityReceived: item.quantityReceived || 0,
                receivedDate: item.receivedDate ? new Date(item.receivedDate) : null,
                // New fulfillment fields
                availability: item.availability || 'UNKNOWN',
                fulfillmentMethod: item.fulfillmentMethod,
                trackingNumber: item.trackingNumber,
                expectedDelivery: item.expectedDelivery ? new Date(item.expectedDelivery) : null,
                actualDelivery: item.actualDelivery ? new Date(item.actualDelivery) : null,
              },
            })
          }
        }
      }
      
      // Remove items if specified
      if (data.removeItems && data.removeItems.length > 0) {
        await tx.orderItem.deleteMany({
          where: {
            id: { in: data.removeItems },
            orderId: id,
          },
        })
      }
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "ORDER_CREATED", // Using ORDER_CREATED as there's no ORDER_UPDATED in ActivityType
          title: "Order updated",
          description: `Order ${updatedOrder.orderNumber} updated`,
          entityType: "Order",
          entityId: updatedOrder.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            orderNumber: updatedOrder.orderNumber,
            updatedFields: Object.keys(data),
          },
        },
      })
      
      // If status changed to DELIVERED, log delivery
      if (data.status === OrderStatus.DELIVERED && existingOrder.status !== OrderStatus.DELIVERED) {
        await tx.activityLog.create({
          data: {
            type: "ORDER_DELIVERED",
            title: "Order delivered",
            description: `Order ${updatedOrder.orderNumber} marked as delivered`,
            entityType: "Order",
            entityId: updatedOrder.id,
            userId: session.user.id,
            organizationId: session.user.organizationId,
            metadata: {
              orderNumber: updatedOrder.orderNumber,
              deliveryDate: data.actualDelivery || new Date().toISOString(),
            },
          },
        })
      }
      
      // Return the updated order with items
      return tx.order.findUnique({
        where: { id: updatedOrder.id },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          vehicle: updatedOrder.vehicleId ? {
            select: {
              id: true,
              vehicleId: true,
              make: true,
              model: true,
            },
          } : undefined,
          orderItems: {
            include: {
              part: {
                select: {
                  id: true,
                  partNumber: true,
                  description: true,
                },
              },
            },
          },
        },
      })
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error updating order:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/orders/[id]
 * Delete a specific order
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to delete orders
    const canDeleteOrders = await hasRole(["ADMIN"])
    
    if (!canDeleteOrders) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Await params
    const { id } = await params
    
    // Check if order exists and belongs to the user's organization
    const existingOrder = await prisma.order.findUnique({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })
    
    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    
    // Delete order in a transaction
    await prisma.$transaction(async (tx: TransactionClient) => {
      // Delete all order items
      await tx.orderItem.deleteMany({
        where: {
          orderId: id,
        },
      })
      
      // Delete the order
      await tx.order.delete({
        where: {
          id,
        },
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "ORDER_CREATED", // Using ORDER_CREATED as there's no ORDER_DELETED in ActivityType
          title: "Order deleted",
          description: `Order ${existingOrder.orderNumber} deleted`,
          entityType: "Order",
          entityId: id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            orderNumber: existingOrder.orderNumber,
          },
        },
      })
    })
    
    return NextResponse.json(
      { success: true, message: "Order deleted successfully" }
    )
  } catch (error) {
    console.error("Error deleting order:", error)
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    )
  }
}