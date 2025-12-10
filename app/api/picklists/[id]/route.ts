import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/picklists/:id - Get a specific pick list
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
            title: true,
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

    return NextResponse.json({ data: pickList });
  } catch (error) {
    console.error("Error fetching pick list:", error);
    return NextResponse.json(
      { error: "Failed to fetch pick list" },
      { status: 500 }
    );
  }
}

// PUT /api/picklists/:id - Update a pick list
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pickListId = params.id;
    const { name, status } = await req.json();

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

    // Update the pick list
    const updatedPickList = await prisma.chatPickList.update({
      where: {
        id: pickListId,
      },
      data: {
        name: name !== undefined ? name : undefined,
        status: status !== undefined ? status : undefined,
      },
    });

    return NextResponse.json({ data: updatedPickList });
  } catch (error) {
    console.error("Error updating pick list:", error);
    return NextResponse.json(
      { error: "Failed to update pick list" },
      { status: 500 }
    );
  }
}

// DELETE /api/picklists/:id - Delete a pick list
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pickListId = params.id;

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

    // Delete the pick list
    await prisma.chatPickList.delete({
      where: {
        id: pickListId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pick list:", error);
    return NextResponse.json(
      { error: "Failed to delete pick list" },
      { status: 500 }
    );
  }
}