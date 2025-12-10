import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Validation schema for updating an auxiliary email
const updateAuxiliaryEmailSchema = z.object({
  name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

// PATCH /api/suppliers/[id]/emails/[emailId]
// Updates an auxiliary email's name or phone
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; emailId: string } }
) {
  try {
    const supplierId = params.id;
    const emailId = params.emailId;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateAuxiliaryEmailSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    const data = validationResult.data;
    
    // Verify the supplier exists and belongs to the user's organization
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: session.user.organizationId,
      },
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or access denied" },
        { status: 404 }
      );
    }
    
    // Check if the auxiliary email exists and belongs to this supplier
    const auxiliaryEmail = await prisma.auxiliaryEmail.findFirst({
      where: {
        id: emailId,
        supplierId,
      },
    });
    
    if (!auxiliaryEmail) {
      return NextResponse.json(
        { error: "Auxiliary email not found" },
        { status: 404 }
      );
    }
    
    // Prepare update data
    const updateData: Record<string, any> = {};
    
    if ('name' in data) updateData.name = data.name;
    if ('phone' in data) updateData.phone = data.phone;
    
    // Update the auxiliary email
    const updatedEmail = await prisma.auxiliaryEmail.update({
      where: {
        id: emailId,
      },
      data: updateData,
    });
    
    return NextResponse.json({
      success: true,
      auxiliaryEmail: updatedEmail,
    });
  } catch (error) {
    console.error("Error updating auxiliary email:", error);
    return NextResponse.json(
      { error: "Failed to update auxiliary email" },
      { status: 500 }
    );
  }
}

// DELETE /api/suppliers/[id]/emails/[emailId]
// Deletes an auxiliary email
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; emailId: string } }
) {
  try {
    const supplierId = params.id;
    const emailId = params.emailId;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Verify the supplier exists and belongs to the user's organization
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: session.user.organizationId,
      },
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or access denied" },
        { status: 404 }
      );
    }
    
    // Check if the auxiliary email exists and belongs to this supplier
    const auxiliaryEmail = await prisma.auxiliaryEmail.findFirst({
      where: {
        id: emailId,
        supplierId,
      },
    });
    
    if (!auxiliaryEmail) {
      return NextResponse.json(
        { error: "Auxiliary email not found" },
        { status: 404 }
      );
    }
    
    // Delete the auxiliary email
    await prisma.auxiliaryEmail.delete({
      where: {
        id: emailId,
      },
    });
    
    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error deleting auxiliary email:", error);
    return NextResponse.json(
      { error: "Failed to delete auxiliary email" },
      { status: 500 }
    );
  }
}