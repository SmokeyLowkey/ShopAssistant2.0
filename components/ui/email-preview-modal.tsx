import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";
import { useState, useEffect } from "react";
import { EmailEditorModal } from "@/components/ui/email-editor-modal";

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: any;
  webhookResponse?: any; // New prop for webhook response
  onApprove?: () => void;
  onRevise?: () => void;
  onEdit?: (editedEmail: any) => void; // New prop for handling edited email
  showApprovalButtons?: boolean;
}

export function EmailPreviewModal({
  open,
  onOpenChange,
  message,
  webhookResponse,
  onApprove,
  onRevise,
  onEdit,
  showApprovalButtons = false
}: EmailPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'html' | 'text'>('html');
  const [showEditor, setShowEditor] = useState(false);
  
  // Use webhook response if available, otherwise use message
  const emailContent = webhookResponse?.email || message;
  const metadata = webhookResponse?.metadata;
  const actions = webhookResponse?.actions;
  
  if (!emailContent) return null;
  
  // Log the email content for debugging
  console.log("EmailPreviewModal - Email Content:", emailContent);
  console.log("EmailPreviewModal - Webhook Response:", webhookResponse);
  
  const handleEditClick = () => {
    console.log("EmailPreviewModal - Edit button clicked");
    // Always call onRevise if available, since EmailPreviewModalWithEditor
    // passes its handleEditClick function as onRevise
    if (onRevise) {
      console.log("EmailPreviewModal - Calling onRevise");
      onRevise();
    } else if (onEdit) {
      // This branch is for backward compatibility
      setShowEditor(true);
    }
  };
  
  const handleSaveEdit = (editedEmail: any) => {
    console.log("EmailPreviewModal - Save edit:", editedEmail);
    if (onEdit) {
      onEdit(editedEmail);
      setShowEditor(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email Preview</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Email metadata */}
          <div className="bg-slate-50 p-4 rounded-md space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Subject:</span>
              <span>{emailContent.subject}</span>
            </div>
            {!webhookResponse && (
              <>
                <div className="flex justify-between">
                  <span className="font-medium">From:</span>
                  <span>{emailContent.from}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">To:</span>
                  <span>{emailContent.to}</span>
                </div>
              </>
            )}
            {webhookResponse && metadata && (
              <>
                {metadata.supplier && (
                  <>
                    <div className="flex justify-between">
                      <span className="font-medium">To:</span>
                      <span>{metadata.supplier.email}</span>
                    </div>
                    {metadata.supplier.auxiliaryEmails && metadata.supplier.auxiliaryEmails.length > 0 && (
                      <div className="flex justify-between">
                        <span className="font-medium">CC:</span>
                        <span>{metadata.supplier.auxiliaryEmails.join(", ")}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between">
                  <span className="font-medium">Follow-up Reason:</span>
                  <span>{metadata.followUpReason || 'N/A'}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="font-medium">Date:</span>
              <span>
                {webhookResponse
                  ? (metadata?.generatedAt ? formatDate(metadata.generatedAt) : "N/A")
                  : (emailContent.sentAt ? formatDate(emailContent.sentAt) : emailContent.receivedAt ? formatDate(emailContent.receivedAt) : "N/A")}
              </span>
            </div>
            {emailContent.expectedResponseBy && (
              <div className="flex justify-between">
                <span className="font-medium">Expected Response By:</span>
                <span>{formatDate(emailContent.expectedResponseBy)}</span>
              </div>
            )}
          </div>
          
          {/* Content tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'html' | 'text')}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="html">HTML View</TabsTrigger>
              <TabsTrigger value="text">Text View</TabsTrigger>
            </TabsList>
            
            <TabsContent value="html" className="border rounded-md p-4 min-h-[300px] bg-white">
              {emailContent.bodyHtml ? (
                <div
                  className="email-preview-html"
                  dangerouslySetInnerHTML={{ __html: emailContent.bodyHtml }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No HTML content available
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="text" className="border rounded-md p-4 min-h-[300px] bg-white">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {emailContent.body || "No text content available"}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {showApprovalButtons && (
            <>
              <Button
                variant="outline"
                onClick={handleEditClick}
                className="bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
              >
                {webhookResponse && actions?.edit?.label ? actions.edit.label : "Edit Email"}
              </Button>
              <Button
                onClick={onApprove}
                className="bg-green-600 hover:bg-green-700"
              >
                {webhookResponse && actions?.approve?.label ? actions.approve.label : "Approve & Send"}
              </Button>
            </>
          )}
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Render the EmailEditorModal outside the main component to avoid nesting dialogs
export function EmailPreviewModalWithEditor(props: EmailPreviewModalProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [emailData, setEmailData] = useState<any>(null);
  
  // Initialize email data when props change
  useEffect(() => {
    console.log("EmailPreviewModalWithEditor - Props changed:", {
      webhookResponse: props.webhookResponse,
      message: props.message
    });
    
    if (props.webhookResponse || props.message) {
      const newEmailData = props.webhookResponse || { message: props.message };
      console.log("EmailPreviewModalWithEditor - Setting email data:", newEmailData);
      setEmailData(newEmailData);
    }
  }, [props.webhookResponse, props.message]);
  
  const handleEditClick = () => {
    console.log("EmailPreviewModalWithEditor - Edit button clicked, current email data:", emailData);
    // Email data should already be set from the useEffect
    setShowEditor(true);
  };
  
  const handleSaveEdit = (editedEmail: any) => {
    console.log("EmailPreviewModalWithEditor - Save edit:", editedEmail);
    if (props.onEdit) {
      props.onEdit(editedEmail);
    }
    setShowEditor(false);
  };
  
  return (
    <>
      <EmailPreviewModal
        {...props}
        onRevise={props.onEdit ? handleEditClick : props.onRevise}
        onOpenChange={(open) => {
          console.log("EmailPreviewModalWithEditor - Modal open change:", open);
          // If closing the modal, don't reset the state
          if (open === false && props.onEdit) {
            console.log("EmailPreviewModalWithEditor - Closing modal but keeping state");
            // Just hide the modal but keep the state
            props.onOpenChange(open);
          } else {
            props.onOpenChange(open);
          }
        }}
      />
      
      {showEditor && (
        <EmailEditorModal
          open={showEditor}
          onOpenChange={setShowEditor}
          emailData={emailData}
          onSave={handleSaveEdit}
        />
      )}
    </>
  );
}