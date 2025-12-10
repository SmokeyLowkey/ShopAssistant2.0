
# Quote-to-Order Conversion with Multiple Fulfillment Scenarios

This document outlines the implementation plan for enhancing the quote-to-order conversion process to support multiple fulfillment scenarios.

## Overview

The construction dashboard application needs to handle different fulfillment scenarios when converting quote requests to orders:

1. **All Parts In-Stock (Pickup)**: When all parts are available in-store, the user can convert the quote to an order and pick up the parts.
2. **Online Supplier (Delivery Only)**: When dealing with online suppliers that only deliver parts, the system needs to track shipping information and delivery status.
3. **Mixed Availability (Split Fulfillment)**: When some parts are available in-store but others need to be ordered, the system should support a hybrid approach where users can pick up available items and request delivery for the rest.

## Schema Enhancements

### Prisma Schema Updates

```prisma
// Add to Order model
trackingNumber    String?
fulfillmentMethod FulfillmentMethod @default(STANDARD)
partialFulfillment Boolean @default(false)
pickupLocation    String?
pickupDate        DateTime?
shippingCarrier   String?

// Add to OrderItem model
availability      ItemAvailability @default(UNKNOWN)
fulfillmentMethod FulfillmentMethod? // Override order-level method
trackingNumber    String? // For split shipments with different tracking
expectedDelivery  DateTime?
actualDelivery    DateTime?

// Add to QuoteRequestItem model
availability      ItemAvailability @default(UNKNOWN)
estimatedDeliveryDays Int?
suggestedFulfillmentMethod String?

// Add to QuoteRequest model
suggestedFulfillmentMethod String?

// New enums
enum FulfillmentMethod {
  PICKUP
  DELIVERY
  SPLIT
}

enum ItemAvailability {
  IN_STOCK
  BACKORDERED
  SPECIAL_ORDER
  UNKNOWN
}
```

## n8n Workflow Enhancements

### 1. Enhanced Price Update Workflow

The existing price update workflow will be enhanced to also assess item availability from supplier emails:

```typescript
// Updated PriceUpdateRequest interface
export interface PriceUpdateRequest {
  quoteRequestId: string;
  items: {
    id: string;
    partNumber: string;
    description: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    leadTime?: number;
  }[];
  supplierEmail?: {
    id: string;
    from: string;
    subject: string;
    body: string;
    bodyHtml?: string;
    receivedAt: string;
    direction: 'INBOUND';
  } | null;
}

// Updated PriceUpdateResponse interface with availability information
export interface PriceUpdateResponse {
  updatedItems: {
    id: string;
    unitPrice: number;
    totalPrice: number;
    leadTime?: number;
    availability: 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN';
    estimatedDeliveryDays?: number;
    suggestedFulfillmentMethod: 'PICKUP' | 'DELIVERY';
  }[];
  overallRecommendation: 'PICKUP' | 'DELIVERY' | 'SPLIT';
  success: boolean;
  message: string;
}
```

#### n8n Workflow Tasks:

1. Extract prices from supplier emails (existing functionality)
2. Analyze the email content to determine availability for each item
3. Assign an availability status to each item (IN_STOCK, BACKORDERED, etc.)
4. Calculate estimated delivery days based on availability and supplier type
5. Recommend a fulfillment method for each item
6. Provide an overall fulfillment recommendation based on all items

### 2. Enhanced Order Confirmation Workflow

The order confirmation webhook payload will be enhanced to include all necessary data for different fulfillment scenarios:

