import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { hasRole } from "@/lib/auth"
import { VehicleType, IndustryCategory, VehicleStatus, PrismaClient } from "@prisma/client"

// Type for transaction prisma client
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// Validation schema for updating a vehicle
const updateVehicleSchema = z.object({
  vehicleId: z.string().min(3, "Vehicle ID must be at least 3 characters").optional(),
  serialNumber: z.string().min(5, "Serial number must be at least 5 characters").optional(),
  make: z.string().min(2, "Make must be at least 2 characters").optional(),
  model: z.string().min(2, "Model must be at least 2 characters").optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  type: z.nativeEnum(VehicleType).optional(),
  industryCategory: z.nativeEnum(IndustryCategory).optional(),
  status: z.nativeEnum(VehicleStatus).optional(),
  currentLocation: z.string().optional().nullable(),
  operatingHours: z.number().int().optional(),
  healthScore: z.number().int().min(0).max(100).optional(),
  engineModel: z.string().optional().nullable(),
  specifications: z.record(z.any()).optional().nullable(),
  lastServiceDate: z.string().datetime().optional().nullable(),
  nextServiceDate: z.string().datetime().optional().nullable(),
  serviceInterval: z.number().int().optional().nullable(),
  ownerId: z.string().optional(),
})

// Type for the update data that will be passed to Prisma
type VehicleUpdateData = {
  vehicleId?: string;
  serialNumber?: string;
  make?: string;
  model?: string;
  year?: number;
  type?: VehicleType;
  industryCategory?: IndustryCategory;
  status?: VehicleStatus;
  currentLocation?: string | null;
  operatingHours?: number;
  healthScore?: number;
  engineModel?: string | null;
  specifications?: any;
  lastServiceDate?: string | null;
  nextServiceDate?: string | null;
  serviceInterval?: number | null;
  ownerId?: string;
}

