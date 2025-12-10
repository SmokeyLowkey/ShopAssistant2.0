# Supplier Part Number & Supersession Tracking - n8n Webhook Format

## Overview
This document defines the expected webhook response format for the price update endpoint when n8n returns supplier pricing information, including support for superseded part numbers and alternative parts.

## Use Case Examples

### 1. Superseded Part Number
**Scenario**: Customer requests part T396635, supplier responds that it's been superseded to T396635SH

**n8n Response Format**:
```json
{
  "success": true,
  "updatedItems": [
    {
      "id": "quote_request_item_id",
      "partNumber": "T396635",
      "supplierPartNumber": "T396635SH",
      "isSuperseded": true,
      "originalPartNumber": "T396635",
      "supersessionNotes": "Part T396635 has been superseded to T396635SH effective 2024",
      "unitPrice": 257.84,
      "totalPrice": 257.84,
      "availability": "IN_STOCK",
      "estimatedDeliveryDays": 2,
      "leadTime": 2,
      "supplierNotes": "Superseded part, same fit and function",
      "suggestedFulfillmentMethod": "DELIVERY"
    }
  ]
}
```

### 2. Alternative Part
**Scenario**: Customer requests a specific part, supplier suggests an alternative

**n8n Response Format**:
```json
{
  "success": true,
  "updatedItems": [
    {
      "id": "quote_request_item_id",
      "partNumber": "FILTER-ABC123",
      "supplierPartNumber": "FILTER-XYZ789",
      "isAlternative": true,
      "alternativeReason": "Original part discontinued, this is the recommended replacement with improved filtration",
      "unitPrice": 45.99,
      "totalPrice": 91.98,
      "availability": "IN_STOCK",
      "estimatedDeliveryDays": 1,
      "supplierNotes": "Upgraded alternative with better performance specs",
      "suggestedFulfillmentMethod": "PICKUP"
    }
  ]
}
```

### 3. Regular Part (No Supersession)
**Scenario**: Standard part quote with no changes

**n8n Response Format**:
```json
{
  "success": true,
  "updatedItems": [
    {
      "id": "quote_request_item_id",
      "partNumber": "BRAKE-PAD-123",
      "supplierPartNumber": "BRAKE-PAD-123",
      "unitPrice": 89.50,
      "totalPrice": 179.00,
      "availability": "IN_STOCK",
      "estimatedDeliveryDays": 1,
      "leadTime": 1,
      "suggestedFulfillmentMethod": "DELIVERY"
    }
  ]
}
```

### 4. Multiple Items with Mixed Supersessions
**n8n Response Format**:
```json
{
  "success": true,
  "updatedItems": [
    {
      "id": "item_1_id",
      "partNumber": "T396635",
      "supplierPartNumber": "T396635SH",
      "isSuperseded": true,
      "originalPartNumber": "T396635",
      "supersessionNotes": "Superseded to T396635SH",
      "unitPrice": 257.84,
      "totalPrice": 257.84,
      "availability": "IN_STOCK",
      "estimatedDeliveryDays": 2,
      "supplierNotes": "New part number effective 2024"
    },
    {
      "id": "item_2_id",
      "partNumber": "FILTER-456",
      "supplierPartNumber": "FILTER-456",
      "unitPrice": 35.91,
      "totalPrice": 35.91,
      "availability": "IN_STOCK",
      "estimatedDeliveryDays": 1
    }
  ],
  "overallRecommendation": "DELIVERY"
}
```

## Field Definitions

### Required Fields
- `id` (string): The quote request item ID
- `partNumber` (string): The original part number requested by customer
- `unitPrice` (decimal): Price per unit
- `totalPrice` (decimal): Total price (unitPrice × quantity)
- `availability` (enum): `IN_STOCK`, `BACKORDERED`, `SPECIAL_ORDER`, `UNKNOWN`

### Supersession Fields (Optional)
- `supplierPartNumber` (string): The actual part number the supplier will provide
- `isSuperseded` (boolean): `true` if the part number has been superseded
- `originalPartNumber` (string): The original requested part number (only if superseded)
- `supersessionNotes` (string): Human-readable explanation of the supersession

### Alternative Part Fields (Optional)
- `isAlternative` (boolean): `true` if supplier is suggesting an alternative part
- `alternativeReason` (string): Explanation of why this alternative is suggested

### Additional Fields (Optional)
- `supplierNotes` (string): Any additional notes from the supplier
- `estimatedDeliveryDays` (number): Estimated days until delivery
- `leadTime` (number): Lead time in days
- `suggestedFulfillmentMethod` (string): `PICKUP`, `DELIVERY`, or `SPLIT`

## Database Schema

### QuoteRequestItem
```prisma
model QuoteRequestItem {
  partNumber            String    // Customer's requested part number
  supplierPartNumber    String?   // Supplier's actual part number
  isSuperseded          Boolean   @default(false)
  originalPartNumber    String?   // If superseded, the original number
  supersessionNotes     String?   // Details about supersession
  isAlternative         Boolean   @default(false)
  alternativeReason     String?   // Why alternative was suggested
  supplierNotes         String?   // General supplier notes
  // ... other fields
}
```

### Part (Auto-created during order conversion)
```prisma
model Part {
  partNumber          String    // Primary part number (supplier's number if superseded)
  supplierPartNumber  String?   // If different from partNumber
  supersededBy        String?   // New part number that replaces this
  supersedes          String?   // Old part number this replaces
  supersessionDate    DateTime?
  supersessionNotes   String?
  // ... other fields
}
```

### OrderItem
```prisma
model OrderItem {
  supplierNotes  String?  // Preserves supersession/alternative notes
  // ... other fields
}
```

## n8n Workflow Tips

### Parsing Supplier Emails for Supersessions
Look for patterns like:
- "superseded to"
- "replaced by"
- "new part number:"
- "obsolete, use instead:"
- "discontinued, alternative:"

### Example n8n Code Node
```javascript
// Parse email for supersession
function parseSupersession(emailBody, requestedPartNumber) {
  const supersessionPatterns = [
    /(?:superseded|replaced)\s+(?:to|by|with)\s+([A-Z0-9-]+)/i,
    /new part number:?\s*([A-Z0-9-]+)/i,
    /use\s+([A-Z0-9-]+)\s+instead/i,
  ];
  
  for (const pattern of supersessionPatterns) {
    const match = emailBody.match(pattern);
    if (match) {
      return {
        isSuperseded: true,
        supplierPartNumber: match[1],
        originalPartNumber: requestedPartNumber,
        supersessionNotes: match[0], // Full matched text
      };
    }
  }
  
  return {
    isSuperseded: false,
    supplierPartNumber: requestedPartNumber,
  };
}
```

## Benefits

1. **Accurate Ordering**: System orders exactly what supplier quoted
2. **Price Tracking**: Prices tied to correct supplier part numbers
3. **Historical Record**: Track when parts were superseded
4. **Customer Transparency**: Show customers when parts have been superseded/replaced
5. **Future Automation**: Build smart matching for repeat orders
6. **Compliance**: Documentation trail for part changes

## Migration Notes

- All existing quote items will have `isSuperseded: false` by default
- Existing parts without supplier part numbers will remain unchanged
- New quotes will start capturing this information immediately
- n8n workflows should be updated to parse supersession information from emails
