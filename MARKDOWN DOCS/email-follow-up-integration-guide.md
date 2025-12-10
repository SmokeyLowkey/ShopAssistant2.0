# Email Follow-up Integration Guide

This document outlines the recommended approach for integrating the email follow-up functionality into the main construction dashboard application without disrupting existing functionality.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Integration Overview](#integration-overview)
3. [Database Migration Strategy](#database-migration-strategy)
4. [Backend Integration Steps](#backend-integration-steps)
5. [Frontend Integration Steps](#frontend-integration-steps)
6. [Testing Strategy](#testing-strategy)
7. [Rollback Plan](#rollback-plan)
8. [Deployment Checklist](#deployment-checklist)

## Prerequisites

Since we're still in the development phase, the integration process can be more streamlined:

- Review the email-follow-up-implementation.md and email-follow-up-frontend.md documents
- Make sure your local development environment is up-to-date with the latest code
- Consider using a development branch if working with multiple developers
- Run the existing application to ensure it's working properly before making changes
- Have a local database that you can easily reset if needed (e.g., using Prisma's `npx prisma db push` for quick iterations)

## Integration Overview

The email follow-up feature introduces several new components:

1. **Database Changes**: New fields in the `EmailMessage` model and updates to the `EmailThreadStatus` enum
2. **API Endpoints**: New endpoints for follow-up email preview and sending
3. **UI Components**: New components for displaying follow-up status and managing follow-up emails
4. **Business Logic**: New logic for determining when follow-ups are needed

The integration will follow a logical sequence:

1. Database schema changes
2. Backend API implementation
3. Frontend component integration
4. Testing and refinement

## Database Migration Strategy

The database changes involve adding new fields to existing tables:

1. Update your Prisma schema in `prisma/schema.prisma`:

```prisma
model EmailMessage {
  // Existing fields...
  
  // New fields
  expectedResponseBy DateTime?
  followUpSentAt     DateTime?
}

enum EmailThreadStatus {
  // Existing values...
  FOLLOW_UP_NEEDED
  FOLLOW_UP_SENT
}
```

2. Apply the changes to your development database:

```bash
npx prisma db push
```

3. If you need to generate a migration for future deployment:

```bash
npx prisma migrate dev --name add_email_follow_up_fields
```

**Note**: All new fields are nullable, so they won't affect existing functionality.

## Backend Integration Steps

### Step 1: Add API Client Functions

Add the new API client functions to `lib/api/quote-requests.ts`:

```typescript
// Add these functions to lib/api/quote-requests.ts

export async function generateFollowUpPreview(
  quoteRequestId: string,
  messageId: string,
  data: {
    reason: 'no-response' | 'additional-info' | 'other';
    additionalMessage?: string;
    expectedResponseBy?: Date;
  }
) {
  return await apiClient.post(
    `/api/quote-requests/${quoteRequestId}/follow-up/preview`,
    { messageId, ...data }
  );
}

export async function sendFollowUpEmail(
  quoteRequestId: string,
  messageId: string,
  data: {
    subject: string;
    body: string;
    expectedResponseBy?: Date;
  }
) {
  return await apiClient.post(
    `/api/webhooks/email/follow-up`,
    { 
      quoteRequestId, 
      messageId, 
      ...data 
    }
  );
}
```

### Step 2: Implement API Endpoints

Create the new API endpoint files:

1. Create `app/api/quote-requests/[id]/follow-up/preview/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs";
import { generateFollowUpEmailContent } from "@/lib/email-templates";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quoteRequestId = params.id;
    const { messageId, reason, additionalMessage, expectedResponseBy } = await request.json();

    // Fetch the original message
    const originalMessage = await prisma.emailMessage.findUnique({
      where: { id: messageId },
      include: {
        thread: {
          include: {
            quoteRequest: true
          }
        }
      }
    });

    if (!originalMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Generate follow-up email content
    const { subject, body } = generateFollowUpEmailContent({
      originalMessage,
      reason,
      additionalMessage,
      expectedResponseBy
    });

    return NextResponse.json({ 
      data: { subject, body },
      success: true 
    });
  } catch (error) {
    console.error("Error generating follow-up preview:", error);
    return NextResponse.json(
      { error: "Failed to generate follow-up preview" },
      { status: 500 }
    );
  }
}
```

2. Create `app/api/webhooks/email/follow-up/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs";
import { sendEmail } from "@/lib/email-service";

export async function POST(request: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { quoteRequestId, messageId, subject, body, expectedResponseBy } = await request.json();

    // Fetch the original message
    const originalMessage = await prisma.emailMessage.findUnique({
      where: { id: messageId },
      include: {
        thread: {
          include: {
            quoteRequest: {
              include: {
                supplier: true
              }
            }
          }
        }
      }
    });

    if (!originalMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Create a new follow-up message
    const followUpMessage = await prisma.emailMessage.create({
      data: {
        direction: "OUTBOUND",
        subject,
        body,
        threadId: originalMessage.threadId,
        expectedResponseBy: expectedResponseBy ? new Date(expectedResponseBy) : null,
        inReplyTo: messageId
      }
    });

    // Update the original message to mark follow-up as sent
    await prisma.emailMessage.update({
      where: { id: messageId },
      data: {
        followUpSentAt: new Date()
      }
    });

    // Update thread status
    await prisma.emailThread.update({
      where: { id: originalMessage.threadId },
      data: {
        status: "FOLLOW_UP_SENT"
      }
    });

    // Send the email
    await sendEmail({
      to: originalMessage.thread.quoteRequest.supplier.email,
      subject,
      body,
      quoteRequestId,
      messageId: followUpMessage.id
    });

    return NextResponse.json({ 
      data: { messageId: followUpMessage.id },
      success: true 
    });
  } catch (error) {
    console.error("Error sending follow-up email:", error);
    return NextResponse.json(
      { error: "Failed to send follow-up email" },
      { status: 500 }
    );
  }
}
```

### Step 3: Create Email Template Helper

Create a new file `lib/email-templates.ts` for generating follow-up email content:

```typescript
export function generateFollowUpEmailContent({
  originalMessage,
  reason,
  additionalMessage,
  expectedResponseBy
}: {
  originalMessage: any;
  reason: 'no-response' | 'additional-info' | 'other';
  additionalMessage?: string;
  expectedResponseBy?: Date;
}) {
  const quoteRequest = originalMessage.thread.quoteRequest;
  const supplierName = quoteRequest.supplier.name;
  const projectName = quoteRequest.projectName;
  
  let subject = `Follow-up: ${originalMessage.subject}`;
  let body = `Hello ${supplierName},\n\n`;
  
  // Add reason-specific content
  if (reason === 'no-response') {
    body += `I'm following up on my previous email regarding the quote request for ${projectName}. We haven't received a response yet, and we're eager to move forward with this project.\n\n`;
  } else if (reason === 'additional-info') {
    body += `I'm following up on my previous email regarding the quote request for ${projectName}. We need some additional information to proceed with this project.\n\n`;
  } else {
    body += `I'm following up on my previous email regarding the quote request for ${projectName}.\n\n`;
  }
  
  // Add the original message for reference
  body += `For your reference, here's my original message:\n\n---\n${originalMessage.body}\n---\n\n`;
  
  // Add additional message if provided
  if (additionalMessage && additionalMessage.trim()) {
    body += `${additionalMessage}\n\n`;
  }
  
  // Add expected response time if provided
  if (expectedResponseBy) {
    const formattedDate = expectedResponseBy.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    body += `We would appreciate a response by ${formattedDate}.\n\n`;
  }
  
  // Add closing
  body += `Thank you for your attention to this matter.\n\nBest regards,\n[Your Name]\n[Your Company]`;
  
  return { subject, body };
}
```

## Frontend Integration Steps

### Step 1: Add UI Components

Create the following UI components:

1. `components/ui/message-status-badge.tsx`
2. `components/ui/follow-up-button.tsx`
3. `components/ui/follow-up-alert.tsx`
4. `components/ui/follow-up-status.tsx`
5. `components/ui/date-time-picker.tsx`
6. `components/ui/email-preview.tsx`
7. `components/ui/follow-up-modal.tsx`
8. `components/ui/communication-timeline.tsx`

The implementation details for these components are provided in the `email-follow-up-frontend.md` document.

### Step 2: Update Quote Request Detail Page

Modify the quote request detail page (`app/orders/quote-request/[id]/page.tsx`) to integrate the new components:

1. Import the new components
2. Add state for managing the follow-up modal
3. Add handlers for follow-up actions
4. Integrate the components into the page layout

**Important**: Use a feature flag to control the visibility of these components during the initial rollout.

### Step 3: Implement Feature Flag

Create a feature flag system to control the rollout:

```typescript
// lib/feature-flags.ts
export const FEATURES = {
  EMAIL_FOLLOW_UP: process.env.NEXT_PUBLIC_FEATURE_EMAIL_FOLLOW_UP === 'true'
};

// Usage in components
import { FEATURES } from '@/lib/feature-flags';

// Only render if feature is enabled
{FEATURES.EMAIL_FOLLOW_UP && (
  <FollowUpAlert 
    quoteRequest={quoteRequest} 
    onFollowUpClick={handleFollowUpClick} 
  />
)}
```

## Testing Strategy

Since we're in the development phase, we can focus on manual testing to quickly validate the functionality:

### Manual Testing Checklist

Test the following scenarios:

- [ ] Creating a quote request with expected response time
- [ ] Verifying status changes as time passes (you can temporarily modify the date in your code for testing)
- [ ] Initiating follow-up when response is overdue
- [ ] Editing and sending follow-up emails
- [ ] Verifying status updates after follow-up is sent
- [ ] Testing with responses received before and after expected time
- [ ] Verifying all UI components render correctly on different screen sizes

### Testing Tips

1. **Time-based testing**: To test time-dependent features without waiting:
   ```typescript
   // Temporarily modify the current date for testing
   const mockNow = new Date('2025-09-15T10:00:00Z');
   jest.spyOn(global, 'Date').mockImplementation(() => mockNow);
   ```

2. **Quick API testing**: Use the browser's Network tab or tools like Postman to test API endpoints

3. **Component testing**: Use the React Developer Tools to inspect component state and props

### Future Test Implementation

As the project matures, consider implementing:

- Unit tests for critical business logic
- Component tests for UI elements
- API tests for backend endpoints

## Handling Issues

If you encounter issues during development:

### 1. Code Issues

1. Use Git to revert specific changes that are causing problems
2. Check the browser console for JavaScript errors
3. Use `console.log()` statements to debug issues

### 2. Database Issues

1. Reset your development database if needed:
   ```bash
   npx prisma db push --force-reset
   ```
2. Check Prisma Studio to inspect your database:
   ```bash
   npx prisma studio
   ```

### 3. API Issues

1. Check the server logs for errors
2. Use the Network tab in browser dev tools to inspect requests and responses
3. Verify that your API routes are correctly handling all edge cases

## Preparing for Future Production Deployment

As the project moves closer to production:

- [ ] Implement comprehensive tests
- [ ] Consider adding feature flags for controlled rollout
- [ ] Create proper database migrations
- [ ] Document the feature thoroughly
- [ ] Plan for monitoring and observability

## Conclusion

By following this integration guide, you can incorporate the email follow-up functionality into the main application during the development phase. The key principles are:

1. Make incremental changes and test frequently
2. Use Prisma's development tools for quick database iterations
3. Focus on manual testing to validate functionality quickly
4. Keep the implementation modular for easier debugging and maintenance

This approach ensures that the new functionality can be integrated smoothly while maintaining a productive development workflow.