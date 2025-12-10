# Email Communication Continuity Implementation

This document outlines the implementation plan for maintaining email communication continuity when a quote request is converted to an order.

## Overview

When a quote request is converted to an order, we need to ensure that:

1. The email communication history is preserved and accessible in the order context
2. New emails from suppliers continue to be properly associated with the order
3. Users can see the complete communication timeline and respond appropriately
4. Users have control over when the communication thread is considered complete

## Schema Enhancements

### 1. Update EmailThreadStatus Enum

```prisma
// In prisma/schema.prisma
enum EmailThreadStatus {
  DRAFT
  SENT
  WAITING_RESPONSE
  RESPONSE_RECEIVED
  FOLLOW_UP_NEEDED
  COMPLETED
  CONVERTED_TO_ORDER // New status
  CANCELLED
}
```

### 2. Migration Script

```sql
-- Create a new migration file
-- prisma/migrations/YYYYMMDDHHMMSS_add_converted_to_order_status/migration.sql

-- Alter the EmailThreadStatus enum to add the new status
ALTER TYPE "EmailThreadStatus" ADD VALUE 'CONVERTED_TO_ORDER';
```

## API Enhancements

### 1. Update Quote-to-Order Conversion API

Modify the conversion API to set the email thread status to `CONVERTED_TO_ORDER` instead of `COMPLETED`:

```typescript
// app/api/quote-requests/[id]/convert-to-order/route.ts

// Update the email thread status
if (quoteRequest.emailThread) {
  await prisma.emailThread.update({
    where: {
      id: quoteRequest.emailThread.id,
    },
    data: {
      status: "CONVERTED_TO_ORDER", // Changed from "COMPLETED"
    },
  });
}
```

### 2. Add Email Thread Status Update API

Create a new API endpoint to allow users to manually update the email thread status:

```typescript
// app/api/email-threads/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EmailThreadStatus } from "@prisma/client";
import { z } from "zod";

const statusUpdateSchema = z.object({
  status: z.enum([
    "DRAFT",
    "SENT",
    "WAITING_RESPONSE",
    "RESPONSE_RECEIVED",
    "FOLLOW_UP_NEEDED",
    "COMPLETED",
    "CONVERTED_TO_ORDER",
    "CANCELLED"
  ])
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const threadId = params.id;
    
    // Get the email thread to verify it exists and belongs to the user's organization
    const emailThread = await prisma.emailThread.findUnique({
      where: {
        id: threadId,
        organizationId: session.user.organizationId,
      },
    });
    
    if (!emailThread) {
      return NextResponse.json({ error: "Email thread not found" }, { status: 404 });
    }
    
    // Parse and validate request body
    const body = await req.json();
    const validationResult = statusUpdateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    const { status } = validationResult.data;
    
    // Update the email thread status
    const updatedThread = await prisma.emailThread.update({
      where: { id: threadId },
      data: { status: status as EmailThreadStatus },
    });
    
    // Create an activity log entry
    await prisma.activityLog.create({
      data: {
        type: "SYSTEM_UPDATE",
        title: `Email thread status updated`,
        description: `Email thread status changed to ${status}`,
        entityType: "EmailThread",
        entityId: threadId,
        userId: session.user.id,
        organization: {
          connect: {
            id: session.user.organizationId,
          },
        },
        metadata: {
          previousStatus: emailThread.status,
          newStatus: status,
        },
      },
    });
    
    return NextResponse.json({
      success: true,
      message: "Email thread status updated successfully",
      thread: updatedThread,
    });
  } catch (error) {
    console.error("Error updating email thread status:", error);
    return NextResponse.json(
      { error: "Failed to update email thread status" },
      { status: 500 }
    );
  }
}
```

### 3. Update Email Parsing Webhook

Modify the email parsing webhook to handle threads that are linked to orders:

```typescript
// app/api/webhooks/email/parse/route.ts

// After identifying the email thread
if (emailThread.status === 'CONVERTED_TO_ORDER') {
  // Find the associated order
  const order = await prisma.order.findUnique({
    where: { emailThreadId: emailThread.id }
  });
  
  if (order) {
    // Add order context to the email message
    await prisma.emailMessage.create({
      data: {
        // ... existing email message data
        metadata: {
          // ... existing metadata
          orderId: order.id,
          orderNumber: order.orderNumber,
          isPostConversion: true,
        },
      },
    });
    
    // Optionally notify users about new communication on this order
    await createOrderCommunicationNotification(order.id);
  }
}
```

