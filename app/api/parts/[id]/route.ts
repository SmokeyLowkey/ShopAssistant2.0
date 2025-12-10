import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { hasRole } from "@/lib/auth"
import { Prisma, PrismaClient } from "@prisma/client"

// Type for transaction prisma client
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// Validation schema for updating a part
const updatePartSchema = z.object({
  partNumber: z.string().min(3, "Part number must be at least 3 characters").optional(),
  description: z.string().min(3, "Description must be at least 3 characters").optional(),
  category: z.string().optional().nullable(),
  subcategory: z.string().optional().nullable(),
  
  // Pricing & Stock
  price: z.number().positive("Price must be positive").optional(),
  cost: z.number().positive("Cost must be positive").optional().nullable(),
  stockQuantity: z.number().int().optional(),
  minStockLevel: z.number().int().optional(),
  maxStockLevel: z.number().int().optional().nullable(),
  
  // Physical Properties
  weight: z.number().positive().optional().nullable(),
  dimensions: z.record(z.any()).optional().nullable(),
  location: z.string().optional().nullable(),
  
  // Compatibility
  compatibility: z.record(z.any()).optional().nullable(),
  specifications: z.record(z.any()).optional().nullable(),
  
  // Status
  isActive: z.boolean().optional(),
  isObsolete: z.boolean().optional(),
})

/**
 * GET /api/parts/[id]
 * Get a specific part by ID
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
    
    // Check if user has permission to read parts
    const canReadParts = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN", "USER"])
    
    if (!canReadParts) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Get the part
    const part = await prisma.part.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                type: true,
                contactPerson: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        orderItems: {
          take: 5,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                orderDate: true,
              },
            },
          },
        },
        maintenanceParts: {
          take: 5,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            maintenance: {
              select: {
                id: true,
                maintenanceId: true,
                type: true,
                status: true,
                scheduledDate: true,
              },
            },
          },
        },
      },
    })
    
    if (!part) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 })
    }
    
    return NextResponse.json(part)
  } catch (error) {
    console.error("Error fetching part:", error)
    return NextResponse.json(
      { error: "Failed to fetch part" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/parts/[id]
 * Update a specific part
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
    
    // Check if user has permission to update parts
    const canUpdateParts = await hasRole(["ADMIN", "MANAGER"])
    
    if (!canUpdateParts) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Check if part exists and belongs to the user's organization
    const existingPart = await prisma.part.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })
    
    if (!existingPart) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = updatePartSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const data = validationResult.data
    
    // Check if partNumber is being updated and if it already exists
    if (data.partNumber && data.partNumber !== existingPart.partNumber) {
      const partWithSameNumber = await prisma.part.findUnique({
        where: {
          organizationId_partNumber: {
            organizationId: session.user.organizationId,
            partNumber: data.partNumber,
          },
        },
      })
      
      if (partWithSameNumber) {
        return NextResponse.json(
          { error: "Part number already exists in your organization" },
          { status: 400 }
        )
      }
    }
    
    // Update part in a transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Prepare update data
      const updateData: Record<string, any> = {};
      
      // Add fields to update data
      if (data.partNumber) updateData.partNumber = data.partNumber;
      if (data.description) updateData.description = data.description;
      if ('category' in data) updateData.category = data.category;
      if ('subcategory' in data) updateData.subcategory = data.subcategory;
      
      if (data.price !== undefined) {
        updateData.price = new Prisma.Decimal(data.price);
      }
      
      if (data.cost !== undefined) {
        updateData.cost = data.cost !== null ? new Prisma.Decimal(data.cost) : null;
      }
      
      if (data.stockQuantity !== undefined) updateData.stockQuantity = data.stockQuantity;
      if (data.minStockLevel !== undefined) updateData.minStockLevel = data.minStockLevel;
      if (data.maxStockLevel !== undefined) updateData.maxStockLevel = data.maxStockLevel;
      
      if (data.weight !== undefined) {
        updateData.weight = data.weight !== null ? new Prisma.Decimal(data.weight) : null;
      }
      
      if ('dimensions' in data) updateData.dimensions = data.dimensions;
      if ('location' in data) updateData.location = data.location;
      if ('compatibility' in data) updateData.compatibility = data.compatibility;
      if ('specifications' in data) updateData.specifications = data.specifications;
      
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.isObsolete !== undefined) updateData.isObsolete = data.isObsolete;
      
      // Update the part
      const updatedPart = await tx.part.update({
        where: {
          id: params.id,
        },
        data: updateData,
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "PART_LOW_STOCK", // Using PART_LOW_STOCK as there's no PART_UPDATED in ActivityType
          title: "Part updated",
          description: `Part ${updatedPart.partNumber} (${updatedPart.description}) updated`,
          entityType: "Part",
          entityId: updatedPart.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            partNumber: updatedPart.partNumber,
            updatedFields: Object.keys(data),
          },
        },
      })
      
      return updatedPart
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error updating part:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to update part" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/parts/[id]
 * Delete a specific part
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
    
    // Check if user has permission to delete parts
    const canDeleteParts = await hasRole(["ADMIN"])
    
    if (!canDeleteParts) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Check if part exists and belongs to the user's organization
    const existingPart = await prisma.part.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })
    
    if (!existingPart) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 })
    }
    
    // Check if part has related records
    const partWithRelations = await prisma.part.findUnique({
      where: {
        id: params.id,
      },
      include: {
        _count: {
          select: {
            orderItems: true,
            maintenanceParts: true,
          },
        },
      },
    })
    
    if (
      (partWithRelations?._count?.orderItems ?? 0) > 0 ||
      (partWithRelations?._count?.maintenanceParts ?? 0) > 0
    ) {
      return NextResponse.json(
        {
          error: "Cannot delete part with related records",
          details: {
            orderItems: partWithRelations?._count?.orderItems,
            maintenanceParts: partWithRelations?._count?.maintenanceParts,
          },
        },
        { status: 400 }
      )
    }
    
    // Delete part in a transaction
    await prisma.$transaction(async (tx: TransactionClient) => {
      // Delete all supplier relationships for this part
      await tx.partSupplier.deleteMany({
        where: {
          partId: params.id,
        },
      })
      
      // Delete the part
      await tx.part.delete({
        where: {
          id: params.id,
        },
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "PART_LOW_STOCK", // Using PART_LOW_STOCK as there's no PART_DELETED in ActivityType
          title: "Part deleted",
          description: `Part ${existingPart.partNumber} (${existingPart.description}) deleted`,
          entityType: "Part",
          entityId: params.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            partNumber: existingPart.partNumber,
            description: existingPart.description,
          },
        },
      })
    })
    
    return NextResponse.json(
      { success: true, message: "Part deleted successfully" }
    )
  } catch (error) {
    console.error("Error deleting part:", error)
    return NextResponse.json(
      { error: "Failed to delete part" },
      { status: 500 }
    )
  }
}