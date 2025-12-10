import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

interface FollowUpButtonProps {
  message: any;
  relatedMessages: any[];
  onFollowUpClick: (messageId: string) => void;
  quoteStatus?: string; // Add quote status prop
}

export function FollowUpButton({
  message,
  relatedMessages,
  onFollowUpClick,
  quoteStatus
}: FollowUpButtonProps) {
  // Only show for outbound messages
  if (message.direction !== 'OUTBOUND') {
    return null;
  }
  
  const now = new Date();
  const expectedResponseBy = message.expectedResponseBy ? new Date(message.expectedResponseBy) : null;
  // Check if there's a direct reply or any inbound message after this outbound message was sent
  const hasResponse = relatedMessages.some(m =>
    m.direction === 'INBOUND' &&
    ((m.inReplyTo === message.id) ||
     (m.receivedAt && message.sentAt && new Date(m.receivedAt) > new Date(message.sentAt)))
  );
  const followUpSent = message.followUpSentAt !== null;
  
  // Only show button if:
  // 1. Quote status is SENT
  // 2. Response is overdue
  // 3. No follow-up has been sent
  // 4. No response has been received
  const isOverdue = expectedResponseBy && now > expectedResponseBy;
  const showButton = quoteStatus === 'SENT' && isOverdue && !hasResponse && !followUpSent;
  
  if (!showButton) {
    return null;
  }
  
  return (
    <Button
      variant="outline"
      size="sm"
      className="border-red-200 text-red-600 hover:bg-red-50"
      onClick={() => onFollowUpClick(message.id)}
    >
      <Mail className="h-4 w-4 mr-2" />
      Send Follow-up
    </Button>
  );
}