```typescript
// Enhanced OrderConfirmationRequest interface
export interface EnhancedOrderConfirmationRequest {
  // Order identification
  orderId: string;
  orderNumber: string;
  quoteRequestId: string;
  quoteNumber: string; // Added for reference
  
  // Fulfillment information
  fulfillmentMethod: 'PICKUP' | 'DELIVERY' | 'SPLIT';
  partialFulfillment: boolean; // Added to indicate split fulfillment
  
  // Supplier information
  supplier: {
    id: string;
    name: string;
    email: string;
    type: string; // Added supplier type (LOCAL_DEALER, ONLINE_RETAILER, etc.)
    contactPerson?: string; // Added contact person
    phone?: string; // Added phone number
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    }; // Added supplier address
  };
  
  // Organization information
  organization: {
    id: string;
    name: string;
    contactInfo: string;
    billingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    }; // Added billing address
  };
  
  // User information
  user: {
    id: string;
    name: string;
    email: string;
    role?: string;
    phone?: string;
  };
  
  // Vehicle information (if applicable)
  vehicle?: {
    id: string;
    vehicleId: string;
    make: string;
    model: string;
    year: number;
    serialNumber?: string;
    type?: string;
  };
  
  // Email thread information
  emailThread?: {
    id: string;
    subject: string;
  };
  
  // Items with detailed information
  items: {
    id: string; // Order item ID
    partId?: string; // Part ID if available
    partNumber: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    
    // Availability and fulfillment information
    availability: 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN';
    fulfillmentMethod?: 'PICKUP' | 'DELIVERY'; // For split fulfillment
    estimatedDeliveryDays?: number;
    leadTime?: number;
    
    // Additional part information
    supplierPartNumber?: string;
    category?: string;
    weight?: number;
    dimensions?: {
      length?: number;
      width?: number;
      height?: number;
      unit?: string;
    };
  }[];
  
  // Order details
  orderDetails: {
    // Financial information
    subtotal: number;
    tax: number;
    shipping: number;
    totalAmount: number;
    currency: string;
    paymentTerms: string;
    paymentMethod?: string;
    
    // Pickup information
    pickupLocation?: string;
    pickupDate?: string;
    pickupInstructions?: string;
    
    // Delivery information
    shippingCarrier?: string;
    trackingNumber?: string;
    shippingMethod?: string;
    deliveryAddress?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    requestedDeliveryDate?: string;
    estimatedDeliveryDate?: string;
    
    // Additional information
    notes?: string;
    specialInstructions?: string;
    purchaseOrderNumber?: string;
  };
  
  // Timestamps
  timestamps: {
    orderDate: string;
    quoteApprovalDate?: string;
    expectedFulfillmentDate?: string;
  };
}

// Enhanced OrderConfirmationResponse interface
export interface EnhancedOrderConfirmationResponse {
  // Email content for sending to the supplier
  emailContent: {
    subject: string;
    body: string;
    bodyHtml: string;
  };
  messageId: string;
  
  // Optional purchase order attachment
  purchaseOrderAttachment?: {
    filename: string;
    contentType: string;
    content: string; // Base64 encoded
  };
  
  // Optional order updates to be applied to the database
  orderUpdates?: {
    trackingNumber?: string;
    shippingCarrier?: string;
    expectedDeliveryDate?: string;
    fulfillmentStatus?: string;
    items?: {
      id: string;
      availability?: 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN';
      trackingNumber?: string;
      expectedDeliveryDate?: string;
    }[];
  };
  
  // Additional information
  suggestedNextSteps?: string[];
  estimatedFulfillmentTimeline?: string;
}
```

#### n8n Workflow Tasks:

1. Generate different email content based on the fulfillment method
2. Include pickup instructions for PICKUP items
3. Include delivery information for DELIVERY items
4. Create separate sections for pickup and delivery items in SPLIT fulfillment
5. Provide appropriate instructions based on the fulfillment method
6. Return order updates to be applied to the database

## API Enhancements

### 1. Enhanced Price Update API

```typescript
// Modified route.ts for price updates
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication and validation...
    
    // Get the quote request with items and email thread...
    
    // Prepare data for the webhook
    const priceUpdateData = {
      quoteRequestId,
      items: quoteRequest.items.map((item: any) => ({
        id: item.id,
        partNumber: item.partNumber,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice || undefined,
        totalPrice: item.totalPrice || undefined,
        leadTime: item.leadTime || undefined,
      })),
      supplierEmail: latestInboundEmail ? {
        id: latestInboundEmail.id,
        from: latestInboundEmail.from,
        subject: latestInboundEmail.subject,
        body: latestInboundEmail.body,
        bodyHtml: latestInboundEmail.bodyHtml || undefined,
        receivedAt: latestInboundEmail.receivedAt?.toISOString() || new Date().toISOString(),
        direction: 'INBOUND' as const
      } : null
    };
    
    // Call the webhook to update prices and assess availability
    const response = await updatePartPrices(priceUpdateData);
    
    // Update the items in the database with the new prices and availability
    const updatePromises = response.updatedItems.map(async (updatedItem) => {
      return prisma.quoteRequestItem.update({
        where: { id: updatedItem.id },
        data: {
          unitPrice: updatedItem.unitPrice,
          totalPrice: updatedItem.totalPrice,
          leadTime: updatedItem.leadTime,
          availability: updatedItem.availability, // New field
          estimatedDeliveryDays: updatedItem.estimatedDeliveryDays, // New field
          suggestedFulfillmentMethod: updatedItem.suggestedFulfillmentMethod, // New field
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
          suggestedFulfillmentMethod: response.overallRecommendation, // New field
        },
      });
    }
    
    // Return the updated quote request
    const finalQuoteRequest = await prisma.quoteRequest.findUnique({
      where: { id: quoteRequestId },
      include: { items: true },
    });
    
    return NextResponse.json({
      success: true,
      message: "Prices and availability updated successfully",
      quoteRequest: finalQuoteRequest,
    });
  } catch (error) {
    // Error handling...
  }
}
```

