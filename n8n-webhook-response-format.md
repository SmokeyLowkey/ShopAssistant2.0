# N8N Webhook Response Format

## Order Confirmation Webhook Response

Your n8n workflow **MUST** return a response in the following format when processing the ORDER_CONFIRMATION webhook.

### Required Response Structure

```json
{
  "emailContent": {
    "subject": "Order Confirmation - ORD-2025-0001",
    "body": "Plain text version of the email body...",
    "bodyHtml": "<html><body>HTML version of the email...</body></html>"
  },
  "messageId": "unique-message-id-12345",
  "purchaseOrderAttachment": {
    "filename": "PO-ORD-2025-0001.pdf",
    "contentType": "application/pdf",
    "content": "base64EncodedPdfContentHere..."
  },
  "orderUpdates": {
    "trackingNumber": "TRACK-123456",
    "shippingCarrier": "FedEx",
    "expectedDeliveryDate": "2026-01-05T17:00:00.000Z",
    "items": [
      {
        "id": "cm5itm001abc123xyz456",
        "availability": "IN_STOCK",
        "trackingNumber": "TRACK-123456-A",
        "expectedDeliveryDate": "2026-01-05T17:00:00.000Z"
      }
    ]
  }
}
```

### Field Descriptions

#### `emailContent` (REQUIRED)
The email to be sent to the supplier confirming the order.

- **`subject`** (string, REQUIRED) - Email subject line
  - Example: `"Order Confirmation - ORD-2025-0001"`

- **`body`** (string, REQUIRED) - Plain text email body
  - Example: `"Dear Supplier,\n\nWe confirm our order for the following items..."`

- **`bodyHtml`** (string, OPTIONAL) - HTML formatted email body
  - If not provided, will fallback to the plain text `body`
  - Example: `"<html><body><h1>Order Confirmation</h1><p>Dear Supplier...</p></body></html>"`

#### `messageId` (REQUIRED)
A unique identifier for this email message.

- **Type**: string
- **Example**: `"msg-order-12345-20251231"` or `"generated-1735635000000"`
- **Default**: If not provided, will use `"order-{orderNumber}-{timestamp}"`

#### `purchaseOrderAttachment` (OPTIONAL)
A PDF attachment containing the purchase order.

- **`filename`** (string) - Name of the PDF file
  - Example: `"PO-ORD-2025-0001.pdf"`

- **`contentType`** (string) - MIME type
  - Should be: `"application/pdf"`

- **`content`** (string) - Base64 encoded PDF content
  - Example: `"JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL..."`

#### `orderUpdates` (OPTIONAL)
Additional information from the supplier to update the order in the database.

- **`trackingNumber`** (string, OPTIONAL) - Shipping tracking number
- **`shippingCarrier`** (string, OPTIONAL) - Carrier name (e.g., "FedEx", "UPS")
- **`expectedDeliveryDate`** (string, OPTIONAL) - ISO 8601 date string
- **`items`** (array, OPTIONAL) - Updates for individual order items
  - **`id`** (string, REQUIRED) - Order item ID from the request payload
  - **`availability`** (string, OPTIONAL) - "IN_STOCK" | "BACKORDERED" | "SPECIAL_ORDER" | "UNKNOWN"
  - **`trackingNumber`** (string, OPTIONAL) - Item-specific tracking number
  - **`expectedDeliveryDate`** (string, OPTIONAL) - ISO 8601 date string for this item

---

## Minimal Valid Response

The **absolute minimum** your webhook must return:

```json
{
  "emailContent": {
    "subject": "Order Confirmation",
    "body": "Your order has been confirmed."
  },
  "messageId": "msg-12345"
}
```

---

## Example: Complete Response

