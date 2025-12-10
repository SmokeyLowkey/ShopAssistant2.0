# Multi-Supplier Quote Implementation - Integration Guide

## Status: ✅ Backend Complete, Frontend Integration Ready

### Completed Work

#### 1. Database Schema ✅
- Created `QuoteRequestEmailThread` junction table
- Added `QuoteThreadStatus` enum (SENT, RESPONDED, ACCEPTED, REJECTED, NO_RESPONSE)
- Updated `QuoteRequest` model with:
  - `selectedSupplierId` field
  - `emailThreads` relation (one-to-many)
  - Separate relations for primary and selected suppliers
- Updated `Supplier` model with relations to quote threads
- Updated `EmailThread` model to support multiple quote request links
- Migration created and applied successfully

#### 2. API Endpoints ✅

**New Endpoints:**
- `POST /api/quote-requests/:id/link-email-thread` - Links email thread to quote for specific supplier
- `POST /api/quote-requests/:id/send` - Sends quote to all suppliers (primary + additional)

**Updated Endpoints:**
- `GET /api/quote-requests/:id` - Now includes `emailThreads` array with full details
- `POST /api/quote-requests/:id/convert-to-order` - Accepts `selectedSupplierId` parameter
  - Updates thread statuses (ACCEPTED for selected, REJECTED for others)
  - Links order to correct supplier and email thread

#### 3. Frontend Components ✅

**Created Components:**
1. `components/quote-request/supplier-selection.tsx` - Multi-supplier selection UI
2. `components/quote-request/price-comparison.tsx` - Side-by-side price comparison table
3. `components/quote-request/supplier-response-tabs.tsx` - Tabbed view of supplier responses

### Frontend Integration Guide

#### Integrating into Quote Request Creation Page

**File:** `app/orders/quote-request/new/page.tsx` (or equivalent)

**Steps:**

1. **Import the component:**
```tsx
import { SupplierSelectionInput } from "@/components/quote-request/supplier-selection";
```

2. **Add state management:**
```tsx
const [supplierId, setSupplierId] = useState("");
const [additionalSupplierIds, setAdditionalSupplierIds] = useState<string[]>([]);
const [suppliers, setSuppliers] = useState([]);
```

3. **Fetch suppliers:**
```tsx
useEffect(() => {
  // Fetch suppliers from your API
  fetchSuppliers().then(data => setSuppliers(data));
}, []);
```

4. **Add component to form:**
```tsx
<SupplierSelectionInput
  primarySupplierId={supplierId}
  additionalSupplierIds={additionalSupplierIds}
  onPrimaryChange={setSupplierId}
  onAdditionalChange={setAdditionalSupplierIds}
  suppliers={suppliers}
/>
```

5. **Update submission logic:**
```tsx
const handleSubmit = async () => {
  const quoteData = {
    supplierId,
    additionalSupplierIds: JSON.stringify(additionalSupplierIds), // Store as JSON
    // ... other fields
  };
  
  const response = await createQuoteRequest(quoteData);
  
  // Optional: Send emails immediately after creation
  if (response.data.id) {
    await sendQuoteToMultipleSuppliers(response.data.id);
  }
};
```

#### Integrating into Quote Request Detail Page

**File:** `app/orders/quote-request/[id]/page.tsx`

**Important:** This file is 1677 lines long. Modifications should be made carefully.

**Recommended Approach:**

1. **Import components at the top:**
```tsx
import { SupplierResponseTabs } from "@/components/quote-request/supplier-response-tabs";
import { PriceComparisonTable } from "@/components/quote-request/price-comparison";
```

2. **Add state for selected supplier:**
```tsx
const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
```

3. **Update the quote request fetch to include emailThreads:**
The `GET /api/quote-requests/:id` endpoint now returns:
```typescript
{
  data: {
    // ... existing fields
    emailThreads: [
      {
        id: string,
        supplierId: string,
        isPrimary: boolean,
        status: string,
        responseDate: Date | null,
        quotedAmount: number | null,
        supplier: { ... },
        emailThread: {
          messages: [ ... ]
        }
      }
    ],
    selectedSupplierId: string | null
  }
}
```

4. **Add the multi-supplier view section:**

Find the section where email thread/communication timeline is displayed. Add a conditional check:

```tsx
{/* Multi-Supplier Communication */}
{quoteRequest.emailThreads && quoteRequest.emailThreads.length > 1 ? (
  <div className="space-y-6">
    {/* Price Comparison - Show only if we have responses */}
    {quoteRequest.emailThreads.some(t => t.quotedAmount) && (
      <Card>
        <CardHeader>
          <CardTitle>Price Comparison</CardTitle>
          <CardDescription>
            Compare quotes from {quoteRequest.emailThreads.length} suppliers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PriceComparisonTable
            emailThreads={quoteRequest.emailThreads}
            onSelectSupplier={setSelectedSupplierId}
            selectedSupplierId={selectedSupplierId || quoteRequest.selectedSupplierId}
          />
        </CardContent>
      </Card>
    )}

    {/* Supplier Response Tabs */}
    <Card>
      <CardHeader>
        <CardTitle>Supplier Communications</CardTitle>
        <CardDescription>
          View responses and communication history for each supplier
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SupplierResponseTabs
          emailThreads={quoteRequest.emailThreads}
          onSelectSupplier={setSelectedSupplierId}
        />
      </CardContent>
    </Card>
  </div>
) : (
  // Original single supplier view
  <CommunicationTimeline ... />
)}
```

