import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { hasRole } from "@/lib/auth"
import { Prisma, PrismaClient, OrderStatus, Priority } from "@prisma/client"

// Type for transaction prisma client
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// Validation schema for order item
const orderItemSchema = z.object({
  partId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
})

// Validation schema for creating an order
const createOrderSchema = z.object({
  orderNumber: z.string().min(3, "Order number must be at least 3 characters").optional(),
  supplierId: z.string(),
  vehicleId: z.string().optional(),
  status: z.nativeEnum(OrderStatus).default(OrderStatus.PENDING),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  expectedDelivery: z.string().datetime().optional(),
  
  // Financial
  subtotal: z.number().positive(),
  tax: z.number().optional(),
  shipping: z.number().optional(),
  total: z.number().positive(),
  
  // Shipping
  trackingNumber: z.string().optional(),
  shippingMethod: z.string().optional(),
  shippingAddress: z.record(z.any()).optional(),
  
  // Notes
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  
  // Order items
  orderItems: z.array(orderItemSchema).min(1, "At least one order item is required"),
})

// Validation schema for filtering orders
const filterOrderSchema = z.object({
  orderNumber: z.string().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  supplierId: z.string().optional(),
  vehicleId: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  minTotal: z.number().optional(),
  maxTotal: z.number().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

type FilterOrderParams = z.infer<typeof filterOrderSchema>

/**
 * GET /api/orders
 * Get all orders for the current organization with filtering and pagination
 */
export async function GET(request: Request) {
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
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params: Record<string, any> = {}
    
    // Convert search params to object
    searchParams.forEach((value, key) => {
      // Convert numeric values
      if (["minTotal", "maxTotal", "page", "limit"].includes(key)) {
        params[key] = parseFloat(value)
      } else {
        params[key] = value
      }
    })
    
    // Validate and parse filter parameters
    const filterParams = filterOrderSchema.parse(params)
    
    // Build the where clause for filtering
    const where: any = {
      organizationId: session.user.organizationId,
    }
    
    // Apply filters
    if (filterParams.orderNumber) {
      where.orderNumber = { contains: filterParams.orderNumber, mode: "insensitive" }
    }
    
    if (filterParams.status) {
      where.status = filterParams.status
    }
    
    if (filterParams.priority) {
      where.priority = filterParams.priority
    }
    
    if (filterParams.supplierId) {
      where.supplierId = filterParams.supplierId
    }
    
    if (filterParams.vehicleId) {
      where.vehicleId = filterParams.vehicleId
    }
    
    if (filterParams.fromDate) {
      where.orderDate = { ...where.orderDate, gte: new Date(filterParams.fromDate) }
    }
    
    if (filterParams.toDate) {
      where.orderDate = { ...where.orderDate, lte: new Date(filterParams.toDate) }
    }
    
    if (filterParams.minTotal !== undefined) {
      where.total = { ...where.total, gte: new Prisma.Decimal(filterParams.minTotal) }
    }
    
    if (filterParams.maxTotal !== undefined) {
      where.total = { ...where.total, lte: new Prisma.Decimal(filterParams.maxTotal) }
    }
    
    // Search across multiple fields
    if (filterParams.search) {
      where.OR = [
        { orderNumber: { contains: filterParams.search, mode: "insensitive" } },
        { trackingNumber: { contains: filterParams.search, mode: "insensitive" } },
        { notes: { contains: filterParams.search, mode: "insensitive" } },
      ]
    }
    
    // Calculate pagination
    const skip = (filterParams.page - 1) * filterParams.limit
    
    // Build the orderBy clause
    const orderBy: any = {}
    if (filterParams.sortBy) {
      orderBy[filterParams.sortBy] = filterParams.sortOrder
    } else {
      // Default sorting by order date
      orderBy.orderDate = "desc"
    }
    
    // Get total count for pagination
    const totalCount = await prisma.order.count({ where })
    
    // Get orders with pagination, sorting, and filtering
    const orders = await prisma.order.findMany({
      where,
      skip,
      take: filterParams.limit,
      orderBy,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            vehicleId: true,
            make: true,
            model: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    })
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filterParams.limit)
    const hasNextPage = filterParams.page < totalPages
    const hasPreviousPage = filterParams.page > 1
    
    return NextResponse.json({
      data: orders,
      meta: {
        totalCount,
        page: filterParams.page,
        limit: filterParams.limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    })
  } catch (error) {
    console.error("Error fetching orders:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/orders
 * Create a new order
 */
export async function POST(request: Request) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to create orders
    const canCreateOrders = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN"])
    
    if (!canCreateOrders) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = createOrderSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const data = validationResult.data
    
    // Generate order number if not provided
    const orderNumber = data.orderNumber || await generateOrderNumber(session.user.organizationId)
    
    // Check if order number already exists in this organization
    if (data.orderNumber) {
      const existingOrder = await prisma.order.findUnique({
        where: {
          organizationId_orderNumber: {
            organizationId: session.user.organizationId,
            orderNumber: data.orderNumber,
          },
        },
      })
      
      if (existingOrder) {
        return NextResponse.json(
          { error: "Order number already exists in your organization" },
          { status: 400 }
        )
      }
    }
    
    // Verify supplier exists and belongs to the organization
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
    
    // Verify all parts exist and belong to the organization
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
    
    // Create order in a transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Convert decimal values
      const subtotalDecimal = new Prisma.Decimal(data.subtotal)
      const taxDecimal = data.tax !== undefined ? new Prisma.Decimal(data.tax) : null
      const shippingDecimal = data.shipping !== undefined ? new Prisma.Decimal(data.shipping) : null
      const totalDecimal = new Prisma.Decimal(data.total)
      
      // Handle JSON fields
      const shippingAddressJson = data.shippingAddress || undefined
      
      // Create the order
      const order = await tx.order.create({
        data: {
          orderNumber,
          status: data.status,
          priority: data.priority,
          expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
          subtotal: subtotalDecimal,
          tax: taxDecimal,
          shipping: shippingDecimal,
          total: totalDecimal,
          trackingNumber: data.trackingNumber,
          shippingMethod: data.shippingMethod,
          shippingAddress: shippingAddressJson,
          notes: data.notes,
          internalNotes: data.internalNotes,
          supplierId: data.supplierId,
          vehicleId: data.vehicleId,
          createdById: session.user.id,
          organizationId: session.user.organizationId,
        },
      })
      
      // Create order items
      for (const item of data.orderItems) {
        const unitPriceDecimal = new Prisma.Decimal(item.unitPrice)
        const totalPriceDecimal = new Prisma.Decimal(item.quantity * item.unitPrice)
        
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            partId: item.partId,
            quantity: item.quantity,
            unitPrice: unitPriceDecimal,
            totalPrice: totalPriceDecimal,
          },
        })
      }
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "ORDER_CREATED",
          title: "Order created",
          description: `Order ${orderNumber} created for supplier ${supplier.name}`,
          entityType: "Order",
          entityId: order.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            orderNumber,
            supplierId: data.supplierId,
            supplierName: supplier.name,
            total: data.total,
            itemCount: data.orderItems.length,
          },
        },
      })
      
      // Return the created order with items
      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          vehicle: data.vehicleId ? {
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
    
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Error creating order:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    )
  }
}

/**
 * Generate a unique order number
 */
async function generateOrderNumber(organizationId: string): Promise<string> {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  
  // Get the count of orders for this organization in the current year
  const orderCount = await prisma.order.count({
    where: {
      organizationId,
      orderDate: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  })
  
  // Generate order number in format ORD-YYYY-MM-XXXX
  const sequenceNumber = String(orderCount + 1).padStart(4, '0')
  return `ORD-${year}-${month}-${sequenceNumber}`
}