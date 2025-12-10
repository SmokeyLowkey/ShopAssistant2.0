import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";
import { generateQuoteRequestEmail } from "@/lib/api/n8n-client";

// POST /api/quote-requests/:id/send-email - Send a quote request email
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quoteRequestId = params.id;

    // Get the quote request with supplier information
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: quoteRequestId,
      },
      include: {
        supplier: true,
        items: true,
        organization: true,
      },
    });

    if (!quoteRequest) {
      return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
    }

    // Verify the user belongs to the organization that owns this quote request
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user || quoteRequest.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if supplier has an email
    if (!quoteRequest.supplier.email) {
      return NextResponse.json(
        { error: "Supplier does not have an email address" },
        { status: 400 }
      );
    }

    // Prepare data for the email webhook
    const emailData = {
      quoteRequestId: quoteRequest.id,
      supplier: {
        id: quoteRequest.supplier.id,
        name: quoteRequest.supplier.name,
        email: quoteRequest.supplier.email,
        contactPerson: quoteRequest.supplier.contactPerson || undefined,
      },
      items: quoteRequest.items.map(item => ({
        partNumber: item.partNumber,
        description: item.description,
        quantity: item.quantity,
      })),
      requirements: {
        deliveryDate: quoteRequest.expiryDate?.toISOString(),
        specialInstructions: quoteRequest.notes || undefined,
      },
      organization: {
        name: quoteRequest.organization.name,
        contactInfo: user.email,
      },
    };

    // Call the webhook to generate the email
    const emailResponse = await generateQuoteRequestEmail(emailData);

    // Create an email thread for this quote request
    const emailThread = await prisma.emailThread.create({
      data: {
        subject: emailResponse.emailContent.subject,
        status: "SENT",
        organization: {
          connect: {
            id: user.organizationId,
          },
        },
        supplier: {
          connect: {
            id: quoteRequest.supplierId,
          },
        },
        quoteRequest: {
          connect: {
            id: quoteRequest.id,
          },
        },
        createdBy: {
          connect: {
            id: user.id,
          },
        },
        messages: {
          create: {
            direction: "OUTBOUND",
            from: user.email || "noreply@example.com",
            to: [quoteRequest.supplier.email],
            subject: emailResponse.emailContent.subject,
            body: emailResponse.emailContent.body,
            bodyHtml: emailResponse.emailContent.bodyHtml,
            sentAt: new Date(),
            externalMessageId: emailResponse.messageId,
          },
        },
      },
    });

    // Update the quote request status and link to the email thread
    const updatedQuoteRequest = await prisma.quoteRequest.update({
      where: {
        id: quoteRequestId,
      },
      data: {
        status: QuoteStatus.SENT,
        emailThread: {
          connect: {
            id: emailThread.id,
          },
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            contactPerson: true,
          },
        },
        items: true,
        emailThread: {
          include: {
            messages: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
    });

    // Create an activity log entry
    await prisma.activityLog.create({
      data: {
        type: "QUOTE_REQUESTED",
        title: `Quote request sent to ${quoteRequest.supplier.name}`,
        description: `Quote request ${quoteRequest.quoteNumber} was sent to ${quoteRequest.supplier.name}`,
        entityType: "QuoteRequest",
        entityId: quoteRequest.id,
        userId: user.id,
        organization: {
          connect: {
            id: user.organizationId,
          },
        },
        metadata: {
          quoteNumber: quoteRequest.quoteNumber,
          supplierName: quoteRequest.supplier.name,
          itemCount: quoteRequest.items.length,
        },
      },
    });

    return NextResponse.json({
      data: {
        quoteRequest: updatedQuoteRequest,
        emailThread: emailThread,
        emailContent: emailResponse.emailContent,
      },
    });
  } catch (error) {
    console.error("Error sending quote request email:", error);
    return NextResponse.json(
      { error: "Failed to send quote request email" },
      { status: 500 }
    );
  }
}