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
    const { supplierId, emailThreadId, isPrimary, status } = await req.json();

    if (!supplierId) {
      return NextResponse.json(
        { error: "supplierId is required" },
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

    // Use upsert to create or update the link
    const link = await prisma.quoteRequestEmailThread.upsert({
      where: {
        quoteRequestId_supplierId: {
          quoteRequestId,
          supplierId,
        },
      },
      update: {
        ...(status && { status }),
        ...(emailThreadId && { emailThreadId }),
        ...(isPrimary !== undefined && { isPrimary }),
      },
      create: {
        quoteRequestId,
        emailThreadId: emailThreadId || "",
        supplierId,
        isPrimary: isPrimary || false,
        status: status || "SENT",
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
    
    return NextResponse.json(
      { error: "Failed to link email thread" },
      { status: 500 }
    );
  }
}
