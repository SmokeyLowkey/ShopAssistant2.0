import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { processCustomerSupportQuery, CustomerSupportRequest } from '@/lib/api/n8n-client';
import { z } from 'zod';

// Validation schema for the request body
const customerSupportSchema = z.object({
  query: z.string().min(1, "Query is required"),
  conversationId: z.string(),
  previousMessages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      timestamp: z.string(),
    })
  ),
  userContext: z.object({
    userId: z.string(),
    role: z.string(),
    organizationId: z.string(),
  }),
  dataAccess: z.object({
    includeOrders: z.boolean().default(false),
    includeQuotes: z.boolean().default(false),
    includeSupplierCommunications: z.boolean().default(false),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate the request body
    const body = await request.json();
    const validationResult = customerSupportSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const supportData: CustomerSupportRequest = validationResult.data;

    // Verify the conversation exists and belongs to the user
    const conversation = await prisma.chatConversation.findUnique({
      where: {
        id: supportData.conversationId,
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    // Verify the conversation is a customer support context
    if (conversation.context !== 'CUSTOMER_SUPPORT') {
      // If not, update the conversation context
      await prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { context: 'CUSTOMER_SUPPORT' },
      });
    }

    // Call the n8n webhook to process the customer support query
    const supportResult = await processCustomerSupportQuery(supportData);

    // Create a new message in the conversation for the user's query
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: supportData.query,
        messageType: 'TEXT',
      },
    });

    // Create the assistant response
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: supportResult.response,
        messageType: 'TEXT',
        context: JSON.stringify({
          sources: supportResult.sources,
          suggestedActions: supportResult.suggestedActions,
          needsHumanEscalation: supportResult.needsHumanEscalation,
          escalationReason: supportResult.escalationReason,
        }),
        actions: JSON.stringify(supportResult.suggestedActions),
      },
    });

    // Update the conversation's lastMessageAt timestamp and message count
    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { 
        lastMessageAt: new Date(),
        messageCount: {
          increment: 2
        }
      },
    });

    // If human escalation is needed, create an activity log
    if (supportResult.needsHumanEscalation) {
      await prisma.activityLog.create({
        data: {
          type: 'SYSTEM_UPDATE',
          title: 'Customer Support Escalation Needed',
          description: `Customer support query requires human attention: ${supportResult.escalationReason}`,
          entityType: 'ChatConversation',
          entityId: conversation.id,
          userId: session.user.id,
          organizationId: session.user.organizationId,
          metadata: {
            conversationId: conversation.id,
            query: supportData.query,
            escalationReason: supportResult.escalationReason,
            messageId: assistantMessage.id,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      response: supportResult.response,
      sources: supportResult.sources,
      suggestedActions: supportResult.suggestedActions,
      needsHumanEscalation: supportResult.needsHumanEscalation,
      escalationReason: supportResult.escalationReason,
      messageId: assistantMessage.id,
    });
  } catch (error) {
    console.error('Error processing customer support query:', error);
    return NextResponse.json(
      { error: 'Failed to process customer support query' },
      { status: 500 }
    );
  }
}