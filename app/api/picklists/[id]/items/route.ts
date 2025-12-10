import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/picklists/:id/items - Get all items in a pick list
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pickListId = params.id;

    // Get the pick list with items
    const pickList = await prisma.chatPickList.findUnique({
      where: {
        id: pickListId,
      },
      include: {
        conversation: {
          select: {
            userId: true,
          },
        },
        items: true,
      },
    });

    if (!pickList) {
      return NextResponse.json({ error: "Pick list not found" }, { status: 404 });
    }

    // Verify the user owns this pick list
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user || pickList.conversation.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ data: pickList.items });
  } catch (error) {
    console.error("Error fetching pick list items:", error);
    return NextResponse.json(
      { error: "Failed to fetch pick list items" },
      { status: 500 }
    );
  }
}

// POST /api/picklists/:id/items - Add an item to a pick list
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pickListId = params.id;
    const { partNumber, description, quantity, estimatedPrice, messageId } = await req.json();

    if (!partNumber || !description) {
      return NextResponse.json(
        { error: "Part number and description are required" },
        { status: 400 }
      );
    }

    // Verify the pick list exists
    const pickList = await prisma.chatPickList.findUnique({
      where: {
        id: pickListId,
      },
      include: {
        conversation: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!pickList) {
      return NextResponse.json({ error: "Pick list not found" }, { status: 404 });
    }

    // Verify the user owns this pick list
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user || pickList.conversation.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Add the item to the pick list
    const item = await prisma.chatPickListItem.create({
      data: {
        partNumber,
        description,
        quantity: quantity || 1,
        estimatedPrice: estimatedPrice || null,
        messageId: messageId || null,
        pickList: {
          connect: {
            id: pickListId,
          },
        },
      },
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error("Error adding item to pick list:", error);
    return NextResponse.json(
      { error: "Failed to add item to pick list" },
      { status: 500 }
    );
  }
}