5. **Update the "Convert to Order" function:**

```tsx
const handleConvertToOrder = async () => {
  setIsConverting(true);
  try {
    // Use selected supplier or fall back to primary
    const supplierToUse = selectedSupplierId || quoteRequest.supplierId;
    
    const response = await convertQuoteRequestToOrder(quoteRequestId, {
      fulfillmentMethod: "DELIVERY", // or user-selected value
      selectedSupplierId: supplierToUse,
      // ... other order details
    });
    
    toast({
      title: "Success",
      description: `Order created with ${quoteRequest.emailThreads.find(t => t.supplierId === supplierToUse)?.supplier.name}`,
    });
    
    router.push(`/orders/${response.data.orderId}`);
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to convert quote to order",
      variant: "destructive",
    });
  } finally {
    setIsConverting(false);
  }
};
```

#### Helper Function: Send Quote to Multiple Suppliers

Add this to `lib/api/quote-requests.ts`:

```typescript
export async function sendQuoteToMultipleSuppliers(quoteRequestId: string) {
  const response = await apiRequest<{
    success: boolean;
    data: {
      totalSent: number;
      totalFailed: number;
      primary: any;
      additional: any[];
      errors: any[];
    };
  }>(`/api/quote-requests/${quoteRequestId}/send`, {
    method: "POST",
  });
  return response;
}
```

#### Integration with n8n Workflow

The n8n workflow integration is designed to work seamlessly:

1. When the quote is sent via `/api/quote-requests/:id/send`:
   - Frontend loops through all suppliers
   - Makes separate n8n calls per supplier
   - Each call returns email thread ID
   
2. After n8n creates the email thread:
   - n8n should call `/api/quote-requests/:id/link-email-thread`
   - This links the thread to the quote request

**n8n HTTP Request Node Configuration:**
```json
{
  "url": "{{$env.APP_URL}}/api/quote-requests/{{$json.quoteRequestId}}/link-email-thread",
  "method": "POST",
  "body": {
    "supplierId": "{{$json.supplier.id}}",
    "emailThreadId": "{{$('insert email_thread').item.json.id}}",
    "isPrimary": "{{$json.isPrimary}}"
  }
}
```

### Backward Compatibility

The implementation maintains full backward compatibility:

- Quotes with single supplier continue to work as before
- `emailThread` (singular) relation still exists alongside `emailThreads` (plural)
- If `additionalSupplierIds` is null/empty, behaves like old system
- API endpoints accept both old and new parameters

### Testing Checklist

- [ ] Create quote with single supplier (backward compatibility)
- [ ] Create quote with multiple suppliers
- [ ] Send quote to multiple suppliers
- [ ] Verify each supplier receives email
- [ ] Simulate price responses from suppliers
- [ ] View price comparison table
- [ ] Select non-primary supplier for order
- [ ] Convert to order and verify correct supplier linked
- [ ] Check thread statuses updated (ACCEPTED/REJECTED)

### Known Limitations

1. **Quote Request Detail Page Size:** The page is 1677 lines and complex. Consider refactoring into smaller components.
2. **Email Sending:** Currently client-side loop. If one supplier fails, others still succeed (by design).
3. **Price Updates:** Prices need to be manually parsed from email responses or updated via separate endpoint.

### Next Steps

1. **Update Quote Request Creation Page** - Add SupplierSelectionInput
2. **Update Quote Request Detail Page** - Add multi-supplier views
3. **Update n8n Workflow** - Add link-email-thread call after thread creation
4. **Add Price Update Endpoint** (optional) - Auto-parse prices from emails
5. **Test End-to-End** - Create quote, send to suppliers, compare prices, convert to order

### Example Usage Flow

1. User creates quote request, selects 3 suppliers (1 primary + 2 additional)
2. User clicks "Send Quote"
3. System calls `/api/quote-requests/:id/send`
4. Three emails sent via n8n (one per supplier)
5. Each supplier gets email, n8n links thread via `/link-email-thread`
6. Suppliers respond with prices
7. Prices displayed in comparison table
8. User sees:
   - Supplier A: $1,500 (primary)
   - Supplier B: $1,200 ✓ Best Price
   - Supplier C: $1,350
9. User selects Supplier B
10. User clicks "Convert to Order"
11. System creates order with Supplier B
12. Updates thread statuses:
    - Supplier B thread: ACCEPTED
    - Supplier A thread: REJECTED
    - Supplier C thread: REJECTED

---

**Implementation Status:** Backend Complete ✅  
**Next Priority:** Frontend Page Integration  
**Risk Level:** Low (backward compatible)
