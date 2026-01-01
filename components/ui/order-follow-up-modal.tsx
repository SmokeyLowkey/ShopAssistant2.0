import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Mail,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { EmailPreview } from "@/components/ui/email-preview";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { OrderFollowUpBranch } from "@/lib/api/n8n-client";

interface OrderFollowUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  onFollowUpSent: () => void;
}

/**
 * Order Follow-Up Modal Component
 *
 * 3-step workflow for sending follow-up emails about orders:
 * 1. Compose: Select reason and add message
 * 2. Preview: Review generated email
 * 3. Edit: Modify email before sending (optional)
 *
 * Pattern cloned from: components/ui/follow-up-modal.tsx
 */
export function OrderFollowUpModal({
  open,
  onOpenChange,
  order,
  onFollowUpSent,
}: OrderFollowUpModalProps) {
  // State for the multi-step process
  const [step, setStep] = useState<"compose" | "preview" | "edit">("compose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [branch, setBranch] = useState<OrderFollowUpBranch>("missing_tracking");
  const [userMessage, setUserMessage] = useState("");
  const [expectedResponseDate, setExpectedResponseDate] = useState<
    Date | undefined
  >(addDays(new Date(), 2)); // Default to 2 days from now

  // Preview state
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewBody, setPreviewBody] = useState("");
  const [previewBodyHtml, setPreviewBodyHtml] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("compose");
      setBranch("missing_tracking");
      setUserMessage("");
      setPreviewSubject("");
      setPreviewBody("");
      setPreviewBodyHtml("");
      setExpectedResponseDate(addDays(new Date(), 2));
      setError(null);
    }
  }, [open]);

  // Handle generating preview
  const handleGeneratePreview = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        "/api/webhooks/email/order-follow-up",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            action: "preview",
            branch,
            userMessage,
            expectedResponseDate: expectedResponseDate?.toISOString(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate preview");
      }

      const data = await response.json();

      setPreviewSubject(data.data.email.subject);
      setPreviewBody(data.data.email.body);
      setPreviewBodyHtml(data.data.email.bodyHtml);
      setStep("preview");
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

      const response = await fetch(
        "/api/webhooks/email/order-follow-up",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            action: "send",
            branch,
            userMessage,
            expectedResponseDate: expectedResponseDate?.toISOString(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to send follow-up");
      }

      toast({
        title: "Follow-up email sent",
        description: "The supplier has been notified.",
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

  // Branch display names
  const branchLabels: Record<OrderFollowUpBranch, string> = {
    no_confirmation: "No order confirmation received",
    missing_tracking: "Tracking number not provided",
    delivery_delayed: "Delivery is delayed",
    quality_issue: "Issue with delivered parts",
    other: "Other inquiry",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md md:max-w-lg",
          step === "preview" || step === "edit" ? "md:max-w-2xl" : ""
        )}
      >
        <DialogHeader>
          <DialogTitle>Send Order Follow-up Email</DialogTitle>
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
                <Label>Follow-up Reason</Label>
                <Select
                  value={branch}
                  onValueChange={(value) => setBranch(value as OrderFollowUpBranch)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(branchLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Additional Message (Optional)</Label>
                <Textarea
                  placeholder="Add any specific details or questions..."
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Expected Response By</Label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={
                    expectedResponseDate
                      ? expectedResponseDate.toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    setExpectedResponseDate(new Date(e.target.value))
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* Preview step */}
          <TabsContent value="preview" className="space-y-4">
            <EmailPreview
              subject={previewSubject}
              body={previewBody}
              expectedResponseBy={expectedResponseDate}
              editable={false}
            />
          </TabsContent>

          {/* Edit step */}
          <TabsContent value="edit" className="space-y-4">
            <EmailPreview
              subject={previewSubject}
              body={previewBody}
              expectedResponseBy={expectedResponseDate}
              onSubjectChange={setPreviewSubject}
              onBodyChange={setPreviewBody}
              onExpectedResponseByChange={setExpectedResponseDate}
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
          {step === "compose" && (
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

          {step === "preview" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("edit")}
              >
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

          {step === "edit" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("preview")}
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
