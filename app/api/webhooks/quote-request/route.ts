import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateQuoteRequestEmail, QuoteRequestEmailData } from "@/lib/api/n8n-client";

// POST /api/webhooks/quote-request - Send a quote request email
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read request body once and destructure all needed values
    const { quoteRequestId, additionalSupplierIds = [] } = await req.json();

    if (!quoteRequestId) {
      return NextResponse.json(
        { error: "Missing quoteRequestId" },
        { status: 400 }
      );
    }

    // Get the quote request with related data
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: quoteRequestId,
      },
      include: {
        supplier: true,
        items: true,
        vehicle: true,
      },
    });

    if (!quoteRequest) {
      return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
    }

    // Get the user and organization information
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      include: {
        organization: true,
      },
    });

    if (!user || quoteRequest.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get organization details
    const organization = user.organization;
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Collect all suppliers (primary + additional)
    // First, check if additionalSupplierIds are stored in the database
    let allSupplierIdsToSend = [quoteRequest.supplierId];
    
    if (quoteRequest.additionalSupplierIds) {
      // Parse comma-separated IDs from database
      const storedSupplierIds = quoteRequest.additionalSupplierIds
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
      allSupplierIdsToSend.push(...storedSupplierIds);
    }
    
    // Also add any additional IDs passed in the request body
    if (additionalSupplierIds && additionalSupplierIds.length > 0) {
      allSupplierIdsToSend.push(...additionalSupplierIds);
    }
    
    // Remove duplicates
    const uniqueSupplierIds = [...new Set(allSupplierIdsToSend)];
    
    const allSuppliers = await prisma.supplier.findMany({
      where: {
        id: { in: uniqueSupplierIds },
        organizationId: user.organizationId,
      },
    });

    // Filter out suppliers without email
    const validSuppliers = allSuppliers.filter(s => s.email);
    
    if (validSuppliers.length === 0) {
      return NextResponse.json(
        { error: "No suppliers have email addresses" },
        { status: 400 }
      );
    }

    // Validate primary supplier has email
    if (!quoteRequest.supplier.email) {
      return NextResponse.json(
        { error: "Primary supplier does not have an email address" },
        { status: 400 }
      );
    }

    // Prepare data for the email webhook with multiple suppliers
    const emailData: QuoteRequestEmailData = {
      quoteRequestId: quoteRequest.id,
      quoteNumber: quoteRequest.quoteNumber,
      suggestedFulfillmentMethod: quoteRequest.suggestedFulfillmentMethod || undefined,
      pickListId: quoteRequest.pickListId || undefined,
      additionalSupplierIds: quoteRequest.additionalSupplierIds || undefined,
      supplier: {
        id: quoteRequest.supplier.id,
        name: quoteRequest.supplier.name,
        email: quoteRequest.supplier.email,
        contactPerson: quoteRequest.supplier.contactPerson || undefined,
      },
      // Add additional suppliers for N8N to handle
      additionalSuppliers: validSuppliers.filter(s => s.id !== quoteRequest.supplierId).map(s => ({
        id: s.id,
        name: s.name,
        email: s.email!,
        contactPerson: s.contactPerson || undefined,
      })),
      items: quoteRequest.items.map(item => ({
        partNumber: item.partNumber,
        description: item.description,
        quantity: item.quantity,
      })),
      organization: {
        id: organization.id,
        name: organization.name,
        contactInfo: `${user.name || 'Contact'} | ${user.email} | ${organization.domain || ''}`,
      },
      user: {
        id: user.id,
        name: user.name || 'User',
        email: user.email,
        role: user.role,
      },
      emailThread: {
        createdById: user.id,
      },
      // Add vehicle data if available
      vehicle: quoteRequest.vehicle ? {
        id: quoteRequest.vehicle.id,
        vehicleId: quoteRequest.vehicle.vehicleId,
        make: quoteRequest.vehicle.make,
        model: quoteRequest.vehicle.model,
        year: quoteRequest.vehicle.year,
        serialNumber: quoteRequest.vehicle.serialNumber || undefined,
      } : undefined,
      // Add timing information
      timing: {
        requestDate: quoteRequest.requestDate.toISOString(),
        expiryDate: quoteRequest.expiryDate ? quoteRequest.expiryDate.toISOString() : undefined,
        expectedResponseDate: quoteRequest.expiryDate ? quoteRequest.expiryDate.toISOString() : undefined,
      },
      // Add requirements with response date expectations
      requirements: {
        requestedResponseDate: quoteRequest.expiryDate ? quoteRequest.expiryDate.toISOString() : undefined,
      },
    };

    // Call the webhook to generate the email
    const emailResponse = await generateQuoteRequestEmail(emailData);

    // Create an email thread for this quote request if it doesn't exist
    let emailThread = await prisma.emailThread.findFirst({
      where: {
        quoteRequestId: quoteRequest.id,
      },
    });

    if (!emailThread) {
      emailThread = await prisma.emailThread.create({
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
              to: quoteRequest.supplier.email!, // Already validated above
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
      await prisma.quoteRequest.update({
        where: {
          id: quoteRequestId,
        },
        data: {
          status: "SENT",
          emailThread: {
            connect: {
              id: emailThread.id,
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
          organizationId: user.organizationId,
          metadata: {
            quoteNumber: quoteRequest.quoteNumber,
            supplierName: quoteRequest.supplier.name,
            itemCount: quoteRequest.items.length,
          },
        },
      });
    }

    // Return the email response
    return NextResponse.json({
      data: {
        emailResponse,
        emailThread
      }
    });
  } catch (error) {
    console.error("Error sending quote request email:", error);
    return NextResponse.json(
      { error: "Failed to send quote request email" },
      { status: 500 }
    );
  }
}