# POST_ORDER_WEBHOOK System Implementation Plan

## Overview

Implement a comprehensive order communication and tracking update system that:
- Automatically triggers webhook when supplier emails arrive
- Provides manual "Sync Updates" button (like price update flow)
- Auto-applies tracking numbers, delivery dates, and order status
- Generates clickable tracking links (UPS, FedEx, USPS, etc.)
- Implements order follow-up workflow (mirroring quote follow-up pattern)
- Creates notifications for all updates

## Architecture Pattern

Following existing patterns:
- **Manual Sync**: Similar to `app/api/quote-requests/[id]/prices/route.ts`
- **Automatic Trigger**: Enhance `app/api/webhooks/email/parse/route.ts`
- **Follow-Up Flow**: Clone `components/ui/follow-up-modal.tsx` for orders
- **N8N Integration**: Add new webhook types in `lib/api/n8n-client.ts`

## Implementation Phases

### Phase 1: Foundation

**1.1 Environment Variables**
- File: `.env.example`
- Add after line 11:
  ```env
  POST_ORDER_WEBHOOK_URL=
  ORDER_FOLLOW_UP_WEBHOOK_URL=
  ```

**1.2 Tracking Link Utility**
- File: `lib/utils/tracking-links.ts` (NEW)
- Function: `generateTrackingLink(trackingNumber, carrier?)`
- Returns: `{ carrier, url, displayName }`
- Supports: UPS, FedEx, USPS, DHL, OnTrac
- Auto-detection: Pattern matching on tracking number format
- Fallback: Google search for unknown formats

### Phase 2: N8N Client Integration

**2.1 Webhook Types**
- File: `lib/api/n8n-client.ts` (add at end, ~line 873)

**PostOrderWebhookRequest:**
```typescript
{
  orderId, orderNumber, supplierId,
  orderDate, status, totalAmount, fulfillmentMethod,
  currentTracking: { trackingNumber?, shippingCarrier?, expectedDelivery? },
  supplier: { id, name, email, contactPerson? },
  emailThread: { id, messages[] },
  items: [{ id, partNumber, description, quantity, availability, currentTracking? }],
  organization, user?
}
```

**PostOrderWebhookResponse:**
```typescript
{
  orderUpdates?: { trackingNumber?, shippingCarrier?, expectedDelivery?, status? },
  itemUpdates?: [{ id, trackingNumber?, expectedDelivery?, availability? }],
  supplierMessages?, suggestedActions?,
  success, message?
}
```

**Functions:**
- `postOrderWebhook(data)` → calls POST_ORDER_WEBHOOK_URL
- `generateOrderFollowUpEmail(data)` → calls ORDER_FOLLOW_UP_WEBHOOK_URL

### Phase 3: Manual Sync Updates API

**3.1 Sync Updates Endpoint**
- File: `app/api/orders/[id]/sync-updates/route.ts` (NEW)
- Method: POST
- Pattern: Mirrors `app/api/quote-requests/[id]/prices/route.ts`

**Flow:**
1. Authenticate user (session check)
2. Fetch order with all relationships (supplier, items, emailThread, organization)
3. Verify user authorization (organizationId match)
4. Prepare webhook payload (order + email thread + items)
5. Call `postOrderWebhook()`
6. Apply order-level updates (tracking, carrier, delivery dates, status)
7. Apply item-level updates (per-item tracking, availability)
8. Create activity log
9. Return updated order + applied updates count

**Validation Rules:**
- Don't overwrite `actualDelivery` if already set (unless newer)
- Don't downgrade status (e.g., DELIVERED → PROCESSING)
- Validate date formats
- Match items by OrderItem.id

### Phase 4: Automatic Webhook Trigger

**4.1 Enhance Email Parse Route**
- File: `app/api/webhooks/email/parse/route.ts`
- Location: Add after line 152 (after activity log creation)

