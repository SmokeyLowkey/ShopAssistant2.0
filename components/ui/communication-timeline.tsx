import { formatDate } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FollowUpButton } from "@/components/ui/follow-up-button";
import { MessageStatusBadge } from "@/components/ui/message-status-badge";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Mail,
  ArrowRight,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  FileText,
  Paperclip,
  Download
} from "lucide-react";
import { useEffect, useState } from "react";

interface CommunicationTimelineProps {
  quoteRequest?: any;
  emailThreadId?: string;
  orderId?: string;
  conversionDate?: string;
  onFollowUpClick: (messageId: string) => void;
  onPreviewClick?: (messageId: string) => void;
  quoteStatus?: string;
}

export function CommunicationTimeline({
  quoteRequest,
  emailThreadId,
  orderId,
  conversionDate,
  onFollowUpClick,
  onPreviewClick,
  quoteStatus
}: CommunicationTimelineProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const fetchMessages = async () => {
      // If we have a direct emailThreadId, fetch messages from the API
      if (emailThreadId) {
        try {
          setLoading(true);
          const response = await fetch(`/api/email-threads/${emailThreadId}/messages`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch messages: ${response.status}`);
          }
          
          const data = await response.json();
          setMessages(data.messages || []);
        } catch (err) {
          console.error("Error fetching messages:", err);
        } finally {
          setLoading(false);
        }
      } else if (quoteRequest?.emailThread?.messages) {
        // Otherwise use messages from the quote request
        setMessages(quoteRequest.emailThread.messages);
      }
    };
    
    fetchMessages();
  }, [emailThreadId, quoteRequest]);
  
  // Sort messages by date (oldest first for timeline view)
  const sortedMessages = [...messages].sort((a, b) => {
    const dateA = new Date(a.sentAt || a.receivedAt || a.createdAt);
    const dateB = new Date(b.sentAt || b.receivedAt || b.createdAt);
    return dateA.getTime() - dateB.getTime();
  });

  // Debug logging for post-conversion detection
  if (conversionDate) {
    console.log('=== POST-CONVERSION DEBUG ===');
    console.log('Conversion date:', conversionDate);
    console.log('Conversion date as Date:', new Date(conversionDate));
    console.log('Messages:', sortedMessages.map(m => ({
      id: m.id.substring(0, 8),
      subject: m.subject?.substring(0, 40),
      sentAt: m.sentAt,
      receivedAt: m.receivedAt,
      createdAt: m.createdAt,
      actualTimestamp: m.sentAt || m.receivedAt || m.createdAt,
      isAfterConversion: new Date(m.sentAt || m.receivedAt || m.createdAt) > new Date(conversionDate)
    })));
  }
  
  // Helper function to check if a message has a timely response
  const hasTimelyResponse = (message: any) => {
    if (message.direction !== 'OUTBOUND' || !message.expectedResponseBy) {
      return false;
    }
    
    const expectedResponseBy = new Date(message.expectedResponseBy);
    
    // Check if there's a direct response to this message or any inbound message after this was sent
    const response = messages.find((m: any) =>
      m.direction === 'INBOUND' &&
      ((m.inReplyTo === message.id) ||
       (m.receivedAt && message.sentAt && new Date(m.receivedAt) > new Date(message.sentAt))) &&
      m.receivedAt
    );
    
    if (!response) {
      return false;
    }
    
    // Check if the response was received before the expected response date
    const receivedAt = new Date(response.receivedAt);
    return receivedAt <= expectedResponseBy;
  };
  
  if (loading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-lg text-white">Communication Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-600 border-t-transparent"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sortedMessages.length === 0) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-lg text-white">Communication Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-400">
            <Mail className="w-12 h-12 mx-auto mb-4 text-slate-400/50" />
            <p>No messages yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="border-b border-slate-700">
        <CardTitle className="text-lg text-white">Communication Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {sortedMessages.map((message: any, index: number) => {
            const messageDate = new Date(message.sentAt || message.receivedAt || message.createdAt);
            const isPostConversion = conversionDate && messageDate > new Date(conversionDate);
            const isConversionPoint = conversionDate && index > 0 &&
              new Date(sortedMessages[index-1].sentAt || sortedMessages[index-1].receivedAt || sortedMessages[index-1].createdAt) <= new Date(conversionDate) &&
              messageDate > new Date(conversionDate);
            
            return (
              <div key={message.id} className="relative">
                {/* Timeline connector */}
                {index > 0 && (
                  <div className="absolute left-4 top-0 -mt-6 h-6 w-0.5 bg-slate-600"></div>
                )}

                {/* Conversion point indicator */}
                {isConversionPoint && (
                  <div className="flex items-center justify-center py-4 mb-4">
                    <div className="bg-slate-700 px-4 py-2 rounded-full flex items-center gap-2 border border-slate-600">
                      <Badge variant="outline" className="text-white border-slate-400">Quote</Badge>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <ShoppingCart className="w-4 h-4 text-orange-500" />
                      <Badge className="bg-orange-600 text-white">Order</Badge>
                      <span className="text-xs text-slate-400 ml-2">
                        {formatDistanceToNow(new Date(conversionDate), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className={`flex gap-4 ${isPostConversion ? 'bg-slate-700/30 p-4 rounded-md' : ''}`}>
                  {/* Message direction icon */}
                  <div className="flex-shrink-0 mt-1">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      message.direction === 'OUTBOUND'
                        ? 'bg-blue-900/30'
                        : 'bg-green-900/30'
                    }`}>
                      {message.direction === 'OUTBOUND' ? (
                        <ArrowUpRight className="w-4 h-4 text-blue-400" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                  </div>

                  <div className="flex-grow">
                    {/* Message header with status badge */}
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-white">
                          {message.direction === 'OUTBOUND' ? 'Sent to Supplier' : 'Received from Supplier'}
                        </p>
                        <p className="text-sm text-slate-400">
                          {message.sentAt ? formatDate(message.sentAt) :
                           message.receivedAt ? formatDate(message.receivedAt) : ""}
                        </p>
                        <p className="text-xs text-slate-400">
                          {message.direction === 'OUTBOUND' ? `To: ${message.to}` : `From: ${message.from}`}
                          {message.direction === 'INBOUND' && quoteRequest?.supplier && (
                            message.from === quoteRequest.supplier.email
                              ? ' (Primary Email)'
                              : (quoteRequest.supplier.auxiliaryEmails &&
                                 Array.isArray(quoteRequest.supplier.auxiliaryEmails) &&
                                 quoteRequest.supplier.auxiliaryEmails.some((email: string) =>
                                   email === message.from ||
                                   email.replace(/[{}]/g, '') === message.from
                                 ))
                                ? ' (Auxiliary Email)'
                                : ' (New Email)'
                          )}
                        </p>
                      </div>
                      {!isPostConversion ? (
                        <MessageStatusBadge
                          message={message}
                          relatedMessages={messages}
                        />
                      ) : (
                        <Badge variant="outline" className="text-white border-slate-400">Post-conversion</Badge>
                      )}
                    </div>

                    {/* Message content */}
                    <div className="mt-2 p-3 bg-slate-700/50 rounded-md border border-slate-600">
                      <p className="font-medium mb-1 break-words text-white">{message.subject}</p>
                      <p className="text-sm text-slate-300 break-words">
                        {message.body.length > 200
                          ? `${message.body.substring(0, 200)}...`
                          : message.body}
                      </p>
                      
                      {/* Attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-600">
                          <div className="flex items-center gap-2 mb-2">
                            <Paperclip className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium text-slate-400">
                              {message.attachments.length} {message.attachments.length === 1 ? 'Attachment' : 'Attachments'}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {message.attachments.map((attachment: any) => (
                              <AttachmentDownloadButton
                                key={attachment.id}
                                attachment={attachment}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expected response date */}
                    {message.expectedResponseBy && message.direction === 'OUTBOUND' && (
                      <div className="mt-2 flex items-center text-sm text-slate-400">
                        <Clock className="w-4 h-4 mr-1" />
                        <span>
                          Response expected by: {formatDate(message.expectedResponseBy)}
                        </span>
                      </div>
                    )}
                    
                    {/* Action buttons */}
                    <div className="mt-2 flex gap-2">
                      {/* Follow-up button - Only shown for outbound messages that need follow-up */}
                      {message.direction === 'OUTBOUND' && !message.followUpSentAt && !isPostConversion && (
                        <FollowUpButton
                          message={message}
                          relatedMessages={messages}
                          onFollowUpClick={onFollowUpClick}
                          quoteStatus={quoteStatus || quoteRequest?.status}
                        />
                      )}

                      {/* Preview HTML button - Shown for all messages with HTML content */}
                      {onPreviewClick && message.bodyHtml && (
                        <button
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-slate-600 bg-slate-700 hover:bg-slate-600 text-white h-9 px-3"
                          onClick={() => onPreviewClick(message.id)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View HTML
                        </button>
                      )}
                    </div>

                    {/* Timely response indicator */}
                    {hasTimelyResponse(message) && message.direction === 'OUTBOUND' && (
                      <div className="mt-2 flex items-center text-sm text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        <span>Supplier responded on time</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Separator between messages */}
                {index < sortedMessages.length - 1 && !isConversionPoint && (
                  <Separator className="my-4 bg-slate-700" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper component for downloading attachments
function AttachmentDownloadButton({ attachment }: { attachment: any }) {
  const [isDownloading, setIsDownloading] = useState(false);
  
  const handleDownload = async () => {
    try {
      setIsDownloading(true);

      // The API redirects (307) to S3 presigned URL, so we can directly open it
      // Browser will follow the redirect and download the file
      const downloadUrl = `/api/attachments/${attachment.id}/download`;
      window.open(downloadUrl, '_blank');

      // Small delay before resetting loading state to show user feedback
      setTimeout(() => {
        setIsDownloading(false);
      }, 500);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Failed to download attachment. Please try again.');
      setIsDownloading(false);
    }
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className="flex items-center gap-2 w-full p-2 rounded-md border border-slate-600 bg-slate-700/30 hover:bg-slate-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
      <div className="flex-grow text-left min-w-0">
        <p className="text-sm font-medium truncate text-white">{attachment.filename}</p>
        <p className="text-xs text-slate-400">
          {attachment.contentType} • {formatFileSize(attachment.size)}
        </p>
      </div>
      {isDownloading ? (
        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
      ) : (
        <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
      )}
    </button>
  );
}