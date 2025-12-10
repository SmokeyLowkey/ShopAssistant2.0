import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { hasRole } from "@/lib/auth"
import { Prisma, PrismaClient, MaintenanceType, MaintenanceStatus, Priority } from "@prisma/client"

// Type for transaction prisma client
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// Validation schema for maintenance part update
const maintenancePartUpdateSchema = z.object({
  id: z.string().optional(), // Existing part ID, if updating
  partId: z.string(),
  quantityUsed: z.number().int().positive(),
  unitCost: z.number().positive(),
})

// Validation schema for updating a maintenance record
const updateMaintenanceSchema = z.object({
  maintenanceId: z.string().min(3, "Maintenance ID must be at least 3 characters").optional(),
  vehicleId: z.string().optional(),
  type: z.nativeEnum(MaintenanceType).optional(),
  status: z.nativeEnum(MaintenanceStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  
  // Scheduling
  scheduledDate: z.string().datetime().optional(),
  completedDate: z.string().datetime().optional().nullable(),
  estimatedHours: z.number().positive().optional().nullable(),
  actualHours: z.number().positive().optional().nullable(),
  
  // Cost Information
  estimatedCost: z.number().positive().optional().nullable(),
  actualCost: z.number().positive().optional().nullable(),
  laborCost: z.number().positive().optional().nullable(),
  partsCost: z.number().positive().optional().nullable(),
  
  // Details
  description: z.string().optional(),
  workPerformed: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  
  // Technician Information
  assignedTechnician: z.string().optional().nullable(),
  technicianNotes: z.string().optional().nullable(),
  
  // Parts used
  parts: z.array(maintenancePartUpdateSchema).optional(),
  
  // Parts to remove
  removeParts: z.array(z.string()).optional(),
})

/**
 * GET /api/maintenance/[id]
 * Get a specific maintenance record by ID
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    
    // Get the maintenance record
    const maintenanceRecord = await prisma.maintenanceRecord.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        vehicle: {
          select: {
            id: true,
            vehicleId: true,
            make: true,
            model: true,
            year: true,
            type: true,
            status: true,
            currentLocation: true,
            operatingHours: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
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
                subcategory: true,
                price: true,
                location: true,
              },
            },
          },
        },
      },
    })
    
    if (!maintenanceRecord) {
      return NextResponse.json({ error: "Maintenance record not found" }, { status: 404 })
    }
    
    return NextResponse.json(maintenanceRecord)
  } catch (error) {
    console.error("Error fetching maintenance record:", error)
    return NextResponse.json(
      { error: "Failed to fetch maintenance record" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/maintenance/[id]
 * Update a specific maintenance record
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to update maintenance records
    const canUpdateMaintenance = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN"])
    
    if (!canUpdateMaintenance) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Check if maintenance record exists and belongs to the user's organization
    const existingMaintenance = await prisma.maintenanceRecord.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        parts: true,
      },
    })
    
    if (!existingMaintenance) {
      return NextResponse.json({ error: "Maintenance record not found" }, { status: 404 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateMaintenanceSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const data = validationResult.data
    
    // Check if maintenanceId is being updated and if it already exists
    if (data.maintenanceId && data.maintenanceId !== existingMaintenance.maintenanceId) {
      const maintenanceWithSameId = await prisma.maintenanceRecord.findUnique({
        where: {
          organizationId_maintenanceId: {
            organizationId: session.user.organizationId,
            maintenanceId: data.maintenanceId,
          },
        },
      })
      
      if (maintenanceWithSameId) {
        return NextResponse.json(
          { error: "Maintenance ID already exists in your organization" },
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
    
    // Update maintenance record in a transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Prepare update data
      const updateData: Record<string, any> = {};
      
      // Add fields to update data
      if (data.maintenanceId) updateData.maintenanceId = data.maintenanceId;
      if (data.vehicleId) updateData.vehicleId = data.vehicleId;
      if (data.type) updateData.type = data.type;
      if (data.status) updateData.status = data.status;
      if (data.priority) updateData.priority = data.priority;
      
      if (data.scheduledDate) {
        updateData.scheduledDate = new Date(data.scheduledDate);
      }
      
      if ('completedDate' in data) {
        updateData.completedDate = data.completedDate ? new Date(data.completedDate) : null;
      }
      
      if ('estimatedHours' in data) {
        updateData.estimatedHours = data.estimatedHours !== null && data.estimatedHours !== undefined
          ? new Prisma.Decimal(data.estimatedHours)
          : null;
      }
      
      if ('actualHours' in data) {
        updateData.actualHours = data.actualHours !== null && data.actualHours !== undefined
          ? new Prisma.Decimal(data.actualHours)
          : null;
      }
      
      if ('estimatedCost' in data) {
        updateData.estimatedCost = data.estimatedCost !== null && data.estimatedCost !== undefined
          ? new Prisma.Decimal(data.estimatedCost)
          : null;
      }
      
      if ('actualCost' in data) {
        updateData.actualCost = data.actualCost !== null && data.actualCost !== undefined
          ? new Prisma.Decimal(data.actualCost)
          : null;
      }
      
      if ('laborCost' in data) {
        updateData.laborCost = data.laborCost !== null && data.laborCost !== undefined
          ? new Prisma.Decimal(data.laborCost)
          : null;
      }
      
      if ('partsCost' in data) {
        updateData.partsCost = data.partsCost !== null && data.partsCost !== undefined
          ? new Prisma.Decimal(data.partsCost)
          : null;
      }
      
      if (data.description) updateData.description = data.description;
      if ('workPerformed' in data) updateData.workPerformed = data.workPerformed;
      if ('notes' in data) updateData.notes = data.notes;
      if ('location' in data) updateData.location = data.location;
      if ('assignedTechnician' in data) updateData.assignedTechnician = data.assignedTechnician;
      if ('technicianNotes' in data) updateData.technicianNotes = data.technicianNotes;
      
      // Update the maintenance record
      const updatedMaintenance = await tx.maintenanceRecord.update({
        where: {
          id: params.id,
        },
        data: updateData,
      })
      
      // Handle maintenance parts if provided
      if (data.parts && data.parts.length > 0) {
        for (const part of data.parts) {
          const unitCostDecimal = new Prisma.Decimal(part.unitCost)
          const totalCostDecimal = new Prisma.Decimal(part.quantityUsed * part.unitCost)
          
          if (part.id) {
            // Update existing part
            const existingPart = existingMaintenance.parts.find(p => p.id === part.id)
            
            if (existingPart) {
              await tx.maintenancePart.update({
                where: { id: part.id },
                data: {
                  quantityUsed: part.quantityUsed,
                  unitCost: unitCostDecimal,
                  totalCost: totalCostDecimal,
                },
              })
            }
          } else {
            // Create new part
            await tx.maintenancePart.create({
              data: {
                maintenanceId: params.id,
                partId: part.partId,
                quantityUsed: part.quantityUsed,
                unitCost: unitCostDecimal,
                totalCost: totalCostDecimal,
              },
            })
          }
        }
      }
      
      // Remove parts if specified
      if (data.removeParts && data.removeParts.length > 0) {
        await tx.maintenancePart.deleteMany({
          where: {
            id: { in: data.removeParts },
            maintenanceId: params.id,
          },
        })
      }
      
      // Get vehicle information for activity log
      const vehicle = await tx.vehicle.findUnique({
        where: { id: updatedMaintenance.vehicleId },
        select: { vehicleId: true },
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "MAINTENANCE_SCHEDULED", // Using MAINTENANCE_SCHEDULED as there's no MAINTENANCE_UPDATED in ActivityType
          title: "Maintenance updated",
          description: `Maintenance ${updatedMaintenance.maintenanceId} updated for vehicle ${vehicle?.vehicleId}`,
          entityType: "MaintenanceRecord",
          entityId: updatedMaintenance.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            maintenanceId: updatedMaintenance.maintenanceId,
            vehicleId: vehicle?.vehicleId,
            updatedFields: Object.keys(data),
          },
        },
      })
      
      // If status changed to COMPLETED, log completion
      if (data.status === MaintenanceStatus.COMPLETED && existingMaintenance.status !== MaintenanceStatus.COMPLETED) {
        await tx.activityLog.create({
          data: {
            type: "MAINTENANCE_COMPLETED",
            title: "Maintenance completed",
            description: `Maintenance ${updatedMaintenance.maintenanceId} completed for vehicle ${vehicle?.vehicleId}`,
            entityType: "MaintenanceRecord",
            entityId: updatedMaintenance.id,
            userId: session.user.id,
            organizationId: session.user.organizationId,
            metadata: {
              maintenanceId: updatedMaintenance.maintenanceId,
              vehicleId: vehicle?.vehicleId,
              completedDate: data.completedDate || new Date().toISOString(),
            },
          },
        })
      }
      
      // Return the updated maintenance record with related data
      return tx.maintenanceRecord.findUnique({
        where: { id: updatedMaintenance.id },
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
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error updating maintenance record:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to update maintenance record" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/maintenance/[id]
 * Delete a specific maintenance record
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get the current session
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check if user has permission to delete maintenance records
    const canDeleteMaintenance = await hasRole(["ADMIN", "MANAGER"])
    
    if (!canDeleteMaintenance) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Check if maintenance record exists and belongs to the user's organization
    const existingMaintenance = await prisma.maintenanceRecord.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        vehicle: {
          select: { vehicleId: true },
        },
      },
    })
    
    if (!existingMaintenance) {
      return NextResponse.json({ error: "Maintenance record not found" }, { status: 404 })
    }
    
    // Delete maintenance record in a transaction
    await prisma.$transaction(async (tx: TransactionClient) => {
      // Delete all maintenance parts
      await tx.maintenancePart.deleteMany({
        where: {
          maintenanceId: params.id,
        },
      })
      
      // Delete the maintenance record
      await tx.maintenanceRecord.delete({
        where: {
          id: params.id,
        },
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "MAINTENANCE_SCHEDULED", // Using MAINTENANCE_SCHEDULED as there's no MAINTENANCE_DELETED in ActivityType
          title: "Maintenance deleted",
          description: `Maintenance ${existingMaintenance.maintenanceId} deleted for vehicle ${existingMaintenance.vehicle.vehicleId}`,
          entityType: "MaintenanceRecord",
          entityId: params.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            maintenanceId: existingMaintenance.maintenanceId,
            vehicleId: existingMaintenance.vehicle.vehicleId,
          },
        },
      })
    })
    
    return NextResponse.json(
      { success: true, message: "Maintenance record deleted successfully" }
    )
  } catch (error) {
    console.error("Error deleting maintenance record:", error)
    return NextResponse.json(
      { error: "Failed to delete maintenance record" },
      { status: 500 }
    )
  }
}