## UI Components

### 1. Thread Status Control Component

```tsx
// components/ui/thread-status-control.tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle } from "lucide-react";
import { EmailThreadStatus } from "@prisma/client";
import { toast } from "@/components/ui/use-toast";

interface ThreadStatusControlProps {
  threadId: string;
  status: EmailThreadStatus;
  onStatusChange?: (newStatus: EmailThreadStatus) => void;
}

export function ThreadStatusControl({ 
  threadId, 
  status, 
  onStatusChange 
}: ThreadStatusControlProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const getStatusBadgeVariant = (status: EmailThreadStatus) => {
    switch (status) {
      case "COMPLETED":
        return "default";
      case "CONVERTED_TO_ORDER":
        return "outline";
      case "WAITING_RESPONSE":
        return "secondary";
      case "FOLLOW_UP_NEEDED":
        return "destructive";
      default:
        return "secondary";
    }
  };
  
  const getStatusLabel = (status: EmailThreadStatus) => {
    switch (status) {
      case "CONVERTED_TO_ORDER":
        return "Active (Order)";
      case "COMPLETED":
        return "Completed";
      case "WAITING_RESPONSE":
        return "Waiting Response";
      case "FOLLOW_UP_NEEDED":
        return "Follow-up Needed";
      default:
        return status.replace(/_/g, " ");
    }
  };
  
  const markAsCompleted = async () => {
    try {
      setIsUpdating(true);
      
      const response = await fetch(`/api/email-threads/${threadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update status");
      }
      
      toast({
        title: "Thread marked as completed",
        description: "The communication thread has been marked as completed.",
      });
      
      if (onStatusChange) {
        onStatusChange("COMPLETED");
      }
    } catch (error) {
      console.error("Error updating thread status:", error);
      toast({
        title: "Error updating status",
        description: "Failed to mark thread as completed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      <Badge variant={getStatusBadgeVariant(status)}>
        {getStatusLabel(status)}
      </Badge>
      
      {(status === "CONVERTED_TO_ORDER" || status === "WAITING_RESPONSE") && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={markAsCompleted}
          disabled={isUpdating}
          className="text-slate-300 border-slate-600 hover:bg-slate-700"
        >
          {isUpdating ? (
            <>
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              Updating...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark as Completed
            </>
          )}
        </Button>
      )}
    </div>
  );
}
```

### 2. Communication Timeline Component

Enhance the existing communication timeline component to show the conversion point:

```tsx
// components/ui/communication-timeline.tsx
"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Mail, ArrowRight, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface CommunicationTimelineProps {
  emailThreadId: string;
  quoteRequestId?: string;
  orderId?: string;
  conversionDate?: string;
}

