import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ConversationContext } from "@prisma/client";

// GET /api/conversations - Get all conversations for the current user
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

    // Get all active conversations for the user
    const conversations = await prisma.chatConversation.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        lastMessageAt: "desc",
      },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    // Format the response
    const formattedConversations = conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title || "Untitled Conversation",
      context: conversation.context,
      isActive: conversation.isActive,
      lastMessageAt: conversation.lastMessageAt,
      messageCount: conversation._count.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    }));

    return NextResponse.json({ data: formattedConversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

// POST /api/conversations - Create a new conversation
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, context, vehicleId } = await req.json();

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create a new conversation
    const conversation = await prisma.chatConversation.create({
      data: {
        title: title || "New Conversation",
        context: context || ConversationContext.PARTS_SEARCH,
        isActive: true,
        user: {
          connect: {
            id: user.id,
          },
        },
        organization: {
          connect: {
            id: user.organizationId,
          },
        },
      },
    });

    // Create a welcome message
    let welcomeMessage = "Hello! I'm your AI Parts Assistant. How can I help you today?";
    let messageContext = undefined;
    
    // If a vehicle ID was provided, add vehicle context
    if (vehicleId) {
      // Get the vehicle details
      const vehicle = await prisma.vehicle.findUnique({
        where: {
          id: vehicleId,
        },
      });

      if (vehicle) {
        welcomeMessage = `Hello! I'm your AI Parts Assistant. I see you're looking for parts for your ${vehicle.year} ${vehicle.make} ${vehicle.model}. How can I help you today?`;
        
        // Store vehicle context in the message
        messageContext = JSON.stringify({
          vehicleId: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          type: vehicle.type
        });
      }
    }

    // Create the welcome message
    await prisma.chatMessage.create({
      data: {
        role: "ASSISTANT",
        content: welcomeMessage,
        messageType: "TEXT",
        context: messageContext,
        conversation: {
          connect: {
            id: conversation.id,
          },
        },
      },
    });

    // Create a pick list for this conversation
    const pickList = await prisma.chatPickList.create({
      data: {
        name: "My Pick List",
        conversation: {
          connect: {
            id: conversation.id,
          },
        },
        ...(vehicleId && {
          vehicle: {
            connect: {
              id: vehicleId,
            },
          },
        }),
      },
    });

    // Return the conversation with the pick list
    return NextResponse.json({
      data: {
        ...conversation,
        pickList: pickList,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}