/**
 * GET /api/vehicles/[id]
 * Get a specific vehicle by ID
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
    
    // Check if user has permission to read vehicles
    const canReadVehicles = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN", "USER"])
    
    if (!canReadVehicles) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Get the vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        alerts: {
          orderBy: {
            createdAt: "desc",
          },
        },
        maintenanceRecords: {
          orderBy: {
            scheduledDate: "desc",
          },
          take: 5,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        orders: {
          orderBy: {
            orderDate: "desc",
          },
          take: 5,
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })
    
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 })
    }
    
    return NextResponse.json(vehicle)
  } catch (error) {
    console.error("Error fetching vehicle:", error)
    return NextResponse.json(
      { error: "Failed to fetch vehicle" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/vehicles/[id]
 * Update a specific vehicle
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
    
    // Check if user has permission to update vehicles
    const canUpdateVehicles = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN"])
    
    if (!canUpdateVehicles) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Check if vehicle exists and belongs to the user's organization
    const existingVehicle = await prisma.vehicle.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })
    
    if (!existingVehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateVehicleSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const data = validationResult.data
    
    // Check if vehicleId is being updated and if it already exists
    if (data.vehicleId && data.vehicleId !== existingVehicle.vehicleId) {
      const vehicleWithSameId = await prisma.vehicle.findUnique({
        where: {
          organizationId_vehicleId: {
            organizationId: session.user.organizationId,
            vehicleId: data.vehicleId,
          },
        },
      })
      
      if (vehicleWithSameId) {
        return NextResponse.json(
          { error: "Vehicle ID already exists in your organization" },
          { status: 400 }
        )
      }
    }
    
    // Check if serialNumber is being updated and if it already exists
    if (data.serialNumber && data.serialNumber !== existingVehicle.serialNumber) {
      const vehicleWithSameSerial = await prisma.vehicle.findUnique({
        where: {
          organizationId_serialNumber: {
            organizationId: session.user.organizationId,
            serialNumber: data.serialNumber,
          },
        },
      })
      
      if (vehicleWithSameSerial) {
        return NextResponse.json(
          { error: "Serial number already exists in your organization" },
          { status: 400 }
        )
      }
    }
    
    // Check if user has permission to change owner
    if (data.ownerId && data.ownerId !== existingVehicle.ownerId) {
      const canChangeOwner = await hasRole(["ADMIN", "MANAGER"])
      
      if (!canChangeOwner) {
        return NextResponse.json(
          { error: "You don't have permission to change the vehicle owner" },
          { status: 403 }
        )
      }
      
      // Verify that the new owner exists and belongs to the same organization
      const newOwner = await prisma.user.findUnique({
        where: {
          id: data.ownerId,
          organizationId: session.user.organizationId,
        },
      })
      
      if (!newOwner) {
        return NextResponse.json(
          { error: "New owner not found or not in your organization" },
          { status: 400 }
        )
      }
    }
    
    // Update vehicle in a transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Prepare update data
      const updateData: Record<string, any> = {};
      
      // Add fields to update data
      if (data.vehicleId) updateData.vehicleId = data.vehicleId;
      if (data.serialNumber) updateData.serialNumber = data.serialNumber;
      if (data.make) updateData.make = data.make;
      if (data.model) updateData.model = data.model;
      if (data.year) updateData.year = data.year;
      if (data.type) updateData.type = data.type;
      if (data.industryCategory) updateData.industryCategory = data.industryCategory;
      if (data.status) updateData.status = data.status;
      if ('currentLocation' in data) updateData.currentLocation = data.currentLocation;
      if (data.operatingHours !== undefined) updateData.operatingHours = data.operatingHours;
      if (data.healthScore !== undefined) updateData.healthScore = data.healthScore;
      if ('engineModel' in data) updateData.engineModel = data.engineModel;
      if ('specifications' in data) updateData.specifications = data.specifications;
      if ('lastServiceDate' in data) updateData.lastServiceDate = data.lastServiceDate;
      if ('nextServiceDate' in data) updateData.nextServiceDate = data.nextServiceDate;
      if ('serviceInterval' in data) updateData.serviceInterval = data.serviceInterval;
      if (data.ownerId) updateData.ownerId = data.ownerId;
      
      // Update the vehicle
      const updatedVehicle = await tx.vehicle.update({
        where: {
          id: params.id,
        },
        data: updateData,
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "VEHICLE_UPDATED",
          title: "Vehicle updated",
          description: `Vehicle ${updatedVehicle.vehicleId} (${updatedVehicle.make} ${updatedVehicle.model}) updated`,
          entityType: "Vehicle",
          entityId: updatedVehicle.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            vehicleId: updatedVehicle.vehicleId,
            updatedFields: Object.keys(data),
          },
        },
      })
      
      return updatedVehicle
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error updating vehicle:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to update vehicle" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/vehicles/[id]
 * Delete a specific vehicle
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
    
    // Check if user has permission to delete vehicles
    const canDeleteVehicles = await hasRole(["ADMIN"])
    
    if (!canDeleteVehicles) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Check if vehicle exists and belongs to the user's organization
    const existingVehicle = await prisma.vehicle.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })
    
    if (!existingVehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 })
    }
    
    // Check if vehicle has related records
    const vehicleWithRelations = await prisma.vehicle.findUnique({
      where: {
        id: params.id,
      },
      include: {
        _count: {
          select: {
            maintenanceRecords: true,
            orders: true,
          },
        },
      },
    })
    
    if (
      (vehicleWithRelations?._count?.maintenanceRecords ?? 0) > 0 ||
      (vehicleWithRelations?._count?.orders ?? 0) > 0
    ) {
      return NextResponse.json(
        {
          error: "Cannot delete vehicle with related records",
          details: {
            maintenanceRecords: vehicleWithRelations?._count.maintenanceRecords,
            orders: vehicleWithRelations?._count.orders,
          },
        },
        { status: 400 }
      )
    }
    
    // Delete vehicle in a transaction
    await prisma.$transaction(async (tx: TransactionClient) => {
      // Delete all alerts for this vehicle
      await tx.vehicleAlert.deleteMany({
        where: {
          vehicleId: params.id,
        },
      })
      
      // Delete the vehicle
      await tx.vehicle.delete({
        where: {
          id: params.id,
        },
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "VEHICLE_UPDATED", // Using VEHICLE_UPDATED as there's no VEHICLE_DELETED in ActivityType
          title: "Vehicle deleted",
          description: `Vehicle ${existingVehicle.vehicleId} (${existingVehicle.make} ${existingVehicle.model}) deleted`,
          entityType: "Vehicle",
          entityId: params.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            vehicleId: existingVehicle.vehicleId,
            make: existingVehicle.make,
            model: existingVehicle.model,
          },
        },
      })
    })
    
    return NextResponse.json(
      { success: true, message: "Vehicle deleted successfully" }
    )
  } catch (error) {
    console.error("Error deleting vehicle:", error)
    return NextResponse.json(
      { error: "Failed to delete vehicle" },
      { status: 500 }
    )
  }
}