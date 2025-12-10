import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchParts, processCustomerSupportQuery } from "@/lib/api/n8n-client";
import { ApiError } from "@/lib/api/client";
import { SignJWT } from "jose";

/**
 * Generate a JWT token for n8n webhook authentication
 */
async function generateJwtToken(): Promise<string> {
  const secret = process.env.N8N_WEBHOOK_SECRET || 'development_secret_key_for_testing';
  
  try {
    const secretKey = new TextEncoder().encode(secret);
    
    const token = await new SignJWT({
      source: 'construction-dashboard',
      timestamp: Date.now()
    })
      .setProtectedHeader({ alg: 'HS512' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(secretKey);
    
    return token;
  } catch (error) {
    console.error('Error generating JWT token:', error);
    return '';
  }
}

// GET /api/conversations/:id/messages - Get all messages in a conversation
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure params is awaited before accessing properties
    const { id } = await params;
    const conversationId = id;

    // Get the conversation with messages
    const conversation = await prisma.chatConversation.findUnique({
      where: {
        id: conversationId,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Verify the user owns this conversation
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user || conversation.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Parse context and actions for each message
    const parsedMessages = conversation.messages.map(msg => {
      const message = { ...msg };
      
      if (message.context && typeof message.context === 'string') {
        try {
          message.context = JSON.parse(message.context);
        } catch (e) {
          console.error("Failed to parse context:", e);
        }
      }
      
      if (message.actions && typeof message.actions === 'string') {
        try {
          message.actions = JSON.parse(message.actions);
        } catch (e) {
          console.error("Failed to parse actions:", e);
        }
      }
      
      return message;
    });

    return NextResponse.json({ success: true, data: parsedMessages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/conversations/:id/messages - Send a message in a conversation
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure params is awaited before accessing properties
    const { id } = await params;
    const conversationId = id;
    const { content, context } = await req.json();

    if (!content) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // Check for duplicate message (same content within last 5 seconds)
    const recentDuplicate = await prisma.chatMessage.findFirst({
      where: {
        conversationId,
        role: "USER",
        content,
        createdAt: {
          gte: new Date(Date.now() - 5000), // Last 5 seconds
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentDuplicate) {
      console.log(`[Duplicate Prevention] Ignoring duplicate message: "${content.substring(0, 50)}..."`);
      
      // Return the existing message instead of creating a duplicate
      const existingAiResponse = await prisma.chatMessage.findFirst({
        where: {
          conversationId,
          role: "ASSISTANT",
          createdAt: {
            gt: recentDuplicate.createdAt,
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({
        success: true,
        data: {
          userMessage: recentDuplicate,
          aiResponse: existingAiResponse,
        },
        note: "Duplicate request detected, returning existing message",
      }, { status: 200 });
    }

    // Verify the conversation exists
    const conversation = await prisma.chatConversation.findUnique({
      where: {
        id: conversationId,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Verify the user owns this conversation
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user || conversation.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Create the user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        role: "USER",
        content,
        context: context || null,
        conversation: {
          connect: {
            id: conversationId,
          },
        },
      },
    });

    // Update the conversation's last message timestamp and message count
    await prisma.chatConversation.update({
      where: {
        id: conversationId,
      },
      data: {
        lastMessageAt: new Date(),
        messageCount: {
          increment: 1,
        },
      },
    });

    // Get vehicle if it's referenced in the conversation's pick lists or messages
    let vehicle = null;
    
    // First, check if there's a pick list with a vehicle
    const pickListWithVehicle = await prisma.chatPickList.findFirst({
      where: { 
        conversationId,
        vehicleId: { not: null }
      },
      include: { vehicle: true },
    });
    
    if (pickListWithVehicle?.vehicle) {
      vehicle = pickListWithVehicle.vehicle;
    } else {
      // If no pick list vehicle, check messages for vehicle context
      const messagesWithContext = await prisma.chatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      
      for (const msg of messagesWithContext) {
        if (msg.context) {
          try {
            const ctx = typeof msg.context === 'string' ? JSON.parse(msg.context as string) : msg.context;
            if (ctx && typeof ctx === 'object' && 'vehicleId' in ctx && ctx.vehicleId) {
              vehicle = await prisma.vehicle.findUnique({
                where: { id: ctx.vehicleId as string },
              });
              if (vehicle) break;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    let aiMessage = null;
    const webhookTimeout = 150000; // 150 seconds (2.5 minutes) - n8n can take time to process

    // Send webhook ONCE (no retries to prevent duplicate payloads)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), webhookTimeout);

      // Use the direct n8n webhook URLs from environment variables
      const webhookUrl = conversation.context === "CUSTOMER_SUPPORT"
        ? process.env.CUSTOMER_SUPPORT_WEBHOOK_URL
        : process.env.PARTS_SEARCH_WEBHOOK_URL;

      if (!webhookUrl) {
        throw new Error(`Webhook URL not configured for context: ${conversation.context}`);
      }

      const webhookPayload = conversation.context === "CUSTOMER_SUPPORT"
        ? {
            conversationId,
            userMessage: {
              id: userMessage.id,
              content: content,
            },
            previousMessages: await prisma.chatMessage.findMany({
              where: { conversationId },
              orderBy: { createdAt: 'asc' },
              take: 10,
            }).then(msgs => msgs.map(msg => ({
              role: msg.role.toLowerCase() as "user" | "assistant",
              content: msg.content,
              timestamp: msg.createdAt.toISOString(),
            }))),
            userContext: {
              userId: user.id,
              role: user.role,
              organizationId: user.organizationId || "",
            },
          }
        : {
            query: content, // This is the main search query
            conversationId,
            vehicleContext: vehicle ? {
              make: vehicle.make,
              model: vehicle.model,
              year: vehicle.year,
              serialNumber: vehicle.serialNumber,
            } : undefined,
          };

      // Log payload details for parts search
      if (conversation.context !== "CUSTOMER_SUPPORT") {
        console.log('[Parts Search Conversation API] Sending payload to n8n webhook:', JSON.stringify({
          payloadCount: 1,
          query: content,
          hasVehicleContext: !!vehicle,
          vehicleDetails: vehicle ? {
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            serialNumber: vehicle.serialNumber
          } : null,
          conversationId,
          timestamp: new Date().toISOString()
        }, null, 2));
      }

      // Generate JWT token for authentication
      const jwtToken = await generateJwtToken();

      const webhookResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(webhookPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      if (webhookResponse.ok) {
        const webhookData = await webhookResponse.json();
        console.log(`[Webhook] Response received, polling DB for AI response...`);
        
        // Poll database multiple times instead of retrying the webhook
        const maxPolls = 12; // 12 polls over 60 seconds
        const pollInterval = 5000; // 5 seconds between polls
        
        for (let poll = 0; poll < maxPolls && !aiMessage; poll++) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          
          aiMessage = await prisma.chatMessage.findFirst({
            where: {
              conversationId: conversationId,
              role: "ASSISTANT",
              createdAt: {
                gte: new Date(Date.now() - 120000), // Last 2 minutes
              },
            },
            orderBy: { createdAt: "desc" },
          });

          console.log(`[Webhook] Poll ${poll + 1}/${maxPolls} - AI message found: ${aiMessage ? 'Yes' : 'No'}`);
          
          if (aiMessage) {
            break;
          }
        }
      } else {
        const errorText = await webhookResponse.text();
        console.error(`[Webhook] Error response: ${errorText}`);
      }
    } catch (error: any) {
      console.error(`[Webhook] Request failed:`, error.message);
    }

    // Fallback: Check database for recent assistant messages
    if (!aiMessage) {
      // console.log("Webhook failed, checking database for recent messages...");
      
      // Wait a bit longer for webhook to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      aiMessage = await prisma.chatMessage.findFirst({
        where: {
          conversationId: conversationId,
          role: "ASSISTANT",
          createdAt: {
            gte: new Date(Date.now() - 120000), // Last 2 minutes
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // Final fallback: Create a default message
    if (!aiMessage) {
      // console.log("No AI response found, creating default message...");
      
      aiMessage = await prisma.chatMessage.create({
        data: {
          conversationId: conversationId,
          role: "ASSISTANT",
          content: "I'm processing your request for parts information. This is taking longer than expected. Please check back in a moment, or try rephrasing your search.",
          messageType: "TEXT",
          context: JSON.stringify({
            error: "Webhook timeout or failure",
            fallback: true,
            query: content,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    }

    // Parse context and actions if they're strings
    if (aiMessage.context && typeof aiMessage.context === 'string') {
      try {
        aiMessage.context = JSON.parse(aiMessage.context);
      } catch (e) {
        console.error("Failed to parse context:", e);
      }
    }

    if (aiMessage.actions && typeof aiMessage.actions === 'string') {
      try {
        aiMessage.actions = JSON.parse(aiMessage.actions);
      } catch (e) {
        console.error("Failed to parse actions:", e);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        userMessage,
        aiResponse: aiMessage,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error in chat message route:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Failed to send message",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}