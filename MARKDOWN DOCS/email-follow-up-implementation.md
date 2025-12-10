## API Endpoints

### 1. Follow-up Webhook

The follow-up webhook endpoint handles sending follow-up emails:

```typescript
// app/api/webhooks/email/follow-up/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateFollowUpEmail, FollowUpEmailRequest } from '@/lib/api/n8n-client';
import { z } from 'zod';

// Enhanced validation schema for the request body
const followUpEmailSchema = z.object({
  quoteRequestId: z.string(),
  threadId: z.string(),
  messageId: z.string(), // Add this field to identify the original message
  supplier: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email("Valid supplier email is required"),
  }),
  previousCommunication: z.object({
    lastContactDate: z.string(),
    messagesSummary: z.string(),
  }),
  followUpReason: z.string(),
  missingInformation: z.array(z.string()).optional(),
  customMessage: z.string().optional(), // Optional custom message from the user
  emailContent: z.object({
    subject: z.string(),
    body: z.string(),
    bodyHtml: z.string().optional(),
  }).optional(),
  expectedResponseBy: z.string().optional(), // ISO date string
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate the request body
    const body = await request.json();
    const validationResult = followUpEmailSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const followUpData = validationResult.data;
    const { emailContent, expectedResponseBy } = followUpData;

    // Verify the quote request exists and belongs to the user's organization
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: followUpData.quoteRequestId,
        organizationId: session.user.organizationId,
      },
      include: {
        supplier: true,
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found or access denied' },
        { status: 404 }
      );
    }

    // Verify the email thread exists and is associated with the quote request
    const emailThread = await prisma.emailThread.findFirst({
      where: {
        id: followUpData.threadId,
        quoteRequestId: quoteRequest.id,
        organizationId: session.user.organizationId,
      },
    });

    if (!emailThread) {
      return NextResponse.json(
        { error: 'Email thread not found or not associated with the quote request' },
        { status: 404 }
      );
    }

    // Verify the original message exists
    const originalMessage = await prisma.emailMessage.findUnique({
      where: {
        id: followUpData.messageId,
        threadId: emailThread.id,
      },
    });

    if (!originalMessage) {
      return NextResponse.json(
        { error: 'Original message not found' },
        { status: 404 }
      );
    }

    // Generate or use provided email content
    let emailResult;
    if (emailContent) {
      // Use the provided email content
      emailResult = {
        emailContent: emailContent,
        messageId: `follow-up-${Date.now()}`, // Generate a unique ID
      };
    } else {
      // Generate email content using the n8n webhook
      emailResult = await generateFollowUpEmail(followUpData);
    }

    // Create the follow-up email message
    const emailMessage = await prisma.emailMessage.create({
      data: {
        threadId: emailThread.id,
        direction: 'OUTBOUND',
        from: session.user.email,
        to: followUpData.supplier.email,
        subject: emailResult.emailContent.subject,
        body: emailResult.emailContent.body,
        bodyHtml: emailResult.emailContent.bodyHtml,
        externalMessageId: emailResult.messageId,
        // Set the expected response date if provided
        expectedResponseBy: expectedResponseBy ? new Date(expectedResponseBy) : undefined,
      },
    });

    // Update the original message to mark that a follow-up was sent
    await prisma.emailMessage.update({
      where: { id: originalMessage.id },
      data: {
        followUpSentAt: new Date(),
      },
    });

    // Update the email thread status
    await prisma.emailThread.update({
      where: { id: emailThread.id },
      data: {
        status: 'FOLLOW_UP_SENT',
        updatedAt: new Date(),
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        type: 'QUOTE_REQUESTED',
        title: 'Quote Request Follow-up Sent',
        description: `Follow-up email sent for quote request ${quoteRequest.quoteNumber} to ${quoteRequest.supplier.name}`,
        entityType: 'QuoteRequest',
        entityId: quoteRequest.id,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        metadata: {
          quoteRequestId: quoteRequest.id,
          supplierId: quoteRequest.supplierId,
          emailThreadId: emailThread.id,
          emailMessageId: emailMessage.id,
          originalMessageId: originalMessage.id,
          followUpReason: followUpData.followUpReason,
          missingInformation: followUpData.missingInformation,
        },
      },
    });

    return NextResponse.json({
      success: true,
      emailContent: emailResult.emailContent,
      emailThreadId: emailThread.id,
      emailMessageId: emailMessage.id,
      originalMessageId: originalMessage.id,
      suggestedNextFollowUp: emailResult.suggestedNextFollowUp,
    });
  } catch (error) {
    console.error('Error generating follow-up email:', error);
    return NextResponse.json(
      { error: 'Failed to generate follow-up email' },
      { status: 500 }
    );
  }
}
```

### 2. Preview API Endpoint

The preview API endpoint generates a preview of the follow-up email:

