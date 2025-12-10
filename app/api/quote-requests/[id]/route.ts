import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";

// GET /api/quote-requests/:id - Get a specific quote request
export async function GET(
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

    // Get the quote request with related data
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: quoteRequestId,
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
        selectedSupplier: {
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
          orderBy: [
            { isPrimary: 'desc' },
            { createdAt: 'asc' },
          ],
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

    return NextResponse.json({ data: quoteRequest });
  } catch (error) {
    console.error("Error fetching quote request:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote request" },
      { status: 500 }
    );
  }
}

// PUT /api/quote-requests/:id - Update a quote request
export async function PUT(
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
    const { title, status, description, notes, expiryDate, vehicleId, items, additionalSupplierIds } = await req.json();

    // Verify the quote request exists
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: quoteRequestId,
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

    // Build update data object
    const updateData: any = {}
    
    if (title !== undefined) updateData.title = title
    if (status !== undefined) updateData.status = status
    if (description !== undefined) updateData.description = description
    if (notes !== undefined) updateData.notes = notes
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : null
    
    // Handle additional supplier IDs (comma-separated string)
    if (additionalSupplierIds !== undefined) {
      updateData.additionalSupplierIds = Array.isArray(additionalSupplierIds) 
        ? additionalSupplierIds.join(',') 
        : additionalSupplierIds
    }
    
    // Handle vehicle relationship
    if (vehicleId !== undefined) {
      if (vehicleId === null) {
        updateData.vehicle = { disconnect: true }
      } else {
        updateData.vehicle = { connect: { id: vehicleId } }
      }
    }

    // Update the quote request
    const updatedQuoteRequest = await prisma.quoteRequest.update({
      where: {
        id: quoteRequestId,
      },
      data: updateData,
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
    });

    // Handle items update if provided
    if (items !== undefined && Array.isArray(items)) {
      // Delete all existing items
      await prisma.quoteRequestItem.deleteMany({
        where: { quoteRequestId },
      });
      
      // Create new items
      if (items.length > 0) {
        await prisma.quoteRequestItem.createMany({
          data: items.map((item: any) => ({
            quoteRequestId,
            partNumber: item.partNumber,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            notes: item.notes,
          })),
        });
      }
      
      // Fetch updated quote request with new items
      const finalQuoteRequest = await prisma.quoteRequest.findUnique({
        where: { id: quoteRequestId },
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
      });
      
      return NextResponse.json({ data: finalQuoteRequest });
    }

    return NextResponse.json({ data: updatedQuoteRequest });
  } catch (error) {
    console.error("Error updating quote request:", error);
    return NextResponse.json(
      { error: "Failed to update quote request" },
      { status: 500 }
    );
  }
}

// PATCH /api/quote-requests/:id - Partially update a quote request (e.g., pickListId)
export async function PATCH(
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
    const body = await req.json();

    // Verify the quote request exists
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: quoteRequestId,
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

    // Build update data object - only update fields that are provided
    const updateData: any = {}
    
    if (body.pickListId !== undefined) {
      if (body.pickListId === null) {
        updateData.pickList = { disconnect: true }
      } else {
        updateData.pickList = { connect: { id: body.pickListId } }
      }
    }

    // Update the quote request
    const updatedQuoteRequest = await prisma.quoteRequest.update({
      where: {
        id: quoteRequestId,
      },
      data: updateData,
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

    return NextResponse.json({ data: updatedQuoteRequest });
  } catch (error) {
    console.error("Error patching quote request:", error);
    return NextResponse.json(
      { error: "Failed to update quote request" },
      { status: 500 }
    );
  }
}

// DELETE /api/quote-requests/:id - Delete a quote request
export async function DELETE(
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

    // Verify the quote request exists
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: quoteRequestId,
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

    // Delete the quote request
    await prisma.quoteRequest.delete({
      where: {
        id: quoteRequestId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quote request:", error);
    return NextResponse.json(
      { error: "Failed to delete quote request" },
      { status: 500 }
    );
  }
}