### 2. Enhanced Quote-to-Order Conversion API

```typescript
// Modified convert-to-order route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication and validation...
    
    // Get request body with fulfillment information
    const { 
      fulfillmentMethod = 'STANDARD', 
      itemFulfillment = [], 
      shippingAddress, 
      pickupLocation,
      pickupDate 
    } = await req.json();
    
    // Get the quote request with all related data
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id: params.id },
      include: {
        supplier: true,
        vehicle: true,
        items: true,
        emailThread: true,
        organization: true,
      },
    });
    
    // Validation checks...
    
    // Generate an order number
    const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    // Calculate order totals
    const subtotal = quoteRequest.items.reduce(
      (sum, item) => sum + (Number(item.unitPrice) || 0) * item.quantity,
      0
    );
    const tax = 0;
    const shipping = 0;
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
        
        // Relations
        organization: { connect: { id: user.organizationId } },
        supplier: { connect: { id: quoteRequest.supplierId } },
        createdBy: { connect: { id: user.id } },
        vehicle: quoteRequest.vehicle ? { connect: { id: quoteRequest.vehicle.id } } : undefined,
        emailThread: quoteRequest.emailThread ? { connect: { id: quoteRequest.emailThread.id } } : undefined,
        
        // Create order items with fulfillment information
        orderItems: {
          create: quoteRequest.items.map(item => {
            // Get fulfillment method for this item (for split fulfillment)
            const itemMethod = itemFulfillment.find(f => f.itemId === item.id)?.method || fulfillmentMethod;
            
            // Create a base item
            const orderItem: any = {
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice) || 0,
              totalPrice: Number(item.unitPrice || 0) * item.quantity,
              
              // New fulfillment fields
              availability: item.availability || 'UNKNOWN',
              fulfillmentMethod: itemMethod,
              expectedDelivery: item.estimatedDeliveryDays 
                ? new Date(Date.now() + (item.estimatedDeliveryDays * 24 * 60 * 60 * 1000))
                : null,
            };
            
            // Only add partId if it exists
            if (item.partId) {
              orderItem.part = { connect: { id: item.partId } };
            }
            
            return orderItem;
          }),
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
    
    // Update the quote request status
    await prisma.quoteRequest.update({
      where: { id: params.id },
      data: { status: QuoteStatus.CONVERTED_TO_ORDER },
    });
    
    // If the supplier has an email, send an order confirmation email with fulfillment information
    if (quoteRequest.supplier.email) {
      try {
        // Get organization details
        const organization = await prisma.organization.findUnique({
          where: { id: user.organizationId },
        });

        // Prepare data for the email webhook with comprehensive information
        const emailData: EnhancedOrderConfirmationRequest = {
          // Order identification
          orderId: order.id,
          orderNumber: order.orderNumber,
          quoteRequestId: quoteRequest.id,
          quoteNumber: quoteRequest.quoteNumber,
          
          // Fulfillment information
          fulfillmentMethod: fulfillmentMethod || 'STANDARD',
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
          
          // Email thread information
          emailThread: quoteRequest.emailThread ? {
            id: quoteRequest.emailThread.id,
            subject: quoteRequest.emailThread.subject,
          } : undefined,
          
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
              availability: item.availability || quoteItem?.availability || 'UNKNOWN',
              fulfillmentMethod: itemFulfillment?.find(f => f.itemId === quoteItem?.id)?.method || fulfillmentMethod,
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
            subtotal: Number(order.subtotal),
            tax: Number(order.tax),
            shipping: Number(order.shipping),
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
        if (quoteRequest.emailThread) {
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
              thread: { connect: { id: quoteRequest.emailThread.id } },
            },
          });
          
          // Update the email thread status
          await prisma.emailThread.update({
            where: { id: quoteRequest.emailThread.id },
            data: { status: "COMPLETED" },
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
    
    // Create an activity log entry
    await prisma.activityLog.create({
      data: {
        type: "QUOTE_APPROVED",
        title: `Quote request converted to order`,
        description: `Quote request ${quoteRequest.quoteNumber} was converted to order ${order.orderNumber} with ${fulfillmentMethod} fulfillment`,
        entityType: "Order",
        entityId: order.id,
        userId: user.id,
        organization: { connect: { id: user.organizationId } },
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
    // Error handling...
  }
}
```

