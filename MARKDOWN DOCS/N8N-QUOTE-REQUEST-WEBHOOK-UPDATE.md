# n8n Quote Request Webhook - Multi-Supplier Update Guide

## Problem Statement

The current quote request flow only creates ONE email thread per quote request, even when multiple suppliers are selected. When the API sends requests to the webhook for each supplier, the workflow needs to:

1. **Create separate email threads** - One per supplier
2. **Send individual emails** - Each supplier gets their own email
3. **Link threads properly** - Call `/api/quote-requests/:id/link-email-thread` for each supplier
4. **Track responses separately** - Each supplier's response should be tracked independently

## Current vs. Required Flow

### ❌ Current Behavior
```
Quote Request → Webhook Called Once → Creates 1 Email Thread → Sends 1 Email
                (regardless of number of suppliers)
```

### ✅ Required Behavior
```
Quote Request with 3 suppliers:

API Call 1 (Primary Supplier) → Webhook → Create Email Thread 1 → Send Email to Supplier A → Link Thread to Quote (isPrimary: true)
API Call 2 (Additional Supplier) → Webhook → Create Email Thread 2 → Send Email to Supplier B → Link Thread to Quote (isPrimary: false)
API Call 3 (Additional Supplier) → Webhook → Create Email Thread 3 → Send Email to Supplier C → Link Thread to Quote (isPrimary: false)
```

## Updated Webhook Payload Structure

The API now sends this payload **per supplier**:

```json
{
  "quoteRequestId": "cmiwhv4bq00017t45f3412qqi",
  "quoteNumber": "QR-12-2025-4273",
  "supplierId": "cm123xyz", // ⚠️ CRITICAL: Unique per supplier
  "isPrimary": true, // or false for additional suppliers
  "supplier": {
    "id": "cm123xyz",
    "name": "Brandt",
    "email": "ykondakov@brandt.ca",
    "contactPerson": "yuriy"
  },
  "items": [
    {
      "partNumber": "AT458826",
      "description": "Electronic Control Unit (ECU)",
      "quantity": 1
    }
  ],
  "organization": {
    "name": "testSubaccount",
    "contactInfo": "theyk48@gmail.com"
  },
  "vehicle": {
    "make": "John Deere",
    "model": "160GLC",
    "year": 2014,
    "serialNumber": "1FF160GXE05001"
  },
  "suggestedFulfillmentMethod": "PICKUP",
  "pickListId": null
}
```

## n8n Workflow Update Instructions

### Step 1: Update Webhook Trigger Node

The webhook receives each supplier call separately. No changes needed here.

### Step 2: Generate Unique Email Thread ID

**CRITICAL**: Each supplier needs its own email thread. Generate a unique thread ID based on **both** `quoteRequestId` AND `supplierId`:

```javascript
// In a Code node or Set node
const quoteRequestId = $json.quoteRequestId;
const supplierId = $json.supplierId;
const isPrimary = $json.isPrimary || false;

// Generate unique external thread ID per supplier
const externalThreadId = `quote-${quoteRequestId}-supplier-${supplierId}-${Date.now()}`;

return {
  ...item.json,
  externalThreadId,
  isPrimary
};
```

### Step 3: Create Email Thread in Database

Use the **EmailThread table** tool with INSERT operation:

```json
{
  "id": "{{ $uuid }}",
  "subject": "Quote Request {{ $json.quoteNumber }} - {{ $json.supplier.name }}",
  "externalThreadId": "{{ $json.externalThreadId }}",
  "status": "ACTIVE",
  "organizationId": "{{ $json.organization.id }}",
  "supplierId": "{{ $json.supplierId }}", 
  "quoteRequestId": "{{ $json.quoteRequestId }}",
  "createdById": "{{ $json.user.id }}",
  "createdAt": "{{ $now }}",
  "updatedAt": "{{ $now }}"
}
```

**⚠️ IMPORTANT**: Save the generated `id` from this node for the next step.

### Step 4: Send Email to Supplier

Use the **"Send a message in Gmail"** tool to send the email to the specific supplier:

```json
{
  "To": "{{ $json.supplier.email }}",
  "Subject": "Quote Request {{ $json.quoteNumber }} - {{ $json.supplier.name }}",
  "Email Type": "HTML",
  "Message": "<!DOCTYPE html>...your HTML template..."
}
```

**Key Points**:
- Each supplier gets their own email
- Subject line should be unique per supplier
- Email body should address the specific supplier

### Step 5: Link Email Thread to Quote Request

**THIS IS THE NEW CRITICAL STEP** - After successfully sending the email, call the link-email-thread endpoint:

#### HTTP Request Node Configuration