**Logic:**
```typescript
if (emailThread.status === 'CONVERTED_TO_ORDER') {
  const order = await prisma.order.findFirst({ where: { emailThreadId } });

  if (order && emailData.from === order.supplier?.email) {
    // Fetch full order context
    // Call postOrderWebhook() (fire-and-forget with error handling)
    // If successful, apply updates to Order and OrderItem
    // Create activity log: "Automatic order update from supplier email"
  }
}
```

**Safety:**
- Only trigger for INBOUND emails
- Only if email is from the order's supplier
- Non-fatal errors (don't fail email parse if webhook fails)
- Log all automatic updates

### Phase 5: Order Follow-Up System

**5.1 Follow-Up API Route**
- File: `app/api/webhooks/email/order-follow-up/route.ts` (NEW)
- Pattern: Clone `app/api/webhooks/email/follow-up/route.ts`

**Workflow Branches:**
- `no_confirmation`: No order confirmation received
- `missing_tracking`: Tracking not provided
- `delivery_delayed`: Expected delivery passed
- `quality_issue`: Issue with delivered parts
- `other`: General inquiry

**Actions:**
- `preview`: Generate email content, return for user review
- `send`: Send follow-up via N8N, save to EmailMessage

**5.2 Order Follow-Up Modal**
- File: `components/ui/order-follow-up-modal.tsx` (NEW)
- Pattern: Clone `components/ui/follow-up-modal.tsx`

**3-Step Workflow:**
1. Compose: Select reason, add message, set expected response date
2. Preview: Show generated email
3. Edit: Allow editing via EmailPreviewModal

**5.3 Order Follow-Up Button**
- File: `components/ui/order-follow-up-button.tsx` (NEW)

**Visibility Logic:**
```typescript
showButton = (order.status === 'PROCESSING' || 'IN_TRANSIT') &&
             (noTrackingAfterTwoDays || deliveryOverdue)
```

### Phase 6: UI Enhancements

**6.1 Enhanced Tracking Information**
- File: `components/ui/tracking-information.tsx`
- Import: `generateTrackingLink` from `lib/utils/tracking-links`

**Changes:**
- Replace tracking number text with clickable link
- Add `<ExternalLink>` icon
- Format: "Track with UPS" → opens UPS tracking page
- Apply to both order-level and item-level tracking

**6.2 Order Detail Page Integration**
- File: `app/orders/[id]/page.tsx`

**Add:**
1. "Sync Updates" button in Order Summary card header
   - Calls `/api/orders/${orderId}/sync-updates`
   - Shows loading spinner while syncing
   - Toast notification with update count
2. `OrderFollowUpButton` in Fulfillment Information card
   - Conditional visibility based on order state
3. `OrderFollowUpModal` at page bottom
   - Triggered by follow-up button
   - Refreshes email thread after send

### Phase 7: Notification System

**7.1 Activity Log Helpers**
- File: `lib/utils/activity-log.ts` (NEW)
- Function: `createOrderUpdateNotification()`
- Types: 'tracking', 'delivery', 'status'
- Creates ActivityLog entry with metadata

**7.2 Toast Notifications**
- Sync updates: Show count of applied updates
- Auto-updates: Show when supplier email triggers update
- Follow-up sent: Confirm email sent to supplier

## Critical Files

**Must Create (5 new files):**
1. `lib/utils/tracking-links.ts` - Tracking link generation
2. `app/api/orders/[id]/sync-updates/route.ts` - Manual sync endpoint
3. `app/api/webhooks/email/order-follow-up/route.ts` - Follow-up API
4. `components/ui/order-follow-up-modal.tsx` - Follow-up UI wizard
5. `components/ui/order-follow-up-button.tsx` - Conditional follow-up button

**Must Modify (4 existing files):**
1. `lib/api/n8n-client.ts` - Add webhook types and functions
2. `app/api/webhooks/email/parse/route.ts` - Add automatic trigger
3. `components/ui/tracking-information.tsx` - Add clickable tracking links
4. `app/orders/[id]/page.tsx` - Add sync button, follow-up integration

**Optional Create:**
1. `lib/utils/activity-log.ts` - Notification helpers

## Database Schema

**No migrations needed!** Existing schema has all necessary fields:
- `Order`: trackingNumber, shippingCarrier, expectedDelivery, actualDelivery, status
- `OrderItem`: trackingNumber, expectedDelivery, availability, supplierNotes
- `EmailMessage`: metadata (JSON field for order context)

## Testing Checklist

**Manual Sync:**
- [ ] Order with no tracking → N8N returns tracking → Verify applied
- [ ] Order with tracking → N8N updates delivery → Verify updated
- [ ] Split fulfillment → Item-level tracking → Verify per-item

**Automatic Trigger:**
- [ ] Supplier email with tracking → Verify auto-update
- [ ] Supplier email without tracking → Graceful handling
- [ ] Non-supplier email → No trigger

**Follow-Up:**
- [ ] No confirmation → Generate → Preview → Edit → Send
- [ ] Missing tracking → Verify email content appropriate
- [ ] Follow-up sent → Button disappears

**Tracking Links:**
- [ ] UPS tracking → Correct link
- [ ] FedEx tracking → Correct link
- [ ] USPS tracking → Correct link
- [ ] Unknown format → Google search fallback

## Implementation Order

**Day 1: Foundation**
1. Add environment variables
2. Create tracking-links.ts utility
3. Add N8N webhook types

**Day 2: Manual Sync**
4. Create sync-updates endpoint
5. Add "Sync Updates" button to order page
6. Test with mock N8N responses

**Day 3: Automatic Trigger**
7. Enhance email parse route
8. Test automatic trigger
9. Verify activity logs

**Day 4-5: Follow-Up System**
10. Create order-follow-up API route
11. Create OrderFollowUpModal component
12. Create OrderFollowUpButton component
13. Integrate into order detail page

**Day 6: UI Polish**
14. Update tracking-information.tsx with links
15. Add toast notifications
16. Create activity-log helpers

**Day 7: Testing**
17. End-to-end testing
18. Error handling improvements
19. Documentation

## Key Architectural Decisions

**1. Automatic Trigger Location**
- Chosen: Enhance existing parse/route.ts
- Reason: Consistent with existing patterns, easier debugging
- Trade-off: Requires N8N to route emails (already established)

**2. Update Conflict Resolution**
- Chosen: Last-write-wins with smart validation
- Reason: Simple, matches price update pattern
- Safeguards: Don't downgrade status, don't overwrite deliveries

**3. Tracking Link Generation**
- Chosen: Client-side with pattern matching
- Reason: No external APIs, instant, works offline
- Trade-off: May not cover all formats → fallback to search

**4. Follow-Up Workflow Branches**
- Chosen: 5 branches (no_confirmation, missing_tracking, etc.)
- Reason: Context-appropriate emails, better analytics
- Trade-off: More complex, but better UX

**5. No New Database Tables**
- Chosen: Use existing Order/OrderItem models
- Reason: Avoid migrations, faster implementation
- Trade-off: No separate tracking history → use ActivityLog

## Environment Variables

```env
# Add to .env and .env.example
POST_ORDER_WEBHOOK_URL=https://your-n8n-instance.com/webhook/post-order
ORDER_FOLLOW_UP_WEBHOOK_URL=https://your-n8n-instance.com/webhook/order-follow-up
```

## Success Criteria

✅ User clicks "Sync Updates" → N8N parses emails → Tracking applied to order
✅ Supplier sends email with tracking → Auto-update triggers → Tracking appears
✅ Tracking number displayed → Clickable link → Opens carrier tracking page
✅ No tracking after 2 days → "Send Follow-up" button appears → User clicks → Email sent
✅ Delivery delayed → Follow-up with "delivery_delayed" branch → Appropriate email generated
✅ All updates logged in ActivityLog → User can see history

---

**Estimated Effort:** 7 days (1 developer)
**Complexity:** Medium (follows existing patterns closely)
**Risk:** Low (no schema changes, incremental implementation)
