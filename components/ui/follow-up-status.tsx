import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, Mail, CheckCircle, AlertTriangle } from "lucide-react";

interface FollowUpStatusProps {
  quoteRequest: any;
}

export function FollowUpStatus({ quoteRequest }: FollowUpStatusProps) {
  const now = new Date();
  
  // Count messages by status
  const messages = quoteRequest.emailThread?.messages || [];
  const outboundMessages = messages.filter((m: any) => m.direction === 'OUTBOUND');
  
  type MessageStatus = 'responded' | 'follow-up-sent' | 'overdue' | 'awaiting';
  
  const messageStatuses: MessageStatus[] = outboundMessages.map((message: any) => {
    const expectedResponseBy = message.expectedResponseBy ? new Date(message.expectedResponseBy) : null;
    const hasResponse = messages.some((m: any) =>
      m.direction === 'INBOUND' &&
      ((m.inReplyTo === message.id) ||
       (m.receivedAt && message.sentAt && new Date(m.receivedAt) > new Date(message.sentAt))) &&
      m.receivedAt
    );
    const followUpSent = message.followUpSentAt !== null;
    
    if (hasResponse) {
      return 'responded';
    } else if (followUpSent) {
      return 'follow-up-sent';
    } else if (expectedResponseBy && now > expectedResponseBy) {
      return 'overdue';
    } else {
      return 'awaiting';
    }
  });
  
  const respondedCount = messageStatuses.filter((s: MessageStatus) => s === 'responded').length;
  const followUpSentCount = messageStatuses.filter((s: MessageStatus) => s === 'follow-up-sent').length;
  const overdueCount = messageStatuses.filter((s: MessageStatus) => s === 'overdue').length;
  const awaitingCount = messageStatuses.filter((s: MessageStatus) => s === 'awaiting').length;
  
  // Calculate response rate
  const responseRate = outboundMessages.length > 0 
    ? Math.round((respondedCount / outboundMessages.length) * 100) 
    : 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Communication Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Response rate */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">Response Rate</span>
              <span className="text-sm font-medium">{responseRate}%</span>
            </div>
            <Progress value={responseRate} className="h-2" />
          </div>
          
          {/* Status counts */}
          <div className="grid grid-cols-2 gap-4">
            {respondedCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{respondedCount}</p>
                  <p className="text-xs text-muted-foreground">Responded</p>
                </div>
              </div>
            )}
            
            {awaitingCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{awaitingCount}</p>
                  <p className="text-xs text-muted-foreground">Awaiting</p>
                </div>
              </div>
            )}
            
            {overdueCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{overdueCount}</p>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                </div>
              </div>
            )}
            
            {followUpSentCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100">
                  <Mail className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{followUpSentCount}</p>
                  <p className="text-xs text-muted-foreground">Follow-ups</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}