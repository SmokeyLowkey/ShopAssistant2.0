# POST Order Webhook - Complete Payload Structure

This document describes the complete payload sent to the N8N `POST_ORDER_WEBHOOK_URL` for order tracking updates.

## Key Features

✅ **Post-Conversion Messages Only**: Only emails sent AFTER the order was created
✅ **Complete Order Data**: All updatable fields from the database
✅ **No Attachment Content**: Attachment metadata only (not file content)
✅ **Supplier Email Thread**: Full email context for AI parsing
✅ **Item-Level Tracking**: Support for split shipments

---

## Complete Payload Structure

```typescript
{
  // ============================================================================
  // ORDER IDENTIFICATION
  // ============================================================================
  orderId: string;              // Database ID: "cmjabcd1234..."
  orderNumber: string;          // Display number: "ORD-2024-001"
  supplierId: string;           // Supplier database ID

  // ============================================================================
  // ORDER DATES
  // ============================================================================
  orderDate: string;            // ISO 8601: "2024-12-30T15:30:00Z"
                                // Used as cutoff for post-conversion messages

  // ============================================================================
  // CURRENT ORDER STATUS & FINANCIALS
  // ============================================================================
  status: string;               // PENDING | PROCESSING | IN_TRANSIT | DELIVERED | CANCELLED
  totalAmount: number;          // Total order value: 1250.00
  subtotal: number | null;      // Subtotal before tax/shipping: 1000.00
  tax: number | null;           // Tax amount: 100.00
  shipping: number | null;      // Shipping cost: 150.00

  // ============================================================================
  // FULFILLMENT INFORMATION
  // ============================================================================
  fulfillmentMethod: string;    // PICKUP | DELIVERY | SPLIT
  partialFulfillment: boolean;  // true if items shipped separately

  // Pickup details (when fulfillmentMethod = PICKUP or SPLIT)
  pickupLocation: string | null;      // "123 Main St, City, State"
  pickupDate: string | null;          // ISO 8601: "2025-01-05T10:00:00Z"
  pickupInstructions: string | null;  // "Ask for John at parts counter"

  // ============================================================================
  // CURRENT TRACKING INFORMATION (Order-Level)
  // ============================================================================
  currentTracking: {
    trackingNumber: string | null;      // "1Z999AA10123456784"
    shippingCarrier: string | null;     // "UPS" | "FEDEX" | "USPS" | "DHL" | "ONTRAC"
    expectedDelivery: string | null;    // ISO 8601: "2024-12-31T00:00:00Z"
    actualDelivery: string | null;      // ISO 8601: "2024-12-30T14:30:00Z"
  };

  // ============================================================================
  // SUPPLIER INFORMATION
  // ============================================================================
  supplier: {
    id: string;                   // Database ID
    name: string;                 // "John Deere Industrial Supply"
    email: string;                // "orders@jdis.com"
    contactPerson: string | null; // "Jane Smith"
  };

  // ============================================================================
  // EMAIL THREAD (Post-Conversion Messages Only)
  // ============================================================================
  emailThread: {
    id: string;                   // Email thread database ID
    messages: [
      {
        id: string;               // Message database ID
        from: string;             // "supplier@example.com"
        to: string;               // "your-org@example.com"
        subject: string;          // "Order #ORD-2024-001 - Tracking Information"
        body: string;             // Plain text email body (for AI parsing)
        bodyHtml: string | null;  // HTML email body (if available)
        sentAt: string;           // ISO 8601: "2024-12-30T20:31:15Z"
        receivedAt: string | null;// ISO 8601: "2024-12-30T20:31:20Z"
        direction: string;        // "INBOUND" | "OUTBOUND"
        hasAttachments: boolean;  // true if message has attachments
                                  // NOTE: Attachment content NOT included
      }
    ]
  };

  // ============================================================================
  // ORDER ITEMS (With Current Tracking State)
  // ============================================================================
  items: [
    {
      id: string;                 // Order item database ID
      partNumber: string;         // "RE539279"
      description: string;        // "Engine Oil Filter"
      quantity: number;           // 3
      unitPrice: number | null;   // 57.19
      totalPrice: number | null;  // 171.57

      // Item fulfillment
      fulfillmentMethod: string | null;  // PICKUP | DELIVERY (for SPLIT orders)
      availability: string | null;       // Item availability status

      // Current item tracking (for split shipments)
      currentTracking: {
        trackingNumber: string | null;      // Item-specific tracking
        expectedDelivery: string | null;    // Item-specific delivery date
        actualDelivery: string | null;      // Item-specific delivery date
      };

      // Supplier notes (may contain tracking info)
      supplierNotes: string | null;  // "Ships separately, tracking TBA"
    }
  ];

  // ============================================================================
  // ORGANIZATION CONTEXT
  // ============================================================================
  organization: {
    id: string;     // Organization database ID
    name: string;   // "Your Company Name"
  };

  // ============================================================================
  // USER CONTEXT (Who Triggered the Sync)
  // ============================================================================
  user: {
    id: string;     // User database ID
    name: string;   // "John Doe"
    email: string;  // "john@example.com"
  };
}
```

---

## Message Filtering Logic

### What Gets Included:
- ✅ Messages sent **AFTER** `orderDate`
- ✅ Messages from the supplier's email thread
- ✅ Both INBOUND (from supplier) and OUTBOUND (to supplier)
- ✅ Message body and HTML body (for AI parsing)
- ✅ Metadata flag if attachments exist

