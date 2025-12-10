import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST /api/quote-requests/[id]/update-thread-statuses - Auto-update thread statuses based on message direction
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: quoteRequestId } = await params;
    
    // Get all email threads for this quote request
    const quoteRequestThreads = await prisma.quoteRequestEmailThread.findMany({
      where: {
        quoteRequestId: quoteRequestId,
      },
      include: {
        emailThread: {
          include: {
            messages: {
              select: {
                id: true,
                direction: true,
                receivedAt: true,
              },
              orderBy: {
                receivedAt: 'desc',
              },
            },
          },
        },
      },
    });

    console.log('[Update Thread Statuses] Found threads:', quoteRequestThreads.length);

    const updates = [];

    for (const thread of quoteRequestThreads) {
      // Skip if already accepted or rejected
      if (thread.status === 'ACCEPTED' || thread.status === 'REJECTED') {
        continue;
      }

      // Check for inbound messages
      const hasInboundMessages = thread.emailThread.messages.some(
        (msg) => msg.direction === 'INBOUND'
      );

      // Update status if we found inbound messages and status is still SENT
      if (hasInboundMessages && thread.status === 'SENT') {
        console.log('[Update Thread Statuses] Updating thread for supplier:', thread.supplierId, 'to RESPONDED');
        
        const update = prisma.quoteRequestEmailThread.update({
          where: { id: thread.id },
          data: {
            status: 'RESPONDED',
            responseDate: thread.emailThread.messages.find(m => m.direction === 'INBOUND')?.receivedAt || new Date(),
          },
        });
        
        updates.push(update);
      }
    }

    // Execute all updates
    if (updates.length > 0) {
      await Promise.all(updates);
      console.log('[Update Thread Statuses] Updated', updates.length, 'thread statuses');
    }

    return NextResponse.json({
      success: true,
      updated: updates.length,
      message: `Updated ${updates.length} thread status(es)`,
    });
  } catch (error) {
    console.error("Error updating thread statuses:", error);
    return NextResponse.json(
      { error: "Failed to update thread statuses" },
      { status: 500 }
    );
  }
}
