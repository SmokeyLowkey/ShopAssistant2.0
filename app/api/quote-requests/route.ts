import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";

// GET /api/quote-requests - Get all quote requests for the current user
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
    const status = url.searchParams.get("status") as QuoteStatus | null;
    const supplierId = url.searchParams.get("supplierId");
    const includeWithEmailThread = url.searchParams.get("includeWithEmailThread") === "true";

    console.log("Query params:", { status, supplierId, includeWithEmailThread });

    // Build the where clause
    const where: any = {
      organizationId: user.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    // Handle the includeWithEmailThread parameter
    if (!includeWithEmailThread) {
      // If includeWithEmailThread is false, only include quote requests without email threads
      where.emailThread = null;
    } else {
      // If includeWithEmailThread is true, include all quote requests
      // No additional filter needed, but we'll log it for clarity
      console.log("Including all quote requests, with or without email threads");
    }
    
    console.log("Final where clause:", JSON.stringify(where));

    // Get all quote requests for the organization
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
        pickList: {
          select: {
            id: true,
            conversationId: true,
          },
        },
        emailThread: {
          include: {
            messages: {
              select: {
                id: true,
                direction: true,
                from: true,
                to: true,
                subject: true,
                sentAt: true,
                receivedAt: true,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 5,
            },
          },
        },
        emailThreads: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Log the results
    console.log(`Found ${quoteRequests.length} quote requests`);
    quoteRequests.forEach((quote, index) => {
      console.log(`Quote #${index + 1}: ID=${quote.id}, Number=${quote.quoteNumber}, Title=${quote.title}`);
      
      // Handle both old (singular) and new (array) emailThread structure
      const emailThreads = Array.isArray(quote.emailThread) 
        ? quote.emailThread 
        : quote.emailThread 
          ? [quote.emailThread] 
          : [];
      
      console.log(`  Has EmailThreads: ${emailThreads.length > 0 ? 'Yes' : 'No'}`);
      if (emailThreads.length > 0) {
        console.log(`  EmailThread Count: ${emailThreads.length}`);
        emailThreads.forEach((thread: any, threadIndex: number) => {
          console.log(`    Thread #${threadIndex + 1}: ID=${thread.id}, Message Count=${thread.messages?.length || 0}`);
        });
      }
      
      // Also log QuoteRequestEmailThreads from junction table if present
      if (quote.emailThreads && quote.emailThreads.length > 0) {
        console.log(`  QuoteRequestEmailThreads: ${quote.emailThreads.length}`);
        quote.emailThreads.forEach((qret: any, idx: number) => {
          console.log(`    QRET #${idx + 1}: Supplier=${qret.supplier?.name}, Status=${qret.status}, IsPrimary=${qret.isPrimary}`);
        });
      }
    });
    
    return NextResponse.json({ data: quoteRequests });
  } catch (error) {
    console.error("Error fetching quote requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote requests" },
      { status: 500 }
    );
  }
}

// POST /api/quote-requests - Create a new quote request
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { supplierId, title, description, items, notes, expiryDate, vehicleId, pickListId } = await req.json();

    if (!supplierId || !title || !items || items.length === 0 || !vehicleId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the supplier exists and belongs to the organization
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: user.organizationId,
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Generate a unique quote number in the format QR-MM-YYYY-XXXX
    let quoteNumber = '';
    let isUnique = false;
    
    while (!isUnique) {
      const now = new Date();
      const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
      const year = now.getFullYear();
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      
      quoteNumber = `QR-${month}-${year}-${randomNum}`;
      
      // Check if this quote number already exists
      const existingQuote = await prisma.quoteRequest.findFirst({
        where: {
          quoteNumber,
          organizationId: user.organizationId,
        },
      });
      
      if (!existingQuote) {
        isUnique = true;
      }
    }

    // Create a new quote request
    const quoteRequest = await prisma.quoteRequest.create({
      data: {
        quoteNumber,
        title,
        description,
        notes,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        status: QuoteStatus.DRAFT,
        organization: {
          connect: {
            id: user.organizationId,
          },
        },
        supplier: {
          connect: {
            id: supplierId,
          },
        },
        vehicle: {
          connect: {
            id: vehicleId,
          },
        },
        pickList: pickListId ? {
          connect: {
            id: pickListId,
          },
        } : undefined,
        createdBy: {
          connect: {
            id: user.id,
          },
        },
        items: {
          create: items.map((item: any) => ({
            partNumber: item.partNumber,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            supplierPartNumber: item.supplierPartNumber,
            leadTime: item.leadTime,
            isAlternative: item.isAlternative || false,
            notes: item.notes,
          })),
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
        pickList: {
          select: {
            id: true,
            conversationId: true,
          },
        },
      },
    });

    return NextResponse.json({ data: quoteRequest }, { status: 201 });
  } catch (error) {
    console.error("Error creating quote request:", error);
    return NextResponse.json(
      { error: "Failed to create quote request" },
      { status: 500 }
    );
  }
}