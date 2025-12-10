import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { hasRole } from "@/lib/auth"
import { Prisma, PrismaClient } from "@prisma/client"

// Type for transaction prisma client
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// Validation schema for creating a part
const createPartSchema = z.object({
  partNumber: z.string().min(3, "Part number must be at least 3 characters"),
  description: z.string().min(3, "Description must be at least 3 characters"),
  category: z.string().optional().nullable(),
  subcategory: z.string().optional().nullable(),
  
  // Pricing & Stock
  price: z.number().positive("Price must be positive"),
  cost: z.number().positive("Cost must be positive").optional().nullable(),
  stockQuantity: z.number().int().default(0),
  minStockLevel: z.number().int().default(0),
  maxStockLevel: z.number().int().optional().nullable(),
  
  // Physical Properties
  weight: z.number().positive().optional().nullable(),
  dimensions: z.record(z.any()).optional().nullable(),
  location: z.string().optional().nullable(),
  
  // Compatibility
  compatibility: z.record(z.any()).optional().nullable(),
  specifications: z.record(z.any()).optional().nullable(),
  
  // Status
  isActive: z.boolean().default(true),
  isObsolete: z.boolean().default(false),
})

// Validation schema for filtering parts
const filterPartSchema = z.object({
  partNumber: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minStock: z.number().int().optional(),
  maxStock: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isObsolete: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
})

type FilterPartParams = z.infer<typeof filterPartSchema>

/**
 * GET /api/parts
 * Get all parts for the current organization with filtering and pagination
 */
export async function GET(request: Request) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to read parts
    const canReadParts = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN", "USER"])
    
    if (!canReadParts) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params: Record<string, any> = {}
    
    // Convert search params to object
    searchParams.forEach((value, key) => {
      // Convert numeric values
      if (["minPrice", "maxPrice", "minStock", "maxStock", "page", "limit"].includes(key)) {
        params[key] = parseFloat(value)
      } else if (["isActive", "isObsolete"].includes(key)) {
        params[key] = value === "true"
      } else {
        params[key] = value
      }
    })
    
    // Validate and parse filter parameters
    const filterParams = filterPartSchema.parse(params)
    
    // Build the where clause for filtering
    const where: any = {
      organizationId: session.user.organizationId,
    }
    
    // Apply filters
    if (filterParams.partNumber) {
      where.partNumber = { contains: filterParams.partNumber, mode: "insensitive" }
    }
    
    if (filterParams.description) {
      where.description = { contains: filterParams.description, mode: "insensitive" }
    }
    
    if (filterParams.category) {
      where.category = { contains: filterParams.category, mode: "insensitive" }
    }
    
    if (filterParams.subcategory) {
      where.subcategory = { contains: filterParams.subcategory, mode: "insensitive" }
    }
    
    if (filterParams.minPrice !== undefined) {
      where.price = { ...where.price, gte: filterParams.minPrice }
    }
    
    if (filterParams.maxPrice !== undefined) {
      where.price = { ...where.price, lte: filterParams.maxPrice }
    }
    
    if (filterParams.minStock !== undefined) {
      where.stockQuantity = { ...where.stockQuantity, gte: filterParams.minStock }
    }
    
    if (filterParams.maxStock !== undefined) {
      where.stockQuantity = { ...where.stockQuantity, lte: filterParams.maxStock }
    }
    
    if (filterParams.isActive !== undefined) {
      where.isActive = filterParams.isActive
    }
    
    if (filterParams.isObsolete !== undefined) {
      where.isObsolete = filterParams.isObsolete
    }
    
    // Search across multiple fields
    if (filterParams.search) {
      where.OR = [
        { partNumber: { contains: filterParams.search, mode: "insensitive" } },
        { description: { contains: filterParams.search, mode: "insensitive" } },
        { category: { contains: filterParams.search, mode: "insensitive" } },
        { subcategory: { contains: filterParams.search, mode: "insensitive" } },
        { location: { contains: filterParams.search, mode: "insensitive" } },
      ]
    }
    
    // Calculate pagination
    const skip = (filterParams.page - 1) * filterParams.limit
    
    // Build the orderBy clause
    const orderBy: any = {}
    if (filterParams.sortBy) {
      orderBy[filterParams.sortBy] = filterParams.sortOrder
    } else {
      // Default sorting
      orderBy.createdAt = "desc"
    }
    
    // Get total count for pagination
    const totalCount = await prisma.part.count({ where })
    
    // Get parts with pagination, sorting, and filtering
    const parts = await prisma.part.findMany({
      where,
      skip,
      take: filterParams.limit,
      orderBy,
      include: {
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        _count: {
          select: {
            orderItems: true,
            maintenanceParts: true,
          },
        },
      },
    })
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filterParams.limit)
    const hasNextPage = filterParams.page < totalPages
    const hasPreviousPage = filterParams.page > 1
    
    return NextResponse.json({
      data: parts,
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
    console.error("Error fetching parts:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to fetch parts" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/parts
 * Create a new part
 */
export async function POST(request: Request) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to create parts
    const canCreateParts = await hasRole(["ADMIN", "MANAGER"])
    
    if (!canCreateParts) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = createPartSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const data = validationResult.data
    
    // Check if part number already exists in this organization
    const existingPart = await prisma.part.findUnique({
      where: {
        organizationId_partNumber: {
          organizationId: session.user.organizationId,
          partNumber: data.partNumber,
        },
      },
    })
    
    if (existingPart) {
      return NextResponse.json(
        { error: "Part number already exists in your organization" },
        { status: 400 }
      )
    }
    
    // Create part in a transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Convert price and cost to Prisma.Decimal
      const priceDecimal = new Prisma.Decimal(data.price)
      const costDecimal = data.cost ? new Prisma.Decimal(data.cost) : null
      const weightDecimal = data.weight ? new Prisma.Decimal(data.weight) : null
      
      // Handle JSON fields
      const dimensionsJson = data.dimensions ? data.dimensions : undefined
      const compatibilityJson = data.compatibility ? data.compatibility : undefined
      const specificationsJson = data.specifications ? data.specifications : undefined
      
      // Create the part
      const part = await tx.part.create({
        data: {
          partNumber: data.partNumber,
          description: data.description,
          category: data.category,
          subcategory: data.subcategory,
          price: priceDecimal,
          cost: costDecimal,
          stockQuantity: data.stockQuantity,
          minStockLevel: data.minStockLevel,
          maxStockLevel: data.maxStockLevel,
          weight: weightDecimal,
          dimensions: dimensionsJson,
          location: data.location,
          compatibility: compatibilityJson,
          specifications: specificationsJson,
          isActive: data.isActive,
          isObsolete: data.isObsolete,
          organizationId: session.user.organizationId,
        },
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "PART_LOW_STOCK", // Using PART_LOW_STOCK as there's no PART_ADDED in ActivityType
          title: "Part added",
          description: `Part ${data.partNumber} (${data.description}) added`,
          entityType: "Part",
          entityId: part.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            partNumber: data.partNumber,
            description: data.description,
            category: data.category,
          },
        },
      })
      
      return part
    })
    
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Error creating part:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to create part" },
      { status: 500 }
    )
  }
}