```typescript
// app/api/quote-requests/[id]/follow-up/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateFollowUpEmail } from '@/lib/api/n8n-client';
import { z } from 'zod';

// Validation schema for the request body
const previewRequestSchema = z.object({
  messageId: z.string(),
  followUpReason: z.string(),
  customMessage: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const quoteRequestId = params.id;
    
    // Authenticate the request
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate the request body
    const body = await request.json();
    const validationResult = previewRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { messageId, followUpReason, customMessage } = validationResult.data;

    // Fetch the quote request with related data
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id: quoteRequestId,
        organizationId: session.user.organizationId,
      },
      include: {
        supplier: true,
        emailThread: {
          include: {
            messages: {
              where: {
                id: messageId,
              },
            },
          },
        },
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found or access denied' },
        { status: 404 }
      );
    }

    if (!quoteRequest.emailThread) {
      return NextResponse.json(
        { error: 'Email thread not found for this quote request' },
        { status: 404 }
      );
    }

    if (quoteRequest.emailThread.messages.length === 0) {
      return NextResponse.json(
        { error: 'Original message not found' },
        { status: 404 }
      );
    }

    const originalMessage = quoteRequest.emailThread.messages[0];

    // Prepare the follow-up data
    const followUpData = {
      quoteRequestId,
      threadId: quoteRequest.emailThread.id,
      messageId: originalMessage.id,
      supplier: {
        id: quoteRequest.supplier.id,
        name: quoteRequest.supplier.name,
        email: quoteRequest.supplier.email || '',
      },
      previousCommunication: {
        lastContactDate: new Date().toISOString(),
        messagesSummary: customMessage || "No additional message provided.",
      },
      followUpReason,
      missingInformation: followUpReason === 'INCOMPLETE_INFO' ? ['pricing', 'availability'] : undefined,
    };

    // Call the n8n webhook to generate the follow-up email
    const emailResult = await generateFollowUpEmail(followUpData);

    // Return the preview content
    return NextResponse.json({
      success: true,
      emailContent: emailResult.emailContent,
      suggestedNextFollowUp: emailResult.suggestedNextFollowUp,
    });
  } catch (error) {
    console.error('Error generating follow-up email preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate follow-up email preview' },
      { status: 500 }
    );
  }
}
```

### 3. Client-Side API Functions

The client-side API functions for sending follow-up emails and generating previews:

```typescript
// lib/api/quote-requests.ts

// Function to send a follow-up email
export async function sendFollowUpEmail(
  quoteRequestId: string,
  messageId: string,
  data: {
    followUpReason: string;
    customMessage?: string;
    emailContent?: {
      subject: string;
      body: string;
      bodyHtml?: string;
    };
    expectedResponseBy?: string; // ISO date string
  }
) {
  const response = await apiRequest<{
    success: boolean;
    data: {
      emailContent: {
        subject: string;
        body: string;
        bodyHtml: string;
      };
      emailThreadId: string;
      emailMessageId: string;
      originalMessageId: string;
      suggestedNextFollowUp?: string;
    }
  }>(`/api/quote-requests/${quoteRequestId}/follow-up`, {
    method: 'POST',
    body: JSON.stringify({
      messageId,
      followUpReason: data.followUpReason,
      customMessage: data.customMessage,
      emailContent: data.emailContent,
      expectedResponseBy: data.expectedResponseBy,
    }),
  });

  return response;
}

// Function to generate a follow-up email preview
export async function generateFollowUpEmailPreview(
  quoteRequestId: string,
  messageId: string,
  data: {
    followUpReason: string;
    customMessage?: string;
  }
) {
  const response = await apiRequest<{
    success: boolean;
    emailContent: {
      subject: string;
      body: string;
      bodyHtml: string;
    };
    suggestedNextFollowUp?: string;
  }>(`/api/quote-requests/${quoteRequestId}/follow-up/preview`, {
    method: 'POST',
    body: JSON.stringify({
      messageId,
      followUpReason: data.followUpReason,
      customMessage: data.customMessage,
    }),
  });

  return response;
}
```

## Workflow

The email follow-up workflow consists of the following steps:

1. **Setting Expected Response Times**:
   - When an outbound email is sent, an expected response time is set (default: 3 business days)
   - This time is stored in the `expectedResponseBy` field of the `EmailMessage` model

2. **Monitoring Response Status**:
   - The system continuously checks if the expected response time has passed
   - If a response is received before the expected time, it's marked as a "Timely Response"
   - If no response is received by the expected time, the message is marked as needing follow-up

3. **Notifying Users**:
   - The UI shows a prominent alert when follow-up is needed
   - Status badges indicate the current status of each message
   - The follow-up button is activated when a response is overdue

4. **Sending Follow-up Emails**:
   - When the user clicks the follow-up button, they enter a multi-step workflow:
     1. **Compose**: Select a follow-up reason and add an optional message
     2. **Preview**: Review the generated follow-up email
     3. **Edit** (optional): Modify the subject, body, and expected response time
     4. **Send**: Send the follow-up email

5. **Tracking Follow-ups**:
   - When a follow-up is sent, the original message is marked with `followUpSentAt`
   - The email thread status is updated to `FOLLOW_UP_SENT`
   - The UI is updated to reflect the new status

## Testing

To test the complete workflow, follow these steps:

1. **Create a Quote Request**:
   - Create a new quote request with a supplier
   - Send the initial email to the supplier

2. **Check Response Tracking**:
   - Verify that the expected response time is set correctly
   - Check that the UI shows the correct status for the message

3. **Test Follow-up Needed**:
   - Wait until the expected response time has passed (or manually adjust the date in the database)
   - Verify that the UI shows the message as needing follow-up
   - Check that the follow-up button is activated

4. **Test Human-in-the-Loop Approval**:
   - Click the follow-up button
   - Enter a follow-up reason and optional message
   - Click "Preview Email"
   - Verify that the preview shows the correct content
   - Edit the email if needed
   - Send the follow-up email

5. **Verify Follow-up Tracking**:
   - Check that the original message is marked with `followUpSentAt`
   - Verify that the email thread status is updated to `FOLLOW_UP_SENT`
   - Check that the UI shows the message as "Follow-up Sent"

6. **Test Timely Response**:
   - Create another quote request
   - Send the initial email
   - Simulate a response before the expected response time
   - Verify that the UI shows the message as "Timely Response"
   - Check that the follow-up button is not shown

7. **Test Response After Follow-up**:
   - Simulate a response after a follow-up has been sent
   - Verify that the UI shows the message as "Response Received"
   - Check that no further follow-up options are shown

By following these testing steps, you can ensure that the email follow-up workflow functions correctly in all scenarios.