import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/suppliers/[id]/emails
// Returns all email addresses for a supplier
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id;
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
      include: {
        auxiliaryEmails: true, // Include the auxiliary emails relation
      },
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or access denied" },
        { status: 404 }
      );
    }
    
    // Return the primary email and auxiliary emails
    return NextResponse.json({
      success: true,
      primaryEmail: supplier.email,
      auxiliaryEmails: supplier.auxiliaryEmails,
    });
  } catch (error) {
    console.error("Error fetching supplier emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier emails" },
      { status: 500 }
    );
  }
}

// POST /api/suppliers/[id]/emails
// Adds a new auxiliary email to a supplier
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { email, name, phone } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }
    
    // Verify the supplier exists and belongs to the user's organization
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: session.user.organizationId,
      },
      include: {
        auxiliaryEmails: true,
      },
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or access denied" },
        { status: 404 }
      );
    }
    
    // Check if the email already exists in auxiliaryEmails
    const existingAuxEmail = supplier.auxiliaryEmails.find(aux => aux.email === email);
    if (existingAuxEmail) {
      return NextResponse.json(
        { error: "Email already exists for this supplier" },
        { status: 400 }
      );
    }
    
    // Check if the email is the same as the primary email
    if (supplier.email === email) {
      return NextResponse.json(
        { error: "Email is already the primary email for this supplier" },
        { status: 400 }
      );
    }
    
    // Create a new auxiliary email
    const newAuxiliaryEmail = await prisma.auxiliaryEmail.create({
      data: {
        email,
        name: name || null,
        phone: phone || null,
        supplierId,
      },
    });
    
    return NextResponse.json({
      success: true,
      auxiliaryEmail: newAuxiliaryEmail,
    });
  } catch (error) {
    console.error("Error adding supplier email:", error);
    return NextResponse.json(
      { error: "Failed to add supplier email" },
      { status: 500 }
    );
  }
}

// DELETE /api/suppliers/[id]/emails
// Removes an auxiliary email from a supplier
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { emailId } = await request.json();
    
    if (!emailId) {
      return NextResponse.json(
        { error: "Email ID is required" },
        { status: 400 }
      );
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
    console.error("Error removing supplier email:", error);
    return NextResponse.json(
      { error: "Failed to remove supplier email" },
      { status: 500 }
    );
  }
}