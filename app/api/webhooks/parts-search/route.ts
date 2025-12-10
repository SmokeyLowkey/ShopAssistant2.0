import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { searchParts, PartsSearchRequest } from '@/lib/api/n8n-client';
import { z } from 'zod';

// Validation schema for the request body
const partsSearchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  vehicleContext: z.object({
    make: z.string().optional(),
    model: z.string().optional(),
    year: z.number().optional(),
    serialNumber: z.string().optional(),
  }).optional(),
  filters: z.object({
    category: z.string().optional(),
    inStock: z.boolean().optional(),
  }).optional(),
  conversationId: z.string().optional(),
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
    const validationResult = partsSearchSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const searchData: PartsSearchRequest = validationResult.data;

    // Add the conversation to the database if it doesn't exist
    if (searchData.conversationId) {
      // Check if the conversation exists and belongs to the user
      const conversation = await prisma.chatConversation.findUnique({
        where: {
          id: searchData.conversationId,
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
    }

    // Call the n8n webhook to process the parts search
    const searchResults = await searchParts(searchData);

    // Store the search query and results in the database
    if (searchData.conversationId) {
      // Create a new message in the conversation
      await prisma.chatMessage.create({
        data: {
          conversationId: searchData.conversationId,
          role: 'USER',
          content: searchData.query,
          messageType: 'TEXT',
        },
      });

      // Create the assistant response with the search results
      const assistantMessageContent = `I found ${searchResults.results.length} parts matching your search for "${searchData.query}".`;
      
      await prisma.chatMessage.create({
        data: {
          conversationId: searchData.conversationId,
          role: 'ASSISTANT',
          content: assistantMessageContent,
          messageType: 'PART_RECOMMENDATION',
          context: JSON.stringify({ searchResults }),
        },
      });

      // Update the conversation's lastMessageAt timestamp
      await prisma.chatConversation.update({
        where: { id: searchData.conversationId },
        data: { 
          lastMessageAt: new Date(),
          messageCount: {
            increment: 2
          }
        },
      });
    }

    return NextResponse.json(searchResults);
  } catch (error) {
    console.error('Error processing parts search:', error);
    return NextResponse.json(
      { error: 'Failed to process parts search request' },
      { status: 500 }
    );
  }
}