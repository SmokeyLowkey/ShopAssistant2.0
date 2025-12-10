import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET /api/quote-requests/[id]/edited-emails/latest
// Retrieves the latest edited email for a specific type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: quoteRequestId } = await params;
    const { searchParams } = new URL(request.url);
    const emailType = searchParams.get("type");
    
    if (!emailType) {
      return NextResponse.json(
        { error: "Email type is required" },
        { status: 400 }
      );
    }

    // Check if quote request exists and belongs to user's organization
    const quoteRequest = await prisma.quoteRequest.findFirst({
      where: {
        id: quoteRequestId,
        organization: {
          users: {
            some: {
              email: session.user.email,
            },
          },
        },
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: "Quote request not found" },
        { status: 404 }
      );
    }

    // Get the latest edited email of the specified type
    const latestEditedEmail = await prisma.editedEmail.findFirst({
      where: {
        quoteRequestId,
        emailType,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!latestEditedEmail) {
      return NextResponse.json(
        { error: "No edited email found for the specified type" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: latestEditedEmail });
  } catch (error) {
    console.error("Error retrieving latest edited email:", error);
    return NextResponse.json(
      { error: "Failed to retrieve latest edited email" },
      { status: 500 }
    );
  }
}