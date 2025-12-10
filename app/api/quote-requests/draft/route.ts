import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";

// POST /api/quote-requests/draft - Create a draft quote request from pick list
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pickListId, vehicleId } = await req.json();

    if (!pickListId) {
      return NextResponse.json(
        { error: "Pick list ID is required" },
        { status: 400 }
      );
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch the pick list with conversation and items
    const pickList = await prisma.chatPickList.findUnique({
      where: { id: pickListId },
      include: {
        items: true,
        conversation: {
          include: {
            pickLists: {
              include: {
                items: true,
              },
            },
          },
        },
      },
    });

    if (!pickList) {
      return NextResponse.json({ error: "Pick list not found" }, { status: 404 });
    }

    // For now, we'll create a quote request without a supplier (it will be selected in the edit page)
    // We need at least one supplier for the schema, so let's get the first supplier
    const firstSupplier = await prisma.supplier.findFirst({
      where: {
        organizationId: user.organizationId,
      },
    });

    if (!firstSupplier) {
      return NextResponse.json(
        { error: "No suppliers found. Please create a supplier first." },
        { status: 400 }
      );
    }

    // Generate a unique quote number
    let quoteNumber = '';
    let isUnique = false;
    
    while (!isUnique) {
      const now = new Date();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      
      quoteNumber = `QR-${month}-${year}-${randomNum}`;
      
      const existingQuote = await prisma.quoteRequest.findFirst({
        where: {
          quoteNumber,
          organizationId: user.organizationId,
        },
      });
      
      if (!existingQuote) {
        isUnique = true;
      }
    }

    // Create draft quote request with items from pick list
    const quoteRequest = await prisma.quoteRequest.create({
      data: {
        quoteNumber,
        title: `Quote Request - ${pickList.name || 'Draft'}`,
        status: QuoteStatus.DRAFT,
        organization: {
          connect: {
            id: user.organizationId,
          },
        },
        supplier: {
          connect: {
            id: firstSupplier.id,
          },
        },
        vehicle: {
          connect: {
            id: vehicleId,
          },
        },
        pickList: {
          connect: {
            id: pickListId,
          },
        },
        createdBy: {
          connect: {
            id: user.id,
          },
        },
        items: {
          create: pickList.items.map((item) => ({
            partNumber: item.partNumber,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.estimatedPrice,
            totalPrice: item.estimatedPrice 
              ? Number(item.estimatedPrice) * item.quantity 
              : undefined,
          })),
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            contactPerson: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            vehicleId: true,
            make: true,
            model: true,
            year: true,
          },
        },
        items: true,
        pickList: {
          select: {
            id: true,
            conversationId: true,
          },
        },
      },
    });

    return NextResponse.json({ data: quoteRequest }, { status: 201 });
  } catch (error) {
    console.error("Error creating draft quote request:", error);
    return NextResponse.json(
      { error: "Failed to create draft quote request" },
      { status: 500 }
    );
  }
}
