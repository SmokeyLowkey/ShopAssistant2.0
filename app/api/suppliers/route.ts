import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { hasRole } from "@/lib/auth"
import { Prisma, PrismaClient, SupplierType, SupplierStatus } from "@prisma/client"

// Type for transaction prisma client
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// Auxiliary email schema
const auxiliaryEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

// Validation schema for creating a supplier
const createSupplierSchema = z.object({
  supplierId: z.string().min(3, "Supplier ID must be at least 3 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  type: z.nativeEnum(SupplierType),
  status: z.nativeEnum(SupplierStatus).default(SupplierStatus.ACTIVE),
  
  // Contact Information
  contactPerson: z.string().optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url("Invalid URL").optional().nullable(),
  
  // Address
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  country: z.string().default("USA").optional().nullable(),
  
  // Performance Metrics
  rating: z.number().min(0).max(5).optional().nullable(),
  deliveryRating: z.number().min(0).max(5).optional().nullable(),
  qualityRating: z.number().min(0).max(5).optional().nullable(),
  avgDeliveryTime: z.number().int().optional().nullable(),
  
  // Business Information
  paymentTerms: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  certifications: z.array(z.string()).optional().nullable(),
  specialties: z.array(z.string()).optional().nullable(),
  
  // Auxiliary Emails
  auxiliaryEmails: z.array(auxiliaryEmailSchema).optional(),
})

// Validation schema for filtering suppliers
const filterSupplierSchema = z.object({
  supplierId: z.string().optional(),
  name: z.string().optional(),
  type: z.nativeEnum(SupplierType).optional(),
  status: z.nativeEnum(SupplierStatus).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  minRating: z.number().min(0).max(5).optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
})

type FilterSupplierParams = z.infer<typeof filterSupplierSchema>

/**
 * GET /api/suppliers
 * Get all suppliers for the current organization with filtering and pagination
 */
export async function GET(request: Request) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to read suppliers
    const canReadSuppliers = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN", "USER"])
    
    if (!canReadSuppliers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params: Record<string, any> = {}
    
    // Convert search params to object
    searchParams.forEach((value, key) => {
      // Convert numeric values
      if (["minRating", "page", "limit"].includes(key)) {
        params[key] = parseFloat(value)
      } else {
        params[key] = value
      }
    })
    
    // Validate and parse filter parameters
    const filterParams = filterSupplierSchema.parse(params)
    
    // Build the where clause for filtering
    const where: any = {
      organizationId: session.user.organizationId,
    }
    
    // Apply filters
    if (filterParams.supplierId) {
      where.supplierId = { contains: filterParams.supplierId, mode: "insensitive" }
    }
    
    if (filterParams.name) {
      where.name = { contains: filterParams.name, mode: "insensitive" }
    }
    
    if (filterParams.type) {
      where.type = filterParams.type
    }
    
    if (filterParams.status) {
      where.status = filterParams.status
    }
    
    if (filterParams.city) {
      where.city = { contains: filterParams.city, mode: "insensitive" }
    }
    
    if (filterParams.state) {
      where.state = { contains: filterParams.state, mode: "insensitive" }
    }
    
    if (filterParams.country) {
      where.country = { contains: filterParams.country, mode: "insensitive" }
    }
    
    if (filterParams.minRating !== undefined) {
      where.rating = { gte: filterParams.minRating }
    }
    
    // Search across multiple fields
    if (filterParams.search) {
      where.OR = [
        { supplierId: { contains: filterParams.search, mode: "insensitive" } },
        { name: { contains: filterParams.search, mode: "insensitive" } },
        { contactPerson: { contains: filterParams.search, mode: "insensitive" } },
        { email: { contains: filterParams.search, mode: "insensitive" } },
        { phone: { contains: filterParams.search, mode: "insensitive" } },
        { address: { contains: filterParams.search, mode: "insensitive" } },
        { city: { contains: filterParams.search, mode: "insensitive" } },
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
    const totalCount = await prisma.supplier.count({ where })
    
    // Get suppliers with pagination, sorting, and filtering
    const suppliers = await prisma.supplier.findMany({
      where,
      skip,
      take: filterParams.limit,
      orderBy,
      include: {
        _count: {
          select: {
            orders: true,
            parts: true,
          },
        },
      },
    })
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filterParams.limit)
    const hasNextPage = filterParams.page < totalPages
    const hasPreviousPage = filterParams.page > 1
    
    return NextResponse.json({
      data: suppliers,
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
    console.error("Error fetching suppliers:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/suppliers
 * Create a new supplier
 */
export async function POST(request: Request) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to create suppliers
    const canCreateSuppliers = await hasRole(["ADMIN", "MANAGER"])
    
    if (!canCreateSuppliers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = createSupplierSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const data = validationResult.data
    
    // Check if supplier ID already exists in this organization
    const existingSupplier = await prisma.supplier.findUnique({
      where: {
        organizationId_supplierId: {
          organizationId: session.user.organizationId,
          supplierId: data.supplierId,
        },
      },
    })
    
    if (existingSupplier) {
      return NextResponse.json(
        { error: "Supplier ID already exists in your organization" },
        { status: 400 }
      )
    }
    
    // Create supplier in a transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Convert decimal values
      const ratingDecimal = data.rating !== null && data.rating !== undefined
        ? new Prisma.Decimal(data.rating)
        : null;
      
      const deliveryRatingDecimal = data.deliveryRating !== null && data.deliveryRating !== undefined
        ? new Prisma.Decimal(data.deliveryRating)
        : null;
      
      const qualityRatingDecimal = data.qualityRating !== null && data.qualityRating !== undefined
        ? new Prisma.Decimal(data.qualityRating)
        : null;
      
      // Handle JSON fields
      const certificationsJson = data.certifications || undefined;
      const specialtiesJson = data.specialties || undefined;
      
      // Extract auxiliary emails if present
      const auxiliaryEmails = (body.auxiliaryEmails || []).map((aux: any) => ({
        email: aux.email,
        name: aux.name || null,
        phone: aux.phone || null
      }));
      
      // Create the supplier with auxiliary emails
      const supplier = await tx.supplier.create({
        data: {
          supplierId: data.supplierId,
          name: data.name,
          type: data.type,
          status: data.status,
          contactPerson: data.contactPerson,
          email: data.email,
          phone: data.phone,
          website: data.website,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          country: data.country,
          rating: ratingDecimal,
          deliveryRating: deliveryRatingDecimal,
          qualityRating: qualityRatingDecimal,
          avgDeliveryTime: data.avgDeliveryTime,
          paymentTerms: data.paymentTerms,
          taxId: data.taxId,
          certifications: certificationsJson,
          specialties: specialtiesJson,
          organizationId: session.user.organizationId,
          // Create auxiliary emails in the same transaction
          auxiliaryEmails: {
            create: auxiliaryEmails
          }
        },
        include: {
          auxiliaryEmails: true
        }
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "SUPPLIER_ADDED",
          title: "Supplier added",
          description: `Supplier ${data.supplierId} (${data.name}) added`,
          entityType: "Supplier",
          entityId: supplier.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            supplierId: data.supplierId,
            name: data.name,
            type: data.type,
          },
        },
      })
      
      return supplier
    })
    
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Error creating supplier:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to create supplier" },
      { status: 500 }
    )
  }
}