## UI Enhancements

### 1. Quote-to-Order Conversion Page

The quote-to-order conversion page will be enhanced to:

1. Display availability information for each item
2. Allow selecting a fulfillment method (PICKUP, DELIVERY, SPLIT)
3. For SPLIT fulfillment, allow configuring which items are for pickup vs. delivery
4. Collect pickup location and date for PICKUP items
5. Collect shipping address for DELIVERY items

```tsx
// Component for selecting fulfillment method during quote conversion
function FulfillmentMethodSelector({ 
  items, 
  onMethodSelected 
}: FulfillmentSelectorProps) {
  const [method, setMethod] = useState<FulfillmentMethod>('STANDARD');
  const [itemMethods, setItemMethods] = useState<Record<string, FulfillmentMethod>>({});
  
  // Determine if split fulfillment is needed based on availability
  const needsSplit = useMemo(() => {
    return items.some(item => item.availability !== 'IN_STOCK');
  }, [items]);
  
  // Handle method change
  const handleMethodChange = (newMethod: FulfillmentMethod) => {
    setMethod(newMethod);
    
    if (newMethod !== 'SPLIT') {
      // Reset item-level methods when not using split
      setItemMethods({});
    }
  };
  
  // Handle item method change for split fulfillment
  const handleItemMethodChange = (itemId: string, itemMethod: FulfillmentMethod) => {
    setItemMethods(prev => ({
      ...prev,
      [itemId]: itemMethod
    }));
  };
  
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Select Fulfillment Method</h3>
        <RadioGroup value={method} onValueChange={handleMethodChange}>
          <div className="space-y-2">
            <RadioGroupItem value="PICKUP" id="pickup">
              <Label htmlFor="pickup">Pickup (All items available in store)</Label>
            </RadioGroupItem>
            <RadioGroupItem value="DELIVERY" id="delivery">
              <Label htmlFor="delivery">Delivery (Ship all items)</Label>
            </RadioGroupItem>
            <RadioGroupItem value="SPLIT" id="split">
              <Label htmlFor="split">Split Fulfillment (Pickup available items, ship the rest)</Label>
            </RadioGroupItem>
          </div>
        </RadioGroup>
      </div>
      
      {method === 'SPLIT' && (
        <div className="space-y-4">
          <h4 className="text-md font-medium">Configure Item Fulfillment</h4>
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 border rounded">
              <div>
                <p className="font-medium">{item.partNumber}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <Badge variant={getAvailabilityBadgeVariant(item.availability)}>
                  {getAvailabilityLabel(item.availability)}
                </Badge>
              </div>
              <Select
                value={itemMethods[item.id] || 'PICKUP'}
                onValueChange={(value) => handleItemMethodChange(item.id, value as FulfillmentMethod)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PICKUP">Pickup</SelectItem>
                  <SelectItem value="DELIVERY">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
      
      <Button 
        onClick={() => onMethodSelected(method, itemMethods)}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}
```

### 2. Order Details Page

The order details page will be enhanced to:

1. Display fulfillment method and status
2. Show pickup information for PICKUP items
3. Show tracking information for DELIVERY items
4. Separate items by fulfillment method for SPLIT fulfillment

```tsx
// Component for displaying tracking information
function TrackingInformation({ 
  order, 
  orderItems 
}: TrackingInfoProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Fulfillment Information</h3>
      
      {order.fulfillmentMethod === 'PICKUP' && (
        <div className="p-4 bg-blue-50 rounded-md border border-blue-200">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800">Pickup Information</h4>
              <p className="text-sm text-blue-700">Location: {order.pickupLocation}</p>
              {order.pickupDate && (
                <p className="text-sm text-blue-700">
                  Date: {formatDate(order.pickupDate)}
                </p>
              )}
              <p className="text-sm text-blue-700 mt-2">
                Please bring your order number and ID for pickup.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {(order.fulfillmentMethod === 'DELIVERY' || order.