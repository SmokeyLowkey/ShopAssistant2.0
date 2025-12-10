# Quote Status Flow Implementation

This document outlines the implementation plan for improving the quote status flow in the construction dashboard application. The goal is to ensure that the quote status is properly updated at different stages of communication in the app.

## Current Status Flow Analysis

Currently, the quote status is updated at the following points:

1. **Initial Creation**: When a quote request is created, it's set to `DRAFT` status.
2. **Sending to Supplier**: When a quote request email is sent to a supplier, the status is updated to `SENT`.
3. **Receiving Response**: When an email response is received from a supplier, the status is updated to `UNDER_REVIEW`.
4. **Follow-up Email**: When a follow-up email is sent, the status is updated to `UNDER_REVIEW`.
5. **Converting to Order**: When a quote is converted to an order, the status is updated to `CONVERTED_TO_ORDER`.
6. **Manual Approval**: In the UI, there's a button to accept a quote which updates the status to `APPROVED` before converting to an order.

## Identified Gaps

1. **No Status Update for RECEIVED**: There's no clear transition from `SENT` to `RECEIVED` when the supplier acknowledges receipt but hasn't provided a full quote yet.
2. **No Status Update for REJECTED**: There's no mechanism to mark a quote as `REJECTED` if the user decides not to proceed with it.
3. **No Status Update for EXPIRED**: There's no automatic or manual way to mark a quote as `EXPIRED` if it passes its expiry date.
4. **Inconsistent Follow-up Handling**: The follow-up email changes the status to `UNDER_REVIEW`, but this might not be appropriate for all types of follow-ups.
5. **No Differentiation Between Types of Follow-ups**: Different types of follow-ups should potentially update the status differently.

## Complete Quote Request Lifecycle

Here's a comprehensive map of the quote request lifecycle with appropriate status transitions:

### 1. DRAFT
- **Initial State**: When a quote request is first created but not yet sent to the supplier
- **Transitions To**: SENT (when the quote request email is sent to the supplier)

