import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/picklists - Get all pick lists for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get all active pick lists for the user
    const pickLists = await prisma.chatPickList.findMany({
      where: {
        conversation: {
          userId: user.id,
        },
      },
      include: {
        conversation: {
          select: {
            title: true,
          },
        },
        items: true,
      },
    });

    return NextResponse.json({ data: pickLists });
  } catch (error) {
    console.error("Error fetching pick lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch pick lists" },
      { status: 500 }
    );
  }
}

// POST /api/picklists - Create a new pick list
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, name } = await req.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    // Create a new pick list
    const pickList = await prisma.chatPickList.create({
      data: {
        name: name || "My Pick List",
        conversation: {
          connect: {
            id: conversationId,
          },
        },
      },
    });

    return NextResponse.json({ data: pickList }, { status: 201 });
  } catch (error) {
    console.error("Error creating pick list:", error);
    return NextResponse.json(
      { error: "Failed to create pick list" },
      { status: 500 }
    );
  }
}