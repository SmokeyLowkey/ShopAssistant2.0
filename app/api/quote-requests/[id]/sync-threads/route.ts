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

    // Check if we should force a re-sync (delete and recreate all links)
    const body = await req.json().catch(() => ({}));
    const forceResync = body.forceResync === true;

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

    // If forceResync is true, delete all existing links for this quote request
    if (forceResync) {
      await prisma.quoteRequestEmailThread.deleteMany({
        where: { quoteRequestId },
      });
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

    // Get email threads with their outbound messages to match by recipient
    const threadsWithMessages = await prisma.emailThread.findMany({
      where: {
        id: { in: quoteRequest.emailThread.map(t => t.id) },
      },
      include: {
        messages: {
          where: { direction: 'OUTBOUND' },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Match email threads to suppliers by recipient email address
    for (const supplier of suppliers) {
      const isPrimary = supplier.id === quoteRequest.supplierId;

      try {
        // Check if link already exists (skip if forceResync since we deleted all links)
        if (!forceResync) {
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
        }

        // Find the email thread that was sent to this supplier by matching recipient email
        const matchingThread = threadsWithMessages.find(thread => {
          const outboundMessage = thread.messages[0];
          return outboundMessage && outboundMessage.to?.includes(supplier.email || '');
        });

        if (!matchingThread) {
          results.errors.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            error: `No email thread found with recipient ${supplier.email}`,
          });
          continue;
        }

        // Create the link
        const link = await prisma.quoteRequestEmailThread.create({
          data: {
            quoteRequestId: quoteRequest.id,
            emailThreadId: matchingThread.id,
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
          emailThreadId: matchingThread.id,
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
