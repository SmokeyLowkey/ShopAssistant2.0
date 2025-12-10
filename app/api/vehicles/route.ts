import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { hasRole } from "@/lib/auth"
import { VehicleType, IndustryCategory, VehicleStatus, PrismaClient } from "@prisma/client"

// Type for transaction prisma client
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// Validation schema for creating a vehicle
const createVehicleSchema = z.object({
  vehicleId: z.string().min(3, "Vehicle ID must be at least 3 characters"),
  serialNumber: z.string().min(5, "Serial number must be at least 5 characters"),
  make: z.string().min(2, "Make must be at least 2 characters"),
  model: z.string().min(2, "Model must be at least 2 characters"),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  type: z.nativeEnum(VehicleType),
  industryCategory: z.nativeEnum(IndustryCategory).default(IndustryCategory.CONSTRUCTION),
  status: z.nativeEnum(VehicleStatus).default(VehicleStatus.ACTIVE),
  currentLocation: z.string().optional(),
  operatingHours: z.number().int().default(0),
  healthScore: z.number().int().min(0).max(100).default(100),
  engineModel: z.string().optional(),
  specifications: z.record(z.any()).optional(),
})

// Validation schema for filtering vehicles
const filterVehicleSchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  type: z.nativeEnum(VehicleType).optional(),
  industryCategory: z.nativeEnum(IndustryCategory).optional(),
  status: z.nativeEnum(VehicleStatus).optional(),
  year: z.number().int().optional(),
  minHealthScore: z.number().int().min(0).max(100).optional(),
  maxHealthScore: z.number().int().min(0).max(100).optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
})

type FilterVehicleParams = z.infer<typeof filterVehicleSchema>

/**
 * GET /api/vehicles
 * Get all vehicles for the current organization with filtering and pagination
 */
export async function GET(request: Request) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to read vehicles
    const canReadVehicles = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN", "USER"])
    
    if (!canReadVehicles) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params: Record<string, any> = {}
    
    // Convert search params to object
    searchParams.forEach((value, key) => {
      // Convert numeric values
      if (["year", "page", "limit", "minHealthScore", "maxHealthScore"].includes(key)) {
        params[key] = parseInt(value)
      } else {
        params[key] = value
      }
    })
    
    // Validate and parse filter parameters
    const filterParams = filterVehicleSchema.parse(params)
    
    // Build the where clause for filtering
    const where: any = {
      organizationId: session.user.organizationId,
    }
    
    // Apply filters
    if (filterParams.make) {
      where.make = { contains: filterParams.make, mode: "insensitive" }
    }
    
    if (filterParams.model) {
      where.model = { contains: filterParams.model, mode: "insensitive" }
    }
    
    if (filterParams.type) {
      where.type = filterParams.type
    }
    
    if (filterParams.industryCategory) {
      where.industryCategory = filterParams.industryCategory
    }
    
    if (filterParams.status) {
      where.status = filterParams.status
    }
    
    if (filterParams.year) {
      where.year = filterParams.year
    }
    
    if (filterParams.minHealthScore !== undefined) {
      where.healthScore = { ...where.healthScore, gte: filterParams.minHealthScore }
    }
    
    if (filterParams.maxHealthScore !== undefined) {
      where.healthScore = { ...where.healthScore, lte: filterParams.maxHealthScore }
    }
    
    // Search across multiple fields
    if (filterParams.search) {
      where.OR = [
        { vehicleId: { contains: filterParams.search, mode: "insensitive" } },
        { serialNumber: { contains: filterParams.search, mode: "insensitive" } },
        { make: { contains: filterParams.search, mode: "insensitive" } },
        { model: { contains: filterParams.search, mode: "insensitive" } },
        { currentLocation: { contains: filterParams.search, mode: "insensitive" } },
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
    const totalCount = await prisma.vehicle.count({ where })
    
    // Get vehicles with pagination, sorting, and filtering
    const vehicles = await prisma.vehicle.findMany({
      where,
      skip,
      take: filterParams.limit,
      orderBy,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        alerts: {
          where: {
            isResolved: false,
          },
          select: {
            id: true,
            type: true,
            severity: true,
            title: true,
          },
        },
        _count: {
          select: {
            maintenanceRecords: true,
            orders: true,
          },
        },
      },
    })
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filterParams.limit)
    const hasNextPage = filterParams.page < totalPages
    const hasPreviousPage = filterParams.page > 1
    
    return NextResponse.json({
      data: vehicles,
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
    console.error("Error fetching vehicles:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to fetch vehicles" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/vehicles
 * Create a new vehicle
 */
export async function POST(request: Request) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Debug logging
    console.log("Session user:", {
      id: session.user.id,
      email: session.user.email,
      organizationId: session.user.organizationId,
      role: session.user.role
    })
    
    // Check if organizationId exists
    if (!session.user.organizationId) {
      console.error("User session missing organizationId")
      return NextResponse.json(
        { error: "Your session is missing organization information. Please log out and log back in." },
        { status: 400 }
      )
    }
    
    // Check if user has permission to create vehicles
    const canCreateVehicles = await hasRole(["ADMIN", "MANAGER"])
    
    if (!canCreateVehicles) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = createVehicleSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const data = validationResult.data
    
    // Check if vehicle ID already exists in this organization
    const existingVehicle = await prisma.vehicle.findUnique({
      where: {
        organizationId_vehicleId: {
          organizationId: session.user.organizationId,
          vehicleId: data.vehicleId,
        },
      },
    })
    
    if (existingVehicle) {
      return NextResponse.json(
        { error: "Vehicle ID already exists in your organization" },
        { status: 400 }
      )
    }
    
    // Check if serial number already exists in this organization
    const existingSerialNumber = await prisma.vehicle.findUnique({
      where: {
        organizationId_serialNumber: {
          organizationId: session.user.organizationId,
          serialNumber: data.serialNumber,
        },
      },
    })
    
    if (existingSerialNumber) {
      return NextResponse.json(
        { error: "Serial number already exists in your organization" },
        { status: 400 }
      )
    }
    
    // Create vehicle in a transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Create the vehicle
      const vehicle = await tx.vehicle.create({
        data: {
          ...data,
          organizationId: session.user.organizationId,
          ownerId: session.user.id,
        },
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "VEHICLE_ADDED",
          title: "Vehicle added",
          description: `Vehicle ${data.vehicleId} (${data.make} ${data.model}) added`,
          entityType: "Vehicle",
          entityId: vehicle.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            vehicleId: data.vehicleId,
            make: data.make,
            model: data.model,
            year: data.year,
            type: data.type,
          },
        },
      })
      
      return vehicle
    })
    
    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error("Error creating vehicle:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      )
    }
    
    // Handle Prisma errors
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: "Database constraint error. Please ensure you are properly authenticated and your organization exists." },
        { status: 400 }
      )
    }
    
    if (error.code === 'P2002') {
      const target = error.meta?.target as string[] | undefined
      if (target?.includes('vehicleId')) {
        return NextResponse.json(
          { error: "Vehicle ID already exists in your organization" },
          { status: 400 }
        )
      }
      if (target?.includes('serialNumber')) {
        return NextResponse.json(
          { error: "Serial number already exists in your organization" },
          { status: 400 }
        )
      }
    }
    
    return NextResponse.json(
      { error: "Failed to create vehicle" },
      { status: 500 }
    )
  }
}