```json
{
  "emailContent": {
    "subject": "Order Confirmation - Heavy Equipment Parts Order ORD-2025-0001",
    "body": "Dear Heavy Equipment Parts & Supply Co.,\n\nThank you for your quote. We are pleased to confirm our order for the following items:\n\n1. Hydraulic Pump Assembly (CAT-123-4567) - Qty: 1 - $2,850.00\n2. Hydraulic Control Valve (CAT-234-5678) - Qty: 1 - $1,450.00\n3. Hydraulic Cylinder Seal Kit (CAT-345-6789) - Qty: 2 - $250.00\n\nTotal: $4,550.00\n\nFulfillment Details:\n- Item 1: Delivery to 789 Main Street, Seattle, WA 98101\n- Item 2: Pickup at your Portland location on Dec 31\n- Item 3: Delivery to 789 Main Street, Seattle, WA 98101\n\nPayment Terms: Net 30\nPurchase Order: ORD-2025-0001\n\nPlease confirm receipt of this order.\n\nBest regards,\nJane Doe\nABC Construction Company",
    "bodyHtml": "<html><body><h2>Order Confirmation</h2><p>Dear Heavy Equipment Parts & Supply Co.,</p><p>Thank you for your quote. We are pleased to confirm our order for the following items:</p><table border='1'><tr><th>Item</th><th>Part Number</th><th>Qty</th><th>Price</th></tr><tr><td>Hydraulic Pump Assembly</td><td>CAT-123-4567</td><td>1</td><td>$2,850.00</td></tr><tr><td>Hydraulic Control Valve</td><td>CAT-234-5678</td><td>1</td><td>$1,450.00</td></tr><tr><td>Hydraulic Cylinder Seal Kit</td><td>CAT-345-6789</td><td>2</td><td>$250.00</td></tr></table><p><strong>Total: $4,550.00</strong></p><h3>Fulfillment Details:</h3><ul><li>Item 1: Delivery to 789 Main Street, Seattle, WA 98101</li><li>Item 2: Pickup at your Portland location on Dec 31</li><li>Item 3: Delivery to 789 Main Street, Seattle, WA 98101</li></ul><p>Payment Terms: Net 30<br>Purchase Order: ORD-2025-0001</p><p>Please confirm receipt of this order.</p><p>Best regards,<br>Jane Doe<br>ABC Construction Company</p></body></html>"
  },
  "messageId": "order-conf-ORD-2025-0001-1735635000",
  "purchaseOrderAttachment": {
    "filename": "PurchaseOrder-ORD-2025-0001.pdf",
    "contentType": "application/pdf",
    "content": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago..."
  }
}
```

---

## Common Errors

### Error: "Webhook returned invalid response format"
**Cause**: Your webhook returned `null`, `undefined`, or an empty object `{}`

**Solution**: Ensure your n8n workflow's **final node** (usually "Respond to Webhook") outputs the required JSON structure with at least `emailContent.subject` and `emailContent.body`.

### Error: "Webhook response missing required email fields"
**Cause**: The `emailContent` object exists but is missing `subject` or `body`

**Solution**: Check that your n8n workflow is populating both fields:
```json
{
  "emailContent": {
    "subject": "{{ $json.generatedSubject }}",
    "body": "{{ $json.generatedBody }}"
  }
}
```

### Error: "Cannot read properties of undefined (reading 'subject')"
**Cause**: The webhook response doesn't have an `emailContent` object at all

**Solution**: Restructure your n8n response to include the `emailContent` wrapper:
```json
{
  "emailContent": {
    "subject": "...",
    "body": "..."
  }
}
```

---

## N8N Workflow Configuration

### Last Node: "Respond to Webhook"

In your n8n workflow, the **last node** should be a "Respond to Webhook" node configured as follows:

**Response Mode**: "Using 'Respond to Webhook' Node"

**Response Body**:
```json
{
  "emailContent": {
    "subject": "={{ $('Generate Email').json.subject }}",
    "body": "={{ $('Generate Email').json.body }}",
    "bodyHtml": "={{ $('Generate Email').json.bodyHtml }}"
  },
  "messageId": "={{ $('Generate MessageID').json.messageId }}",
  "purchaseOrderAttachment": "={{ $('Generate PDF').json.attachment }}"
}
```

Make sure to replace node names like `'Generate Email'` with your actual node names.

---

## Testing Your Webhook

You can test your webhook response format using this curl command:

```bash
curl -X POST https://your-n8n-instance.com/webhook/order-confirmation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d @order-confirmation-webhook-payload-example.json
```

The response should match the format described above.
