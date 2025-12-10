import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { hasRole } from "@/lib/auth"
import { Prisma, PrismaClient, MaintenanceType, MaintenanceStatus, Priority } from "@prisma/client"

// Type for transaction prisma client
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// Validation schema for maintenance part
const maintenancePartSchema = z.object({
  partId: z.string(),
  quantityUsed: z.number().int().positive(),
  unitCost: z.number().positive(),
})

// Validation schema for creating a maintenance record
const createMaintenanceSchema = z.object({
  maintenanceId: z.string().min(3, "Maintenance ID must be at least 3 characters").optional(),
  vehicleId: z.string(),
  type: z.nativeEnum(MaintenanceType),
  status: z.nativeEnum(MaintenanceStatus).default(MaintenanceStatus.SCHEDULED),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  
  // Scheduling
  scheduledDate: z.string().datetime(),
  completedDate: z.string().datetime().optional().nullable(),
  estimatedHours: z.number().positive().optional().nullable(),
  actualHours: z.number().positive().optional().nullable(),
  
  // Cost Information
  estimatedCost: z.number().positive().optional().nullable(),
  actualCost: z.number().positive().optional().nullable(),
  laborCost: z.number().positive().optional().nullable(),
  partsCost: z.number().positive().optional().nullable(),
  
  // Details
  description: z.string(),
  workPerformed: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  
  // Technician Information
  assignedTechnician: z.string().optional().nullable(),
  technicianNotes: z.string().optional().nullable(),
  
  // Parts used
  parts: z.array(maintenancePartSchema).optional(),
})

