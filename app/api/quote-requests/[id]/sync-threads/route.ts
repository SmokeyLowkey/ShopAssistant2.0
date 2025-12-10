import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/quote-requests/:id/sync-threads
 * Sync email threads with suppliers by creating missing junction table entries
 * This is useful when email threads are created by n8n but not linked yet
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

    // Verify the user belongs to the organization that owns this quote request
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the quote request with email threads and suppliers
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id: quoteRequestId },
      include: {
        emailThread: {
          orderBy: { createdAt: 'desc' },
        },
        emailThreads: true, // Existing links
      },
    });

    if (!quoteRequest) {
      return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
    }

    if (quoteRequest.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get all suppliers (primary + additional)
    const supplierIds = [quoteRequest.supplierId];
    if (quoteRequest.additionalSupplierIds) {
      // additionalSupplierIds can be:
      // 1. A comma-separated string: "id1,id2,id3"
      // 2. A JSON array string: '["id1","id2","id3"]'
      // 3. A single ID string: "id1"
      let additionalIds: string[];
      const trimmed = quoteRequest.additionalSupplierIds.trim();
      
      if (trimmed.startsWith('[')) {
        // It's a JSON array
        additionalIds = JSON.parse(trimmed);
      } else if (trimmed.includes(',')) {
        // It's comma-separated
        additionalIds = trimmed.split(',').map(id => id.trim()).filter(Boolean);
      } else {
        // It's a single ID
        additionalIds = [trimmed];
      }
      
      supplierIds.push(...additionalIds);
    }

    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
    });

    const results = {
      linked: [] as any[],
      alreadyLinked: [] as any[],
      errors: [] as any[],
    };

    // Match email threads to suppliers
    // Assumption: threads are created in the same order as suppliers were processed
    for (let i = 0; i < suppliers.length && i < quoteRequest.emailThread.length; i++) {
      const supplier = suppliers[i];
      const emailThread = quoteRequest.emailThread[i];
      const isPrimary = supplier.id === quoteRequest.supplierId;

      try {
        // Check if link already exists
        const existingLink = quoteRequest.emailThreads.find(
          link => link.supplierId === supplier.id
        );

        if (existingLink) {
          results.alreadyLinked.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            emailThreadId: existingLink.emailThreadId,
          });
          continue;
        }

        // Create the link
        const link = await prisma.quoteRequestEmailThread.create({
          data: {
            quoteRequestId: quoteRequest.id,
            emailThreadId: emailThread.id,
            supplierId: supplier.id,
            isPrimary,
            status: 'SENT',
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

        results.linked.push({
          supplierId: supplier.id,
          supplierName: supplier.name,
          emailThreadId: emailThread.id,
          isPrimary,
        });
      } catch (error) {
        console.error(`Error linking thread for supplier ${supplier.name}:`, error);
        results.errors.push({
          supplierId: supplier.id,
          supplierName: supplier.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      summary: {
        totalSuppliers: suppliers.length,
        totalThreads: quoteRequest.emailThread.length,
        linked: results.linked.length,
        alreadyLinked: results.alreadyLinked.length,
        errors: results.errors.length,
      },
    });
  } catch (error) {
    console.error("Error syncing email threads:", error);
    return NextResponse.json(
      { error: "Failed to sync email threads" },
      { status: 500 }
    );
  }
}
