import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updatePartPrices } from "@/lib/api/n8n-client";
import { ItemAvailability } from "@prisma/client";

// POST /api/quote-requests/[id]/prices - Refresh prices for quote request items
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
    const body = await req.json();
    const { supplierId } = body; // Optional: if provided, only update items for this supplier
    
    console.log('[Price Update API] Request received:', {
      quoteRequestId,
      supplierId,
      hasSupplierIdInBody: !!supplierId,
      bodyKeys: Object.keys(body)
    });
    
    // Get the quote request to verify it exists and belongs to the user's organization
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: quoteRequestId,
      },
      include: {
        items: supplierId ? {
          where: {
            OR: [
              { supplierId: supplierId },
              { supplierId: null } // Include items without supplier (legacy)
            ]
          }
        } : true,
        emailThreads: supplierId ? {
          where: {
            supplierId: supplierId // Only get threads for this supplier
          },
          include: {
            emailThread: {
              include: {
                messages: {
                  include: {
                    attachments: {
                      select: {
                        id: true,
                        filename: true,
                        contentType: true,
                        size: true,
                        extractedText: true,
                      },
                    },
                  },
                  orderBy: {
                    receivedAt: 'desc',
                  },
                },
              },
            }
          },
        } : {
          include: {
            emailThread: {
              include: {
                messages: {
                  include: {
                    attachments: {
                      select: {
                        id: true,
                        filename: true,
                        contentType: true,
                        size: true,
                        extractedText: true,
                      },
                    },
                  },
                  orderBy: {
                    receivedAt: 'desc',
                  },
                },
              },
            }
          },
        },
      },
    });

    if (!quoteRequest) {
      return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
    }

    // Get the user's organization
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
      include: { organization: true },
    });

    if (!user || quoteRequest.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get all email messages from the thread (both inbound and outbound)
    // If supplierId is provided, only get messages from that supplier's thread
    const allMessages = supplierId
      ? quoteRequest.emailThreads
          ?.filter(junctionRecord => junctionRecord.supplierId === supplierId)
          .flatMap(junctionRecord => junctionRecord.emailThread?.messages || []) || []
      : quoteRequest.emailThreads
          ?.flatMap(junctionRecord => junctionRecord.emailThread?.messages || []) || [];

    // Prepare data for the webhook
    // IMPORTANT: Do NOT send current prices - n8n should extract prices from supplier's email
    // Sending current prices causes compounding discounts on each refresh

    // Filter items to only include those for the specified supplier (if provided)
    let itemsToUpdate = supplierId
      ? quoteRequest.items.filter((item: any) => item.supplierId === supplierId)
      : quoteRequest.items;

    // If no supplier-specific items found but supplierId is provided, create them
    if (supplierId && itemsToUpdate.length === 0) {
      console.log(`[Price Update API] No supplier-specific items found for supplier ${supplierId}, creating them...`);

      // Get items without supplier ID (original items)
      const originalItems = quoteRequest.items.filter((item: any) => !item.supplierId);

      if (originalItems.length > 0) {
        // Create supplier-specific items
        itemsToUpdate = await Promise.all(
          originalItems.map(async (item: any) => {
            return await prisma.quoteRequestItem.create({
              data: {
                quoteRequestId: quoteRequest.id,
                supplierId: supplierId,
                partNumber: item.partNumber,
                description: item.description,
                quantity: item.quantity,
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

        console.log(`[Price Update API] Created ${itemsToUpdate.length} supplier-specific items`);
      }
    }

    console.log(`[Price Update API] Using ${itemsToUpdate.length} items for ${supplierId ? `supplier ${supplierId}` : 'all suppliers'}`);

    const priceUpdateData = {
      quoteRequestId,
      supplierId: supplierId, // Include supplier ID for targeted price updates
      items: itemsToUpdate.map((item: any) => ({
        id: item.id, // This is now the supplier-specific item ID
        partNumber: item.partNumber,
        description: item.description,
        quantity: item.quantity,
        // Do not send unitPrice, totalPrice, or leadTime - let n8n extract from email
      })),
      // Send all email messages in the thread for full context
      emailThread: allMessages.map((message: any) => ({
        id: message.id,
        from: message.from,
        to: message.to,
        subject: message.subject,
        body: message.body,
        bodyHtml: message.bodyHtml || undefined,
        direction: message.direction,
        sentAt: message.sentAt?.toISOString() || undefined,
        receivedAt: message.receivedAt?.toISOString() || undefined,
        createdAt: message.createdAt?.toISOString(),
        attachments: message.attachments?.map((att: any) => ({
          id: att.id,
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
          extractedText: att.extractedText || undefined,
        })) || [],
      }))
    };

    console.log('[Price Update API] Sending to n8n webhook:', {
      quoteRequestId,
      supplierId: priceUpdateData.supplierId,
      itemCount: priceUpdateData.items.length,
      messageCount: priceUpdateData.emailThread.length,
      fullPayload: JSON.stringify(priceUpdateData, null, 2).substring(0, 500) + '...'
    });

    // Call the webhook to update prices
    const response = await updatePartPrices(priceUpdateData);

    console.log("Price update response:", response);

    // Handle new response format with operations.update
    let updatedItems = response.updatedItems || [];

    // Check if response has operations.update structure (new format)
    if (!updatedItems.length && (response as any).operations?.update) {
      console.log("Using new response format with operations.update");
      updatedItems = (response as any).operations.update;
    }

    // Check success flag - if not present, check validation.hasErrors
    const hasErrors = (response as any).validation?.hasErrors ?? !response.success;

    if (hasErrors && response.success === false) {
      return NextResponse.json(
        { error: response.message || "Failed to update prices" },
        { status: 500 }
      );
    }

    // Check if we have structured pricing data or just a text output
    if (!updatedItems || updatedItems.length === 0) {
      console.log("No structured pricing data returned, n8n processed with text output");
      
      // Fetch the full quote request with all relationships for the response
      const fullQuoteRequest = await prisma.quoteRequest.findUnique({
        where: { id: quoteRequestId },
        include: {
          supplier: true,
          vehicle: true,
          items: true,
          emailThread: {
            include: {
              messages: true,
            },
          },
        },
      });
      
      // Return success but indicate that manual review may be needed
      return NextResponse.json({
        success: true,
        message: "Quote processed by supplier. Please review the email response for pricing details.",
        textOutput: (response as any).textOutput,
        quoteRequest: fullQuoteRequest,
      });
    }

    // Helper function to map availability strings to enum values
    const mapAvailability = (availability: string | undefined): ItemAvailability => {
      if (!availability) return ItemAvailability.UNKNOWN;
      
      const availabilityUpper = availability.toUpperCase();
      
      // Map common variations to valid enum values
      if (availabilityUpper.includes('IN_STOCK') || availabilityUpper === 'IN STOCK' || availabilityUpper === 'AVAILABLE') {
        return ItemAvailability.IN_STOCK;
      }
      if (availabilityUpper.includes('BACKORDER') || availabilityUpper === 'BACKORDERED') {
        return ItemAvailability.BACKORDERED;
      }
      if (availabilityUpper.includes('SPECIAL') || availabilityUpper === 'SPECIAL_ORDER' || availabilityUpper === 'SPECIAL ORDER') {
        return ItemAvailability.SPECIAL_ORDER;
      }
      if (availabilityUpper === 'LIMITED' || availabilityUpper.includes('PARTIAL')) {
        return ItemAvailability.IN_STOCK; // LIMITED availability still means some stock available
      }
      
      // Default to UNKNOWN for unrecognized values
      return ItemAvailability.UNKNOWN;
    };

    // Update the items in the database with the new prices and availability
    const updatePromises = updatedItems.map(async (updatedItem) => {
      return prisma.quoteRequestItem.update({
        where: { id: updatedItem.id },
        data: {
          supplierId: supplierId || undefined, // Link item to supplier if provided
          unitPrice: updatedItem.unitPrice,
          totalPrice: updatedItem.totalPrice,
          // leadTime should be a number (days), if it's a string, try to extract days or set to null
          leadTime: typeof updatedItem.leadTime === 'number' 
            ? updatedItem.leadTime 
            : typeof updatedItem.leadTime === 'string' && (updatedItem.leadTime as string).match(/\d+/)
              ? parseInt((updatedItem.leadTime as string).match(/\d+/)?.[0] || '0')
              : null,
          availability: mapAvailability(updatedItem.availability),
          estimatedDeliveryDays: updatedItem.estimatedDeliveryDays,
          suggestedFulfillmentMethod: updatedItem.suggestedFulfillmentMethod,
          
          // Update supplier part number and supersession tracking
          supplierPartNumber: updatedItem.supplierPartNumber,
          isSuperseded: updatedItem.isSuperseded || false,
          originalPartNumber: updatedItem.isSuperseded ? updatedItem.originalPartNumber : null,
          supersessionNotes: updatedItem.supersessionNotes,
          
          // Update alternative part tracking
          isAlternative: updatedItem.isAlternative || false,
          alternativeReason: updatedItem.alternativeReason,
          
          // Store any supplier notes, including leadTime text if it was a string
          supplierNotes: [
            updatedItem.supplierNotes,
            typeof updatedItem.leadTime === 'string' ? `Lead time: ${updatedItem.leadTime}` : null
          ].filter(Boolean).join('. '),
          
          updatedAt: new Date(),
        },
      });
    });

    await Promise.all(updatePromises);

    // Calculate and update the total amount for the quote request
    const updatedQuoteRequest = await prisma.quoteRequest.findUnique({
      where: { id: quoteRequestId },
      include: { items: true },
    });

    if (updatedQuoteRequest) {
      const totalAmount = updatedQuoteRequest.items.reduce(
        (sum, item) => sum + (item.totalPrice ? Number(item.totalPrice) : 0),
        0
      );

      await prisma.quoteRequest.update({
        where: { id: quoteRequestId },
        data: {
          totalAmount,
          suggestedFulfillmentMethod: response.overallRecommendation,
        },
      });
    }

    // Get the updated quote request with the new prices and all relationships
    const finalQuoteRequest = await prisma.quoteRequest.findUnique({
      where: { id: quoteRequestId },
      include: {
        items: true,
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
        // Include multi-supplier email threads (junction table) with their email threads and messages
        emailThreads: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                email: true,
                contactPerson: true,
                rating: true,
              },
            },
            emailThread: {
              include: {
                messages: {
                  include: {
                    attachments: {
                      select: {
                        id: true,
                        filename: true,
                        contentType: true,
                        size: true,
                        path: true,
                        extractedText: true,
                      },
                    },
                  },
                  orderBy: {
                    createdAt: "desc",
                  },
                },
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Prices and availability updated successfully",
      quoteRequest: finalQuoteRequest,
    });
  } catch (error) {
    console.error("Error updating prices:", error);
    return NextResponse.json(
      { error: "Failed to update prices" },
      { status: 500 }
    );
  }
}