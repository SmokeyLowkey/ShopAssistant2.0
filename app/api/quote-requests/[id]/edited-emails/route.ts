import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET /api/quote-requests/[id]/edited-emails
// Retrieves all edited emails for a quote request
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quoteRequestId = await params.id;
    
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

    // Get all edited emails for this quote request
    const editedEmails = await prisma.editedEmail.findMany({
      where: {
        quoteRequestId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ data: editedEmails });
  } catch (error) {
    console.error("Error retrieving edited emails:", error);
    return NextResponse.json(
      { error: "Failed to retrieve edited emails" },
      { status: 500 }
    );
  }
}

// POST /api/quote-requests/[id]/edited-emails
// Creates a new edited email for a quote request
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quoteRequestId = await params.id;
    const body = await request.json();
    
    // Validate required fields
    const { emailType, subject, body: emailBody } = body;
    if (!emailType || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    // Create the edited email
    const editedEmail = await prisma.editedEmail.create({
      data: {
        quoteRequestId,
        emailType,
        subject,
        body: emailBody,
        bodyHtml: body.bodyHtml,
      },
    });

    // Update the quote request status to UNDER_REVIEW if it's not already
    if (quoteRequest.status !== "UNDER_REVIEW") {
      await prisma.quoteRequest.update({
        where: { id: quoteRequestId },
        data: { status: "UNDER_REVIEW" },
      });
    }

    return NextResponse.json({ data: editedEmail }, { status: 201 });
  } catch (error) {
    console.error("Error creating edited email:", error);
    return NextResponse.json(
      { error: "Failed to create edited email" },
      { status: 500 }
    );
  }
}