// Validation schema for filtering maintenance records
const filterMaintenanceSchema = z.object({
  maintenanceId: z.string().optional(),
  vehicleId: z.string().optional(),
  type: z.nativeEnum(MaintenanceType).optional(),
  status: z.nativeEnum(MaintenanceStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

type FilterMaintenanceParams = z.infer<typeof filterMaintenanceSchema>

/**
 * GET /api/maintenance
 * Get all maintenance records for the current organization with filtering and pagination
 */
export async function GET(request: Request) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to read maintenance records
    const canReadMaintenance = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN", "USER"])
    
    if (!canReadMaintenance) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params: Record<string, any> = {}
    
    // Convert search params to object
    searchParams.forEach((value, key) => {
      // Convert numeric values
      if (["page", "limit"].includes(key)) {
        params[key] = parseInt(value)
      } else {
        params[key] = value
      }
    })
    
    // Validate and parse filter parameters
    const filterParams = filterMaintenanceSchema.parse(params)
    
    // Build the where clause for filtering
    const where: any = {
      organizationId: session.user.organizationId,
    }
    
    // Apply filters
    if (filterParams.maintenanceId) {
      where.maintenanceId = { contains: filterParams.maintenanceId, mode: "insensitive" }
    }
    
    if (filterParams.vehicleId) {
      where.vehicleId = filterParams.vehicleId
    }
    
    if (filterParams.type) {
      where.type = filterParams.type
    }
    
    if (filterParams.status) {
      where.status = filterParams.status
    }
    
    if (filterParams.priority) {
      where.priority = filterParams.priority
    }
    
    if (filterParams.fromDate) {
      where.scheduledDate = { ...where.scheduledDate, gte: new Date(filterParams.fromDate) }
    }
    
    if (filterParams.toDate) {
      where.scheduledDate = { ...where.scheduledDate, lte: new Date(filterParams.toDate) }
    }
    
    // Search across multiple fields
    if (filterParams.search) {
      where.OR = [
        { maintenanceId: { contains: filterParams.search, mode: "insensitive" } },
        { description: { contains: filterParams.search, mode: "insensitive" } },
        { workPerformed: { contains: filterParams.search, mode: "insensitive" } },
        { notes: { contains: filterParams.search, mode: "insensitive" } },
        { location: { contains: filterParams.search, mode: "insensitive" } },
        { assignedTechnician: { contains: filterParams.search, mode: "insensitive" } },
      ]
    }
    
    // Calculate pagination
    const skip = (filterParams.page - 1) * filterParams.limit
    
    // Build the orderBy clause
    const orderBy: any = {}
    if (filterParams.sortBy) {
      orderBy[filterParams.sortBy] = filterParams.sortOrder
    } else {
      // Default sorting by scheduled date
      orderBy.scheduledDate = "desc"
    }
    
    // Get total count for pagination
    const totalCount = await prisma.maintenanceRecord.count({ where })
    
    // Get maintenance records with pagination, sorting, and filtering
    const maintenanceRecords = await prisma.maintenanceRecord.findMany({
      where,
      skip,
      take: filterParams.limit,
      orderBy,
      include: {
        vehicle: {
          select: {
            id: true,
            vehicleId: true,
            make: true,
            model: true,
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
        _count: {
          select: {
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
      data: maintenanceRecords,
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
    console.error("Error fetching maintenance records:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to fetch maintenance records" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/maintenance
 * Create a new maintenance record
 */
export async function POST(request: Request) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to create maintenance records
    const canCreateMaintenance = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN"])
    
    if (!canCreateMaintenance) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = createMaintenanceSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const data = validationResult.data
    
    // Generate maintenance ID if not provided
    const maintenanceId = data.maintenanceId || await generateMaintenanceId(session.user.organizationId)
    
    // Check if maintenance ID already exists in this organization
    if (data.maintenanceId) {
      const existingMaintenance = await prisma.maintenanceRecord.findUnique({
        where: {
          organizationId_maintenanceId: {
            organizationId: session.user.organizationId,
            maintenanceId: data.maintenanceId,
          },
        },
      })
      
      if (existingMaintenance) {
        return NextResponse.json(
          { error: "Maintenance ID already exists in your organization" },
          { status: 400 }
        )
      }
    }
    
    // Verify vehicle exists and belongs to the organization
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
    
    // Verify all parts exist and belong to the organization if provided
    if (data.parts && data.parts.length > 0) {
      const partIds = data.parts.map(part => part.partId)
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
    
    // Create maintenance record in a transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Convert decimal values
      const estimatedHoursDecimal = data.estimatedHours !== null && data.estimatedHours !== undefined 
        ? new Prisma.Decimal(data.estimatedHours) 
        : null;
      
      const actualHoursDecimal = data.actualHours !== null && data.actualHours !== undefined 
        ? new Prisma.Decimal(data.actualHours) 
        : null;
      
      const estimatedCostDecimal = data.estimatedCost !== null && data.estimatedCost !== undefined 
        ? new Prisma.Decimal(data.estimatedCost) 
        : null;
      
      const actualCostDecimal = data.actualCost !== null && data.actualCost !== undefined 
        ? new Prisma.Decimal(data.actualCost) 
        : null;
      
      const laborCostDecimal = data.laborCost !== null && data.laborCost !== undefined 
        ? new Prisma.Decimal(data.laborCost) 
        : null;
      
      const partsCostDecimal = data.partsCost !== null && data.partsCost !== undefined 
        ? new Prisma.Decimal(data.partsCost) 
        : null;
      
      // Create the maintenance record
      const maintenanceRecord = await tx.maintenanceRecord.create({
        data: {
          maintenanceId,
          type: data.type,
          status: data.status,
          priority: data.priority,
          scheduledDate: new Date(data.scheduledDate),
          completedDate: data.completedDate ? new Date(data.completedDate) : null,
          estimatedHours: estimatedHoursDecimal,
          actualHours: actualHoursDecimal,
          estimatedCost: estimatedCostDecimal,
          actualCost: actualCostDecimal,
          laborCost: laborCostDecimal,
          partsCost: partsCostDecimal,
          description: data.description,
          workPerformed: data.workPerformed,
          notes: data.notes,
          location: data.location,
          assignedTechnician: data.assignedTechnician,
          technicianNotes: data.technicianNotes,
          vehicleId: data.vehicleId,
          createdById: session.user.id,
          organizationId: session.user.organizationId,
        },
      })
      
      // Create maintenance parts if provided
      if (data.parts && data.parts.length > 0) {
        for (const part of data.parts) {
          const unitCostDecimal = new Prisma.Decimal(part.unitCost)
          const totalCostDecimal = new Prisma.Decimal(part.quantityUsed * part.unitCost)
          
          await tx.maintenancePart.create({
            data: {
              maintenanceId: maintenanceRecord.id,
              partId: part.partId,
              quantityUsed: part.quantityUsed,
              unitCost: unitCostDecimal,
              totalCost: totalCostDecimal,
            },
          })
        }
      }
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "MAINTENANCE_SCHEDULED",
          title: "Maintenance scheduled",
          description: `Maintenance ${maintenanceId} scheduled for vehicle ${vehicle.vehicleId}`,
          entityType: "MaintenanceRecord",
          entityId: maintenanceRecord.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            maintenanceId,
            vehicleId: vehicle.vehicleId,
            type: data.type,
            scheduledDate: data.scheduledDate,
          },
        },
      })
      
      // If status is COMPLETED, log completion
      if (data.status === MaintenanceStatus.COMPLETED) {
        await tx.activityLog.create({
          data: {
            type: "MAINTENANCE_COMPLETED",
            title: "Maintenance completed",
            description: `Maintenance ${maintenanceId} completed for vehicle ${vehicle.vehicleId}`,
            entityType: "MaintenanceRecord",
            entityId: maintenanceRecord.id,
            userId: session.user.id,
            organizationId: session.user.organizationId,
            metadata: {
              maintenanceId,
              vehicleId: vehicle.vehicleId,
              completedDate: data.completedDate || new Date().toISOString(),
            },
          },
        })
      }
      
      // Return the created maintenance record with related data
      return tx.maintenanceRecord.findUnique({
        where: { id: maintenanceRecord.id },
        include: {
          vehicle: {
            select: {
              id: true,
              vehicleId: true,
              make: true,
              model: true,
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
          parts: {
            include: {
              part: {
                select: {
                  id: true,
                  partNumber: true,
                  description: true,
                  category: true,
                },
              },
            },
          },
        },
      })
    })
    
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Error creating maintenance record:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to create maintenance record" },
      { status: 500 }
    )
  }
}

/**
 * Generate a unique maintenance ID
 */
async function generateMaintenanceId(organizationId: string): Promise<string> {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  
  // Get the count of maintenance records for this organization in the current year
  const maintenanceCount = await prisma.maintenanceRecord.count({
    where: {
      organizationId,
      scheduledDate: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  })
  
  // Generate maintenance ID in format MAINT-YYYY-MM-XXX
  const sequenceNumber = String(maintenanceCount + 1).padStart(3, '0')
  return `MAINT-${year}-${month}-${sequenceNumber}`
}