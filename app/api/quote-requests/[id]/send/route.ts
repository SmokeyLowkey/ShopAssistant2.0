import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateQuoteRequestEmail } from "@/lib/api/n8n-client";

/**
 * POST /api/quote-requests/:id/send
 * Send quote request emails to all suppliers (primary + additional)
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

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the quote request with supplier information
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id: quoteRequestId },
      include: {
        supplier: true,
        items: true,
        organization: true,
        vehicle: true,
      },
    });

    if (!quoteRequest) {
      return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
    }

    // Verify the user belongs to the organization that owns this quote request
    if (quoteRequest.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Parse additional supplier IDs (handles both JSON array and comma-separated string)
    let additionalSupplierIds: string[] = [];
    if (quoteRequest.additionalSupplierIds) {
      try {
        // First try to parse as JSON array
        additionalSupplierIds = JSON.parse(quoteRequest.additionalSupplierIds);
      } catch (e) {
        // If JSON parsing fails, treat as comma-separated string
        additionalSupplierIds = quoteRequest.additionalSupplierIds
          .split(',')
          .map(id => id.trim())
          .filter(id => id.length > 0);
        console.log("Parsed additionalSupplierIds from comma-separated string:", additionalSupplierIds);
      }
    }

    // Get all additional suppliers
    const additionalSuppliers = additionalSupplierIds.length > 0
      ? await prisma.supplier.findMany({
          where: {
            id: { in: additionalSupplierIds },
            organizationId: user.organizationId,
          },
        })
      : [];

    // Combine primary and additional suppliers
    const allSuppliers = [
      { ...quoteRequest.supplier, isPrimary: true },
      ...additionalSuppliers.map(s => ({ ...s, isPrimary: false })),
    ];

    // Results tracking
    const results = {
      totalSent: 0,
      totalFailed: 0,
      primary: null as any,
      additional: [] as any[],
      errors: [] as any[],
    };

    // Send email to each supplier
    for (const supplier of allSuppliers) {
      try {
        // Check if supplier has an email
        if (!supplier.email) {
          results.totalFailed++;
          results.errors.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            error: "Supplier does not have an email address",
          });
          continue;
        }

        // Create or get supplier-specific quote items
        // This ensures each supplier has their own set of items that can be independently priced
        const supplierItems = await Promise.all(
          quoteRequest.items.map(async (item) => {
            // Check if a supplier-specific item already exists
            const existingSupplierItem = await prisma.quoteRequestItem.findFirst({
              where: {
                quoteRequestId: quoteRequest.id,
                supplierId: supplier.id,
                partNumber: item.partNumber,
              },
            });

            if (existingSupplierItem) {
              return existingSupplierItem;
            }

            // Create a new supplier-specific item if it doesn't exist
            return await prisma.quoteRequestItem.create({
              data: {
                quoteRequestId: quoteRequest.id,
                supplierId: supplier.id,
                partNumber: item.partNumber,
                description: item.description,
                quantity: item.quantity,
                // Copy other fields if they exist
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                supplierPartNumber: item.supplierPartNumber,
                leadTime: item.leadTime,
                isAlternative: item.isAlternative,
                notes: item.notes,
                availability: item.availability,
                estimatedDeliveryDays: item.estimatedDeliveryDays,
                suggestedFulfillmentMethod: item.suggestedFulfillmentMethod,
              },
            });
          })
        );

        console.log(`[Send Quote] Created/retrieved ${supplierItems.length} supplier-specific items for ${supplier.name}`);

        // Prepare data for the email webhook with complete payload structure
        const emailData = {
          quoteRequestId: quoteRequest.id,
          quoteNumber: quoteRequest.quoteNumber,
          supplierId: supplier.id, // CRITICAL: Include supplier ID so webhook knows which supplier this is for
          isPrimary: supplier.isPrimary,
          suggestedFulfillmentMethod: quoteRequest.suggestedFulfillmentMethod || undefined,
          pickListId: quoteRequest.pickListId || undefined,

          // Timing information
          timing: {
            requestDate: quoteRequest.requestDate.toISOString(),
            expiryDate: quoteRequest.expiryDate?.toISOString(),
            expectedResponseDate: quoteRequest.expiryDate?.toISOString(),
          },

          // Supplier information
          supplier: {
            id: supplier.id,
            name: supplier.name,
            email: supplier.email,
            contactPerson: supplier.contactPerson || undefined,
          },

          // Items - use supplier-specific items with their IDs
          items: supplierItems.map(item => ({
            id: item.id, // Include the supplier-specific item ID
            partNumber: item.partNumber,
            description: item.description,
            quantity: item.quantity,
          })),
          
          // Requirements
          requirements: {
            deliveryDate: quoteRequest.expiryDate?.toISOString(),
            specialInstructions: quoteRequest.notes || undefined,
          },
          
          // Special Instructions (notes) - always included for n8n workflow
          specialInstructions: quoteRequest.notes || undefined,
          notes: quoteRequest.notes || undefined,
          description: quoteRequest.description || undefined,
          
          // Organization information
          organization: {
            id: quoteRequest.organization.id,
            name: quoteRequest.organization.name,
            contactInfo: `${user.name || 'Contact'} | ${user.email} | ${quoteRequest.organization.domain || ''}`,
          },
          
          // User information
          user: {
            id: user.id,
            name: user.name || 'User',
            email: user.email,
            role: user.role,
          },
          
          // Vehicle information
          vehicle: quoteRequest.vehicle ? {
            id: quoteRequest.vehicle.id,
            vehicleId: quoteRequest.vehicle.vehicleId,
            make: quoteRequest.vehicle.make,
            model: quoteRequest.vehicle.model,
            year: quoteRequest.vehicle.year,
            serialNumber: quoteRequest.vehicle.serialNumber || undefined,
          } : undefined,
          
          // Email thread creation info
          emailThread: {
            createdById: user.id,
          },
        };

        // Call the webhook to generate and send the email
        const emailResponse = await generateQuoteRequestEmail(emailData);

        // Store result
        const resultData = {
          supplierId: supplier.id,
          supplierName: supplier.name,
          emailContent: emailResponse.emailContent,
          messageId: emailResponse.messageId,
        };

        if (supplier.isPrimary) {
          results.primary = resultData;
        } else {
          results.additional.push(resultData);
        }

        results.totalSent++;
      } catch (error) {
        console.error(`Error sending email to supplier ${supplier.name}:`, error);
        results.totalFailed++;
        results.errors.push({
          supplierId: supplier.id,
          supplierName: supplier.name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // After sending all emails, link the email threads to suppliers via junction table
    // This is a temporary solution until n8n workflow calls the link endpoint
    try {
      console.log('Attempting to link email threads to suppliers...');
      
      // Fetch the quote request with its email threads
      const quoteRequestWithThreads = await prisma.quoteRequest.findUnique({
        where: { id: quoteRequestId },
        include: {
          emailThread: {
            orderBy: { createdAt: 'desc' },
            take: allSuppliers.length, // Get the most recent threads matching supplier count
          },
        },
      });

      if (quoteRequestWithThreads && quoteRequestWithThreads.emailThread.length > 0) {
        console.log(`Found ${quoteRequestWithThreads.emailThread.length} email threads to link`);

        // Get threads with their messages to match by recipient email
        const threadsWithMessages = await prisma.emailThread.findMany({
          where: {
            id: { in: quoteRequestWithThreads.emailThread.map(t => t.id) },
          },
          include: {
            messages: {
              where: { direction: 'OUTBOUND' }, // Only check outbound messages
              take: 1,
              orderBy: { createdAt: 'asc' },
            },
          },
        });

        // Create junction table entries by matching supplier email to thread recipient
        for (const supplier of allSuppliers) {
          try {
            // Check if link already exists
            const existingLink = await prisma.quoteRequestEmailThread.findUnique({
              where: {
                quoteRequestId_supplierId: {
                  quoteRequestId: quoteRequestId,
                  supplierId: supplier.id,
                },
              },
            });

            if (existingLink) {
              console.log(`Link already exists for supplier ${supplier.name}`);
              continue;
            }

            // Find the email thread that was sent to this supplier
            const matchingThread = threadsWithMessages.find(thread => {
              const outboundMessage = thread.messages[0];
              return outboundMessage && outboundMessage.to?.includes(supplier.email || '');
            });

            if (!matchingThread) {
              console.warn(`No matching email thread found for supplier ${supplier.name} (${supplier.email})`);
              continue;
            }

            // Create the link
            await prisma.quoteRequestEmailThread.create({
              data: {
                quoteRequestId: quoteRequestId,
                emailThreadId: matchingThread.id,
                supplierId: supplier.id,
                isPrimary: supplier.isPrimary,
                status: 'SENT',
              },
            });
            console.log(`Linked email thread ${matchingThread.id} to supplier ${supplier.name} (${supplier.email})`);
          } catch (linkError) {
            console.error(`Error linking thread for supplier ${supplier.name}:`, linkError);
          }
        }
      } else {
        console.log('No email threads found to link - they may be created asynchronously by n8n');
      }
    } catch (linkError) {
      console.error('Error linking email threads:', linkError);
      // Don't fail the entire request if linking fails
    }

    return NextResponse.json({
      success: results.totalSent > 0,
      data: results,
    });
  } catch (error) {
    console.error("Error sending quote request emails:", error);
    return NextResponse.json(
      { error: "Failed to send quote request emails" },
      { status: 500 }
    );
  }
}