### What Gets Excluded:
- ❌ Messages sent **BEFORE** order creation (quote phase)
- ❌ Attachment file content (too large, not needed for tracking extraction)
- ❌ Messages from other email threads

### Example Timeline:

```
2024-12-28 10:00  - Quote request sent          ❌ (before order)
2024-12-29 14:00  - Supplier quote received     ❌ (before order)
2024-12-30 09:00  - Order placed (orderDate)    ← CUTOFF
2024-12-30 15:00  - Order confirmation          ✅ (after order)
2024-12-30 20:31  - Tracking number email       ✅ (after order)
2024-12-31 10:00  - Shipment update             ✅ (after order)
```

---

## Example Payload (Real-World)

```json
{
  "orderId": "cmjsorder12345",
  "orderNumber": "ORD-2024-001",
  "supplierId": "cmjssupplier789",
  "orderDate": "2024-12-30T09:00:00Z",

  "status": "PROCESSING",
  "totalAmount": 1250.00,
  "subtotal": 1000.00,
  "tax": 100.00,
  "shipping": 150.00,

  "fulfillmentMethod": "DELIVERY",
  "partialFulfillment": false,
  "pickupLocation": null,
  "pickupDate": null,
  "pickupInstructions": null,

  "currentTracking": {
    "trackingNumber": null,
    "shippingCarrier": null,
    "expectedDelivery": null,
    "actualDelivery": null
  },

  "supplier": {
    "id": "cmjssupplier789",
    "name": "John Deere Industrial Supply",
    "email": "orders@jdis.com",
    "contactPerson": "Jane Smith"
  },

  "emailThread": {
    "id": "cmjsthread456",
    "messages": [
      {
        "id": "cmjsmsg001",
        "from": "orders@jdis.com",
        "to": "purchasing@yourcompany.com",
        "subject": "Order ORD-2024-001 - Tracking Information",
        "body": "Your order ORD-2024-001 has shipped via UPS with tracking number 1Z999AA10123456784. Expected delivery: December 31, 2024.",
        "bodyHtml": "<p>Your order ORD-2024-001 has shipped...</p>",
        "sentAt": "2024-12-30T20:31:15Z",
        "receivedAt": "2024-12-30T20:31:20Z",
        "direction": "INBOUND",
        "hasAttachments": true
      }
    ]
  },

  "items": [
    {
      "id": "cmjsitem001",
      "partNumber": "RE539279",
      "description": "Engine Oil Filter",
      "quantity": 3,
      "unitPrice": 57.19,
      "totalPrice": 171.57,
      "fulfillmentMethod": null,
      "availability": "IN_STOCK",
      "currentTracking": {
        "trackingNumber": null,
        "expectedDelivery": null,
        "actualDelivery": null
      },
      "supplierNotes": null
    }
  ],

  "organization": {
    "id": "cmjsorg123",
    "name": "Your Construction Company"
  },

  "user": {
    "id": "cmjsuser999",
    "name": "John Doe",
    "email": "john@yourcompany.com"
  }
}
```

---

## AI Agent Instructions

The N8N AI agent should:

1. **Extract Tracking Numbers**: From email body/subject
2. **Detect Carrier**: From explicit mention or tracking number format
3. **Parse Delivery Dates**: Convert any date format to ISO 8601
4. **Identify Status Changes**: Map email content to order statuses
5. **Handle Split Shipments**: Match items by part number for item-level tracking
6. **Update Database**: Call Postgres tools to update `orders` and `order_items` tables

---

## Response Format (From N8N to API)

```json
{
  "success": true,
  "orderUpdates": {
    "trackingNumber": "1Z999AA10123456784",
    "shippingCarrier": "UPS",
    "expectedDelivery": "2024-12-31",
    "status": "IN_TRANSIT"
  },
  "itemUpdates": [
    {
      "id": "cmjsitem001",
      "trackingNumber": "1Z999AA10123456784",
      "expectedDelivery": "2024-12-31"
    }
  ],
  "supplierMessages": [
    {
      "type": "tracking",
      "message": "Tracking number provided: 1Z999AA10123456784",
      "timestamp": "2024-12-30T20:31:15Z"
    }
  ],
  "suggestedActions": [],
  "message": "Order tracking updated successfully"
}
```

---

## Triggers

### 1. Manual Sync
- User clicks "Sync Updates" button in UI
- Endpoint: `POST /api/orders/[id]/sync-updates`

### 2. Automatic Trigger
- Supplier email arrives for order
- Endpoint: `POST /api/webhooks/email/parse`
- Condition: `emailThread.status === 'CONVERTED_TO_ORDER' && emailData.from === order.supplier.email`

---

## Database Updates Applied

After N8N processing, the API applies:

### Orders Table:
- `trackingNumber`
- `shippingCarrier`
- `expectedDelivery`
- `actualDelivery`
- `status` (with hierarchy validation)

### Order Items Table (for split shipments):
- `trackingNumber`
- `expectedDelivery`
- `actualDelivery`
- `availability`

### Activity Log:
- Automatic entry for all updates
- Source: `manual_sync` or `automatic_email_trigger`
- Includes update count and metadata

---

## Notes

- **No Pricing Updates**: Order is already placed, so pricing fields are read-only
- **Attachment Awareness**: AI knows attachments exist but doesn't get content
- **Date Filtering**: Critical to only send post-conversion messages
- **Idempotency**: Safe to call multiple times (updates only if data changes)
- **Error Handling**: Non-fatal for automatic triggers (logs error, continues email parsing)
