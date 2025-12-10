import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QuoteStatus, OrderStatus, Priority, ItemAvailability, FulfillmentMethod } from "@prisma/client";
import { generateOrderConfirmationEmail } from "@/lib/api/n8n-client";

// POST /api/quote-requests/:id/convert-to-order - Convert a quote request to an order
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

    // Parse request body with error handling
    let fulfillmentMethod: FulfillmentMethod = 'DELIVERY';
    let itemFulfillment: any[] | undefined = undefined;
    let shippingAddress: any | undefined = undefined;
    let pickupLocation: string | undefined = undefined;
    let pickupDate: string | undefined = undefined;
    let specialInstructions: string | undefined = undefined;
    let selectedSupplierId: string | undefined = undefined;

    try {
      const contentType = req.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await req.json();
        fulfillmentMethod = body.fulfillmentMethod || 'DELIVERY';
        itemFulfillment = body.itemFulfillment;
        shippingAddress = body.shippingAddress;
        pickupLocation = body.pickupLocation;
        pickupDate = body.pickupDate;
        specialInstructions = body.specialInstructions;
        selectedSupplierId = body.selectedSupplierId;
      }
    } catch (e) {
      console.log('No JSON body provided, using defaults');
    }

    // Get the quote request with all related data
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: quoteRequestId,
      },
      include: {
        supplier: true,
        vehicle: true,
        items: true,
        emailThread: {
          include: {
            messages: {
              include: {
                attachments: true,
              },
              orderBy: {
                sentAt: 'asc' as const,
              },
            },
          },
        },
        emailThreads: {
          include: {
            emailThread: {
              include: {
                messages: {
                  include: {
                    attachments: true,
                  },
                  orderBy: {
                    sentAt: 'asc' as const,
                  },
                },
              },
            },
            supplier: true,
          },
        },
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

    // Determine which supplier to use for the order
    // If selectedSupplierId is provided, use that; otherwise use the primary supplier
    const orderSupplierId = selectedSupplierId || quoteRequest.supplierId;
    
    // Find the email thread for the selected supplier
    let selectedEmailThread = quoteRequest.emailThread && quoteRequest.emailThread.length > 0 ? quoteRequest.emailThread[0] : null;
    if (quoteRequest.emailThreads && quoteRequest.emailThreads.length > 0) {
      const threadLink = quoteRequest.emailThreads.find(
        (link) => link.supplierId === orderSupplierId
      );
      if (threadLink) {
        selectedEmailThread = threadLink.emailThread;
      }
    }

    // Check if the quote request has been approved
    if (quoteRequest.status !== QuoteStatus.APPROVED) {
      return NextResponse.json(
        { error: "Quote request must be approved before converting to an order" },
        { status: 400 }
      );
    }

    // Determine which supplier to use for the order
    const finalSupplierId = selectedSupplierId || quoteRequest.supplierId;
    
    // Find the corresponding email thread for the selected supplier
    let emailThreadToLink: any = quoteRequest.emailThread && quoteRequest.emailThread.length > 0 ? quoteRequest.emailThread[0] : null;
    if (quoteRequest.emailThreads && quoteRequest.emailThreads.length > 0) {
      const selectedThread = quoteRequest.emailThreads.find(
        et => et.supplierId === finalSupplierId
      );
      if (selectedThread) {
        emailThreadToLink = selectedThread.emailThread;
      }
    }

    // Generate an order number
    const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    // Calculate order totals
    const subtotal = quoteRequest.items.reduce(
      (sum, item) => sum + (Number(item.unitPrice) || 0) * item.quantity,
      0
    );
    const tax = 0; // This could be calculated based on tax rates
    const shipping = 0; // This could be set by the user
    const total = subtotal + tax + shipping;

    // Create a new order from the quote request with fulfillment information
    const order = await prisma.order.create({
      data: {
        orderNumber,
        status: OrderStatus.PROCESSING,
        priority: Priority.MEDIUM,
        orderDate: new Date(),
        subtotal,
        tax,
        shipping,
        total,
        notes: quoteRequest.notes,
        quoteReference: quoteRequest.quoteNumber,
        
        // New fulfillment fields
        fulfillmentMethod,
        partialFulfillment: fulfillmentMethod === 'SPLIT',
        pickupLocation: fulfillmentMethod === 'PICKUP' || fulfillmentMethod === 'SPLIT' ? pickupLocation : null,
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        
        organization: {
          connect: {
            id: user.organizationId,
          },
        },
        supplier: {
          connect: {
            id: finalSupplierId,
          },
        },
        createdBy: {
          connect: {
            id: user.id,
          },
        },
        // Link to the vehicle if it exists
        vehicle: quoteRequest.vehicle
          ? {
              connect: {
                id: quoteRequest.vehicle.id,
              },
            }
          : undefined,
        // Link to the email thread if it exists
        emailThread: emailThreadToLink
          ? {
              connect: {
                id: emailThreadToLink.id,
              },
            }
          : selectedEmailThread
          ? {
              connect: {
                id: selectedEmailThread.id,
              },
            }
          : undefined,
        // Create order items with fulfillment information
        orderItems: {
          create: await Promise.all(quoteRequest.items.map(async (item) => {
            // Get fulfillment method for this item (for split fulfillment)
            const itemMethod = itemFulfillment?.find((f: any) => f.itemId === item.id)?.method || fulfillmentMethod;
            
            // Ensure we have a partId - create a part if one doesn't exist
            let partId = item.partId;
            if (!partId) {
              // Use supplier's part number if different from requested, otherwise use requested
              const primaryPartNumber = item.supplierPartNumber || item.partNumber;
              
              // Check if a part with this part number already exists
              const existingPart = await prisma.part.findFirst({
                where: {
                  organizationId: user.organizationId,
                  partNumber: primaryPartNumber,
                },
              });
              
              if (existingPart) {
                // Use the existing part
                partId = existingPart.id;
                
                // Optionally update the existing part with new supersession info if it exists
                if (item.isSuperseded && !existingPart.supersededBy) {
                  await prisma.part.update({
                    where: { id: existingPart.id },
                    data: {
                      supersededBy: item.supplierPartNumber,
                      supersedes: item.originalPartNumber || item.partNumber,
                      supersessionDate: new Date(),
                      supersessionNotes: item.supersessionNotes,
                    },
                  });
                }
              } else {
                // Build comprehensive notes
                const notesParts = [
                  `Auto-created from quote ${quoteRequest.quoteNumber}`,
                  item.isSuperseded ? `Superseded from ${item.originalPartNumber || item.partNumber} to ${item.supplierPartNumber}` : null,
                  item.supersessionNotes,
                  item.isAlternative ? `Alternative part: ${item.alternativeReason || 'Supplier suggested alternative'}` : null,
                  item.supplierNotes,
                ].filter(Boolean);
                
                // Create a new part for this item with supersession tracking
                const newPart = await prisma.part.create({
                  data: {
                    partNumber: primaryPartNumber,
                    description: item.description,
                    category: "GENERAL",
                    
                    // Track supplier-specific part number if different
                    supplierPartNumber: item.supplierPartNumber !== item.partNumber 
                      ? item.supplierPartNumber 
                      : null,
                    
                    // Track supersession information
                    supersededBy: item.isSuperseded ? item.supplierPartNumber : null,
                    supersedes: item.isSuperseded ? (item.originalPartNumber || item.partNumber) : null,
                    supersessionDate: item.isSuperseded ? new Date() : null,
                    supersessionNotes: item.supersessionNotes,
                    
                    stockQuantity: 0,
                    minStockLevel: 0,
                    price: Number(item.unitPrice) || 0,
                    cost: Number(item.unitPrice) || 0,
                    
                    organization: {
                      connect: {
                        id: user.organizationId,
                      },
                    },
                  },
                });
                partId = newPart.id;
              }
            }
            
            // Build supplier notes for the order item
            const orderItemNotes = [
              item.supplierNotes,
              item.isSuperseded ? `Superseded: ${item.supersessionNotes || `${item.originalPartNumber || item.partNumber} → ${item.supplierPartNumber}`}` : null,
              item.isAlternative ? `Alternative: ${item.alternativeReason || 'Supplier suggested'}` : null,
            ].filter(Boolean).join('. ');
            
            // Create the order item
            return {
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice) || 0,
              totalPrice: Number(item.unitPrice || 0) * item.quantity,
              
              // New fulfillment fields
              availability: item.availability || 'UNKNOWN' as ItemAvailability,
              fulfillmentMethod: itemMethod as FulfillmentMethod,
              expectedDelivery: item.estimatedDeliveryDays 
                ? new Date(Date.now() + (item.estimatedDeliveryDays * 24 * 60 * 60 * 1000))
                : null,
              
              // Preserve supplier notes about supersessions/alternatives
              supplierNotes: orderItemNotes || null,
              
              part: {
                connect: {
                  id: partId
                }
              },
            };
          })),
        },
      },
    });
    
    // Get the created order with items
    const orderWithItems = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        supplier: true,
        vehicle: true,
        orderItems: {
          include: {
            part: true,
          },
        },
        organization: true,
        createdBy: true,
      },
    });

    if (!orderWithItems) {
      return NextResponse.json({ error: "Failed to retrieve created order" }, { status: 500 });
    }

    // Update the quote request status
    await prisma.quoteRequest.update({
      where: {
        id: quoteRequestId,
      },
      data: {
        status: QuoteStatus.CONVERTED_TO_ORDER,
      },
    });

    // If the supplier has an email, send an order confirmation email
    if (quoteRequest.supplier.email) {
      try {
        // Get organization details
        const organization = await prisma.organization.findUnique({
          where: { id: user.organizationId },
        });

        // Prepare data for the email webhook with comprehensive information
        const expectedResponseBy = new Date();
        expectedResponseBy.setHours(expectedResponseBy.getHours() + 24);
        
        const emailData = {
          // Order identification
          orderId: order.id,
          orderNumber: order.orderNumber,
          quoteRequestId: quoteRequest.id,
          quoteNumber: quoteRequest.quoteNumber,
          
          // Email tracking
          expectedResponseBy: expectedResponseBy.toISOString(),
          
          // Fulfillment information
          fulfillmentMethod: fulfillmentMethod as 'PICKUP' | 'DELIVERY' | 'SPLIT',
          partialFulfillment: fulfillmentMethod === 'SPLIT',
          
          // Supplier information
          supplier: {
            id: quoteRequest.supplier.id,
            name: quoteRequest.supplier.name,
            email: quoteRequest.supplier.email,
            type: quoteRequest.supplier.type,
            contactPerson: quoteRequest.supplier.contactPerson || undefined,
            phone: quoteRequest.supplier.phone || undefined,
            address: quoteRequest.supplier.address ? {
              street: quoteRequest.supplier.address || undefined,
              city: quoteRequest.supplier.city || undefined,
              state: quoteRequest.supplier.state || undefined,
              zipCode: quoteRequest.supplier.zipCode || undefined,
              country: quoteRequest.supplier.country || undefined,
            } : undefined,
          },
          
          // Organization information
          organization: {
            id: organization?.id || user.organizationId,
            name: organization?.name || 'Organization',
            contactInfo: organization?.billingEmail || user.email,
            billingAddress: {
              // Include billing address if available
            },
          },
          
          // User information
          user: {
            id: user.id,
            name: user.name || 'User',
            email: user.email,
            role: user.role,
            phone: user.phone || undefined,
          },
          
          // Vehicle information (if applicable)
          vehicle: quoteRequest.vehicle ? {
            id: quoteRequest.vehicle.id,
            vehicleId: quoteRequest.vehicle.vehicleId,
            make: quoteRequest.vehicle.make,
            model: quoteRequest.vehicle.model,
            year: quoteRequest.vehicle.year,
            serialNumber: quoteRequest.vehicle.serialNumber || undefined,
            type: quoteRequest.vehicle.type || undefined,
          } : undefined,
          
          // Email thread information with full conversation history
          emailThread: selectedEmailThread ? {
            id: selectedEmailThread.id,
            subject: selectedEmailThread.subject,
            status: selectedEmailThread.status,
            messages: selectedEmailThread.messages.map((msg: any) => ({
              id: msg.id,
              direction: msg.direction,
              subject: msg.subject,
              fromEmail: msg.from,
              toEmail: msg.to,
              cc: msg.cc.length > 0 ? msg.cc : undefined,
              bcc: msg.bcc.length > 0 ? msg.bcc : undefined,
              body: msg.body,
              htmlBody: msg.bodyHtml || undefined,
              sentAt: msg.sentAt?.toISOString() || msg.createdAt.toISOString(),
              receivedAt: msg.receivedAt?.toISOString() || undefined,
              followUpSentAt: msg.followUpSentAt?.toISOString() || undefined,
              followUpReason: msg.followUpReason || undefined,
              inReplyTo: msg.inReplyTo || undefined,
              externalMessageId: msg.externalMessageId || undefined,
              attachments: msg.attachments?.map((att: any) => ({
                id: att.id,
                filename: att.filename,
                s3Key: att.path,
                extractedText: att.extractedText || undefined,
              })),
            })),
          } : undefined,
          
          // Most recent quote content from supplier (last inbound message)
          mostRecentQuote: selectedEmailThread ? (() => {
            const lastInbound = selectedEmailThread.messages
              .filter((msg: any) => msg.direction === 'INBOUND')
              .sort((a: any, b: any) => {
                const aTime = a.sentAt?.getTime() || a.createdAt.getTime();
                const bTime = b.sentAt?.getTime() || b.createdAt.getTime();
                return bTime - aTime;
              })[0];
            
            return lastInbound ? {
              id: lastInbound.id,
              subject: lastInbound.subject,
              body: lastInbound.body,
              htmlBody: lastInbound.bodyHtml || undefined,
              sentAt: lastInbound.sentAt?.toISOString() || lastInbound.createdAt.toISOString(),
              attachments: lastInbound.attachments?.map((att: any) => ({
                filename: att.filename,
                extractedText: att.extractedText || undefined,
              })),
            } : undefined;
          })() : undefined,
          
          // Items with detailed information
          items: orderWithItems.orderItems.map(item => {
            // Get the corresponding quote request item for additional information
            const quoteItem = quoteRequest.items.find(qi => qi.partId === item.partId);
            
            return {
              id: item.id,
              partId: item.partId || undefined,
              partNumber: item.part?.partNumber || `Part #${item.id}`,
              description: item.part?.description || "Order item",
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
              totalPrice: Number(item.totalPrice),
              
              // Availability and fulfillment information
              availability: (item.availability || quoteItem?.availability || 'UNKNOWN') as 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN',
              fulfillmentMethod: itemFulfillment?.find((f: any) => f.itemId === quoteItem?.id)?.method || fulfillmentMethod as 'PICKUP' | 'DELIVERY',
              estimatedDeliveryDays: quoteItem?.estimatedDeliveryDays || undefined,
              leadTime: quoteItem?.leadTime || undefined,
              
              // Additional part information
              supplierPartNumber: quoteItem?.supplierPartNumber || undefined,
              category: item.part?.category || undefined,
              weight: item.part?.weight ? Number(item.part.weight) : undefined,
              dimensions: item.part?.dimensions ? JSON.parse(item.part.dimensions as string) : undefined,
            };
          }),
          
          // Order details
          orderDetails: {
            // Financial information
            totalAmount: Number(order.total),
            currency: "USD",
            paymentTerms: "Net 30",
            
            // Pickup information
            pickupLocation: order.pickupLocation || undefined,
            pickupDate: order.pickupDate?.toISOString(),
            
            // Delivery information
            shippingCarrier: order.shippingCarrier || undefined,
            trackingNumber: order.trackingNumber || undefined,
            deliveryAddress: shippingAddress ? {
              street: shippingAddress.street || '',
              city: shippingAddress.city || '',
              state: shippingAddress.state || '',
              zipCode: shippingAddress.zipCode || '',
              country: shippingAddress.country || 'USA',
            } : undefined,
            requestedDeliveryDate: order.expectedDelivery?.toISOString(),
            
            // Additional information
            notes: order.notes || quoteRequest.notes || undefined,
            specialInstructions: specialInstructions || undefined,
            purchaseOrderNumber: order.orderNumber,
          },
          
          // Timestamps
          timestamps: {
            orderDate: order.orderDate.toISOString(),
            quoteApprovalDate: quoteRequest.responseDate?.toISOString(),
            expectedFulfillmentDate: order.expectedDelivery?.toISOString(),
          },
        };

        // Call the webhook to generate the email with fulfillment information
        const emailResponse = await generateOrderConfirmationEmail(emailData);

        // Add the confirmation email to the email thread
        if (selectedEmailThread) {
          await prisma.emailMessage.create({
            data: {
              direction: "OUTBOUND",
              from: user.email || "noreply@example.com",
              to: quoteRequest.supplier.email,
              subject: emailResponse.emailContent.subject,
              body: emailResponse.emailContent.body,
              bodyHtml: emailResponse.emailContent.bodyHtml,
              sentAt: new Date(),
              externalMessageId: emailResponse.messageId,
              thread: {
                connect: {
                  id: selectedEmailThread.id,
                },
              },
            },
          });

          // Update the email thread status
          await prisma.emailThread.update({
            where: {
              id: selectedEmailThread.id,
            },
            data: {
              status: "CONVERTED_TO_ORDER",
            },
          });
        }
        
        // If the webhook response includes updated order information, update the order
        if (emailResponse.orderUpdates) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              trackingNumber: emailResponse.orderUpdates.trackingNumber || order.trackingNumber,
              shippingCarrier: emailResponse.orderUpdates.shippingCarrier || order.shippingCarrier,
              expectedDelivery: emailResponse.orderUpdates.expectedDeliveryDate 
                ? new Date(emailResponse.orderUpdates.expectedDeliveryDate) 
                : order.expectedDelivery,
              // Add any other fields that might be updated by the webhook
            },
          });
          
          // Update order items if needed
          if (emailResponse.orderUpdates.items && emailResponse.orderUpdates.items.length > 0) {
            for (const itemUpdate of emailResponse.orderUpdates.items) {
              await prisma.orderItem.update({
                where: { id: itemUpdate.id },
                data: {
                  availability: itemUpdate.availability || undefined,
                  trackingNumber: itemUpdate.trackingNumber || undefined,
                  expectedDelivery: itemUpdate.expectedDeliveryDate 
                    ? new Date(itemUpdate.expectedDeliveryDate) 
                    : undefined,
                  // Add any other item fields that might be updated
                },
              });
            }
          }
        }
      } catch (error) {
        console.error("Error sending order confirmation email:", error);
        // Continue with the order creation even if the email fails
      }
    }

    // Update quote request with selected supplier and update thread statuses
    if (quoteRequest.emailThreads && quoteRequest.emailThreads.length > 0) {
      // Update all thread statuses
      await Promise.all(
        quoteRequest.emailThreads.map(async (emailThread) => {
          const newStatus = emailThread.supplierId === finalSupplierId ? 'ACCEPTED' : 'REJECTED';
          return prisma.quoteRequestEmailThread.update({
            where: { id: emailThread.id },
            data: { status: newStatus },
          });
        })
      );
    }

    // Update quote request with selected supplier
    await prisma.quoteRequest.update({
      where: { id: quoteRequest.id },
      data: {
        status: QuoteStatus.CONVERTED_TO_ORDER,
        selectedSupplierId: finalSupplierId,
      },
    });

    // Create an activity log entry
    await prisma.activityLog.create({
      data: {
        type: "QUOTE_APPROVED",
        title: `Quote request converted to order`,
        description: `Quote request ${quoteRequest.quoteNumber} was converted to order ${order.orderNumber} with ${fulfillmentMethod} fulfillment`,
        entityType: "Order",
        entityId: order.id,
        userId: user.id,
        organization: {
          connect: {
            id: user.organizationId,
          },
        },
        metadata: {
          quoteNumber: quoteRequest.quoteNumber,
          orderNumber: order.orderNumber,
          supplierName: quoteRequest.supplier.name,
          vehicleId: quoteRequest.vehicle?.vehicleId,
          itemCount: orderWithItems.orderItems.length || 0,
          total: order.total,
          fulfillmentMethod,
          partialFulfillment: fulfillmentMethod === 'SPLIT',
        },
      },
    });

    return NextResponse.json({
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        quoteRequestId: quoteRequest.id,
        fulfillmentMethod,
      },
    });
  } catch (error) {
    console.error("Error converting quote request to order:", error);
    return NextResponse.json(
      { error: "Failed to convert quote request to order" },
      { status: 500 }
    );
  }
}