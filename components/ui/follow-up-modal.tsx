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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays } from "date-fns";
import { cn } from "@/lib/utils";

interface FollowUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteRequest: any;
  messageId: string;
  supplierId?: string; // Optional supplier ID for multi-supplier quotes
  onFollowUpSent: () => void;
  initialReason?: string;
  initialWorkflowBranch?: "no_response" | "needs_revision" | "accept_quote";
  onPreviewGenerated?: (messageId: string, reason: string, workflowBranch: "no_response" | "needs_revision" | "accept_quote", additionalMessage?: string, supplierId?: string) => Promise<void>;
}

export function FollowUpModal({
  open,
  onOpenChange,
  quoteRequest,
  messageId,
  supplierId,
  onFollowUpSent,
  initialReason = "No response received by expected date",
  initialWorkflowBranch = "no_response",
  onPreviewGenerated
}: FollowUpModalProps) {
  // State for the multi-step process
  const [step, setStep] = useState<'compose' | 'preview' | 'edit'>('compose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [additionalMessage, setAdditionalMessage] = useState('');
  const [followUpReason, setFollowUpReason] = useState<string>(initialReason);
  const [workflowBranch, setWorkflowBranch] = useState<"no_response" | "needs_revision" | "accept_quote">(initialWorkflowBranch);
  const [expectedResponseBy, setExpectedResponseBy] = useState<Date | undefined>(
    addDays(new Date(), 2) // Default to 2 days from now
  );
  
  // Preview state
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewBody, setPreviewBody] = useState('');
  
  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      console.log("FollowUpModal - Modal opened with:", { initialReason, initialWorkflowBranch });
      setStep('compose');
      setAdditionalMessage('');
      setFollowUpReason(initialReason);
      setWorkflowBranch(initialWorkflowBranch);
      setPreviewSubject('');
      setPreviewBody('');
      setExpectedResponseBy(addDays(new Date(), 2));
      setError(null);
    }
  }, [open, initialReason, initialWorkflowBranch]);
  
  // Handle generating preview
  const handleGeneratePreview = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (onPreviewGenerated) {
        // Use the parent component's preview generation function
        await onPreviewGenerated(messageId, followUpReason, workflowBranch, additionalMessage, supplierId);
        onOpenChange(false); // Close the modal as the preview will be shown in the EmailPreviewModal
      } else {
        // Fallback to the original implementation
        const response = await generateFollowUpPreview(quoteRequest.id, messageId, {
          additionalMessage,
          expectedResponseBy,
          followUpReason,
          workflowBranch,
          supplierId
        });
        
        setPreviewSubject(response.data.email.subject);
        setPreviewBody(response.data.email.body);
        setStep('preview');
      }
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
      
      // Log the additionalMessage when sending the follow-up
      console.log(`FollowUpModal - Sending follow-up with additionalMessage: ${additionalMessage || 'None'}`);
      
      // Log specifically for the needs_revision branch
      if (workflowBranch === 'needs_revision') {
        console.log(`[FOLLOW-UP] Sending follow-up for needs_revision branch with additionalMessage: ${additionalMessage || 'None'}`);
      }
      
      await sendFollowUpEmail(quoteRequest.id, messageId, {
        additionalMessage,
        expectedResponseBy,
        followUpReason,
        workflowBranch,
        supplierId
      });
      
      toast({
        title: "Follow-up email sent",
        description: "The supplier has been notified."
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
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Follow-up Reason</Label>
                  <Select
                    value={followUpReason}
                    onValueChange={(value) => {
                      console.log("FollowUpModal - Reason changed to:", value);
                      console.log("FollowUpModal - Current workflowBranch:", workflowBranch);
                      console.log("FollowUpModal - Initial workflowBranch:", initialWorkflowBranch);
                      
                      setFollowUpReason(value);
                      
                      // If we're in a "needs_revision" workflow, keep it that way regardless of reason change
                      if (initialWorkflowBranch === 'needs_revision') {
                        console.log("FollowUpModal - Keeping workflowBranch as needs_revision");
                        // Do not change the workflow branch
                      } else {
                        // Otherwise, update workflow branch based on reason
                        if (value.toLowerCase().includes('revision')) {
                          setWorkflowBranch('needs_revision');
                        } else if (value.toLowerCase().includes('accept')) {
                          setWorkflowBranch('accept_quote');
                        } else {
                          setWorkflowBranch('no_response');
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No response received by expected date">No response received</SelectItem>
                      <SelectItem value="Needs revision">Quote needs revision</SelectItem>
                      <SelectItem value="Missing information">Missing information</SelectItem>
                      <SelectItem value="Pricing issue">Pricing issue</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Additional Message (Optional)</Label>
                <Textarea
                  placeholder="Add any specific details or questions..."
                  value={additionalMessage}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setAdditionalMessage(newValue);
                    
                    // Log when the additionalMessage changes
                    if (newValue) {
                      console.log(`FollowUpModal - additionalMessage changed: ${newValue}`);
                      
                      // Log specifically for the needs_revision branch
                      if (workflowBranch === 'needs_revision') {
                        console.log(`[FOLLOW-UP] additionalMessage updated for needs_revision branch: ${newValue}`);
                      }
                    }
                  }}
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
              onClick={() => {
                console.log("FollowUpModal - Preview button clicked with:", {
                  followUpReason,
                  workflowBranch,
                  initialWorkflowBranch,
                  additionalMessage: additionalMessage || 'None'
                });
                
                // Log specifically for the needs_revision branch
                if (workflowBranch === 'needs_revision') {
                  console.log(`[FOLLOW-UP] Preview button clicked for needs_revision branch with additionalMessage: ${additionalMessage || 'None'}`);
                }
                handleGeneratePreview();
              }}
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