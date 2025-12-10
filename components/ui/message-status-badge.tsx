import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, AlertTriangle, CheckCircle, Mail } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface MessageStatusBadgeProps {
  message: any;
  relatedMessages: any[];
}

export function MessageStatusBadge({ message, relatedMessages }: MessageStatusBadgeProps) {
  // Only show status for outbound messages
  if (message.direction !== 'OUTBOUND') {
    return null;
  }
  
  const now = new Date();
  const expectedResponseBy = message.expectedResponseBy ? new Date(message.expectedResponseBy) : null;
  // Check if there's a direct response to this message
  const hasDirectResponse = relatedMessages.some(m =>
    m.direction === 'INBOUND' &&
    m.inReplyTo === message.id &&
    m.receivedAt
  );
  
  // Check if there's any inbound message received after this message was sent
  const hasAnyLaterResponse = message.sentAt && relatedMessages.some(m =>
    m.direction === 'INBOUND' &&
    m.receivedAt &&
    new Date(m.receivedAt) > new Date(message.sentAt)
  );
  
  // Consider a response received if either condition is met
  const hasResponse = hasDirectResponse || hasAnyLaterResponse;
  const followUpSent = message.followUpSentAt !== null;
  
  // Calculate time remaining until expected response
  const timeRemaining = expectedResponseBy ? expectedResponseBy.getTime() - now.getTime() : null;
  const hoursRemaining = timeRemaining ? Math.floor(timeRemaining / (1000 * 60 * 60)) : null;
  
  // Determine status
  let status: 'awaiting' | 'due-soon' | 'overdue' | 'responded' | 'follow-up-sent' = 'awaiting';
  
  if (hasResponse) {
    status = 'responded';
  } else if (followUpSent) {
    status = 'follow-up-sent';
  } else if (expectedResponseBy && now > expectedResponseBy) {
    status = 'overdue';
  } else if (hoursRemaining !== null && hoursRemaining <= 24) {
    status = 'due-soon';
  } else {
    status = 'awaiting';
  }
  
  // Render appropriate badge based on status
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Use a span instead of a fragment to accept aria-describedby */}
          <span>
            {status === 'awaiting' && (
              <Badge variant="outline" className="flex items-center gap-1 border-blue-200 text-blue-600">
                <Clock className="h-3 w-3" />
                <span>Awaiting Response</span>
              </Badge>
            )}
            
            {status === 'due-soon' && (
              <Badge variant="outline" className="flex items-center gap-1 border-amber-200 text-amber-600">
                <Clock className="h-3 w-3" />
                <span>Response Due Soon</span>
              </Badge>
            )}
            
            {status === 'overdue' && (
              <Badge variant="outline" className="flex items-center gap-1 border-red-200 text-red-600">
                <AlertTriangle className="h-3 w-3" />
                <span>Follow-up Needed</span>
              </Badge>
            )}
            
            {status === 'responded' && (
              <Badge variant="outline" className="flex items-center gap-1 border-green-200 text-green-600">
                <CheckCircle className="h-3 w-3" />
                <span>Response Received</span>
              </Badge>
            )}
            
            {status === 'follow-up-sent' && (
              <Badge variant="outline" className="flex items-center gap-1 border-purple-200 text-purple-600">
                <Mail className="h-3 w-3" />
                <span>Follow-up Sent</span>
              </Badge>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {status === 'awaiting' && expectedResponseBy && (
            <p>Response expected by {formatDate(expectedResponseBy)}</p>
          )}
          
          {status === 'due-soon' && hoursRemaining !== null && (
            <p>Response due in {hoursRemaining} hours</p>
          )}
          
          {status === 'overdue' && (
            <p>Response is overdue. Consider sending a follow-up.</p>
          )}
          
          {status === 'responded' && (
            <p>Supplier has responded to this message</p>
          )}
          
          {status === 'follow-up-sent' && message.followUpSentAt && (
            <p>Follow-up sent on {formatDate(message.followUpSentAt)}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}