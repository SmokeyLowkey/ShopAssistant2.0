import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, AlertTriangle, CheckCircle, Edit, ArrowRight } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";

interface EmailEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailData: any;
  onSave: (editedEmail: any) => void;
}

export function EmailEditorModal({
  open,
  onOpenChange,
  emailData,
  onSave
}: EmailEditorModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [activeTab, setActiveTab] = useState<'html' | 'text'>('text');
  const [loading, setLoading] = useState(false);
  const [syncContent, setSyncContent] = useState(true);
  
  // Initialize form with email data
  useEffect(() => {
    console.log("EmailEditorModal - useEffect triggered:", { open, emailData });
    
    if (open && emailData) {
      console.log("EmailEditorModal - Initializing form with email data");
      
      if (emailData.email) {
        console.log("EmailEditorModal - Using emailData.email:", emailData.email);
        setSubject(emailData.email.subject || "");
        setBody(emailData.email.body || "");
        setBodyHtml(emailData.email.bodyHtml || "");
      } else if (emailData.message) {
        console.log("EmailEditorModal - Using emailData.message:", emailData.message);
        setSubject(emailData.message.subject || "");
        setBody(emailData.message.body || "");
        setBodyHtml(emailData.message.bodyHtml || "");
      }
    }
  }, [open, emailData]);
  
  const handleSave = () => {
    console.log("EmailEditorModal - handleSave called");
    setLoading(true);
    
    try {
      // Create a copy of the email data with updated content
      const updatedEmailData = { ...emailData };
      console.log("EmailEditorModal - Original emailData:", emailData);
      
      if (updatedEmailData.email) {
        console.log("EmailEditorModal - Updating email content");
        updatedEmailData.email.subject = subject;
        updatedEmailData.email.body = body;
        updatedEmailData.email.bodyHtml = bodyHtml;
      } else if (updatedEmailData.message) {
        console.log("EmailEditorModal - Updating message content");
        updatedEmailData.message.subject = subject;
        updatedEmailData.message.body = body;
        updatedEmailData.message.bodyHtml = bodyHtml;
      }
      
      console.log("EmailEditorModal - Updated emailData:", updatedEmailData);
      onSave(updatedEmailData);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving email:", error);
      toast({
        title: "Error",
        description: "Failed to save email changes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        console.log("EmailEditorModal - Dialog onOpenChange:", newOpen);
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Email</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>
          
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'html' | 'text')}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="text">Plain Text</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
            </TabsList>
            
            <TabsContent value="text" className="space-y-2">
              <Label htmlFor="body">Message Body (Plain Text)</Label>
              <div className="space-y-2">
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => {
                    const newText = e.target.value;
                    setBody(newText);
                    
                    // Always update HTML content to match text content regardless of checkbox state
                    // Convert plain text to HTML by replacing newlines with <br> and preserving paragraphs
                    let htmlContent = newText
                      .replace(/\n\n/g, '</p><p>')
                      .replace(/\n/g, '<br>');
                    
                    // Ensure the THIS IS A TEST markers are preserved in both versions
                    setBodyHtml(`<p>${htmlContent}</p>`);
                    
                    console.log("Text updated, HTML synchronized");
                  }}
                  placeholder="Email body in plain text"
                  rows={12}
                />
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="syncContent"
                    checked={true}
                    onChange={() => {/* Always keep checked */}}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={true}
                  />
                  <label htmlFor="syncContent" className="text-sm text-gray-600 font-medium">
                    Synchronize HTML (Always enabled)
                  </label>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="html" className="space-y-2">
              <Label htmlFor="bodyHtml">Message Body (HTML)</Label>
              <div className="space-y-2">
                <Textarea
                  id="bodyHtml"
                  value={bodyHtml}
                  onChange={(e) => {
                    const newHtml = e.target.value;
                    setBodyHtml(newHtml);
                    
                    // Always update text content based on HTML regardless of checkbox state
                    // Convert HTML to plain text by removing HTML tags and preserving basic structure
                    const textContent = newHtml
                      .replace(/<br\s*\/?>/gi, '\n')
                      .replace(/<\/p>\s*<p>/gi, '\n\n')
                      .replace(/<[^>]*>/g, '')
                      .replace(/&nbsp;/g, ' ')
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&amp;/g, '&');
                    
                    setBody(textContent);
                    console.log("HTML updated, text synchronized");
                  }}
                  placeholder="Email body in HTML format"
                  rows={12}
                />
              </div>
              
              <div className="border rounded-md p-4 mt-4">
                <h3 className="text-sm font-medium mb-2">HTML Preview</h3>
                <div 
                  className="email-preview-html border p-4 rounded-md bg-white" 
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}