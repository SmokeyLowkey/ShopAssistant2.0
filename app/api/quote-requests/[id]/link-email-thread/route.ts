import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/quote-requests/:id/link-email-thread
 * Create a link between a quote request and an email thread for a specific supplier
 */
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const quoteRequestId = params.id;
    const { supplierId, emailThreadId, isPrimary } = await req.json();

    if (!supplierId || !emailThreadId) {
      return NextResponse.json(
        { error: "supplierId and emailThreadId are required" },
        { status: 400 }
      );
    }

    // Verify the user belongs to the organization that owns this quote request
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the quote request exists and belongs to the user's organization
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id: quoteRequestId },
    });

    if (!quoteRequest) {
      return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
    }

    if (quoteRequest.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Create the link
    const link = await prisma.quoteRequestEmailThread.create({
      data: {
        quoteRequestId,
        emailThreadId,
        supplierId,
        isPrimary: isPrimary || false,
        status: "SENT",
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        emailThread: {
          select: {
            id: true,
            subject: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ data: link });
  } catch (error) {
    console.error("Error linking email thread to quote request:", error);
    
    // Handle unique constraint violation
    if ((error as any).code === 'P2002') {
      return NextResponse.json(
        { error: "This supplier is already linked to this quote request" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to link email thread" },
      { status: 500 }
    );
  }
}
