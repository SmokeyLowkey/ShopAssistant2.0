# Multi-Supplier Quote Request Flow

## Overview
The system now supports sending a single quote request to multiple suppliers simultaneously. Instead of creating duplicate quote records, the system sends a single payload with multiple supplier emails to N8N, which handles the email distribution logistics.

## Implementation Details

### 1. Edit Quote Request Page
**File:** `app/orders/quote-request/[id]/edit/page.tsx`

**Changes:**
- Added supplier selection field (single select for primary supplier)
- Added "Additional Suppliers" checkbox section for selecting multiple suppliers
- When submitting, includes `additionalSupplierIds` in the update payload
- Shows success message indicating how many suppliers will receive the quote

**User Flow:**
1. Select primary supplier from dropdown
2. (Optional) Check "Send to additional suppliers"
3. Select one or more additional suppliers via checkboxes
4. Save changes - system stores the additional supplier IDs

### 2. API Client Function
**File:** `lib/api/quote-requests.ts`

**Changes:**
- Updated `updateQuoteRequest()` signature to accept `additionalSupplierIds?: string[]`
- Updated `sendQuoteRequestEmail()` to accept `additionalSupplierIds: string[] = []`
- Passes additional supplier IDs to backend endpoints

### 3. Webhook Route (Send Email)
**File:** `app/api/webhooks/quote-request/route.ts`

**Changes:**
- Accepts `additionalSupplierIds` from request body
- Fetches all suppliers (primary + additional) from database
- Filters suppliers to only include those with valid email addresses
- Prepares payload with `additionalSuppliers` array for N8N
- Single payload sent to N8N with all supplier information

**Payload Structure:**
```typescript
{
  quoteRequestId: "xxx",
  quoteNumber: "QR-001",
  supplier: {
    id: "primary-id",
    name: "Primary Supplier",
    email: "primary@example.com",
    contactPerson: "John Doe"
  },
  additionalSuppliers: [
    {
      id: "supplier-2-id",
      name: "Additional Supplier 1",
      email: "supplier2@example.com",
      contactPerson: "Jane Smith"
    },
    {
      id: "supplier-3-id",
      name: "Additional Supplier 2",
      email: "supplier3@example.com"
    }
  ],
  items: [...],
  organization: {...},
  vehicle: {...}
}
```

### 4. N8N Client Interface
**File:** `lib/api/n8n-client.ts`

**Changes:**
- Updated `QuoteRequestEmailData` interface to include `additionalSuppliers?` field
- Type definition supports array of supplier objects with same structure as primary supplier

## N8N Workflow Expectations

### Input
N8N webhook receives a single request with:
- Primary supplier (required, always has email)
- Additional suppliers array (optional, all have validated emails)
- Quote request details (items, organization, vehicle, etc.)

### Expected N8N Behavior
1. Loop through all suppliers (primary + additional)
2. Generate personalized email for each supplier
3. Send emails to all suppliers
4. Create email threads for each supplier communication
5. Return consolidated response

### Response Format
```typescript
{
  emailContent: {
    subject: "Quote Request QR-001",
    body: "...",
    bodyHtml: "..."
  },
  messageId: "unique-message-id",
  // Could include details about which suppliers were emailed
  sentToSuppliers?: [
    { supplierId: "xxx", email: "...", sent: true },
    { supplierId: "yyy", email: "...", sent: true }
  ]
}
```

## Benefits

1. **Single Source of Truth**: One quote request record, not duplicates
2. **N8N Handles Distribution**: Email logic stays in N8N where it belongs
3. **Cleaner Database**: No duplicate quote records cluttering the system
4. **Simpler UI**: Users just select multiple suppliers and save
5. **Flexible**: N8N can handle email personalization, threading, and tracking

## Database Considerations

### Current Approach
- Single `QuoteRequest` record per request
- Primary supplier stored in `supplierId` field
- Additional suppliers sent via webhook payload only
- No additional database fields needed

### Future Enhancement Option
If tracking which suppliers received the quote is important:
```prisma
model QuoteRequest {
  // ... existing fields
  additionalSuppliers String[] // Array of supplier IDs
}
```

This would allow:
- Querying which suppliers received a quote
- Displaying all recipients in UI
- Historical tracking of distribution

## Testing Checklist

- [ ] Edit quote with single supplier (no additional) - works as before
- [ ] Edit quote with 1 additional supplier - payload includes both
- [ ] Edit quote with multiple additional suppliers - all included
- [ ] Supplier without email is filtered out - only valid emails sent
- [ ] N8N receives correct payload structure
- [ ] N8N successfully sends to all suppliers
- [ ] Email threads created for each supplier
- [ ] Success toast shows correct count

## Migration Notes

- **No database migration required**
- **No breaking changes to existing functionality**
- **Backward compatible**: quotes without additional suppliers work exactly as before
- **N8N webhook must be updated** to handle `additionalSuppliers` array