```
Method: POST
URL: {{ $env.APP_BASE_URL }}/api/quote-requests/{{ $json.quoteRequestId }}/link-email-thread
Authentication: None (internal API call)

Headers:
- Content-Type: application/json

Body (JSON):
{
  "supplierId": "{{ $json.supplierId }}",
  "emailThreadId": "{{ $('EmailThread table').item.json.id }}",
  "isPrimary": {{ $json.isPrimary }}
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "link_id",
    "quoteRequestId": "...",
    "emailThreadId": "...",
    "supplierId": "...",
    "isPrimary": true,
    "status": "SENT"
  }
}
```

### Step 6: Insert Email Message Record

After sending the email and linking the thread, record the outbound message:

```json
{
  "id": "{{ $uuid }}",
  "threadId": "{{ $('EmailThread table').item.json.id }}",
  "direction": "OUTBOUND",
  "from": "{{ $json.organization.contactInfo }}",
  "to": "{{ $json.supplier.email }}",
  "subject": "Quote Request {{ $json.quoteNumber }} - {{ $json.supplier.name }}",
  "body": "Plain text version of email",
  "bodyHtml": "Full HTML email content",
  "sentAt": "{{ $now }}",
  "createdAt": "{{ $now }}",
  "updatedAt": "{{ $now }}"
}
```

## Testing the Multi-Supplier Flow

### Test Case 1: Single Supplier (Backward Compatibility)

**Input**: Quote request with only primary supplier
- Primary supplier: testSubaccount
- Additional suppliers: none

**Expected**:
- 1 webhook call
- 1 email thread created
- 1 email sent
- 1 link-email-thread call with `isPrimary: true`

### Test Case 2: Multiple Suppliers (New Feature)

**Input**: Quote request with 3 suppliers
- Primary supplier: testSubaccount
- Additional suppliers: Brandt, Another Supplier

**Expected**:
- 3 webhook calls (one per supplier)
- 3 separate email threads created
- 3 emails sent (one to each supplier)
- 3 link-email-thread calls:
  - Call 1: `isPrimary: true` for testSubaccount
  - Call 2: `isPrimary: false` for Brandt
  - Call 3: `isPrimary: false` for Another Supplier

### Verification Queries

Check that links were created properly:

```sql
-- Should show 3 records for a quote with 3 suppliers
SELECT 
  qret.*,
  s.name as supplier_name,
  et.subject as thread_subject
FROM quote_request_email_threads qret
JOIN suppliers s ON qret."supplierId" = s.id
JOIN email_threads et ON qret."emailThreadId" = et.id
WHERE qret."quoteRequestId" = 'your-quote-id'
ORDER BY qret."isPrimary" DESC, qret."createdAt" ASC;
```

Expected result:
```
| isPrimary | supplier_name   | status | thread_subject                        |
|-----------|----------------|--------|---------------------------------------|
| true      | testSubaccount | SENT   | Quote Request QR-12-2025-4273 - test  |
| false     | Brandt         | SENT   | Quote Request QR-12-2025-4273 - Bra.. |
| false     | Another Sup... | SENT   | Quote Request QR-12-2025-4273 - Ano.. |
```

## Common Issues & Solutions

### Issue 1: Only One Email Sent Despite Multiple Suppliers

**Symptom**: Webhook receives 3 calls but only 1 email sent

**Cause**: Workflow is using `quoteRequestId` to check if thread already exists and skipping duplicate requests

**Solution**: Remove any deduplication logic based on `quoteRequestId`. Each supplier should get its own thread. Use `supplierId` + `quoteRequestId` combination to identify unique requests.

### Issue 2: Email Threads Not Linked to Quote Request

**Symptom**: Threads created but `QuoteRequestEmailThread` table is empty

**Cause**: Missing the HTTP request to `/link-email-thread` endpoint

**Solution**: Add the HTTP Request node (Step 5 above) after email is sent successfully

### Issue 3: All Threads Marked as Primary

**Symptom**: All `QuoteRequestEmailThread` records have `isPrimary: true`

**Cause**: Not passing the `isPrimary` field from webhook payload to link-email-thread call

**Solution**: Ensure you're using `{{ $json.isPrimary }}` in the link-email-thread request body

## Environment Variables Required

Make sure these are set in your n8n environment:

```bash
APP_BASE_URL=https://your-app-domain.com
# Used for making the link-email-thread API call
```

## Summary of Changes

1. ✅ **Payload includes `supplierId`** - Each webhook call has unique supplier context
2. ✅ **Payload includes `isPrimary`** - Identifies primary vs additional suppliers
3. ✅ **Generate unique thread IDs** - Based on both quoteRequestId and supplierId
4. ✅ **Create separate email threads** - One per supplier
5. ✅ **Send individual emails** - Each supplier gets their own message
6. ✅ **Call link-email-thread endpoint** - Links each thread to the quote request
7. ✅ **Remove deduplication logic** - Allow multiple requests per quote (one per supplier)

## Next Steps

1. Update the n8n workflow following the steps above
2. Test with a single supplier to ensure backward compatibility
3. Test with multiple suppliers (2-3) to verify parallel processing
4. Monitor the `QuoteRequestEmailThread` table to ensure proper linking
5. Verify each supplier receives their own email
