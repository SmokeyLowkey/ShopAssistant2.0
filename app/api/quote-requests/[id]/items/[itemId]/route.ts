import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/quote-requests/:id/items/:itemId - Update quote request item
export async function PUT(
  req: NextRequest,
  context: { params: { id: string; itemId: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const quoteRequestId = params.id;
    const itemId = params.itemId;
    const { partNumber, description, quantity, unitPrice, totalPrice, notes } = await req.json();

    // Verify the item exists and belongs to the quote request
    const item = await prisma.quoteRequestItem.findUnique({
      where: { id: itemId },
      include: {
        quoteRequest: true,
      },
    });

    if (!item || item.quoteRequestId !== quoteRequestId) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Verify the user belongs to the organization
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user || item.quoteRequest.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update the item
    const updatedItem = await prisma.quoteRequestItem.update({
      where: { id: itemId },
      data: {
        partNumber: partNumber !== undefined ? partNumber : undefined,
        description: description !== undefined ? description : undefined,
        quantity: quantity !== undefined ? quantity : undefined,
        unitPrice: unitPrice !== undefined ? unitPrice : undefined,
        totalPrice: totalPrice !== undefined ? totalPrice : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    return NextResponse.json({ data: updatedItem });
  } catch (error) {
    console.error("Error updating quote request item:", error);
    return NextResponse.json(
      { error: "Failed to update quote request item" },
      { status: 500 }
    );
  }
}

// DELETE /api/quote-requests/:id/items/:itemId - Delete quote request item
export async function DELETE(
  req: NextRequest,
  context: { params: { id: string; itemId: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const quoteRequestId = params.id;
    const itemId = params.itemId;

    // Verify the item exists and belongs to the quote request
    const item = await prisma.quoteRequestItem.findUnique({
      where: { id: itemId },
      include: {
        quoteRequest: true,
      },
    });

    if (!item || item.quoteRequestId !== quoteRequestId) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Verify the user belongs to the organization
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user || item.quoteRequest.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete the item
    await prisma.quoteRequestItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quote request item:", error);
    return NextResponse.json(
      { error: "Failed to delete quote request item" },
      { status: 500 }
    );
  }
}
