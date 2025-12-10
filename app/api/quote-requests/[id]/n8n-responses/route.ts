import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/quote-requests/:id/n8n-responses - Get N8N responses for a quote request
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract the ID directly without trying to await it
    const quoteRequestId = params.id;

    // Verify the quote request exists and belongs to the user's organization
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: quoteRequestId,
        organizationId: session.user.organizationId,
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: "Quote request not found or access denied" },
        { status: 404 }
      );
    }

    // Get the N8N responses for the quote request
    const n8nResponses = await prisma.n8nResponse.findMany({
      where: {
        quoteRequestId: quoteRequestId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Check if there are any N8N responses
    if (!n8nResponses || n8nResponses.length === 0) {
      console.log(`No N8N responses found for quote request ${quoteRequestId}`);
      // Return an empty array instead of an error to avoid breaking the UI
      return NextResponse.json({ data: [] });
    }

    // Log success for debugging
    console.log(`Found ${n8nResponses.length} N8N responses for quote request ${quoteRequestId}`);
    
    return NextResponse.json({ data: n8nResponses });
  } catch (error) {
    console.error("Error fetching N8N responses:", error);
    return NextResponse.json(
      { error: "Failed to fetch N8N responses" },
      { status: 500 }
    );
  }
}