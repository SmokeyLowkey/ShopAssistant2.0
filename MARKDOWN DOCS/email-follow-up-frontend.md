# Email Follow-up Frontend Implementation

This document details the front-end implementation of the email follow-up workflow in the construction dashboard application.

## UI Components

### MessageStatusBadge

The `MessageStatusBadge` component displays the current status of each message based on its expected response time and whether a response has been received.

```tsx
// components/ui/message-status-badge.tsx
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, AlertTriangle, CheckCircle, Mail } from "lucide-react";

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
  const hasResponse = relatedMessages.some(m => 
    m.direction === 'INBOUND' && 
    m.inReplyTo === message.id &&
    m.receivedAt
  );
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
        </TooltipTrigger>
        <TooltipContent>
          {status === 'awaiting' && expectedResponseBy && (
            <p>Response expected by {expectedResponseBy.toLocaleDateString()}</p>
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
            <p>Follow-up sent on {new Date(message.followUpSentAt).toLocaleDateString()}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### FollowUpButton

The `FollowUpButton` component provides a button for initiating follow-up emails when a response is overdue.

```tsx
// components/ui/follow-up-button.tsx
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

interface FollowUpButtonProps {
  message: any;
  relatedMessages: any[];
  onFollowUpClick: (messageId: string) => void;
}

