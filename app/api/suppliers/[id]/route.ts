import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { hasRole } from "@/lib/auth"
import { Prisma, PrismaClient, SupplierType, SupplierStatus } from "@prisma/client"

// Type for transaction prisma client
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// Validation schema for updating a supplier
const updateSupplierSchema = z.object({
  supplierId: z.string().min(3, "Supplier ID must be at least 3 characters").optional(),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  type: z.nativeEnum(SupplierType).optional(),
  status: z.nativeEnum(SupplierStatus).optional(),
  
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
  country: z.string().optional().nullable(),
  
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
})

/**
 * GET /api/suppliers/[id]
 * Get a specific supplier by ID
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
    
    // Check if user has permission to read suppliers
    const canReadSuppliers = await hasRole(["ADMIN", "MANAGER", "TECHNICIAN", "USER"])
    
    if (!canReadSuppliers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Get the supplier
    const supplier = await prisma.supplier.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        parts: {
          include: {
            part: {
              select: {
                id: true,
                partNumber: true,
                description: true,
                category: true,
                price: true,
                stockQuantity: true,
              },
            },
          },
        },
        orders: {
          take: 5,
          orderBy: {
            orderDate: "desc",
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            orderDate: true,
            expectedDelivery: true,
            actualDelivery: true,
            total: true,
          },
        },
        auxiliaryEmails: true, // Include auxiliary emails
        _count: {
          select: {
            orders: true,
            parts: true,
          },
        },
      },
    })
    
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }
    
    return NextResponse.json(supplier)
  } catch (error) {
    console.error("Error fetching supplier:", error)
    return NextResponse.json(
      { error: "Failed to fetch supplier" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/suppliers/[id]
 * Update a specific supplier
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
    
    // Check if user has permission to update suppliers
    const canUpdateSuppliers = await hasRole(["ADMIN", "MANAGER"])
    
    if (!canUpdateSuppliers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Check if supplier exists and belongs to the user's organization
    const existingSupplier = await prisma.supplier.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })
    
    if (!existingSupplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateSupplierSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const data = validationResult.data
    
    // Check if supplierId is being updated and if it already exists
    if (data.supplierId && data.supplierId !== existingSupplier.supplierId) {
      const supplierWithSameId = await prisma.supplier.findUnique({
        where: {
          organizationId_supplierId: {
            organizationId: session.user.organizationId,
            supplierId: data.supplierId,
          },
        },
      })
      
      if (supplierWithSameId) {
        return NextResponse.json(
          { error: "Supplier ID already exists in your organization" },
          { status: 400 }
        )
      }
    }
    
    // Update supplier in a transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Prepare update data
      const updateData: Record<string, any> = {};
      
      // Add fields to update data
      if (data.supplierId) updateData.supplierId = data.supplierId;
      if (data.name) updateData.name = data.name;
      if (data.type) updateData.type = data.type;
      if (data.status) updateData.status = data.status;
      
      if ('contactPerson' in data) updateData.contactPerson = data.contactPerson;
      if ('email' in data) updateData.email = data.email;
      if ('phone' in data) updateData.phone = data.phone;
      if ('website' in data) updateData.website = data.website;
      
      if ('address' in data) updateData.address = data.address;
      if ('city' in data) updateData.city = data.city;
      if ('state' in data) updateData.state = data.state;
      if ('zipCode' in data) updateData.zipCode = data.zipCode;
      if ('country' in data) updateData.country = data.country;
      
      if (data.rating !== undefined) {
        updateData.rating = data.rating !== null ? new Prisma.Decimal(data.rating) : null;
      }
      
      if (data.deliveryRating !== undefined) {
        updateData.deliveryRating = data.deliveryRating !== null ? new Prisma.Decimal(data.deliveryRating) : null;
      }
      
      if (data.qualityRating !== undefined) {
        updateData.qualityRating = data.qualityRating !== null ? new Prisma.Decimal(data.qualityRating) : null;
      }
      
      if ('avgDeliveryTime' in data) updateData.avgDeliveryTime = data.avgDeliveryTime;
      if ('paymentTerms' in data) updateData.paymentTerms = data.paymentTerms;
      if ('taxId' in data) updateData.taxId = data.taxId;
      if ('certifications' in data) updateData.certifications = data.certifications;
      if ('specialties' in data) updateData.specialties = data.specialties;
      
      // Update the supplier
      const updatedSupplier = await tx.supplier.update({
        where: {
          id: params.id,
        },
        data: updateData,
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "SUPPLIER_ADDED", // Using SUPPLIER_ADDED as there's no SUPPLIER_UPDATED in ActivityType
          title: "Supplier updated",
          description: `Supplier ${updatedSupplier.supplierId} (${updatedSupplier.name}) updated`,
          entityType: "Supplier",
          entityId: updatedSupplier.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            supplierId: updatedSupplier.supplierId,
            updatedFields: Object.keys(data),
          },
        },
      })
      
      return updatedSupplier
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error updating supplier:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to update supplier" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/suppliers/[id]
 * Delete a specific supplier
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
    
    // Check if user has permission to delete suppliers
    const canDeleteSuppliers = await hasRole(["ADMIN"])
    
    if (!canDeleteSuppliers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    // Check if supplier exists and belongs to the user's organization
    const existingSupplier = await prisma.supplier.findUnique({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })
    
    if (!existingSupplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }
    
    // Check if supplier has related records
    const supplierWithRelations = await prisma.supplier.findUnique({
      where: {
        id: params.id,
      },
      include: {
        _count: {
          select: {
            orders: true,
            parts: true,
          },
        },
      },
    })
    
    if (
      (supplierWithRelations?._count?.orders ?? 0) > 0 ||
      (supplierWithRelations?._count?.parts ?? 0) > 0
    ) {
      return NextResponse.json(
        {
          error: "Cannot delete supplier with related records",
          details: {
            orders: supplierWithRelations?._count?.orders,
            parts: supplierWithRelations?._count?.parts,
          },
        },
        { status: 400 }
      )
    }
    
    // Delete supplier in a transaction
    await prisma.$transaction(async (tx: TransactionClient) => {
      // Delete the supplier
      await tx.supplier.delete({
        where: {
          id: params.id,
        },
      })
      
      // Log activity
      await tx.activityLog.create({
        data: {
          type: "SUPPLIER_ADDED", // Using SUPPLIER_ADDED as there's no SUPPLIER_DELETED in ActivityType
          title: "Supplier deleted",
          description: `Supplier ${existingSupplier.supplierId} (${existingSupplier.name}) deleted`,
          entityType: "Supplier",
          entityId: params.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            supplierId: existingSupplier.supplierId,
            name: existingSupplier.name,
          },
        },
      })
    })
    
    return NextResponse.json(
      { success: true, message: "Supplier deleted successfully" }
    )
  } catch (error) {
    console.error("Error deleting supplier:", error)
    return NextResponse.json(
      { error: "Failed to delete supplier" },
      { status: 500 }
    )
  }
}