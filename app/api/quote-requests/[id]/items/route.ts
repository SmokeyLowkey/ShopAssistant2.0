import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST /api/quote-requests/:id/items - Add item to quote request
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const quoteRequestId = params.id;
    const { partNumber, description, quantity, unitPrice, totalPrice, notes } = await req.json();

    // Verify the quote request exists
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id: quoteRequestId },
    });

    if (!quoteRequest) {
      return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
    }

    // Verify the user belongs to the organization
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user || quoteRequest.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Create the item
    const item = await prisma.quoteRequestItem.create({
      data: {
        quoteRequestId,
        partNumber,
        description,
        quantity,
        unitPrice,
        totalPrice,
        notes,
      },
    });

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("Error creating quote request item:", error);
    return NextResponse.json(
      { error: "Failed to create quote request item" },
      { status: 500 }
    );
  }
}