### 2. SENT
- **Description**: Quote request has been sent to the supplier, awaiting acknowledgment or response
- **Transitions To**: 
  - RECEIVED (when supplier acknowledges receipt but hasn't provided full quote)
  - UNDER_REVIEW (when supplier responds with a quote)
  - EXPIRED (when the quote request passes its expiry date without response)

### 3. RECEIVED
- **Description**: Supplier has acknowledged receipt of the quote request
- **Transitions To**:
  - UNDER_REVIEW (when supplier responds with a quote)
  - EXPIRED (when the quote request passes its expiry date without a full response)

### 4. UNDER_REVIEW
- **Description**: Supplier has responded with a quote that is being reviewed by the user
- **Transitions To**:
  - APPROVED (when the user accepts the quote)
  - REJECTED (when the user rejects the quote)
  - SENT (when the user sends a follow-up requesting revisions, resetting the process)

### 5. APPROVED
- **Description**: User has approved the quote
- **Transitions To**:
  - CONVERTED_TO_ORDER (when the quote is converted to an order)

### 6. REJECTED
- **Description**: User has rejected the quote
- **Transitions To**: None (terminal state)

### 7. EXPIRED
- **Description**: Quote request has passed its expiry date without being approved or rejected
- **Transitions To**: None (terminal state)

### 8. CONVERTED_TO_ORDER
- **Description**: Quote has been converted to an order
- **Transitions To**: None (terminal state)

## Status Update Rules for Different Communication Types

### Initial Quote Request
- Create quote request → DRAFT
- Send quote request email → SENT

### Supplier Responses
- Supplier acknowledges receipt → RECEIVED
- Supplier sends quote → UNDER_REVIEW

### Follow-up Emails
- Follow-up for no response → Keep as SENT (no status change)
- Follow-up for revision needed → Change from UNDER_REVIEW back to SENT
- Follow-up for quote acceptance → Change to APPROVED

### User Actions
- User approves quote → APPROVED
- User rejects quote → REJECTED
- User converts to order → CONVERTED_TO_ORDER

### Time-based Transitions
- Quote passes expiry date → EXPIRED

## Implementation Changes

### 1. Initial Quote Request Creation

The initial status is already correctly set to `DRAFT` in the POST route for creating a quote request:

```typescript
// app/api/quote-requests/route.ts (line 198)
const quoteRequest = await prisma.quoteRequest.create({
  data: {
    // ...other fields
    status: QuoteStatus.DRAFT,
    // ...other fields
  },
  // ...include fields
});
```

No changes needed for this part.

### 2. Sending Quote Request Email

The status is already correctly updated to `SENT` when a quote request email is sent:

```typescript
// app/api/webhooks/email/quote-request/route.ts (line 135-140)
// Update the quote request status
await prisma.quoteRequest.update({
  where: { id: quoteRequest.id },
  data: {
    status: 'SENT',
  },
});
```

No changes needed for this part.

### 3. Receiving Response from Supplier

Currently, all responses update the status to `UNDER_REVIEW`. We need to modify this to distinguish between a simple acknowledgment and a full quote response:

```typescript
// app/api/webhooks/email/parse/route.ts (replace lines 119-128)
// If this is a quote response, update the quote request
if (emailThread.quoteRequest) {
  // Determine if this is a simple acknowledgment or a full quote response
  let newStatus: QuoteStatus;
  
  if (parseResult.extractedData.quoteItems.length > 0 || 
      parseResult.extractedData.totalAmount > 0 ||
      parseResult.confidence > 0.7) {
    // This appears to be a full quote response with pricing details
    newStatus = QuoteStatus.UNDER_REVIEW;
  } else {
    // This appears to be a simple acknowledgment without pricing details
    newStatus = QuoteStatus.RECEIVED;
  }
  
  // Update the quote request status
  await prisma.quoteRequest.update({
    where: { id: emailThread.quoteRequest.id },
    data: {
      status: newStatus,
      responseDate: new Date(),
      totalAmount: parseResult.extractedData.quoteItems.length > 0 ? parseResult.extractedData.totalAmount : undefined,
      notes: parseResult.extractedData.additionalNotes || emailThread.quoteRequest.notes,
    },
  });
  
  // Log that we updated the quote request status
  console.log(`Updated quote request ${emailThread.quoteRequest.id} status to ${newStatus}`);
  
  // Only process quote items if they were extracted
  if (parseResult.extractedData.quoteItems.length > 0) {
    // ... (existing code for processing quote items)
  }
}
```

### 4. Sending Follow-up Emails

Currently, all follow-up emails update the status to `UNDER_REVIEW`. We need to modify this to handle different types of follow-ups differently:

```typescript
// app/api/webhooks/email/follow-up/route.ts (replace lines 439-447)
// Only update the quote status when actually sending the email, not for preview
if (action === "send") {
  // Determine the appropriate status based on the workflow branch
  let newStatus: QuoteStatus;
  
  switch (determinedWorkflowBranch) {
    case "no_response":
      // For no response follow-ups, keep the current status (likely SENT)
      // No status change needed
      console.log(`No status change for no_response follow-up for quote request ${quoteRequest.id}`);
      break;
      
    case "needs_revision":
      // For revision requests, change status back to SENT (awaiting revised quote)
      newStatus = QuoteStatus.SENT;
      await prisma.quoteRequest.update({
        where: { id: quoteRequest.id },
        data: {
          status: newStatus,
          responseDate: new Date()
        }
      });
      console.log(`Updated quote request ${quoteRequest.id} status to ${newStatus} for needs_revision follow-up`);
      break;
      
    case "accept_quote":
      // For quote acceptance, change status to APPROVED
      newStatus = QuoteStatus.APPROVED;
      await prisma.quoteRequest.update({
        where: { id: quoteRequest.id },
        data: {
          status: newStatus,
          responseDate: new Date()
        }
      });
      console.log(`Updated quote request ${quoteRequest.id} status to ${newStatus} for accept_quote follow-up`);
      break;
      
    default:
      // Default behavior (current implementation)
      newStatus = QuoteStatus.UNDER_REVIEW;
      await prisma.quoteRequest.update({
        where: { id: quoteRequest.id },
        data: {
          status: newStatus,
          responseDate: new Date()
        }
      });
      console.log(`Updated quote request ${quoteRequest.id} status to ${newStatus} (default behavior)`);
      break;
  }
}
```

### 5. Approving or Rejecting Quotes

We need to improve the existing "Accept Quote" button and add a "Reject Quote" button:

```typescript
// app/orders/quote-request/[id]/page.tsx (improve the Accept Quote button)
<Button
  className="w-full bg-green-600 hover:bg-green-700"
  onClick={() => {
    // First update status to APPROVED, then convert to order
    updateQuoteRequest(quoteRequestId, { status: QuoteStatus.APPROVED })
      .then(() => {
        toast({
          title: "Quote Approved",
          description: "Quote has been approved successfully.",
        });
        // Refresh the quote request data
        return handleFollowUpSent();
      })
      .then(() => handleConvertToOrder())
      .catch(error => {
        console.error("Error updating quote status:", error)
        toast({
          title: "Error",
          description: "Failed to accept quote. Please try again.",
          variant: "destructive",
        })
      })
  }}
>
  <CheckCircle className="w-4 h-4 mr-2" />
  Accept Quote
</Button>
```

```typescript
// app/orders/quote-request/[id]/page.tsx (add state for rejection confirmation dialog)
const [showRejectConfirmation, setShowRejectConfirmation] = useState(false);
```

```typescript
// app/orders/quote-request/[id]/page.tsx (add Reject Quote button)
<Button
  className="w-full bg-red-600 hover:bg-red-700"
  onClick={() => setShowRejectConfirmation(true)}
>
  <X className="w-4 h-4 mr-2" />
  Reject Quote
</Button>
```

```typescript
// app/orders/quote-request/[id]/page.tsx (add rejection confirmation dialog)
<Dialog open={showRejectConfirmation} onOpenChange={setShowRejectConfirmation}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Reject Quote</DialogTitle>
      <DialogDescription>
        Are you sure you want to reject this quote? This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <div className="flex justify-end gap-2 mt-4">
      <Button variant="outline" onClick={() => setShowRejectConfirmation(false)}>
        Cancel
      </Button>
      <Button 
        variant="destructive"
        onClick={() => {
          // Update status to REJECTED
          updateQuoteRequest(quoteRequestId, { status: QuoteStatus.REJECTED })
            .then(() => {
              toast({
                title: "Quote Rejected",
                description: "Quote has been rejected successfully.",
              });
              // Close the dialog
              setShowRejectConfirmation(false);
              // Refresh the quote request data
              return handleFollowUpSent();
            })
            .catch(error => {
              console.error("Error updating quote status:", error)
              toast({
                title: "Error",
                description: "Failed to reject quote. Please try again.",
                variant: "destructive",
              })
            })
        }}
      >
        Reject Quote
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

### 6. Converting to Order

The status is already correctly updated to `CONVERTED_TO_ORDER` when a quote is converted to an order:

```typescript
// app/api/quote-requests/[id]/convert-to-order/route.ts (lines 148-154)
// Update the quote request status
await prisma.quoteRequest.update({
  where: {
    id: quoteRequestId,
  },
  data: {
    status: QuoteStatus.CONVERTED_TO_ORDER,
  },
});
```

No changes needed for this part.

### 7. Updating Frontend Components

We need to update the `getStatusBadge` function to handle all the statuses in our lifecycle:

```typescript
// app/orders/quote-request/[id]/page.tsx (update getStatusBadge function)
// Helper function to get status badge
const getStatusBadge = (status: QuoteStatus) => {
  switch (status) {
    case QuoteStatus.DRAFT:
      return <Badge className="bg-slate-600 text-white">Draft</Badge>
    case QuoteStatus.SENT:
      return <Badge className="bg-blue-600 text-white">Sent</Badge>
    case QuoteStatus.RECEIVED:
      return <Badge className="bg-indigo-600 text-white">Received</Badge>
    case QuoteStatus.UNDER_REVIEW:
      return <Badge className="bg-yellow-600 text-white">Under Review</Badge>
    case QuoteStatus.APPROVED:
      return <Badge className="bg-green-600 text-white">Approved</Badge>
    case QuoteStatus.REJECTED:
      return <Badge className="bg-red-600 text-white">Rejected</Badge>
    case QuoteStatus.EXPIRED:
      return <Badge className="bg-orange-600 text-white">Expired</Badge>
    case QuoteStatus.CONVERTED_TO_ORDER:
      return <Badge className="bg-purple-600 text-white">Converted to Order</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}
```

We also need to update the UI to show different actions based on the current status:

```typescript
// app/orders/quote-request/[id]/page.tsx (update UI based on status)
{quoteRequest.status === QuoteStatus.DRAFT ? (
  <div className="text-center p-4 bg-slate-50 rounded-md">
    <FileText className="w-8 h-8 text-slate-500 mx-auto mb-2" />
    <p className="text-slate-800 font-medium">Draft Quote Request</p>
    <p className="text-slate-600 text-sm mt-1">
      This quote request has not been sent to the supplier yet.
    </p>
    <Button 
      className="w-full mt-4"
      onClick={() => {
        // Logic to send the quote request
      }}
    >
      <Mail className="w-4 h-4 mr-2" />
      Send to Supplier
    </Button>
  </div>
) : quoteRequest.status === QuoteStatus.SENT ? (
  <div className="text-center p-4 bg-blue-50 rounded-md">
    <Mail className="w-8 h-8 text-blue-500 mx-auto mb-2" />
    <p className="text-blue-800 font-medium">Waiting for Response</p>
    <p className="text-blue-600 text-sm mt-1">
      Quote request has been sent to the supplier.
    </p>
  </div>
) : quoteRequest.status === QuoteStatus.RECEIVED ? (
  <div className="text-center p-4 bg-indigo-50 rounded-md">
    <CheckCircle className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
    <p className="text-indigo-800 font-medium">Receipt Acknowledged</p>
    <p className="text-indigo-600 text-sm mt-1">
      Supplier has acknowledged receipt of the quote request.
    </p>
  </div>
) : quoteRequest.status === QuoteStatus.UNDER_REVIEW ? (
  <div className="space-y-2">
    <p className="text-sm text-center font-medium text-yellow-600 mb-2">
      Quote response is under review
    </p>
    <Button
      className="w-full bg-blue-600 hover:bg-blue-700"
      onClick={async () => {
        // Logic to review email
      }}
      disabled={isLoadingN8nResponse}
    >
      {isLoadingN8nResponse ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          <FileText className="w-4 h-4 mr-2" />
          Review Email
        </>
      )}
    </Button>
    <Button
      className="w-full bg-green-600 hover:bg-green-700"
      onClick={() => {
        // Update status to APPROVED
        updateQuoteRequest(quoteRequestId, { status: QuoteStatus.APPROVED })
          .then(() => {
            toast({
              title: "Quote Approved",
              description: "Quote has been approved successfully.",
            });
            // Refresh the quote request data
            return handleFollowUpSent();
          })
          .catch(error => {
            console.error("Error updating quote status:", error)
            toast({
              title: "Error",
              description: "Failed to approve quote. Please try again.",
              variant: "destructive",
            })
          })
      }}
    >
      <CheckCircle className="w-4 h-4 mr-2" />
      Accept Quote
    </Button>
    <Button
      className="w-full bg-red-600 hover:bg-red-700"
      onClick={() => setShowRejectConfirmation(true)}
    >
      <X className="w-4 h-4 mr-2" />
      Reject Quote
    </Button>
    <Button
      className="w-full bg-amber-600 hover:bg-amber-700"
      onClick={() => {
        // Logic for needs revision
      }}
    >
      <Edit className="w-4 h-4 mr-2" />
      Needs Revision
    </Button>
  </div>
) : quoteRequest.status === QuoteStatus.APPROVED ? (
  <div className="text-center p-4 bg-green-50 rounded-md">
    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
    <p className="text-green-800 font-medium">Quote Approved</p>
    <p className="text-green-600 text-sm mt-1">
      This quote has been approved and is ready to be converted to an order.
    </p>
    <Button 
      className="w-full mt-4"
      onClick={handleConvertToOrder}
      disabled={isConverting}
    >
      {isConverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      <ShoppingCart className="w-4 h-4 mr-2" />
      Convert to Order
    </Button>
  </div>
) : quoteRequest.status === QuoteStatus.REJECTED ? (
  <div className="text-center p-4 bg-red-50 rounded-md">
    <X className="w-8 h-8 text-red-500 mx-auto mb-2" />
    <p className="text-red-800 font-medium">Quote Rejected</p>
    <p className="text-red-600 text-sm mt-1">
      This quote has been rejected.
    </p>
  </div>
) : quoteRequest.status === QuoteStatus.EXPIRED ? (
  <div className="text-center p-4 bg-orange-50 rounded-md">
    <Clock className="w-8 h-8 text-orange-500 mx-auto mb-2" />
    <p className="text-orange-800 font-medium">Quote Expired</p>
    <p className="text-orange-600 text-sm mt-1">
      This quote has expired. You may need to request a new quote.
    </p>
  </div>
) : quoteRequest.status === QuoteStatus.CONVERTED_TO_ORDER ? (
  <div className="text-center p-4 bg-purple-50 rounded-md">
    <ShoppingCart className="w-8 h-8 text-purple-500 mx-auto mb-2" />
    <p className="text-purple-800 font-medium">Converted to Order</p>
    <p className="text-purple-600 text-sm mt-1">
      This quote has been converted to an order.
    </p>
  </div>
) : null}
```

## Testing Plan

### 1. Initial Creation and Sending
- Create a new quote request and verify it has DRAFT status
- Send the quote request to a supplier and verify it changes to SENT status
- Check that the UI displays the correct "Waiting for Response" message

### 2. Supplier Response Handling
- Simulate receiving an acknowledgment email (without pricing details) and verify it changes to RECEIVED status
- Simulate receiving a full quote response (with pricing details) and verify it changes to UNDER_REVIEW status
- Check that the UI displays the appropriate actions for each status

### 3. Follow-up Email Testing
- Test sending a follow-up for no response and verify the status remains SENT
- Test sending a follow-up for revision needed and verify the status changes from UNDER_REVIEW back to SENT
- Test sending a follow-up for quote acceptance and verify the status changes to APPROVED
- Check that the UI displays the appropriate actions for each status

### 4. Quote Approval/Rejection Testing
- Test approving a quote and verify it changes to APPROVED status
- Test rejecting a quote and verify it changes to REJECTED status
- Check that the UI displays the appropriate actions for each status

### 5. Order Conversion Testing
- Test converting an approved quote to an order and verify it changes to CONVERTED_TO_ORDER status
- Check that the UI displays the appropriate message for this status

### 6. Edge Case Testing
- Test handling expired quotes (manually set status to EXPIRED)
- Test handling quotes with missing information
- Test the flow with different types of suppliers and quote requests

### 7. End-to-End Flow Testing
- Test the complete flow from creation to conversion, ensuring each status transition works correctly
- Verify that all UI components update appropriately at each stage