export function FollowUpButton({ 
  message, 
  relatedMessages, 
  onFollowUpClick 
}: FollowUpButtonProps) {
  // Only show for outbound messages
  if (message.direction !== 'OUTBOUND') {
    return null;
  }
  
  const now = new Date();
  const expectedResponseBy = message.expectedResponseBy ? new Date(message.expectedResponseBy) : null;
  const hasResponse = relatedMessages.some(m => 
    m.direction === 'INBOUND' && 
    m.inReplyTo === message.id &&
    m.receivedAt
  );
  const followUpSent = message.followUpSentAt !== null;
  
  // Only show button if response is overdue and no follow-up has been sent
  const isOverdue = expectedResponseBy && now > expectedResponseBy;
  const showButton = isOverdue && !hasResponse && !followUpSent;
  
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
```

### FollowUpAlert

The `FollowUpAlert` component displays a prominent alert when follow-up is needed.

```tsx
// components/ui/follow-up-alert.tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Mail } from "lucide-react";

interface FollowUpAlertProps {
  quoteRequest: any;
  onFollowUpClick: (messageId: string) => void;
}

export function FollowUpAlert({ quoteRequest, onFollowUpClick }: FollowUpAlertProps) {
  // Check if there are any messages that need follow-up
  const now = new Date();
  const messagesNeedingFollowUp = quoteRequest.emailThread?.messages
    .filter((message: any) => 
      message.direction === 'OUTBOUND' &&
      message.expectedResponseBy &&
      new Date(message.expectedResponseBy) < now &&
      !message.followUpSentAt &&
      !quoteRequest.emailThread.messages.some((m: any) => 
        m.direction === 'INBOUND' && 
        m.inReplyTo === message.id &&
        m.receivedAt
      )
    )
    .sort((a: any, b: any) => 
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
```

### FollowUpStatus

The `FollowUpStatus` component displays the overall communication status for a quote request.

```tsx
// components/ui/follow-up-status.tsx
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
  
  const messageStatuses = outboundMessages.map((message: any) => {
    const expectedResponseBy = message.expectedResponseBy ? new Date(message.expectedResponseBy) : null;
    const hasResponse = messages.some((m: any) => 
      m.direction === 'INBOUND' && 
      m.inReplyTo === message.id &&
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
  
  const respondedCount = messageStatuses.filter(s => s === 'responded').length;
  const followUpSentCount = messageStatuses.filter(s => s === 'follow-up-sent').length;
  const overdueCount = messageStatuses.filter(s => s === 'overdue').length;
  const awaitingCount = messageStatuses.filter(s => s === 'awaiting').length;
  
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
```

### DateTimePicker

The `DateTimePicker` component allows users to select a date and time for the expected response.

```tsx
// components/ui/date-time-picker.tsx
import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  label?: string;
}

export function DateTimePicker({ value, onChange, label }: DateTimePickerProps) {
  const [date, setDate] = useState<Date | undefined>(value);
  const [time, setTime] = useState<string>(
    value ? format(value, "HH:mm") : "12:00"
  );
  
  // Update the combined date and time when either changes
  useEffect(() => {
    if (date) {
      const [hours, minutes] = time.split(":").map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours, minutes, 0, 0);
      onChange(newDate);
    } else {
      onChange(undefined);
    }
  }, [date, time, onChange]);
  
  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        {/* Date picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : "Select date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        
        {/* Time picker */}
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
    </div>
  );
}
```

### EmailPreview

The `EmailPreview` component displays a preview of the follow-up email.

```tsx
// components/ui/email-preview.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface EmailPreviewProps {
  subject: string;
  body: string;
  expectedResponseBy: Date | undefined;
  onSubjectChange?: (subject: string) => void;
  onBodyChange?: (body: string) => void;
  onExpectedResponseByChange?: (date: Date | undefined) => void;
  editable?: boolean;
}

export function EmailPreview({
  subject,
  body,
  expectedResponseBy,
  onSubjectChange,
  onBodyChange,
  onExpectedResponseByChange,
  editable = false
}: EmailPreviewProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="pt-6 space-y-4">
        {/* Subject */}
        <div className="space-y-2">
          <Label>Subject</Label>
          {editable && onSubjectChange ? (
            <Input
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Email subject"
            />
          ) : (
            <div className="p-2 bg-gray-50 rounded-md">
              {subject}
            </div>
          )}
        </div>
        
        {/* Body */}
        <div className="space-y-2">
          <Label>Message</Label>
          {editable && onBodyChange ? (
            <Textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              placeholder="Email body"
              rows={8}
            />
          ) : (
            <div className="p-2 bg-gray-50 rounded-md whitespace-pre-wrap min-h-[200px]">
              {body}
            </div>
          )}
        </div>
        
        {/* Expected response date */}
        {(expectedResponseBy || (editable && onExpectedResponseByChange)) && (
          <div className="space-y-2">
            {editable && onExpectedResponseByChange ? (
              <DateTimePicker
                value={expectedResponseBy}
                onChange={onExpectedResponseByChange}
                label="Expected Response By"
              />
            ) : (
              <div>
                <Label>Expected Response By</Label>
                <div className="p-2 bg-gray-50 rounded-md">
                  {expectedResponseBy ? expectedResponseBy.toLocaleString() : "Not specified"}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### FollowUpModal

The `FollowUpModal` component implements the human-in-the-loop approval workflow for follow-up emails.

```tsx
// components/ui/follow-up-modal.tsx
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, AlertTriangle, CheckCircle, Edit, ArrowRight } from "lucide-react";
import { EmailPreview } from "@/components/ui/email-preview";
import { toast } from "@/components/ui/use-toast";
import { generateFollowUpPreview, sendFollowUpEmail } from "@/lib/api/quote-requests";
import { addDays } from "date-fns";

interface FollowUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteRequest: any;
  messageId: string;
  onFollowUpSent: () => void;
}

export function FollowUpModal({
  open,
  onOpenChange,
  quoteRequest,
  messageId,
  onFollowUpSent
}: FollowUpModalProps) {
  // State for the multi-step process
  const [step, setStep] = useState<'compose' | 'preview' | 'edit'>('compose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [reason, setReason] = useState<'no-response' | 'additional-info' | 'other'>('no-response');
  const [additionalMessage, setAdditionalMessage] = useState('');
  
  // Preview state
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewBody, setPreviewBody] = useState('');
  const [expectedResponseBy, setExpectedResponseBy] = useState<Date | undefined>(
    addDays(new Date(), 2) // Default to 2 days from now
  );
  
  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('compose');
      setReason('no-response');
      setAdditionalMessage('');
      setPreviewSubject('');
      setPreviewBody('');
      setExpectedResponseBy(addDays(new Date(), 2));
      setError(null);
    }
  }, [open]);
  
  // Handle generating preview
  const handleGeneratePreview = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await generateFollowUpPreview(quoteRequest.id, messageId, {
        reason,
        additionalMessage,
        expectedResponseBy
      });
      
      setPreviewSubject(response.data.subject);
      setPreviewBody(response.data.body);
      setStep('preview');
    } catch (err) {
      console.error("Error generating follow-up preview:", err);
      setError("Failed to generate follow-up preview. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle sending follow-up
  const handleSendFollowUp = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await sendFollowUpEmail(quoteRequest.id, messageId, {
        subject: previewSubject,
        body: previewBody,
        expectedResponseBy
      });
      
      toast({
        title: "Follow-up email sent",
        description: "The supplier has been notified.",
        variant: "success"
      });
      
      onOpenChange(false);
      onFollowUpSent();
    } catch (err) {
      console.error("Error sending follow-up email:", err);
      setError("Failed to send follow-up email. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-md md:max-w-lg",
        step === 'preview' || step === 'edit' ? "md:max-w-2xl" : ""
      )}>
        <DialogHeader>
          <DialogTitle>Send Follow-up Email</DialogTitle>
        </DialogHeader>
        
        {/* Steps */}
        <Tabs value={step} className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="compose" disabled>
              1. Compose
            </TabsTrigger>
            <TabsTrigger value="preview" disabled>
              2. Preview
            </TabsTrigger>
            <TabsTrigger value="edit" disabled>
              3. Edit
            </TabsTrigger>
          </TabsList>
          
          {/* Compose step */}
          <TabsContent value="compose" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason for Follow-up</Label>
                <RadioGroup value={reason} onValueChange={(value) => setReason(value as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no-response" id="no-response" />
                    <Label htmlFor="no-response">No response received</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="additional-info" id="additional-info" />
                    <Label htmlFor="additional-info">Additional information needed</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other">Other reason</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="space-y-2">
                <Label>Additional Message (Optional)</Label>
                <Textarea
                  placeholder="Add any specific details or questions..."
                  value={additionalMessage}
                  onChange={(e) => setAdditionalMessage(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          </TabsContent>
          
          {/* Preview step */}
          <TabsContent value="preview" className="space-y-4">
            <EmailPreview
              subject={previewSubject}
              body={previewBody}
              expectedResponseBy={expectedResponseBy}
              editable={false}
            />
          </TabsContent>
          
          {/* Edit step */}
          <TabsContent value="edit" className="space-y-4">
            <EmailPreview
              subject={previewSubject}
              body={previewBody}
              expectedResponseBy={expectedResponseBy}
              onSubjectChange={setPreviewSubject}
              onBodyChange={setPreviewBody}
              onExpectedResponseByChange={setExpectedResponseBy}
              editable={true}
            />
          </TabsContent>
        </Tabs>
        
        {/* Error message */}
        {error && (
          <div className="bg-red-50 p-3 rounded-md text-red-600 text-sm flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
        
        {/* Footer buttons */}
        <DialogFooter className="flex justify-between sm:justify-between">
          {step === 'compose' && (
            <Button
              type="button"
              onClick={handleGeneratePreview}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Preview Email
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('edit')}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Email
              </Button>
              
              <Button
                type="button"
                onClick={handleSendFollowUp}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Follow-up
                  </>
                )}
              </Button>
            </>
          )}
          
          {step === 'edit' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('preview')}
              >
                Back to Preview
              </Button>
              
              <Button
                type="button"
                onClick={handleSendFollowUp}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Follow-up
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Integration with Quote Request Detail Page

The UI components are integrated into the quote request detail page to provide a seamless user experience for managing follow-up emails.

### Quote Request Detail Page