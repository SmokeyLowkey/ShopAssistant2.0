import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/picklists/:id/items/:itemId - Get a specific item in a pick list
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: pickListId, itemId } = params;

    // Get the pick list item
    const item = await prisma.chatPickListItem.findUnique({
      where: {
        id: itemId,
      },
      include: {
        pickList: {
          include: {
            conversation: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Verify the item belongs to the specified pick list
    if (item.pickList.id !== pickListId) {
      return NextResponse.json({ error: "Item not found in this pick list" }, { status: 404 });
    }

    // Verify the user owns this pick list
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user || item.pickList.conversation.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("Error fetching pick list item:", error);
    return NextResponse.json(
      { error: "Failed to fetch pick list item" },
      { status: 500 }
    );
  }
}

// PUT /api/picklists/:id/items/:itemId - Update an item in a pick list
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: pickListId, itemId } = params;
    const { quantity, isOrdered } = await req.json();

    // Get the pick list item
    const item = await prisma.chatPickListItem.findUnique({
      where: {
        id: itemId,
      },
      include: {
        pickList: {
          include: {
            conversation: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Verify the item belongs to the specified pick list
    if (item.pickList.id !== pickListId) {
      return NextResponse.json({ error: "Item not found in this pick list" }, { status: 404 });
    }

    // Verify the user owns this pick list
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user || item.pickList.conversation.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update the item
    const updatedItem = await prisma.chatPickListItem.update({
      where: {
        id: itemId,
      },
      data: {
        quantity: quantity !== undefined ? quantity : undefined,
        isOrdered: isOrdered !== undefined ? isOrdered : undefined,
      },
    });

    return NextResponse.json({ data: updatedItem });
  } catch (error) {
    console.error("Error updating pick list item:", error);
    return NextResponse.json(
      { error: "Failed to update pick list item" },
      { status: 500 }
    );
  }
}

// DELETE /api/picklists/:id/items/:itemId - Delete an item from a pick list
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: pickListId, itemId } = params;

    // Get the pick list item
    const item = await prisma.chatPickListItem.findUnique({
      where: {
        id: itemId,
      },
      include: {
        pickList: {
          include: {
            conversation: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Verify the item belongs to the specified pick list
    if (item.pickList.id !== pickListId) {
      return NextResponse.json({ error: "Item not found in this pick list" }, { status: 404 });
    }

    // Verify the user owns this pick list
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user || item.pickList.conversation.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete the item
    await prisma.chatPickListItem.delete({
      where: {
        id: itemId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pick list item:", error);
    return NextResponse.json(
      { error: "Failed to delete pick list item" },
      { status: 500 }
    );
  }
}