export function CommunicationTimeline({
  emailThreadId,
  quoteRequestId,
  orderId,
  conversionDate,
}: CommunicationTimelineProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/email-threads/${emailThreadId}/messages`);
        const data = await response.json();
        setMessages(data.messages || []);
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (emailThreadId) {
      fetchMessages();
    }
  }, [emailThreadId]);
  
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-600 border-t-transparent"></div>
      </div>
    );
  }
  
  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No communication history found.
      </div>
    );
  }
  
  // Sort messages by date
  const sortedMessages = [...messages].sort((a, b) => {
    const dateA = new Date(a.sentAt || a.receivedAt || a.createdAt);
    const dateB = new Date(b.sentAt || b.receivedAt || b.createdAt);
    return dateA.getTime() - dateB.getTime();
  });
  
  return (
    <div className="space-y-6">
      {sortedMessages.map((message, index) => {
        const messageDate = new Date(message.sentAt || message.receivedAt || message.createdAt);
        const isPostConversion = conversionDate && messageDate > new Date(conversionDate);
        const isConversionPoint = conversionDate && index > 0 && 
          new Date(sortedMessages[index-1].sentAt || sortedMessages[index-1].receivedAt || sortedMessages[index-1].createdAt) < new Date(conversionDate) &&
          messageDate >= new Date(conversionDate);
        
        return (
          <div key={message.id}>
            {isConversionPoint && (
              <div className="flex items-center justify-center py-4">
                <div className="bg-slate-700 px-4 py-2 rounded-full flex items-center gap-2">
                  <Badge variant="outline">Quote</Badge>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <ShoppingCart className="w-4 h-4 text-orange-500" />
                  <Badge>Order</Badge>
                  <span className="text-xs text-slate-400 ml-2">
                    {formatDistanceToNow(new Date(conversionDate), { addSuffix: true })}
                  </span>
                </div>
              </div>
            )}
            
            <div className={`flex gap-4 ${isPostConversion ? 'bg-slate-700/30' : ''} p-4 rounded-md`}>
              <div className="flex-shrink-0 mt-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.direction === 'OUTBOUND' ? 'bg-blue-900/50' : 'bg-slate-700'
                }`}>
                  <Mail className={`w-4 h-4 ${
                    message.direction === 'OUTBOUND' ? 'text-blue-400' : 'text-slate-400'
                  }`} />
                </div>
              </div>
              
              <div className="flex-grow space-y-2">
                <div className="flex justify-between">
                  <div>
                    <span className="font-medium text-white">
                      {message.direction === 'OUTBOUND' ? 'You' : message.from}
                    </span>
                    <span className="text-slate-400 mx-2">→</span>
                    <span className="text-slate-300">
                      {message.direction === 'OUTBOUND' ? message.to : 'You'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatDistanceToNow(messageDate, { addSuffix: true })}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-white">{message.subject}</h4>
                </div>
                
                <div className="text-sm text-slate-300 whitespace-pre-wrap">
                  {message.body}
                </div>
                
                {isPostConversion && (
                  <Badge variant="outline" className="mt-2">Post-conversion communication</Badge>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### 3. Order Details Page Enhancement

Update the order details page to include the communication timeline and thread status control:

```tsx
// app/orders/[id]/page.tsx

// Add to the imports
import { ThreadStatusControl } from "@/components/ui/thread-status-control";
import { CommunicationTimeline } from "@/components/ui/communication-timeline";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

// Add this card to the order details page
{order.emailThreadId && (
  <Card className="bg-slate-800 border-slate-700">
    <CardHeader className="border-b border-slate-700">
      <div className="flex justify-between items-center">
        <CardTitle className="text-white">Communication History</CardTitle>
        {emailThread && (
          <ThreadStatusControl 
            threadId={order.emailThreadId} 
            status={emailThread.status} 
            onStatusChange={(newStatus) => setEmailThread({...emailThread, status: newStatus})}
          />
        )}
      </div>
    </CardHeader>
    <CardContent className="p-6">
      {emailThread && emailThread.status !== 'COMPLETED' && (
        <Alert className="mb-6 bg-blue-900/20 border-blue-800">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Keep this thread open until parts are received</AlertTitle>
          <AlertDescription>
            This allows you to continue communication with the supplier about this order.
            Mark as completed only when all parts have been received.
          </AlertDescription>
        </Alert>
      )}
      
      <CommunicationTimeline 
        emailThreadId={order.emailThreadId}
        quoteRequestId={order.quoteReference}
        orderId={order.id}
        conversionDate={order.orderDate}
      />
    </CardContent>
  </Card>
)}
```

## Implementation Steps

1. **Schema Updates**:
   - Add the `CONVERTED_TO_ORDER` status to the `EmailThreadStatus` enum
   - Create and run the migration

2. **API Modifications**:
   - Update the quote-to-order conversion API to use the new status
   - Create the email thread status update API endpoint
   - Modify the email parsing webhook to handle converted threads

3. **UI Components**:
   - Create the `ThreadStatusControl` component
   - Enhance the `CommunicationTimeline` component
   - Update the order details page to include these components

4. **Testing**:
   - Test the quote-to-order conversion process
   - Verify that emails continue to be associated with the thread
   - Test manually marking a thread as completed
   - Ensure the communication timeline displays correctly

## Benefits

This implementation provides several key benefits:

1. **Continuity**: Maintains the communication history across the quote-to-order lifecycle
2. **Visibility**: Provides clear visibility of all communications in the order context
3. **Control**: Gives users control over when to mark a thread as completed
4. **Context**: Clearly indicates which communications happened before and after conversion

By implementing these changes, we ensure that the communication flow remains uninterrupted when a quote is converted to an order, while giving users the flexibility to manage the communication lifecycle based on the actual delivery of parts.