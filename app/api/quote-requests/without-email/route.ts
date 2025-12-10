import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";

/**
 * GET /api/quote-requests/without-email
 * Get all quote requests that don't have an associated email thread
 * Used for assigning orphaned emails to quote requests
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const supplierId = url.searchParams.get("supplierId");

    // Build the where clause
    const where: any = {
      organizationId: user.organizationId,
      // Only include quote requests that don't have an email thread
      emailThread: null,
    };

    // If supplierId is provided, filter by supplier
    if (supplierId) {
      where.supplierId = supplierId;
    }

    console.log("Fetching quote requests without email threads with filter:", where);

    // Get all quote requests without email threads for the organization
    const quoteRequests = await prisma.quoteRequest.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            contactPerson: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            vehicleId: true,
            make: true,
            model: true,
            year: true,
            serialNumber: true,
          },
        },
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`Found ${quoteRequests.length} quote requests without email threads`);

    return NextResponse.json({ data: quoteRequests });
  } catch (error) {
    console.error("Error fetching quote requests without email threads:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote requests without email threads" },
      { status: 500 }
    );
  }
}