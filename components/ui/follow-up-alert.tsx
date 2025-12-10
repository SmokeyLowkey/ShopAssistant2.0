import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Mail } from "lucide-react";

interface FollowUpAlertProps {
  quoteRequest: any;
  onFollowUpClick: (messageId: string) => void;
}

export function FollowUpAlert({ quoteRequest, onFollowUpClick }: FollowUpAlertProps) {
  // Only show the alert if the quote status is SENT
  if (quoteRequest.status !== 'SENT') {
    return null;
  }
  
  // Check if there are any messages that need follow-up across all email threads
  const now = new Date();
  
  // Get all email threads (handle both old singular and new array structure)
  const emailThreads = Array.isArray(quoteRequest.emailThread) 
    ? quoteRequest.emailThread 
    : quoteRequest.emailThread 
      ? [quoteRequest.emailThread]
      : [];
  
  // Collect all messages needing follow-up from all threads
  const messagesNeedingFollowUp = emailThreads.flatMap((thread: any) => 
    (thread.messages || []).filter((message: any) => 
      message.direction === 'OUTBOUND' &&
      message.expectedResponseBy &&
      new Date(message.expectedResponseBy) < now &&
      !message.followUpSentAt &&
      !thread.messages.some((m: any) =>
        m.direction === 'INBOUND' &&
        ((m.inReplyTo === message.id) ||
         (m.receivedAt && message.sentAt && new Date(m.receivedAt) > new Date(message.sentAt))) &&
        m.receivedAt
      )
    )
  ).sort((a: any, b: any) => 
    new Date(a.expectedResponseBy).getTime() - new Date(b.expectedResponseBy).getTime()
  );
  
  // If no messages need follow-up, don't show the alert
  if (!messagesNeedingFollowUp || messagesNeedingFollowUp.length === 0) {
    return null;
  }
  
  // Get the most overdue message
  const mostOverdueMessage = messagesNeedingFollowUp[0];
  const daysSinceExpected = Math.floor(
    (now.getTime() - new Date(mostOverdueMessage.expectedResponseBy).getTime()) / 
    (1000 * 60 * 60 * 24)
  );
  
  return (
    <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
      <AlertTriangle className="h-5 w-5 text-red-600" />
      <AlertTitle className="text-red-800">Follow-up Required</AlertTitle>
      <AlertDescription className="text-red-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p>
              A supplier response is overdue by {daysSinceExpected} {daysSinceExpected === 1 ? 'day' : 'days'}.
              Consider sending a follow-up email.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="sm:flex-shrink-0"
            onClick={() => onFollowUpClick(mostOverdueMessage.id)}
          >
            <Mail className="h-4 w-4 mr-2" />
            Send Follow-up
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}