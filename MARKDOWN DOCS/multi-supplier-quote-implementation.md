# Multi-Supplier Quote Request System - Implementation Guide

**Project**: Construction Dashboard  
**Feature**: Multi-Supplier Quote Request with Price Comparison  
**Date**: December 6, 2025  
**Status**: Planning → Implementation Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Changes](#database-changes)
4. [API Endpoints](#api-endpoints)
5. [Frontend Changes](#frontend-changes)
6. [n8n Workflow Updates](#n8n-workflow-updates)
7. [Implementation Phases](#implementation-phases)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Plan](#deployment-plan)
10. [Rollback Strategy](#rollback-strategy)

---

## Overview

### Problem Statement
Currently, the system only supports sending quote requests to a single supplier at a time. This limits the organization's ability to:
- Compare prices across multiple suppliers
- Get the best deal for parts
- Maintain competitive supplier relationships
- Reduce procurement costs

### Solution
Implement a multi-supplier quote request system that allows:
- Sending the same quote request to multiple suppliers simultaneously
- Tracking responses from each supplier independently
- Comparing prices side-by-side
- Selecting the best supplier based on price, delivery time, and other factors
- Converting the selected quote to an order

### Key Benefits
- **Cost Savings**: Automatically compare prices across suppliers
- **Time Efficiency**: Send to multiple suppliers in one action
- **Better Decisions**: Side-by-side comparison of quotes
- **Audit Trail**: Complete history of all supplier communications
- **Flexibility**: Choose any responding supplier, not just the primary

---

## Architecture

### Current System Flow
```
Quote Request Created → Email Sent to ONE Supplier → Response Received → Convert to Order
                                     ↓
                            ONE Email Thread
```

### New System Flow
```
Quote Request Created → Client-Side Loop → Email Sent to Supplier 1 → Thread 1
                                        → Email Sent to Supplier 2 → Thread 2
                                        → Email Sent to Supplier 3 → Thread 3
                                                    ↓
                            Multiple Email Threads (One per Supplier)
                                                    ↓
                            Responses Tracked Independently
                                                    ↓
                            Price Comparison UI
                                                    ↓
                            Select Best Supplier → Convert to Order
```

### Design Decisions

#### Why Client-Side Loop (Approach 1)?
We chose to implement supplier looping on the **client side** rather than in n8n because:

1. **AI Agent Complexity**: The current n8n workflow uses an AI agent which makes looping unpredictable
2. **Simpler Debugging**: Each supplier email is a separate API call, easier to track and debug
3. **Better Error Handling**: Can handle partial failures (e.g., 2/3 suppliers succeed)
4. **No n8n Changes Required**: Existing workflow continues to work as-is
5. **Faster Implementation**: No need to refactor complex n8n AI agent workflow

#### Data Model Strategy
We use a **junction table** approach (`QuoteRequestEmailThread`) to:
- Link multiple email threads to one quote request
- Track status per supplier independently
- Store pricing per supplier
- Maintain referential integrity

---

## Database Changes

### New Models

#### QuoteRequestEmailThread
**Purpose**: Links quote requests to email threads for each supplier

```prisma
model QuoteRequestEmailThread {
  id             String       @id @default(cuid())
  quoteRequestId String
  emailThreadId  String       @unique
  supplierId     String
  
  // Status tracking per supplier
  isPrimary      Boolean      @default(false)
  status         QuoteThreadStatus @default(SENT)
  responseDate   DateTime?
  quotedAmount   Decimal?     @db.Decimal(10, 2)
  
  // Timestamps
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  
  // Relations
  quoteRequest   QuoteRequest @relation(fields: [quoteRequestId], references: [id], onDelete: Cascade)
  emailThread    EmailThread  @relation(fields: [emailThreadId], references: [id])
  supplier       Supplier     @relation(fields: [supplierId], references: [id])
  
  @@unique([quoteRequestId, supplierId])
  @@map("quote_request_email_threads")
  @@index([quoteRequestId])
  @@index([supplierId])
}
```

#### QuoteThreadStatus Enum
```prisma
enum QuoteThreadStatus {
  SENT           // Email sent, awaiting response
  RESPONDED      // Supplier has responded with pricing
  ACCEPTED       // This supplier was selected for the order
  REJECTED       // Another supplier was selected
  NO_RESPONSE    // Supplier did not respond in time
}
```

### Modified Models

#### QuoteRequest
```prisma
model QuoteRequest {
  // REMOVED: One-to-one email thread relation
  // emailThreadId String? @unique
  // emailThread   EmailThread?
  
  // ADDED: One-to-many email threads relation
  emailThreads       QuoteRequestEmailThread[]
  
  // ADDED: Track which supplier was selected
  selectedSupplierId String?
  selectedSupplier   Supplier? @relation("SelectedQuoteSupplier", fields: [selectedSupplierId], references: [id])
  
  // ADDED: Store additional supplier IDs as JSON
  additionalSupplierIds String? // JSON array of supplier IDs
  
  // ... existing fields unchanged
}
```

#### Supplier
```prisma
model Supplier {
  // ... existing fields
  
  // ADDED: Relations for multi-supplier quotes
  quoteRequestEmailThreads QuoteRequestEmailThread[]
  selectedQuoteRequests    QuoteRequest[] @relation("SelectedQuoteSupplier")
}
```

#### EmailThread
```prisma
model EmailThread {
  // ... existing fields
  
  // ADDED: Can be linked to multiple quote requests via junction table
  quoteRequestEmailThreads QuoteRequestEmailThread[]
}
```

### Migration Script

```bash
# Create migration
npx prisma migrate dev --name add_multi_supplier_quote_support

# Migration will:
# 1. Create QuoteRequestEmailThread table
# 2. Create QuoteThreadStatus enum
# 3. Add selectedSupplierId to QuoteRequest
# 4. Add additionalSupplierIds to QuoteRequest
# 5. Create necessary indexes and foreign keys
```

### Data Migration Strategy

For existing quote requests with email threads:

```sql
-- Migrate existing quote requests to new structure
INSERT INTO quote_request_email_threads (
  id,
  quoteRequestId,
  emailThreadId,
  supplierId,
  isPrimary,
  status,
  createdAt,
  updatedAt
)
SELECT
  gen_random_uuid(),
  qr.id,
  qr.emailThreadId,
  qr.supplierId,
  true, -- Mark as primary
  CASE 
    WHEN qr.status = 'SENT' THEN 'SENT'
    WHEN qr.status = 'RECEIVED' THEN 'RESPONDED'
    WHEN qr.status = 'CONVERTED_TO_ORDER' THEN 'ACCEPTED'
    ELSE 'NO_RESPONSE'
  END,
  qr.createdAt,
  qr.updatedAt
FROM quote_requests qr
WHERE qr.emailThreadId IS NOT NULL;

-- Don't drop the old columns yet (for rollback safety)
-- Will drop in a later migration after verification
```

---

## API Endpoints

### New Endpoints

#### 1. Link Email Thread to Quote Request
```
POST /api/quote-requests/:id/link-email-thread
```

**Purpose**: Create a link between a quote request and an email thread for a specific supplier

**Request Body**:
```json
{
  "supplierId": "supplier-001",
  "emailThreadId": "thread-abc123",
  "isPrimary": true
}
```

**Response**:
```json
{
  "data": {
    "id": "link-xyz789",
    "quoteRequestId": "quote-123",
    "emailThreadId": "thread-abc123",
    "supplierId": "supplier-001",
    "isPrimary": true,
    "status": "SENT",
    "createdAt": "2025-12-06T10:00:00Z"
  }
}
```

**Called By**: n8n workflow after sending email

---

#### 2. Send Quote to Multiple Suppliers
```
POST /api/quote-requests/:id/send
```

**Purpose**: Send quote request emails to all suppliers (primary + additional)

**Request Body**: None (reads from quote request)

**Response**:
```json
{
  "success": true,
  "data": {
    "totalSent": 3,
    "totalFailed": 0,
    "primary": {
      "supplierId": "supplier-001",
      "emailContent": { "subject": "...", "body": "..." },
      "messageId": "msg-abc123"
    },
    "additional": [
      {
        "supplierId": "supplier-002",
        "emailContent": { "subject": "...", "body": "..." },
        "messageId": "msg-def456"
      },
      {
        "supplierId": "supplier-003",
        "emailContent": { "subject": "...", "body": "..." },
        "messageId": "msg-ghi789"
      }
    ],
    "errors": []
  }
}
```

---

### Modified Endpoints

#### 1. Create Quote Request
```
POST /api/quote-requests
```

**Changes**: Accept `additionalSupplierIds` parameter

**Request Body**:
```json
{
  "supplierId": "supplier-001",
  "additionalSupplierIds": ["supplier-002", "supplier-003"],
  "vehicleId": "vehicle-123",
  "items": [
    {
      "partNumber": "T396635",
      "description": "Front Lower Windowpane",
      "quantity": 1
    }
  ],
  "notes": "Need ASAP"
}
```

---

#### 2. Get Quote Request Details
```
GET /api/quote-requests/:id
```

**Changes**: Include `emailThreads` with supplier and message details

**Response**:
```json
{
  "data": {
    "id": "quote-123",
    "quoteNumber": "QR-12-2024-001",
    "status": "SENT",
    "supplierId": "supplier-001",
    "supplier": { "id": "supplier-001", "name": "ABC Parts" },
    "emailThreads": [
      {
        "id": "link-1",
        "supplierId": "supplier-001",
        "isPrimary": true,
        "status": "RESPONDED",
        "quotedAmount": 1250.00,
        "responseDate": "2025-12-06T14:30:00Z",
        "supplier": {
          "id": "supplier-001",
          "name": "ABC Parts",
          "email": "sales@abcparts.com"
        },
        "emailThread": {
          "id": "thread-1",
          "subject": "Quote Request QR-12-2024-001",
          "messages": [...]
        }
      },
      {
        "id": "link-2",
        "supplierId": "supplier-002",
        "isPrimary": false,
        "status": "RESPONDED",
        "quotedAmount": 1180.00,
        "responseDate": "2025-12-06T15:45:00Z",
        "supplier": {
          "id": "supplier-002",
          "name": "XYZ Supply",
          "email": "quotes@xyzsupply.com"
        },
        "emailThread": {
          "id": "thread-2",
          "subject": "Quote Request QR-12-2024-001",
          "messages": [...]
        }
      }
    ],
    "items": [...],
    "vehicle": {...}
  }
}
```

---

#### 3. Convert Quote to Order
```
POST /api/quote-requests/:id/convert-to-order
```

**Changes**: Accept `selectedSupplierId` parameter

**Request Body**:
```json
{
  "selectedSupplierId": "supplier-002",
  "fulfillmentMethod": "DELIVERY",
  "shippingAddress": {...}
}
```

**Logic Changes**:
1. Use `selectedSupplierId` instead of quote request's primary `supplierId`
2. Link order to selected supplier's email thread
3. Mark selected thread as `ACCEPTED`
4. Mark other threads as `REJECTED`
5. Update quote request's `selectedSupplierId`

---

## Frontend Changes

### New Components

#### 1. SupplierSelectionInput
**Location**: `components/quote-request/supplier-selection.tsx`

**Purpose**: Multi-select UI for choosing suppliers

```tsx
interface SupplierSelectionInputProps {
  primarySupplierId: string;
  additionalSupplierIds: string[];
  onPrimaryChange: (id: string) => void;
  onAdditionalChange: (ids: string[]) => void;
}

export function SupplierSelectionInput({ ... }: SupplierSelectionInputProps) {
  return (
    <>
      {/* Primary Supplier Dropdown */}
      <Select value={primarySupplierId} onValueChange={onPrimaryChange}>
        ...
      </Select>
      
      {/* Additional Suppliers Checkboxes */}
      <div className="space-y-2">
        {suppliers.map(supplier => (
          <Checkbox
            checked={additionalSupplierIds.includes(supplier.id)}
            onCheckedChange={(checked) => handleToggle(supplier.id, checked)}
          />
        ))}
      </div>
    </>
  )
}
```

---

#### 2. SupplierResponseTabs
**Location**: `components/quote-request/supplier-response-tabs.tsx`

**Purpose**: Tabbed interface showing each supplier's response

```tsx
interface SupplierResponseTabsProps {
  emailThreads: QuoteRequestEmailThread[];
  onSelectSupplier: (supplierId: string) => void;
}

export function SupplierResponseTabs({ emailThreads }: SupplierResponseTabsProps) {
  return (
    <Tabs defaultValue={emailThreads[0]?.supplierId}>
      <TabsList>
        {emailThreads.map(thread => (
          <TabsTrigger value={thread.supplierId}>
            {thread.isPrimary && <Star />}
            {thread.supplier.name}
            {thread.quotedAmount && <span>${thread.quotedAmount}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      
      {emailThreads.map(thread => (
        <TabsContent value={thread.supplierId}>
          <SupplierResponseCard thread={thread} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
```

---

#### 3. PriceComparisonTable
**Location**: `components/quote-request/price-comparison.tsx`

**Purpose**: Side-by-side price comparison

```tsx
interface PriceComparisonTableProps {
  emailThreads: QuoteRequestEmailThread[];
  onSelectSupplier: (supplierId: string) => void;
}

export function PriceComparisonTable({ emailThreads }: PriceComparisonTableProps) {
  const respondedThreads = emailThreads.filter(t => t.status === 'RESPONDED')
  const sortedByPrice = respondedThreads.sort((a, b) => 
    (a.quotedAmount || 0) - (b.quotedAmount || 0)
  )
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Supplier</TableHead>
          <TableHead>Total Quote</TableHead>
          <TableHead>Response Time</TableHead>
          <TableHead>Rating</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedByPrice.map((thread, index) => (
          <TableRow className={index === 0 ? 'bg-green-900/20' : ''}>
            <TableCell>
              {index === 0 && <Trophy />}
              {thread.supplier.name}
            </TableCell>
            <TableCell>
              ${thread.quotedAmount}
              {index === 0 && <Badge>Best Price</Badge>}
            </TableCell>
            <TableCell>{calculateResponseTime(thread)}</TableCell>
            <TableCell><StarRating rating={thread.supplier.rating} /></TableCell>
            <TableCell>
              <Button onClick={() => onSelectSupplier(thread.supplierId)}>
                Select
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

---

### Modified Pages

#### 1. Quote Request Creation Page
**File**: `app/orders/quote-request/new/page.tsx`

**Changes**:
- Add `<SupplierSelectionInput />` component
- Store `additionalSupplierIds` in state
- Send to API on submit
- Show info alert when multiple suppliers selected

**New State**:
```tsx
const [primarySupplierId, setPrimarySupplierId] = useState('')
const [additionalSupplierIds, setAdditionalSupplierIds] = useState<string[]>([])
```

---

#### 2. Quote Request Detail Page
**File**: `app/orders/quote-request/[id]/page.tsx`

**Major Refactor**:
- Replace single supplier view with `<SupplierResponseTabs />`
- Add `<PriceComparisonTable />` when multiple responses exist
- Add supplier selection logic for order conversion
- Show "X suppliers compared" badge
- Display response status per supplier

**New Features**:
- Tab per supplier with their communication history
- Price comparison section
- Best price highlighting
- Response time tracking
- Convert to order button per supplier

---

#### 3. Orders List Page
**File**: `app/orders/page.tsx`

**Changes**:
- Show badge "3 suppliers compared" if quote had multiple suppliers
- Link to quote request to see comparison

```tsx
<TableCell>
  {order.supplier.name}
  {order.quoteRequest?.emailThreads?.length > 1 && (
    <Badge variant="outline">
      {order.quoteRequest.emailThreads.length} suppliers compared
    </Badge>
  )}
</TableCell>
```

---

#### 4. Order Detail Page
**File**: `app/orders/[id]/page.tsx`

**Changes**:
- Add "Quote Request Context" card showing comparison
- Highlight selected supplier
- Show price difference if not cheapest selected
- Display savings/cost difference message

---

## n8n Workflow Updates

### Current Workflow
```
Webhook → Transform Data → AI Agent → Send Email → Update DB → Respond
```

### Updated Workflow

#### Step 1: Add Transform Node
**Node**: "Transform Webhook Data to Chat Input"  
**Type**: Code Node  
**Position**: After webhook, before AI agent

**Code**:
```javascript
const webhookData = $input.item.json.body;

const chatInput = `
GENERATE A PROFESSIONAL QUOTE REQUEST EMAIL

## QUOTE INFORMATION
- Quote Request ID: ${webhookData.quoteRequestId}
- Quote Number: ${webhookData.quoteNumber}
...

## SUPPLIER INFORMATION
- Name: ${webhookData.supplier.name}
- Email: ${webhookData.supplier.email}
...
`;

return {
  json: {
    chatInput: chatInput,
    originalData: webhookData,
    quoteRequestId: webhookData.quoteRequestId,
    supplier: webhookData.supplier,
    // ... extract other fields for easy access
  }
};
```

---

#### Step 2: Update AI Agent Input
**Node**: "Email AI Agent"

**Change prompt from**:
```
={{ $json.body.quoteNumber }}
```

**To**:
```
={{ $json.chatInput }}
```

---

#### Step 3: Add Thread Linking Step
**Node**: "Link Email Thread" (HTTP Request)  
**Type**: HTTP Request  
**Position**: After database inserts, before response

**Configuration**:
```
URL: {{$env.APP_URL}}/api/quote-requests/{{$json.quoteRequestId}}/link-email-thread
Method: POST
Authentication: JWT
Headers:
  Content-Type: application/json
Body:
{
  "supplierId": "{{$json.supplier.id}}",
  "emailThreadId": "{{$('insert email_thread').item.json.id}}",
  "isPrimary": {{$json.isPrimary || false}}
}
```

---

#### Step 4: Update Database Tool Parameters

**Update Quote Request**:
```javascript
{
  "id": "={{ $json.quoteRequestId }}",
  "supplierId": "={{ $json.supplier.id }}",
  "suggestedFulfillmentMethod": "={{ $json.suggestedFulfillmentMethod }}",
  "pickListId": "={{ $json.pickListId }}",
  // ... other fields
}
```

**Insert Email Thread**:
```javascript
{
  "id": "={{ $('Send a message in Gmail').item.json.threadId || $generateId() }}",
  "subject": "={{ $('Send a message in Gmail').item.json.subject }}",
  "supplierId": "={{ $json.supplier.id }}",
  "quoteRequestId": "={{ $json.quoteRequestId }}",
  // ... other fields
}
```

---

### Response Format

**Update**: "Respond to QUOTE REQUEST" node

**Body**:
```json
{
  "emailContent": {
    "subject": "={{$('Send a message in Gmail').item.json.subject}}",
    "body": "={{$('Send a message in Gmail').item.json.message}}",
    "bodyHtml": "={{$('Send a message in Gmail').item.json.message}}"
  },
  "messageId": "={{$('insert email_message').item.json.id}}",
  "suggestedFollowUp": "3 days"
}
```

---

## Implementation Phases

### Phase 1: Database Foundation (2 hours)
**Deliverables**:
- [x] Create migration file
- [x] Add QuoteRequestEmailThread model
- [x] Add QuoteThreadStatus enum
- [x] Update QuoteRequest model
- [x] Update Supplier model
- [x] Update EmailThread model
- [x] Run migration
- [x] Migrate existing data
- [x] Test database integrity

**Acceptance Criteria**:
- Migration runs successfully
- All foreign keys working
- Existing quote requests migrated to new structure
- No data loss

---

### Phase 2: Backend APIs (4 hours)
**Deliverables**:
- [x] Update quote request creation API
- [x] Create link-email-thread endpoint
- [x] Update quote request detail endpoint
- [x] Implement multi-supplier email function
- [x] Create send endpoint
- [x] Update convert-to-order endpoint
- [x] Update price update handler

**Acceptance Criteria**:
- Can create quote with additional suppliers
- Can send emails to multiple suppliers
- Each supplier gets own email thread
- Threads properly linked to quote
- Conversion selects correct supplier

---

### Phase 3: Frontend UI (6 hours)
**Deliverables**:
- [x] Create SupplierSelectionInput component
- [x] Create SupplierResponseTabs component
- [x] Create PriceComparisonTable component
- [x] Update quote creation page
- [x] Refactor quote detail page
- [x] Update orders list page
- [x] Update order detail page
- [x] Add loading states
- [x] Add error handling

**Acceptance Criteria**:
- Can select multiple suppliers in UI
- Tabs show each supplier's thread
- Price comparison displays correctly
- Can select supplier for conversion
- Best price highlighted
- Responsive on mobile

---

### Phase 4: n8n Workflow (2 hours)
**Deliverables**:
- [x] Add transform node
- [x] Update AI agent input
- [x] Add thread linking step
- [x] Update database tool parameters
- [x] Update response format
- [x] Test workflow end-to-end

**Acceptance Criteria**:
- Emails sent successfully
- Threads created in database
- Links created correctly
- Response format matches expected

---

### Phase 5: Integration & Testing (4 hours)
**Deliverables**:
- [x] Single supplier test (backward compatibility)
- [x] Multi-supplier test (2+ suppliers)
- [x] Price comparison test
- [x] Order conversion test
- [x] Edge case testing
- [x] Performance testing

**Test Cases**: See [Testing Strategy](#testing-strategy)

---

### Phase 6: Documentation (2 hours)
**Deliverables**:
- [x] Update API documentation
- [x] Create user guide
- [x] Document n8n changes
- [x] Update ER diagram
- [x] Create deployment guide

---

## Testing Strategy

### Unit Tests

#### Database Layer
```typescript
describe('QuoteRequestEmailThread', () => {
  it('should create thread link', async () => {
    const link = await prisma.quoteRequestEmailThread.create({
      data: {
        quoteRequestId: 'quote-123',
        emailThreadId: 'thread-456',
        supplierId: 'supplier-789',
        isPrimary: true
      }
    });
    expect(link).toBeDefined();
  });
  
  it('should enforce unique constraint per supplier', async () => {
    // Attempt to create duplicate
    await expect(
      prisma.quoteRequestEmailThread.create({
        data: {
          quoteRequestId: 'quote-123',
          emailThreadId: 'thread-999',
          supplierId: 'supplier-789', // Same supplier
          isPrimary: false
        }
      })
    ).rejects.toThrow();
  });
});
```

#### API Layer
```typescript
describe('POST /api/quote-requests', () => {
  it('should create quote with additional suppliers', async () => {
    const response = await fetch('/api/quote-requests', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: 'supplier-1',
        additionalSupplierIds: ['supplier-2', 'supplier-3'],
        // ... other fields
      })
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.additionalSupplierIds).toContain('supplier-2');
  });
});
```

---

### Integration Tests

#### Multi-Supplier Email Flow
```typescript
describe('Multi-Supplier Quote Flow', () => {
  it('should send emails to all suppliers', async () => {
    // 1. Create quote
    const quote = await createQuote({
      supplierId: 'supplier-1',
      additionalSupplierIds: ['supplier-2', 'supplier-3']
    });
    
    // 2. Send emails
    const result = await sendQuoteEmails(quote.id);
    
    // 3. Verify
    expect(result.totalSent).toBe(3);
    expect(result.primary.supplierId).toBe('supplier-1');
    expect(result.additional).toHaveLength(2);
    
    // 4. Check database
    const threads = await prisma.quoteRequestEmailThread.findMany({
      where: { quoteRequestId: quote.id }
    });
    expect(threads).toHaveLength(3);
  });
});
```

#### Price Comparison & Selection
```typescript
describe('Price Comparison', () => {
  it('should select best price supplier', async () => {
    // 1. Create quote with multiple suppliers
    const quote = await createQuote({ /* ... */ });
    
    // 2. Send emails
    await sendQuoteEmails(quote.id);
    
    // 3. Simulate responses with different prices
    await updateThreadPrice(thread1.id, 1500.00);
    await updateThreadPrice(thread2.id, 1200.00); // Best price
    await updateThreadPrice(thread3.id, 1350.00);
    
    // 4. Convert to order with best price supplier
    const order = await convertToOrder(quote.id, thread2.supplierId);
    
    // 5. Verify
    expect(order.supplierId).toBe(thread2.supplierId);
    expect(order.total).toBe(1200.00);
    
    // 6. Check thread statuses
    const updatedThreads = await prisma.quoteRequestEmailThread.findMany({
      where: { quoteRequestId: quote.id }
    });
    expect(updatedThreads.find(t => t.id === thread2.id).status).toBe('ACCEPTED');
    expect(updatedThreads.find(t => t.id === thread1.id).status).toBe('REJECTED');
  });
});
```

---

### End-to-End Tests

#### Complete User Flow
```typescript
describe('E2E: Multi-Supplier Quote Request', () => {
  it('should complete full flow from creation to order', async () => {
    // 1. Login
    await page.goto('/auth/login');
    await login(testUser);
    
    // 2. Navigate to quote creation
    await page.goto('/orders/quote-request/new');
    
    // 3. Select primary supplier
    await page.selectOption('#primary-supplier', 'supplier-1');
    
    // 4. Select additional suppliers
    await page.check('#supplier-2-checkbox');
    await page.check('#supplier-3-checkbox');
    
    // 5. Add items
    await addQuoteItem({ partNumber: 'T396635', quantity: 1 });
    
    // 6. Submit
    await page.click('#submit-quote');
    
    // 7. Wait for quote creation
    await page.waitForSelector('.quote-created-message');
    
    // 8. Send emails
    await page.click('#send-quote-button');
    
    // 9. Wait for emails sent
    await page.waitForSelector('.emails-sent-message');
    
    // 10. Verify tabs appear
    const tabs = await page.$$('.supplier-tab');
    expect(tabs).toHaveLength(3);
    
    // 11. Simulate supplier responses (via API)
    await simulateSupplierResponse(quote.id, 'supplier-1', 1500);
    await simulateSupplierResponse(quote.id, 'supplier-2', 1200);
    await simulateSupplierResponse(quote.id, 'supplier-3', 1350);
    
    // 12. Refresh page
    await page.reload();
    
    // 13. Verify price comparison appears
    await page.waitForSelector('.price-comparison-table');
    
    // 14. Check best price highlighted
    const bestPriceBadge = await page.$('.best-price-badge');
    expect(bestPriceBadge).toBeTruthy();
    
    // 15. Select best price supplier
    await page.click('#select-supplier-2-button');
    
    // 16. Convert to order
    await page.click('#convert-to-order-button');
    await fillOrderDetails();
    await page.click('#confirm-order-button');
    
    // 17. Verify order created
    await page.waitForURL(/\/orders\/ORD-/);
    const orderTotal = await page.textContent('.order-total');
    expect(orderTotal).toContain('$1,200.00');
  });
});
```

---

### Edge Cases

1. **No Additional Suppliers** (Backward Compatibility)
   - Quote with only primary supplier
   - Should work exactly as before

2. **All Suppliers Fail to Respond**
   - All threads remain in SENT status
   - No price comparison available
   - Can still convert with primary supplier

3. **Partial Responses**
   - 1 out of 3 suppliers responds
   - Price comparison shows only responders
   - Can select from responded suppliers

4. **Primary Supplier Most Expensive**
   - Primary: $1500, Additional: $1200
   - User selects cheaper additional supplier
   - System should handle correctly

5. **Simultaneous Quote Requests**
   - Multiple users creating quotes at same time
   - No race conditions in database
   - Email sending doesn't conflict

6. **n8n Failure**
   - One supplier email fails
   - Other suppliers still processed
   - Error logged but doesn't break flow

---

## Deployment Plan

### Pre-Deployment Checklist

- [ ] Database migration tested on staging
- [ ] All tests passing
- [ ] Code review completed
- [ ] Performance tested (load test with 100 concurrent quotes)
- [ ] Documentation updated
- [ ] Rollback plan verified
- [ ] Monitoring alerts configured

---

### Deployment Steps

#### Step 1: Database Migration
```bash
# Staging
cd /path/to/app
npx prisma migrate deploy

# Verify migration
npx prisma db pull
```

#### Step 2: Backend Deployment
```bash
# Build
pnpm build

# Deploy to staging
# ... deployment commands specific to your hosting

# Smoke test
curl https://staging.app.com/api/quote-requests
```

#### Step 3: n8n Workflow Update
1. Export current workflow (backup)
2. Import updated workflow
3. Test with sample data
4. Activate workflow

#### Step 4: Frontend Deployment
```bash
# Verify build
pnpm build

# Deploy
# ... deployment commands

# Verify deployment
curl https://staging.app.com
```

#### Step 5: Verification
- [ ] Create test quote with multiple suppliers
- [ ] Send emails
- [ ] Verify emails received
- [ ] Simulate responses
- [ ] Check price comparison
- [ ] Convert to order
- [ ] Verify order created correctly

---

### Production Deployment

```bash
# 1. Maintenance mode (optional)
# Show "System Update in Progress" message

# 2. Deploy database migration
npx prisma migrate deploy --preview-feature

# 3. Deploy backend
# ... specific to your hosting

# 4. Deploy frontend
# ... specific to your hosting

# 5. Update n8n workflow
# Import and activate

# 6. Smoke test production
# Create real quote, verify emails sent

# 7. Monitor for 30 minutes
# Watch error logs, email delivery, database queries

# 8. All clear - remove maintenance mode
```

---

## Rollback Strategy

### If Issues Detected

#### Quick Rollback (< 5 minutes)
```bash
# 1. Revert to previous deployment
git checkout previous-release-tag
pnpm build
# ... redeploy

# 2. Revert n8n workflow
# Import previous workflow version

# 3. Database stays as-is
# New columns nullable, old code still works
```

#### Full Rollback (Database)
```sql
-- Only if absolutely necessary
-- Drops new tables but preserves data

-- 1. Backup first
pg_dump database_name > backup_before_rollback.sql

-- 2. Restore old email thread links
UPDATE quote_requests qr
SET emailThreadId = (
  SELECT emailThreadId 
  FROM quote_request_email_threads qret
  WHERE qret.quoteRequestId = qr.id 
  AND qret.isPrimary = true
  LIMIT 1
);

-- 3. Drop new tables
DROP TABLE quote_request_email_threads;
DROP TYPE QuoteThreadStatus;

-- 4. Redeploy old schema
npx prisma db push
```

---

### Monitoring Post-Deployment

#### Metrics to Watch

1. **Email Sending**
   - Success rate (should be >98%)
   - Time to send (should be <2s per supplier)
   - Failed sends per hour

2. **Database**
   - Query performance on new junction table
   - Foreign key constraint violations
   - Deadlocks

3. **User Actions**
   - Quote creation rate
   - Multi-supplier quote adoption
   - Order conversion rate
   - Average suppliers per quote

4. **Errors**
   - API errors (should be <0.1%)
   - n8n workflow failures
   - Frontend JavaScript errors

---

### Alerts Configuration

```yaml
# Example alert rules
alerts:
  - name: "High Email Failure Rate"
    condition: "email_send_failures > 5 per minute"
    action: "notify slack #alerts"
  
  - name: "Quote API Slow"
    condition: "api_response_time_p95 > 2000ms"
    action: "notify slack #alerts"
  
  - name: "Database Constraint Violation"
    condition: "constraint_violations > 0"
    action: "notify slack #critical, email team@company.com"
```

---

## Success Metrics

### Launch Week (Week 1)

**Goals**:
- 10% of quotes use multi-supplier feature
- 0 critical bugs
- <5 minor bugs
- 100% uptime

**Measurements**:
```sql
-- Multi-supplier adoption rate
SELECT 
  COUNT(*) FILTER (WHERE additionalSupplierIds IS NOT NULL) * 100.0 / COUNT(*) as adoption_rate
FROM quote_requests
WHERE createdAt > NOW() - INTERVAL '7 days';

-- Average suppliers per quote
SELECT AVG(
  1 + (
    SELECT COUNT(*) 
    FROM quote_request_email_threads 
    WHERE quoteRequestId = qr.id
  )
) as avg_suppliers
FROM quote_requests qr
WHERE qr.createdAt > NOW() - INTERVAL '7 days';

-- Cost savings (estimated)
SELECT 
  qr.id,
  MIN(qret.quotedAmount) as best_price,
  (SELECT quotedAmount FROM quote_request_email_threads WHERE quoteRequestId = qr.id AND isPrimary = true) as primary_price,
  (primary_price - best_price) as savings
FROM quote_requests qr
JOIN quote_request_email_threads qret ON qret.quoteRequestId = qr.id
WHERE qr.selectedSupplierId IS NOT NULL
  AND qr.createdAt > NOW() - INTERVAL '7 days'
GROUP BY qr.id;
```

---

### Month 1

**Goals**:
- 30% adoption rate
- Average 2.5 suppliers per multi-supplier quote
- Measurable cost savings (5% average)
- User satisfaction >4.5/5

**KPIs**:
- Quotes sent: +X%
- Average quote value: $Y
- Average savings per quote: $Z
- Time to order conversion: -A%

---

## Appendix

### A. Database ER Diagram

```
QuoteRequest ──────┐
                   │ 1:N
                   ↓
        QuoteRequestEmailThread ──→ EmailThread (1:1)
                   ↓ N:1
                Supplier
```

### B. API Request/Response Examples

See [API Endpoints](#api-endpoints) section

### C. n8n Workflow JSON

See [n8n Workflow Updates](#n8n-workflow-updates) section

### D. Frontend Component Tree

```
QuoteRequestDetailPage
├── SupplierResponseTabs
│   ├── TabsList
│   │   └── TabsTrigger (per supplier)
│   └── TabsContent (per supplier)
│       ├── SupplierResponseCard
│       ├── CommunicationTimeline
│       └── ActionButtons
└── PriceComparisonTable
    ├── TableHeader
    └── TableBody
        └── PriceRow (per supplier)
            └── SelectButton
```

### E. Glossary

- **Primary Supplier**: The main supplier selected when creating a quote request
- **Additional Suppliers**: Extra suppliers to send the same quote for comparison
- **Email Thread**: A conversation with a specific supplier about a quote
- **Quote Thread Status**: Status of communication with one supplier
- **Junction Table**: Table linking many-to-many relationships (QuoteRequestEmailThread)
- **Best Price**: Lowest quoted amount among all responding suppliers

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 6, 2025 | Initial implementation plan created |

---

**Document Owner**: Development Team  
**Last Updated**: December 6, 2025  
**Status**: Ready for Implementation
