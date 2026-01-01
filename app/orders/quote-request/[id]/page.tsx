"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  getQuoteRequest,
  convertQuoteRequestToOrder,
  updateQuoteRequest,
  generateFollowUpPreview,
  sendFollowUpEmail,
  getN8nResponses,
  refreshPrices,
  sendQuoteRequestEmail,
  deleteQuoteRequest,
  syncQuoteRequestThreads,
  updateThreadStatuses
} from "@/lib/api/quote-requests"
import { saveEditedEmail, getLatestEditedEmail, deleteEditedEmail } from "@/lib/api/edited-emails"
import { QuoteStatus } from "@prisma/client"
import {
  ArrowLeft,
  Package,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Edit,
  ShoppingCart,
  Mail,
  Clock,
  Building,
  User,
  Truck,
  Car,
  X,
  Trash2,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"
import { FollowUpAlert } from "@/components/ui/follow-up-alert"
import { AppLayout } from "@/components/layout/app-layout"
import { FollowUpModal } from "@/components/ui/follow-up-modal"
import { FollowUpStatus } from "@/components/ui/follow-up-status"
import { CommunicationTimeline } from "@/components/ui/communication-timeline"
import { EmailPreviewModalWithEditor } from "@/components/ui/email-preview-modal"
import { SupplierResponseTabs } from "@/components/quote-request/supplier-response-tabs"
import { PriceComparisonTable } from "@/components/quote-request/price-comparison"
import { AcceptQuoteConfirmationDialog } from "@/components/quote-request/accept-quote-confirmation-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function ViewQuoteRequestPage() {
  const router = useRouter()
  const params = useParams()
  const quoteRequestId = params.id as string
  
  const [quoteRequest, setQuoteRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [previewMessageId, setPreviewMessageId] = useState<string | null>(null)
  const [previewEmailData, setPreviewEmailData] = useState<any>(null)
  const [webhookResponse, setWebhookResponse] = useState<any>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [editedEmailContent, setEditedEmailContent] = useState<any>(null)
  const [n8nResponse, setN8nResponse] = useState<any>(null)
  const [isLoadingN8nResponse, setIsLoadingN8nResponse] = useState(false)
  const [showAcceptConfirmation, setShowAcceptConfirmation] = useState(false)
  const [acceptConfirmationData, setAcceptConfirmationData] = useState<{
    supplier: any;
    quoteItems: any[];
    quotedTotal: number;
    otherSuppliersCount: number;
    supplierId: string;
    threadId: string;
  } | null>(null)
  const [isConvertingToOrder, setIsConvertingToOrder] = useState(false)
  const [lastGeneratedFollowUp, setLastGeneratedFollowUp] = useState<{
    messageId: string;
    reason: string;
    workflowBranch: "no_response" | "needs_revision" | "accept_quote";
    response: any;
  } | null>(null)
  const [additionalSuppliers, setAdditionalSuppliers] = useState<any[]>([])
  const [autoSyncStatus, setAutoSyncStatus] = useState<string | null>(null)
  const autoSyncTimeoutsRef = useRef<NodeJS.Timeout[]>([])
  
  // Fetch quote request data
  useEffect(() => {
    const fetchQuoteRequest = async () => {
      try {
        setLoading(true)
        const response = await getQuoteRequest(quoteRequestId)
        console.log('Quote request data:', {
          hasEmailThreads: !!response.data.emailThreads,
          emailThreadsCount: response.data.emailThreads?.length || 0,
          hasEmailThread: !!response.data.emailThread,
          emailThreadCount: response.data.emailThread?.length || 0,
        })
        setQuoteRequest(response.data)
        
        // Auto-update thread statuses based on message direction
        if (response.data.emailThreads && response.data.emailThreads.length > 0) {
          console.log('[Page Load] Auto-updating thread statuses...');
          try {
            const statusUpdate = await updateThreadStatuses(quoteRequestId);
            if (statusUpdate.updated > 0) {
              console.log('[Page Load] Updated', statusUpdate.updated, 'thread statuses, refreshing...');
              // Refresh the quote request to show updated statuses
              const refreshedResponse = await getQuoteRequest(quoteRequestId);
              setQuoteRequest(refreshedResponse.data);
            }
          } catch (error) {
            console.error('[Page Load] Error auto-updating thread statuses:', error);
          }
        }
        
        // Fetch additional suppliers if they exist
        if ((response.data as any).additionalSupplierIds) {
          const supplierIds = (response.data as any).additionalSupplierIds.split(',').filter((id: string) => id.trim())
          if (supplierIds.length > 0) {
            const { getSuppliers } = await import('@/lib/api/suppliers')
            const suppliersResponse = await getSuppliers()
            const additionalSuppliersData = suppliersResponse.data.filter((s: any) => 
              supplierIds.includes(s.id)
            )
            setAdditionalSuppliers(additionalSuppliersData)
          }
        }
        
        setError(null)
      } catch (err) {
        console.error("Error fetching quote request:", err)
        setError("Failed to load quote request. Please try again later.")
      } finally {
        setLoading(false)
      }
    }
    
    if (quoteRequestId) {
      fetchQuoteRequest()
    }
  }, [quoteRequestId])
  
  // Handle convert to order
  const handleConvertToOrder = async () => {
    try {
      setIsConverting(true)
      const response = await convertQuoteRequestToOrder(quoteRequestId)
      
      toast({
        title: "Quote Request Converted",
        description: "Successfully converted to order.",
      })
      
      // Redirect to the new order
      router.push(`/orders/${response.data.orderId}`)
    } catch (error) {
      console.error("Error converting quote request to order:", error)
      toast({
        title: "Error",
        description: "Failed to convert quote request to order. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsConverting(false)
    }
  }
  
  // Handle delete quote request
  const handleDeleteQuoteRequest = async () => {
    try {
      setIsDeleting(true)
      
      await deleteQuoteRequest(quoteRequestId)
      
      toast({
        title: "Quote Request Deleted",
        description: "The quote request has been permanently deleted.",
      })
      
      // Redirect to orders page
      router.push("/orders")
    } catch (error: any) {
      console.error("Error deleting quote request:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to delete quote request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }
  
  // Handle sync email threads
  const handleSyncThreads = async (isAutoSync = false, forceResync = false) => {
    try {
      setIsSyncing(true)
      if (isAutoSync) {
        setAutoSyncStatus("Syncing email threads...")
      }

      const response = await syncQuoteRequestThreads(quoteRequestId, forceResync)

      if (response.data.summary.linked > 0 || response.data.summary.alreadyLinked > 0) {
        toast({
          title: isAutoSync ? "Auto-Sync Complete" : forceResync ? "Email Threads Re-synced" : "Email Threads Synced",
          description: `Linked ${response.data.summary.linked} threads${forceResync ? ' (forced re-sync)' : ''}, ${response.data.summary.alreadyLinked} already linked.`,
        })
        
        // Refresh the quote request to show updated threads
        const updatedQuote = await getQuoteRequest(quoteRequestId)
        setQuoteRequest(updatedQuote.data)
        setAutoSyncStatus(null)
        
        // Clear any pending auto-sync timeouts
        autoSyncTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
        autoSyncTimeoutsRef.current = []
        
        return true // Sync successful
      }
      
      return false // No threads found yet
    } catch (error) {
      console.error("Error syncing email threads:", error)
      if (!isAutoSync) {
        toast({
          title: "Error",
          description: "Failed to sync email threads. Please try again.",
          variant: "destructive",
        })
      }
      return false
    } finally {
      setIsSyncing(false)
    }
  }
  
  // Auto-sync email threads after sending
  const startAutoSync = (supplierCount: number) => {
    // Clear any existing timeouts
    autoSyncTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
    autoSyncTimeoutsRef.current = []
    
    setAutoSyncStatus(`Waiting for email threads to be created (checking in 15s)...`)
    
    // Retry intervals: 15s, 30s, 45s, 60s, 90s, 120s
    const retryIntervals = [15000, 30000, 45000, 60000, 90000, 120000]
    const maxRetries = Math.min(retryIntervals.length, Math.ceil(supplierCount * 2)) // More retries for more suppliers
    
    retryIntervals.slice(0, maxRetries).forEach((delay, index) => {
      const timeout = setTimeout(async () => {
        console.log(`Auto-sync attempt ${index + 1}/${maxRetries} after ${delay}ms`)
        setAutoSyncStatus(`Checking for email threads (attempt ${index + 1}/${maxRetries})...`)
        
        const success = await handleSyncThreads(true)
        
        if (!success && index === maxRetries - 1) {
          // Last retry failed
          setAutoSyncStatus(null)
          toast({
            title: "Auto-Sync Incomplete",
            description: "Email threads are still being created. Use the manual sync button when ready.",
            variant: "default",
          })
        }
      }, delay)
      
      autoSyncTimeoutsRef.current.push(timeout)
    })
  }
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      autoSyncTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
    }
  }, [])
  
  // Handle send to supplier
  const handleSendToSupplier = async () => {
    try {
      setIsSendingEmail(true)
      
      // Validate that quote has required fields
      if (!quoteRequest.vehicleId) {
        toast({
          title: "Missing Vehicle",
          description: "Please assign a vehicle to this quote request before sending.",
          variant: "destructive",
        })
        router.push(`/orders/quote-request/${quoteRequestId}/edit`)
        return
      }
      
      if (!quoteRequest.items || quoteRequest.items.length === 0) {
        toast({
          title: "No Items",
          description: "Please add at least one item to the quote request before sending.",
          variant: "destructive",
        })
        router.push(`/orders/quote-request/${quoteRequestId}/edit`)
        return
      }
      
      if (!quoteRequest.supplier.email) {
        toast({
          title: "No Supplier Email",
          description: "This supplier doesn't have an email address. Please update the supplier information.",
          variant: "destructive",
        })
        return
      }
      
      console.log(`Sending quote request ${quoteRequestId} to suppliers...`)
      
      // Send the email to all suppliers
      const response = await sendQuoteRequestEmail(quoteRequestId)
      
      if (response && response.totalSent > 0) {
        const supplierCount = response.totalSent
        const hasErrors = response.totalFailed > 0
        
        toast({
          title: "Quote Request Sent",
          description: hasErrors
            ? `Sent to ${supplierCount} supplier(s). ${response.totalFailed} failed.`
            : `Successfully sent quote request to ${supplierCount} supplier(s). Auto-syncing email threads...`,
          variant: hasErrors ? "destructive" : "default",
        })
        
        // Refresh the quote request to get updated status
        const updatedQuote = await getQuoteRequest(quoteRequestId)
        setQuoteRequest(updatedQuote.data)
        
        // Start auto-sync process
        startAutoSync(supplierCount)
      } else {
        toast({
          title: "Failed to Send",
          description: "No emails were sent. Please check supplier email addresses.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error sending quote request:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to send quote request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSendingEmail(false)
    }
  }
  
  // Handle follow-up button click
  const handleFollowUpClick = (messageId: string) => {
    setSelectedMessageId(messageId)
    setFollowUpModalOpen(true)
  }
  
  // Handle follow-up sent
  const handleFollowUpSent = async () => {
    // Refresh the quote request data
    try {
      console.log("handleFollowUpSent - Refreshing quote request data");
      setLoading(true)
      const response = await getQuoteRequest(quoteRequestId)
      console.log("handleFollowUpSent - Quote request data received:", response.data.status);
      setQuoteRequest(response.data)
      setError(null)
      console.log("handleFollowUpSent - Quote request data updated in state");
      return response; // Return the response for chaining
    } catch (err) {
      console.error("Error refreshing quote request:", err)
      throw err; // Re-throw the error for proper error handling
    } finally {
      setLoading(false)
    }
  }
  
  // Helper function to check if there are any inbound messages
  const hasInboundMessages = () => {
    if (!quoteRequest?.emailThread?.messages) return false
    
    return quoteRequest.emailThread.messages.some((message: any) =>
      message.direction === 'INBOUND' && message.receivedAt
    )
  }
  
  // Helper function to get the most recent outbound message ID
  const getMostRecentOutboundMessageId = () => {
    if (!quoteRequest?.emailThread?.messages) return null
    
    const outboundMessages = quoteRequest.emailThread.messages
      .filter((message: any) => message.direction === 'OUTBOUND')
      .sort((a: any, b: any) => {
        const dateA = new Date(a.sentAt || a.createdAt)
        const dateB = new Date(b.sentAt || b.createdAt)
        return dateB.getTime() - dateA.getTime()
      })
    
    return outboundMessages.length > 0 ? outboundMessages[0].id : null
  }
  
  // Handle needs revision button click
  const handleNeedsRevisionClick = () => {
    const messageId = getMostRecentOutboundMessageId()
    if (messageId) {
      setSelectedMessageId(messageId)
      setFollowUpModalOpen(true)
    } else {
      toast({
        title: "Error",
        description: "No outbound message found to follow up on.",
        variant: "destructive",
      })
    }
  }
  
  // Handle preview email button click
  const handlePreviewEmail = async (messageId: string) => {
    // Search in emailThreads (multi-supplier junction table)
    if (quoteRequest?.emailThreads && quoteRequest.emailThreads.length > 0) {
      for (const threadData of quoteRequest.emailThreads) {
        const message = threadData.emailThread.messages.find((m: any) => m.id === messageId);
        if (message) {
          setPreviewMessageId(messageId);
          setShowEmailPreview(true);
          return;
        }
      }
    }
    
    // Fallback: search in legacy emailThread (direct relation)
    if (quoteRequest?.emailThread?.messages) {
      const message = quoteRequest.emailThread.messages.find((m: any) => m.id === messageId);
      if (message) {
        setPreviewMessageId(messageId);
        setShowEmailPreview(true);
        return;
      }
    }
  }
  
  // Helper function to find a message by ID across all email threads
  const findMessageById = (messageId: string) => {
    // Search in emailThreads (multi-supplier junction table)
    if (quoteRequest?.emailThreads && quoteRequest.emailThreads.length > 0) {
      for (const threadData of quoteRequest.emailThreads) {
        const message = threadData.emailThread.messages.find((m: any) => m.id === messageId);
        if (message) return message;
      }
    }
    
    // Fallback: search in legacy emailThread (direct relation)
    if (quoteRequest?.emailThread?.messages) {
      return quoteRequest.emailThread.messages.find((m: any) => m.id === messageId);
    }
    
    return null;
  }

  // Handle follow-up preview
  const handleFollowUpPreview = async (messageId: string, reason: string = "No response received by expected date", workflowBranch: "no_response" | "needs_revision" | "accept_quote" = "no_response", additionalMessage?: string, supplierId?: string) => {
    try {
      // Force workflowBranch to "needs_revision" if the reason contains "revision"
      let actualWorkflowBranch = workflowBranch;
      if (reason.toLowerCase().includes('revision')) {
        console.log("handleFollowUpPreview - Forcing workflowBranch to needs_revision because reason contains 'revision'");
        actualWorkflowBranch = "needs_revision";
      }
      
      console.log("handleFollowUpPreview - Starting preview generation:", {
        messageId,
        reason,
        originalWorkflowBranch: workflowBranch,
        actualWorkflowBranch,
        supplierId
      });
      
      setIsPreviewLoading(true);
      
      // If we already have a generated follow-up for this message with the same reason and workflow branch,
      // use that instead of generating a new one
      if (lastGeneratedFollowUp &&
          lastGeneratedFollowUp.messageId === messageId &&
          lastGeneratedFollowUp.reason === reason &&
          lastGeneratedFollowUp.workflowBranch === workflowBranch) {
        
        console.log("handleFollowUpPreview - Using cached follow-up:", lastGeneratedFollowUp);
        
        if (Array.isArray(lastGeneratedFollowUp.response.data) && lastGeneratedFollowUp.response.data.length > 0) {
          setWebhookResponse(lastGeneratedFollowUp.response.data[0]);
          setPreviewEmailData(null);
        } else if (typeof lastGeneratedFollowUp.response.data === 'object' && 'metadata' in lastGeneratedFollowUp.response.data) {
          setWebhookResponse(lastGeneratedFollowUp.response.data);
          setPreviewEmailData(null);
        } else {
          // Use the cached response data
          const previewMessage = {
            id: 'preview',
            subject: lastGeneratedFollowUp.response.data.subject,
            body: lastGeneratedFollowUp.response.data.body,
            bodyHtml: lastGeneratedFollowUp.response.data.bodyHtml,
            from: quoteRequest.createdBy?.email || 'your-email@example.com',
            to: quoteRequest.supplier.email,
            direction: 'OUTBOUND',
            sentAt: new Date().toISOString()
          };
          
          setPreviewEmailData({
            message: previewMessage,
            originalMessageId: messageId,
            followUpReason: reason,
            workflowBranch: workflowBranch
          });
          setWebhookResponse(null);
        }
        
        setShowEmailPreview(true);
        setIsPreviewLoading(false);
        return;
      }
      
      // Generate a preview of the follow-up email
      console.log("handleFollowUpPreview - Generating new preview with additionalMessage:", additionalMessage || 'None');
      const response = await generateFollowUpPreview(quoteRequest.id, messageId, {
        followUpReason: reason,
        workflowBranch: actualWorkflowBranch,
        additionalMessage: additionalMessage,
        supplierId: supplierId
      });
      
      console.log("handleFollowUpPreview - Preview response:", response);
      console.log("handleFollowUpPreview - Response data type:", typeof response.data);
      console.log("handleFollowUpPreview - Response data keys:", response.data ? Object.keys(response.data) : 'null');
      console.log("handleFollowUpPreview - Has metadata?", response.data && 'metadata' in response.data);
      console.log("handleFollowUpPreview - Has email?", response.data && 'email' in response.data);
      
      // Save the generated follow-up for future use
      setLastGeneratedFollowUp({
        messageId,
        reason,
        workflowBranch: actualWorkflowBranch,
        response
      });
      
      console.log("handleFollowUpPreview - Saved to lastGeneratedFollowUp");
      
      // Check if the response has the expected structure from the webhook
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log("handleFollowUpPreview - Using array format");
        // This is the webhook response format
        setWebhookResponse(response.data[0]);
        setPreviewEmailData(null);
      } else if (response.data && typeof response.data === 'object' && 'metadata' in response.data && 'email' in response.data) {
        console.log("handleFollowUpPreview - Using webhook format with email and metadata");
        // This is the webhook response format (email and metadata at top level)
        setWebhookResponse(response.data);
        setPreviewEmailData(null);
      } else if (response.data && typeof response.data === 'object' && ('subject' in response.data || 'body' in response.data)) {
        console.log("handleFollowUpPreview - Using legacy flat format");
        // Legacy format with subject, body, bodyHtml directly in data
        const legacyData = response.data as any;
        const previewMessage = {
          id: 'preview',
          subject: legacyData.subject,
          body: legacyData.body,
          bodyHtml: legacyData.bodyHtml,
          from: quoteRequest.createdBy?.email || 'your-email@example.com',
          to: quoteRequest.supplier.email,
          direction: 'OUTBOUND',
          sentAt: new Date().toISOString()
        };
        
        setPreviewEmailData({
          message: previewMessage,
          originalMessageId: messageId,
          followUpReason: reason,
          workflowBranch: actualWorkflowBranch
        });
        setWebhookResponse(null);
      }
      
      setShowEmailPreview(true);
    } catch (error) {
      console.error("Error generating follow-up preview:", error);
      toast({
        title: "Error",
        description: "Failed to generate follow-up preview. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPreviewLoading(false);
    }
  }
  
  // Handle approve follow-up email
  const handleApproveFollowUp = async () => {
    try {
      setIsPreviewLoading(true);
      console.log("Starting handleApproveFollowUp");
      
      // Determine the email type and workflow branch
      let emailType = "follow_up_no_response";
      let followUpReason = "No response received";
      let workflowBranch: "no_response" | "needs_revision" | "accept_quote" = "no_response";

      if (editedEmailContent?.metadata?.followUpReason) {
        followUpReason = editedEmailContent.metadata.followUpReason;
        workflowBranch = editedEmailContent.metadata.workflowBranch || "no_response";
        if (followUpReason.toLowerCase().includes('revision')) {
          emailType = "follow_up_needs_revision";
          workflowBranch = "needs_revision";
        } else if (followUpReason.toLowerCase().includes('accept')) {
          emailType = "follow_up_accept_quote";
          workflowBranch = "accept_quote";
        }
      } else if (webhookResponse?.metadata?.followUpReason) {
        followUpReason = webhookResponse.metadata.followUpReason;
        if (followUpReason.toLowerCase().includes('revision')) {
          emailType = "follow_up_needs_revision";
          workflowBranch = "needs_revision";
        } else if (followUpReason.toLowerCase().includes('accept')) {
          emailType = "follow_up_accept_quote";
          workflowBranch = "accept_quote";
        }
      } else if (previewEmailData?.followUpReason) {
        followUpReason = previewEmailData.followUpReason;
        workflowBranch = previewEmailData.workflowBranch || "no_response";
        if (followUpReason.toLowerCase().includes('revision')) {
          emailType = "follow_up_needs_revision";
          workflowBranch = "needs_revision";
        } else if (followUpReason.toLowerCase().includes('accept')) {
          emailType = "follow_up_accept_quote";
          workflowBranch = "accept_quote";
        }
      }
      
      // If we have edited content, use that instead of the original webhook response
      let emailToSend = editedEmailContent || webhookResponse;
      
      // If we don't have edited content in memory, try to load it from the database
      if (!editedEmailContent && quoteRequest) {
        try {
          console.log("No edited content in memory, checking database for emailType:", emailType);
          const { getLatestEditedEmail } = await import("@/lib/api/edited-emails");
          const editedEmailResponse = await getLatestEditedEmail(quoteRequest.id, emailType);
          console.log("Edited email response from database:", editedEmailResponse);
          
          if (editedEmailResponse.data) {
            console.log("Found edited email in database:", editedEmailResponse.data);
            // Create a structure similar to editedEmailContent
            emailToSend = {
              email: {
                subject: editedEmailResponse.data.subject,
                body: editedEmailResponse.data.body,
                bodyHtml: editedEmailResponse.data.bodyHtml
              },
              metadata: webhookResponse?.metadata || {
                quoteRequestId: quoteRequest.id,
                followUpReason
              },
              actions: webhookResponse?.actions || {
                approve: {
                  payload: {
                    quoteRequestId: quoteRequest.id,
                    messageId: webhookResponse?.metadata?.messageId ||
                              (previewEmailData?.originalMessageId || ""),
                    action: "send",
                    followUpReason,
                    workflowBranch
                  }
                }
              }
            };
            
            console.log("Using edited email from database:", emailToSend);
          } else {
            console.log("No edited email found in database, using original content");
          }
        } catch (error) {
          console.error("Error loading edited email from database:", error);
          // Continue with the original email content
        }
      }
      
      if (emailToSend && emailToSend.email && emailToSend.metadata) {
        // We have email content and metadata (either from webhook or from database)
        console.log("Sending follow-up email with payload:", {
          quoteRequestId: quoteRequest.id,
          followUpReason,
          workflowBranch
        });

        // Create a simplified payload with only the required fields
        // No messageId as it will be generated by N8N
        const payload = {
          // Required fields for the webhook
          quoteRequestId: quoteRequest.id,
          action: "send",

          // Include workflowBranch separately (needed by N8N)
          workflowBranch: workflowBranch,

          // Store workflowBranch in the followUpReason field as well
          followUpReason: `${followUpReason} [${workflowBranch}]`,

          // Include supplier information from webhook metadata (supplier-specific)
          supplier: emailToSend.metadata?.supplier ? {
            id: emailToSend.metadata.supplier.id,
            name: emailToSend.metadata.supplier.name,
            email: emailToSend.metadata.supplier.email,
            auxiliaryEmails: emailToSend.metadata.supplier.auxiliaryEmails || []
          } : {
            id: quoteRequest.supplier.id,
            name: quoteRequest.supplier.name,
            email: quoteRequest.supplier.email,
            auxiliaryEmails: quoteRequest.supplier.auxiliaryEmails || []
          },

          // Pass supplierId to the API so backend can use the correct supplier
          supplierId: emailToSend.metadata?.supplier?.id,

          // Include the email content
          emailContent: emailToSend.email ? {
            subject: emailToSend.email.subject,
            body: emailToSend.email.body,
            bodyHtml: emailToSend.email.bodyHtml
          } : undefined
        };

        console.log("Modified payload for follow-up email:", payload);

        // Send the follow-up email with edited content if available
        // Use a dummy messageId since it's required by the API but will be ignored
        console.log("Sending email to webhook...");
        const response = await sendFollowUpEmail(quoteRequestId, "dummy-message-id", payload);

        console.log("Webhook triggered, waiting for email processing...");

        // Wait for the quote request data to be refreshed (webhook completion)
        console.log("Refreshing quote request data");
        await handleFollowUpSent();
        console.log("Quote request data refreshed successfully");

        // Delete the saved edited email now that it's been sent
        const supplierId = emailToSend.metadata?.supplier?.id;
        if (supplierId) {
          try {
            await deleteEditedEmail(quoteRequest.id, emailType, supplierId);
            console.log("Deleted saved edited email after successful send");
          } catch (error) {
            console.error("Error deleting edited email:", error);
            // Don't fail the whole operation if delete fails
          }
        }
      } else if (previewEmailData) {
        // Fallback to the old implementation
        console.log("Using fallback implementation with previewEmailData:", {
          quoteRequestId: quoteRequest.id,
          messageId: previewEmailData.originalMessageId,
          followUpReason: previewEmailData.followUpReason,
          workflowBranch: previewEmailData.workflowBranch
        });

        // Create a simplified payload with only the required fields
        // No messageId as it will be generated by N8N
        const payload = {
          // Required fields for the webhook
          quoteRequestId: quoteRequest.id,
          action: "send",

          // Include workflowBranch separately (needed by N8N)
          workflowBranch: previewEmailData.workflowBranch,

          // Store workflowBranch in the followUpReason field as well
          followUpReason: `${previewEmailData.followUpReason} [${previewEmailData.workflowBranch}]`,

          // Include supplier information
          supplier: {
            id: quoteRequest.supplier.id,
            name: quoteRequest.supplier.name,
            email: quoteRequest.supplier.email,
            auxiliaryEmails: quoteRequest.supplier.auxiliaryEmails || []
          },

          // Include the email content
          emailContent: emailToSend && emailToSend.email ? {
            subject: emailToSend.email.subject,
            body: emailToSend.email.body,
            bodyHtml: emailToSend.email.bodyHtml
          } : undefined
        };

        console.log("Modified payload for follow-up email (fallback):", payload);

        // Use a dummy messageId since it's required by the API but will be ignored
        console.log("Sending email to webhook (fallback)...");
        const response = await sendFollowUpEmail(quoteRequest.id, "dummy-message-id", payload);

        console.log("Webhook triggered (fallback), waiting for email processing...");

        // Wait for the quote request data to be refreshed (webhook completion)
        console.log("Refreshing quote request data");
        await handleFollowUpSent();
        console.log("Quote request data refreshed successfully");
      } else {
        throw new Error("No email data available");
      }

      // Show success toast only after webhook completes
      toast({
        title: "Follow-up email sent",
        description: "The supplier has been notified."
      });

      console.log("Closing email preview");
      setShowEmailPreview(false);
      setWebhookResponse(null);
      setEditedEmailContent(null);
    } catch (error) {
      console.error("Error sending follow-up email:", error);
      toast({
        title: "Error",
        description: "Failed to send follow-up email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPreviewLoading(false);
    }
  }
  
  // Handle revise follow-up email
  const handleReviseFollowUp = () => {
    // Just hide the preview modal, but keep the state
    setShowEmailPreview(false);
    
    // Open the follow-up modal with the same data
    if (webhookResponse && webhookResponse.metadata) {
      setSelectedMessageId(webhookResponse.metadata.messageId);
      setFollowUpModalOpen(true);
    } else if (previewEmailData) {
      setSelectedMessageId(previewEmailData.originalMessageId);
      setFollowUpModalOpen(true);
    }
  }
  
  // Handle edit email content
  const handleEditEmail = async (editedEmail: any) => {
    try {
      console.log("handleEditEmail called with:", editedEmail);
      setEditedEmailContent(editedEmail);

      // Extract email content from either editedEmail.email or editedEmail.message
      const emailData = editedEmail.email || editedEmail.message;

      // Save the edited email to the database
      if (quoteRequest && emailData) {
        // When saving edited emails, always use 'follow_up_needs_revision' as the email type
        // This ensures that edits are always treated as revision requests
        const emailType = "follow_up_needs_revision";
        const workflowBranch = "needs_revision";

        console.log("Saving edited email to database with type:", emailType, "and workflowBranch:", workflowBranch);

        // Extract the email content from the editedEmail object
        const emailContent = {
          subject: emailData.subject,
          body: emailData.body,
          bodyHtml: emailData.bodyHtml
        };

        // Get supplierId from metadata if available (for multi-supplier quotes)
        const supplierId = webhookResponse?.metadata?.supplier?.id || editedEmail.metadata?.supplier?.id;

        console.log("Email content to save:", emailContent, "for supplier:", supplierId);

        // Save the edited email to the database with supplier ID
        const saveResponse = await saveEditedEmail(
          quoteRequest.id,
          emailType,
          emailContent,
          supplierId
        );
        
        console.log("Saved edited email to database:", saveResponse);
        
        // Update the editedEmailContent state with the correct structure
        setEditedEmailContent({
          email: emailContent,
          metadata: {
            quoteRequestId: quoteRequest.id,
            followUpReason: emailType,
            workflowBranch: workflowBranch
          },
          actions: webhookResponse?.actions || {
            approve: {
              label: "Approve & Send",
              payload: {
                quoteRequestId: quoteRequest.id,
                messageId: "dummy-message-id",
                action: "send",
                followUpReason: emailType,
                workflowBranch: workflowBranch
              }
            }
          }
        });
        
        toast({
          title: "Email saved",
          description: "Your edited email has been saved to the database.",
        });
      } else {
        console.error("Cannot save edited email: quoteRequest or email data is missing", {
          hasQuoteRequest: !!quoteRequest,
          hasEmailData: !!emailData,
          editedEmail
        });
        toast({
          title: "Error",
          description: "Failed to save edited email: missing required data.",
          variant: "destructive",
        });
      }
      
      // Keep the preview modal open but now with edited content
      setShowEmailPreview(true);
    } catch (error) {
      console.error("Error saving edited email:", error);
      toast({
        title: "Error",
        description: "Failed to save edited email. Please try again.",
        variant: "destructive",
      });
    }
  }
  
  // Handle refresh prices
  const handleRefreshPrices = async (supplierId?: string) => {
    try {
      setIsRefreshingPrices(true);
      console.log("Refreshing prices for quote request:", quoteRequestId, "Supplier:", supplierId);
      
      const response = await refreshPrices(quoteRequestId, supplierId);
      
      if (response.success) {
        console.log("Prices refreshed successfully:", response);
        
        // Update the quote request data with the new prices
        setQuoteRequest(response.quoteRequest);
        
        toast({
          title: "Prices Updated",
          description: supplierId 
            ? "Prices refreshed for selected supplier."
            : "Quote item prices have been refreshed successfully.",
        });
      } else {
        console.error("Error refreshing prices:", response);
        toast({
          title: "Error",
          description: response.message || "Failed to refresh prices. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error refreshing prices:", error);
      toast({
        title: "Error",
        description: "Failed to refresh prices. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingPrices(false);
    }
  };
  
  // Handle accept quote from specific supplier - opens confirmation dialog
  const handleAcceptSupplierQuote = async (supplierId: string, threadId: string) => {
    // Find supplier thread
    const supplierThread = quoteRequest.emailThreads.find(
      (t: any) => t.supplierId === supplierId
    );

    if (!supplierThread) {
      toast({
        title: "Error",
        description: "Supplier thread not found.",
        variant: "destructive",
      });
      return;
    }

    // Get supplier-specific items and calculate total
    const supplierItems = quoteRequest.items.filter(
      (item: any) => item.supplierId === supplierId
    );
    const quotedTotal = supplierItems.reduce(
      (sum: number, item: any) => sum + (Number(item.totalPrice) || 0),
      0
    );

    // Count other suppliers for warning
    const otherSuppliersCount = quoteRequest.emailThreads.filter(
      (t: any) => t.supplierId !== supplierId
    ).length;

    // Open confirmation dialog
    setAcceptConfirmationData({
      supplier: supplierThread.supplier,
      quoteItems: supplierItems,
      quotedTotal,
      otherSuppliersCount,
      supplierId,
      threadId,
    });
    setShowAcceptConfirmation(true);
  };

  // Execute accept with auto-convert after confirmation
  const handleConfirmAcceptQuote = async () => {
    if (!acceptConfirmationData) return;

    const { supplierId, threadId } = acceptConfirmationData;

    try {
      setIsConvertingToOrder(true);

      // 1. Update quote status to APPROVED
      await updateQuoteRequest(quoteRequestId, {
        status: QuoteStatus.APPROVED,
        selectedSupplierId: supplierId,
      });

      // 2. Update all thread statuses
      await Promise.all(
        quoteRequest.emailThreads.map(async (thread: any) => {
          const newStatus = thread.supplierId === supplierId ? 'ACCEPTED' : 'NOT_SELECTED';

          return fetch(`/api/quote-requests/${quoteRequestId}/link-email-thread`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              emailThreadId: thread.emailThreadId,
              supplierId: thread.supplierId,
              status: newStatus,
            }),
          });
        })
      );

      // 3. AUTO-CONVERT to order
      console.log('Converting quote to order with supplier:', supplierId);
      const orderResponse = await convertQuoteRequestToOrder(quoteRequestId, {
        selectedSupplierId: supplierId,
      });

      console.log('Order response:', orderResponse);

      // Validate response
      if (!orderResponse?.data?.orderId) {
        throw new Error('Invalid order response: missing orderId');
      }

      // 4. Success feedback
      setShowAcceptConfirmation(false);
      toast({
        title: "Quote Accepted & Order Created",
        description: `Successfully created order ${orderResponse.data.orderNumber}`,
      });

      // 5. Redirect to new order
      console.log('Redirecting to order:', orderResponse.data.orderId);
      router.push(`/orders/${orderResponse.data.orderId}`);
    } catch (error) {
      console.error("Error accepting quote:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));

      // ROLLBACK on failure
      try {
        await updateQuoteRequest(quoteRequestId, {
          status: QuoteStatus.UNDER_REVIEW,
          selectedSupplierId: undefined,
        });

        await Promise.all(
          quoteRequest.emailThreads.map(async (thread: any) => {
            return fetch(`/api/quote-requests/${quoteRequestId}/link-email-thread`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                emailThreadId: thread.emailThreadId,
                supplierId: thread.supplierId,
                status: 'RESPONDED',
              }),
            });
          })
        );
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }

      toast({
        title: "Error Creating Order",
        description: "Failed to accept quote and create order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConvertingToOrder(false);
    }
  };

  // Handle reject quote from specific supplier
  const handleRejectSupplierQuote = async (supplierId: string, threadId: string) => {
    try {
      // Update the thread status to REJECTED
      await fetch(`/api/quote-requests/${quoteRequestId}/link-email-thread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailThreadId: threadId,
          supplierId: supplierId,
          status: 'REJECTED',
        }),
      });

      // Check if ALL suppliers have been rejected
      const allThreads = quoteRequest.emailThreads;
      const rejectedCount = allThreads.filter(
        (t: any) => t.status === 'REJECTED' || t.supplierId === supplierId
      ).length;
      const allRejected = rejectedCount === allThreads.length;

      // Update overall quote status if all rejected
      if (allRejected) {
        await updateQuoteRequest(quoteRequestId, {
          status: QuoteStatus.REJECTED,
        });

        toast({
          title: "All Suppliers Declined",
          description: "You can re-open this quote request to send to new suppliers or request revisions.",
          variant: "default",
        });
      } else {
        const supplierName = quoteRequest.emailThreads.find(
          (t: any) => t.supplierId === supplierId
        )?.supplier.name;
        toast({
          title: "Quote Rejected",
          description: `Quote from ${supplierName} has been rejected.`,
        });
      }

      // Refresh the quote request data
      await handleFollowUpSent();
    } catch (error) {
      console.error("Error rejecting quote:", error);
      toast({
        title: "Error",
        description: "Failed to reject quote. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Handle request revision from specific supplier
  const handleRequestRevision = async (supplierId: string, threadId: string) => {
    console.log('[handleRequestRevision] Called with:', { supplierId, threadId });
    console.log('[handleRequestRevision] Available emailThreads:', quoteRequest.emailThreads);

    // Clear any previous webhook response or edited email content to avoid conflicts
    setWebhookResponse(null);
    setEditedEmailContent(null);

    try {
      // First, check if there's an existing edited email for this supplier
      console.log('[handleRequestRevision] Checking for existing edited email with params:', {
        quoteRequestId: quoteRequest.id,
        emailType: 'follow_up_needs_revision',
        supplierId: supplierId
      });

      try {
        const existingEmail = await getLatestEditedEmail(
          quoteRequest.id,
          'follow_up_needs_revision',
          supplierId
        );

        console.log('[handleRequestRevision] API response:', existingEmail);

        if (existingEmail?.data) {
          console.log('[handleRequestRevision] Found existing edited email:', {
            id: existingEmail.data.id,
            subject: existingEmail.data.subject,
            supplierId: existingEmail.data.supplierId,
            createdAt: existingEmail.data.createdAt
          });

          // Find the supplier details from emailThreads
          const junctionRecord = quoteRequest.emailThreads?.find((t: any) => t.supplierId === supplierId);
          const supplierDetails = junctionRecord?.supplier;

          console.log('[handleRequestRevision] Found supplier details:', supplierDetails);

          // Display the existing edited email instead of opening the follow-up modal
          setEditedEmailContent({
            email: {
              subject: existingEmail.data.subject,
              body: existingEmail.data.body,
              bodyHtml: existingEmail.data.bodyHtml
            },
            metadata: {
              quoteRequestId: quoteRequest.id,
              followUpReason: 'needs_revision',
              workflowBranch: 'needs_revision',
              date: existingEmail.data.createdAt,
              supplier: supplierDetails ? {
                id: supplierDetails.id,
                name: supplierDetails.name,
                email: supplierDetails.email,
                contactPerson: supplierDetails.contactPerson,
                auxiliaryEmails: supplierDetails.auxiliaryEmails || []
              } : {
                id: supplierId
              }
            }
          });

          setShowEmailPreview(true);

          toast({
            title: "Loaded saved email",
            description: "Showing your previously edited revision request email.",
          });

          return;
        } else {
          console.log('[handleRequestRevision] existingEmail.data is null or undefined');
        }
      } catch (error: any) {
        // If no edited email found, continue with normal flow
        console.log('[handleRequestRevision] Error fetching existing edited email:', {
          error: error.message,
          status: error.status,
          fullError: error
        });
      }

      // Find the supplier thread junction record by emailThreadId and supplierId
      const junctionRecord = quoteRequest.emailThreads?.find((t: any) =>
        t.emailThreadId === threadId && t.supplierId === supplierId
      );

      console.log('[handleRequestRevision] Found junction record:', junctionRecord);

      if (!junctionRecord) {
        console.error('[handleRequestRevision] No junction record found for:', { supplierId, threadId });
        toast({
          title: "Error",
          description: "Could not find email thread for this supplier.",
          variant: "destructive",
        });
        return;
      }

      // Check if we have messages
      const messages = junctionRecord.emailThread?.messages || [];
      console.log('[handleRequestRevision] Messages in thread:', messages);

      if (messages.length > 0) {
        // Get the most recent outbound message
        const outboundMessages = messages
          .filter((message: any) => message.direction === 'OUTBOUND')
          .sort((a: any, b: any) => {
            const dateA = new Date(a.sentAt || a.createdAt);
            const dateB = new Date(b.sentAt || b.createdAt);
            return dateB.getTime() - dateA.getTime();
          });

        const messageId = outboundMessages.length > 0 ? outboundMessages[0].id : `dummy-${threadId}`;

        console.log('[handleRequestRevision] Setting state:', {
          messageId,
          supplierId,
          threadId,
          junctionRecordId: junctionRecord.id,
          supplierName: junctionRecord.supplier?.name
        });

        // Set both message ID and supplier ID for the follow-up modal
        setSelectedMessageId(messageId);
        setSelectedSupplierId(supplierId);
        setFollowUpModalOpen(true);
      } else {
        console.warn('[handleRequestRevision] No messages in thread, using dummy message');
        // Even if no messages, allow opening the modal with a dummy message ID
        const messageId = `dummy-${threadId}`;
        
        console.log('[handleRequestRevision] Setting state with dummy message:', {
          messageId,
          supplierId,
          threadId
        });
        
        setSelectedMessageId(messageId);
        setSelectedSupplierId(supplierId);
        setFollowUpModalOpen(true);
      }
    } catch (error) {
      console.error("Error requesting revision:", error);
      toast({
        title: "Error",
        description: "Failed to request revision. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Helper function to get status badge
  // Handle re-opening a rejected quote
  const handleReopenQuote = async () => {
    try {
      await updateQuoteRequest(quoteRequestId, {
        status: QuoteStatus.SENT,
      });

      toast({
        title: "Quote Re-opened",
        description: "You can now send this quote to additional suppliers or request revisions.",
      });

      await handleFollowUpSent();
    } catch (error) {
      console.error("Error re-opening quote:", error);
      toast({
        title: "Error",
        description: "Failed to re-open quote. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: QuoteStatus) => {
    switch (status) {
      case QuoteStatus.DRAFT:
        return <Badge className="bg-slate-600 text-white text-sm px-3 py-1">Draft</Badge>
      case QuoteStatus.SENT:
        return <Badge className="bg-blue-600 text-white text-sm px-3 py-1">Sent</Badge>
      case QuoteStatus.RECEIVED:
        return <Badge className="bg-purple-600 text-white text-sm px-3 py-1">Received</Badge>
      case QuoteStatus.UNDER_REVIEW:
        return <Badge className="bg-yellow-600 text-white text-sm px-3 py-1">Under Review</Badge>
      case QuoteStatus.APPROVED:
        return <Badge className="bg-green-600 text-white text-sm px-3 py-1">Approved</Badge>
      case QuoteStatus.REJECTED:
        return <Badge className="bg-red-600 text-white text-sm px-3 py-1">Rejected</Badge>
      case QuoteStatus.EXPIRED:
        return <Badge className="bg-orange-600 text-white text-sm px-3 py-1">Expired</Badge>
      case QuoteStatus.CONVERTED_TO_ORDER:
        return <Badge className="bg-indigo-600 text-white text-sm px-3 py-1">Converted to Order</Badge>
      default:
        return <Badge variant="secondary" className="text-sm px-3 py-1">{status}</Badge>
    }
  }
  
  // Calculate the appropriate global status based on supplier thread statuses
  const calculateGlobalStatus = (emailThreads: any[]): QuoteStatus => {
    if (!emailThreads || emailThreads.length === 0) {
      return quoteRequest.status; // Keep current status if no threads
    }
    
    // Analyze each thread's status AND message directions
    const threadAnalysis = emailThreads.map(thread => {
      const hasInboundMessages = thread.emailThread?.messages?.some(
        (msg: any) => msg.direction === 'INBOUND'
      ) || false;
      
      return {
        status: thread.status,
        hasInboundMessages,
        supplierId: thread.supplier?.id,
        supplierName: thread.supplier?.name
      };
    });
    
    console.log('[Status Calculation] Thread analysis:', threadAnalysis);
    
    // If any supplier accepted
    if (threadAnalysis.some(t => t.status === 'ACCEPTED')) {
      return QuoteStatus.APPROVED;
    }
    
    // If all suppliers rejected or no response
    const allRejectedOrNoResponse = threadAnalysis.every(
      t => t.status === 'REJECTED' || t.status === 'NO_RESPONSE'
    );
    if (allRejectedOrNoResponse && threadAnalysis.some(t => t.status === 'REJECTED')) {
      return QuoteStatus.REJECTED;
    }
    
    // Check if any supplier has actually responded (INBOUND messages OR status = RESPONDED)
    const anyResponded = threadAnalysis.some(
      t => t.status === 'RESPONDED' || t.hasInboundMessages
    );
    if (anyResponded) {
      console.log('[Status Calculation] Suppliers responded, setting UNDER_REVIEW');
      return QuoteStatus.UNDER_REVIEW;
    }
    
    // If all sent, no responses yet
    if (threadAnalysis.every(t => t.status === 'SENT' && !t.hasInboundMessages)) {
      return QuoteStatus.SENT;
    }
    
    return quoteRequest.status; // Default to current status
  }
  
  // Get effective status (calculated from supplier threads if available)
  const getEffectiveStatus = (): QuoteStatus => {
    // Don't override terminal states
    if (quoteRequest.status === QuoteStatus.CONVERTED_TO_ORDER || 
        quoteRequest.status === QuoteStatus.EXPIRED) {
      return quoteRequest.status;
    }
    
    // Calculate from supplier threads
    if (quoteRequest.emailThreads && quoteRequest.emailThreads.length > 0) {
      return calculateGlobalStatus(quoteRequest.emailThreads);
    }
    
    return quoteRequest.status;
  }
  
  // Get the effective status for UI logic
  const effectiveStatus = quoteRequest ? getEffectiveStatus() : QuoteStatus.DRAFT;

  // Calculate the lowest supplier total and identify the best supplier
  const getBestSupplierQuote = () => {
    if (!quoteRequest) {
      return null;
    }

    // If this is a multi-supplier quote
    if (quoteRequest.emailThreads && quoteRequest.emailThreads.length > 0) {
      const threads = quoteRequest.emailThreads;

      // Calculate totals for EACH supplier independently from their own items
      const supplierQuotes = threads.map((t: any) => {
        // Get ONLY items for THIS SPECIFIC supplier with prices
        const supplierItems = quoteRequest.items?.filter((item: any) =>
          item.supplierId === t.supplierId &&
          item.totalPrice != null &&
          item.totalPrice > 0
        ) || [];

        // Calculate total ONLY from THIS supplier's priced items
        const totalFromItems = supplierItems.reduce((sum: number, item: any) =>
          sum + (Number(item.totalPrice) || 0), 0
        );

        console.log(`[getBestSupplierQuote] Supplier ${t.supplier?.name}:`, {
          supplierId: t.supplierId,
          itemCount: supplierItems.length,
          total: totalFromItems,
          items: supplierItems.map(i => ({ partNumber: i.partNumber, price: i.totalPrice }))
        });

        // Only include this supplier if they have at least one priced item
        // Otherwise use quotedAmount from thread if available
        const total = totalFromItems > 0 ? totalFromItems : (t.quotedAmount || 0);

        return {
          supplierId: t.supplierId,
          supplierName: t.supplier?.name,
          total,
          pricedItemCount: supplierItems.length,
          hasPrices: totalFromItems > 0
        };
      }).filter((q: any) => q.total > 0); // Only include suppliers with some pricing

      console.log('[getBestSupplierQuote] All supplier quotes:', supplierQuotes);

      if (supplierQuotes.length === 0) {
        return null;
      }

      // Find the supplier with the lowest total among those with prices
      const lowestQuote = Math.min(...supplierQuotes.map((q: any) => q.total));
      const bestSupplier = supplierQuotes.find((q: any) => q.total === lowestQuote);

      console.log('[getBestSupplierQuote] Best supplier:', bestSupplier);

      return bestSupplier;
    }

    // Single supplier quote - use totalAmount or calculate from items
    const allItems = quoteRequest.items?.filter((item: any) =>
      item.totalPrice != null && item.totalPrice > 0
    ) || [];

    const totalFromItems = allItems.reduce((sum: number, item: any) =>
      sum + (item.totalPrice || 0), 0
    );

    if (totalFromItems > 0) {
      return {
        supplierId: quoteRequest.supplier?.id,
        supplierName: quoteRequest.supplier?.name,
        total: totalFromItems,
        pricedItemCount: allItems.length,
        hasPrices: true
      };
    }

    return null;
  };

  const bestSupplierQuote = quoteRequest ? getBestSupplierQuote() : null;

  return (
    <AppLayout activeRoute="/orders">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="mr-4 text-slate-400 hover:text-white"
          onClick={() => router.push("/orders")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white">
            {loading ? "Loading Quote..." : `Quote Request ${quoteRequest?.quoteNumber}`}
          </h1>
          <p className="text-slate-400">View and manage quote request details</p>
        </div>
      </div>

      {quoteRequest && effectiveStatus !== QuoteStatus.CONVERTED_TO_ORDER && (
        <div className="flex justify-end gap-2 mb-6">
          {effectiveStatus === QuoteStatus.DRAFT && (
              <Button 
                onClick={handleSendToSupplier}
                disabled={isSendingEmail}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isSendingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Mail className="w-4 h-4 mr-2" />
                Send to Supplier(s)
              </Button>
            )}
            <Button variant="outline" className="text-orange-600 hover:bg-slate-700 hover:text-white" asChild>
              <Link href={`/orders/quote-request/${quoteRequestId}/edit`}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Quote
              </Link>
            </Button>
            {(effectiveStatus === QuoteStatus.DRAFT || effectiveStatus === QuoteStatus.REJECTED || effectiveStatus === QuoteStatus.EXPIRED) && (
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            <Button
              onClick={handleConvertToOrder}
              disabled={isConverting || quoteRequest.status !== QuoteStatus.APPROVED}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isConverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <ShoppingCart className="w-4 h-4 mr-2" />
              Convert to Order
            </Button>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center p-12">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
            <p className="text-sm text-slate-400">Loading quote request...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 p-8 rounded-md text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 font-medium text-lg">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-4 border-red-500 text-red-500 hover:bg-red-900/20"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      ) : quoteRequest ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Follow-up Alert - Shows at the top when follow-up is needed */}
          <div className="lg:col-span-3">
            <FollowUpAlert
              quoteRequest={quoteRequest}
              onFollowUpClick={handleFollowUpClick}
            />
          </div>
          
          <div className="lg:col-span-2 space-y-6">
            {/* Main content column */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="border-b border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl text-white">{quoteRequest.title}</CardTitle>
                    <CardDescription className="text-slate-400">
                      Quote Request #{quoteRequest.quoteNumber}
                    </CardDescription>
                  </div>
                  <div>
                    {getStatusBadge(quoteRequest.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {quoteRequest.description && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-2">Description</h3>
                      <p className="break-words text-white">{quoteRequest.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-2">
                        {additionalSuppliers.length > 0 ? 'Primary Supplier' : 'Supplier'}
                      </h3>
                      <div className="flex items-start gap-2">
                        <Building className="w-4 h-4 mt-0.5 text-slate-400" />
                        <div>
                          <p className="font-medium text-white">{quoteRequest.supplier.name}</p>
                          {quoteRequest.supplier.email && (
                            <p className="text-sm text-slate-400">{quoteRequest.supplier.email}</p>
                          )}
                          {quoteRequest.supplier.contactPerson && (
                            <p className="text-sm text-slate-400">Contact: {quoteRequest.supplier.contactPerson}</p>
                          )}
                        </div>
                      </div>
                      
                      {additionalSuppliers.length > 0 && (
                        <div className="mt-4 space-y-3">
                          <h4 className="text-sm font-medium text-muted-foreground">Additional Suppliers ({additionalSuppliers.length})</h4>
                          {additionalSuppliers.map((supplier) => (
                            <div key={supplier.id} className="flex items-start gap-2 pl-6 border-l-2 border-orange-200">
                              <Building className="w-4 h-4 mt-0.5 text-muted-foreground" />
                              <div>
                                <p className="text-white font-medium text-sm">{supplier.name}</p>
                                {supplier.email && (
                                  <p className="text-xs text-muted-foreground">{supplier.email}</p>
                                )}
                                {supplier.contactPerson && (
                                  <p className="text-xs text-muted-foreground">Contact: {supplier.contactPerson}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Dates</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-white">Requested: {formatDate(quoteRequest.requestDate)}</span>
                        </div>
                        {quoteRequest.expiryDate && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-white">Expires: {formatDate(quoteRequest.expiryDate)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {quoteRequest.vehicle && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-md border">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Vehicle</h3>
                      <div className="flex items-start gap-2">
                        <Car className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {quoteRequest.vehicle.make} {quoteRequest.vehicle.model} ({quoteRequest.vehicle.year})
                          </p>
                          <p className="text-sm text-muted-foreground">
                            ID: {quoteRequest.vehicle.vehicleId}
                          </p>
                          {quoteRequest.vehicle.serialNumber && (
                            <p className="text-sm text-muted-foreground">
                              Serial: {quoteRequest.vehicle.serialNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Supplier Response Tabs - Shows responses from all suppliers */}
            {quoteRequest.emailThreads && quoteRequest.emailThreads.length > 0 ? (
              <div className="mt-6">
                <SupplierResponseTabs
                  emailThreads={quoteRequest.emailThreads}
                  onPreviewMessage={handlePreviewEmail}
                  onRefreshPrices={handleRefreshPrices}
                  onAcceptQuote={handleAcceptSupplierQuote}
                  onRejectQuote={handleRejectSupplierQuote}
                  onRequestRevision={handleRequestRevision}
                  isRefreshingPrices={isRefreshingPrices}
                  quoteStatus={quoteRequest.status}
                  quoteItems={quoteRequest.items}
                  notes={quoteRequest.notes}
                />
              </div>
            ) : quoteRequest.emailThread && quoteRequest.emailThread.length > 0 ? (
              <Card className="mt-6 bg-slate-800 border-slate-700">
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-yellow-500 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2 text-white">Email Threads Not Linked</h3>
                  <p className="text-slate-400 mb-4">
                    Found {quoteRequest.emailThread.length} email thread(s) that need to be linked to suppliers
                  </p>
                  {autoSyncStatus && (
                    <p className="text-sm text-blue-400 mb-4 flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {autoSyncStatus}
                    </p>
                  )}
                  <Button
                    onClick={(e) => handleSyncThreads(false, e.shiftKey)}
                    disabled={isSyncing}
                    title="Click to sync. Hold Shift to force re-sync (fixes incorrect thread mappings)"
                  >
                    {isSyncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {autoSyncStatus ? "Sync Now (Skip Wait)" : "Sync Email Threads"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="mt-6 bg-slate-800 border-slate-700">
                <CardContent className="py-12 text-center">
                  <Mail className="h-16 w-16 mx-auto mb-4 text-slate-400 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2 text-white">No Email Communication Yet</h3>
                  <p className="text-slate-400 mb-6">
                    Send the quote request to suppliers to start tracking responses
                  </p>
                  {quoteRequest.status === 'DRAFT' && !isSendingEmail && (
                    <Button
                      onClick={handleSendToSupplier}
                      disabled={isSendingEmail}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Send Quote Request
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Price Comparison Table - Shows side-by-side pricing */}
            {quoteRequest.emailThreads && quoteRequest.emailThreads.length > 1 && (
              <div className="mt-6">
                <PriceComparisonTable 
                  emailThreads={quoteRequest.emailThreads}
                  onSelectSupplier={(supplierId) => {
                    console.log('Selected supplier for order:', supplierId);
                  }}
                />
              </div>
            )}
            
            {/* Communication Timeline - Shows all messages with follow-up buttons */}
            {/* Show if no emailThreads junction table data exists (legacy quotes) */}
            {(!quoteRequest.emailThreads || quoteRequest.emailThreads.length === 0) && 
             quoteRequest.emailThread && quoteRequest.emailThread.length > 0 && (
              <div id="conversation" className="mt-6 scroll-mt-6">
                <CommunicationTimeline
                  quoteRequest={{
                    ...quoteRequest,
                    emailThread: quoteRequest.emailThread[0] // Use first thread for legacy display
                  }}
                  onFollowUpClick={handleFollowUpClick}
                  onPreviewClick={handlePreviewEmail}
                  quoteStatus={quoteRequest.status}
                />
              </div>
            )}
          </div>
          
          {/* Sidebar column */}
          <div>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="text-lg text-white">Quote Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status</span>
                    <span>{getStatusBadge(getEffectiveStatus())}</span>
                  </div>

                  {/* Show supplier response summary if multi-supplier */}
                  {quoteRequest.emailThreads && quoteRequest.emailThreads.length > 1 && (
                    <div className="text-xs space-y-1 p-2 bg-slate-700/50 rounded">
                      <div className="font-medium text-slate-300">Supplier Responses:</div>
                      {quoteRequest.emailThreads.map((thread: any) => (
                        <div key={thread.id} className="flex justify-between items-center">
                          <span className="truncate max-w-[120px] text-white">{thread.supplier.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              thread.status === 'RESPONDED' ? 'border-green-500 text-green-700' :
                              thread.status === 'ACCEPTED' ? 'border-green-600 text-green-800' :
                              thread.status === 'REJECTED' ? 'border-red-500 text-red-700' :
                              thread.status === 'NOT_SELECTED' ? 'border-gray-400 text-gray-600' :
                              thread.status === 'NO_RESPONSE' ? 'border-gray-400 text-gray-600' :
                              'border-blue-500 text-blue-700'
                            }`}
                          >
                            {thread.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-slate-400">Items</span>
                    <span className="text-white">
                      {(() => {
                        // Count unique part numbers across all items
                        const uniquePartNumbers = new Set(
                          quoteRequest.items?.map((item: any) => item.partNumber) || []
                        );
                        return uniquePartNumbers.size;
                      })()}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Best Price</span>
                      <span className="font-medium text-white">
                        {bestSupplierQuote
                          ? formatCurrency(bestSupplierQuote.total)
                          : quoteRequest.totalAmount
                            ? formatCurrency(quoteRequest.totalAmount)
                            : "Pending"}
                      </span>
                    </div>
                    {bestSupplierQuote && (
                      <div className="flex justify-end">
                        <Badge variant="outline" className="text-xs border-green-500 text-green-700">
                          {bestSupplierQuote.supplierName}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-slate-700" />

                  <div className="flex justify-between">
                    <span className="text-slate-400">Created By</span>
                    <span className="text-white">{quoteRequest.createdBy?.name || "Unknown"}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Created On</span>
                    <span className="text-white">{formatDate(quoteRequest.createdAt)}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {effectiveStatus === QuoteStatus.APPROVED ? (
                  <Button 
                    className="w-full"
                    onClick={handleConvertToOrder}
                    disabled={isConverting}
                  >
                    {isConverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Convert to Order
                  </Button>
                ) : effectiveStatus === QuoteStatus.DRAFT ? (
                  <div className="text-center p-4 bg-slate-700 rounded-md">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-white font-medium">Draft Quote Request</p>
                    <p className="text-slate-300 text-sm mt-1">
                      This quote request has not been sent to the supplier yet.
                    </p>
                    <Button
                      className="w-full mt-4"
                      onClick={() => {
                        // Update status to SENT
                        updateQuoteRequest(quoteRequestId, { status: QuoteStatus.SENT })
                          .then(() => {
                            toast({
                              title: "Quote Request Sent",
                              description: "Quote request has been marked as sent.",
                            });
                            // Refresh the quote request data
                            return handleFollowUpSent();
                          })
                          .catch(error => {
                            console.error("Error updating quote status:", error)
                            toast({
                              title: "Error",
                              description: "Failed to update quote status. Please try again.",
                              variant: "destructive",
                            })
                          })
                      }}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Mark as Sent
                    </Button>
                  </div>
                ) : effectiveStatus === QuoteStatus.RECEIVED ? (
                  <div className="text-center p-4 bg-indigo-900/20 rounded-md border border-indigo-600">
                    <CheckCircle className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                    <p className="text-white font-medium">Receipt Acknowledged</p>
                    <p className="text-slate-300 text-sm mt-1">
                      Supplier has acknowledged receipt of the quote request.
                    </p>
                    <Button
                      className="w-full mt-4"
                      onClick={() => {
                        // Get the most recent outbound message
                        const messageId = getMostRecentOutboundMessageId();
                        if (messageId) {
                          setSelectedMessageId(messageId);
                          setFollowUpModalOpen(true);
                        } else {
                          toast({
                            title: "Error",
                            description: "No outbound message found to follow up on.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Send Follow-up
                    </Button>
                  </div>
                ) : effectiveStatus === QuoteStatus.UNDER_REVIEW ? (
                  <div className="text-center p-4 bg-blue-900/20 rounded-md border border-blue-600">
                    <AlertTriangle className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-white font-medium">Review Supplier Quotes</p>
                    <p className="text-slate-300 text-sm mt-1">
                      Use the supplier tabs below to compare quotes and take action.
                    </p>
                  </div>
                ) : effectiveStatus === QuoteStatus.SENT ? (
                  <div className="text-center p-4 bg-blue-900/20 rounded-md border border-blue-600">
                    <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-white font-medium">Waiting for Supplier Response</p>
                    <p className="text-slate-300 text-sm mt-1">
                      Quote request has been sent to the supplier.
                    </p>
                  </div>
                ) : effectiveStatus === QuoteStatus.CONVERTED_TO_ORDER ? (
                  <div className="text-center p-4 bg-green-900/20 rounded-md border border-green-600">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-white font-medium">Converted to Order</p>
                    <p className="text-slate-300 text-sm mt-1">
                      This quote has been converted to an order.
                    </p>
                  </div>
                ) : effectiveStatus === QuoteStatus.REJECTED ? (
                  <div className="text-center p-4 bg-red-900/20 rounded-md border border-red-600">
                    <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-white font-medium">Quote Rejected</p>
                    <p className="text-slate-300 text-sm mt-1">
                      This quote has been rejected.
                    </p>
                    <Button
                      className="w-full mt-4"
                      variant="outline"
                      onClick={handleReopenQuote}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Re-open Quote Request
                    </Button>
                  </div>
                ) : effectiveStatus === QuoteStatus.EXPIRED ? (
                  <div className="text-center p-4 bg-orange-900/20 rounded-md border border-orange-600">
                    <Clock className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                    <p className="text-white font-medium">Quote Expired</p>
                    <p className="text-slate-300 text-sm mt-1">
                      This quote has expired. You may need to request a new quote.
                    </p>
                  </div>
                ) : effectiveStatus === QuoteStatus.UNDER_REVIEW ? (
                  // Multi-supplier mode: show supplier comparison message
                  quoteRequest.emailThreads && quoteRequest.emailThreads.length > 1 ? (
                    <div className="text-center p-4 bg-yellow-900/20 rounded-md border border-yellow-600">
                      <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                      <p className="text-white font-medium">Reviewing Supplier Quotes</p>
                      <p className="text-slate-300 text-sm mt-1">
                        Compare quotes in the tabs above and accept your preferred supplier.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-center font-medium text-yellow-600 mb-2">
                        Quote response is under review
                      </p>
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={async () => {
                        try {
                          setIsLoadingN8nResponse(true);
                          console.log("Reviewing email for quote request:", quoteRequestId);
                          
                          // First, check if there are any saved edited emails
                          try {
                            // Use prisma directly to query the edited_emails table
                            const { getEditedEmails } = await import("@/lib/api/edited-emails");
                            const editedEmailsResponse = await getEditedEmails(quoteRequestId);
                            console.log("Edited emails response:", editedEmailsResponse);
                            
                            if (editedEmailsResponse.data && editedEmailsResponse.data.length > 0) {
                              // Use the most recent edited email
                              const latestEditedEmail = editedEmailsResponse.data[0]; // They're ordered by createdAt desc
                              console.log("Using latest edited email:", latestEditedEmail);
                              
                              // Create a structured response with the edited email data
                              const structuredResponse = {
                                email: {
                                  subject: latestEditedEmail.subject,
                                  body: latestEditedEmail.body,
                                  bodyHtml: latestEditedEmail.bodyHtml
                                },
                                metadata: {
                                  supplier: quoteRequest.supplier,
                                  quoteRequestId: quoteRequest.id,
                                  generatedAt: latestEditedEmail.createdAt,
                                  followUpReason: latestEditedEmail.emailType.includes('revision')
                                    ? "Needs Revision"
                                    : latestEditedEmail.emailType.includes('accept')
                                      ? "Accept Quote"
                                      : "No Response"
                                },
                                actions: {
                                  edit: {
                                    label: "Edit Email"
                                  },
                                  approve: {
                                    label: "Approve & Send",
                                    payload: {
                                      quoteRequestId: quoteRequest.id,
                                      messageId: getMostRecentOutboundMessageId() || "",
                                      action: "send",
                                      followUpReason: latestEditedEmail.emailType.includes('revision')
                                        ? "Needs Revision"
                                        : latestEditedEmail.emailType.includes('accept')
                                          ? "Accept Quote"
                                          : "No Response",
                                      workflowBranch: latestEditedEmail.emailType.includes('revision')
                                        ? "needs_revision"
                                        : latestEditedEmail.emailType.includes('accept')
                                          ? "accept_quote"
                                          : "no_response"
                                    }
                                  }
                                }
                              };
                              
                              // Set the webhook response
                              setWebhookResponse(structuredResponse);
                              
                              // Show the email preview
                              setShowEmailPreview(true);
                              setIsLoadingN8nResponse(false);
                              return; // Exit early since we found an edited email
                            } else {
                              console.log("No edited emails found in database, will check N8N responses");
                            }
                          } catch (editedEmailError) {
                            console.error("Error fetching edited emails:", editedEmailError);
                            // Continue to fetch N8N responses if edited emails fail
                          }
                          
                          // If no edited emails found, fetch N8N responses
                          console.log("Fetching N8N responses as fallback");
                          const response = await getN8nResponses(quoteRequestId);
                          console.log("N8N responses:", response);
                          
                          if (response.data && response.data.length > 0) {
                            // Find the most recent follow_up response
                            const followUpResponse = response.data.find(
                              (r: any) => r.responseType === 'follow_up'
                            );
                            
                            if (followUpResponse) {
                              console.log("Found follow_up response:", followUpResponse);
                              
                              // Parse the responseData if it's a string
                              let parsedResponseData;
                              try {
                                parsedResponseData = typeof followUpResponse.responseData === 'string'
                                  ? JSON.parse(followUpResponse.responseData)
                                  : followUpResponse.responseData;
                                  
                                console.log("Parsed response data:", parsedResponseData);
                                
                                // Ensure the parsed data has the correct structure for the email editor
                                // The email editor expects an object with an 'email' property containing subject, body, and bodyHtml
                                if (parsedResponseData && parsedResponseData.email) {
                                  // Data already has the correct structure
                                  setWebhookResponse(parsedResponseData);
                                } else if (parsedResponseData && parsedResponseData.data && parsedResponseData.data.email) {
                                  // Data is nested in a 'data' property
                                  setWebhookResponse(parsedResponseData.data);
                                } else {
                                  // Try to construct the correct structure from the available data
                                  const emailContent = {
                                    subject: parsedResponseData?.subject || parsedResponseData?.data?.subject || "",
                                    body: parsedResponseData?.body || parsedResponseData?.data?.body || "",
                                    bodyHtml: parsedResponseData?.bodyHtml || parsedResponseData?.data?.bodyHtml || ""
                                  };
                                  
                                  const structuredResponse = {
                                    email: emailContent,
                                    metadata: parsedResponseData?.metadata || {
                                      supplier: quoteRequest.supplier,
                                      quoteRequestId: quoteRequest.id,
                                      messageId: followUpResponse.messageId,
                                      generatedAt: new Date().toISOString(),
                                      followUpReason: "Quote Response"
                                    },
                                    actions: parsedResponseData?.actions || {
                                      edit: {
                                        label: "Edit Email"
                                      },
                                      approve: {
                                        label: "Approve & Send",
                                        payload: {
                                          quoteRequestId: quoteRequest.id,
                                          messageId: followUpResponse.messageId,
                                          action: "send",
                                          followUpReason: "Quote Response",
                                          workflowBranch: "accept_quote"
                                        }
                                      }
                                    }
                                  };
                                  
                                  setWebhookResponse(structuredResponse);
                                }
                                
                                // Show the email preview
                                setShowEmailPreview(true);
                              } catch (parseError) {
                                console.error("Error parsing response data:", parseError);
                                toast({
                                  title: "Error",
                                  description: "Failed to parse stored response data.",
                                  variant: "destructive",
                                });
                              }
                            } else {
                              // Try to find any other response type
                              const anyResponse = response.data[0];
                              console.log("No follow_up response found, using first available response:", anyResponse);
                              
                              try {
                                const parsedResponseData = typeof anyResponse.responseData === 'string'
                                  ? JSON.parse(anyResponse.responseData)
                                  : anyResponse.responseData;
                                
                                // Ensure the parsed data has the correct structure for the email editor
                                // Create a structured response with the available data
                                const structuredResponse = {
                                  email: {
                                    subject: parsedResponseData?.subject || parsedResponseData?.data?.subject || "Quote Response",
                                    body: parsedResponseData?.body || parsedResponseData?.data?.body || "Quote response content",
                                    bodyHtml: parsedResponseData?.bodyHtml || parsedResponseData?.data?.bodyHtml || "<p>Quote response content</p>"
                                  },
                                  metadata: parsedResponseData?.metadata || {
                                    supplier: quoteRequest.supplier,
                                    quoteRequestId: quoteRequest.id,
                                    messageId: anyResponse.messageId,
                                    generatedAt: new Date().toISOString(),
                                    followUpReason: "Quote Response"
                                  },
                                  actions: parsedResponseData?.actions || {
                                    edit: {
                                      label: "Edit Email"
                                    },
                                    approve: {
                                      label: "Approve & Send",
                                      payload: {
                                        quoteRequestId: quoteRequest.id,
                                        messageId: anyResponse.messageId,
                                        action: "send",
                                        followUpReason: "Quote Response",
                                        workflowBranch: "accept_quote"
                                      }
                                    }
                                  }
                                };
                                
                                // Set the webhook response
                                setWebhookResponse(structuredResponse);
                                
                                // Show the email preview
                                setShowEmailPreview(true);
                              } catch (parseError) {
                                console.error("Error parsing response data:", parseError);
                                toast({
                                  title: "Error",
                                  description: "Failed to parse stored response data.",
                                  variant: "destructive",
                                });
                              }
                            }
                          } else {
                            toast({
                              title: "Error",
                              description: "No N8N responses found for this quote request.",
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          console.error("Error fetching responses:", error);
                          toast({
                            title: "Error",
                            description: "Failed to fetch responses.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsLoadingN8nResponse(false);
                        }
                      }}
                      disabled={isLoadingN8nResponse}
                    >
                      {isLoadingN8nResponse ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          Review Email
                        </>
                      )}
                    </Button>
                    <Button
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={async () => {
                        try {
                          // Get the most recent outbound message
                          const messageId = getMostRecentOutboundMessageId();
                          if (messageId) {
                            // Set the quote status back to SENT
                            await updateQuoteRequest(quoteRequestId, { status: QuoteStatus.SENT });
                            
                            // Refresh the quote request data
                            await handleFollowUpSent();
                            
                            // Open the follow-up modal with the "needs_revision" workflow branch
                            setSelectedMessageId(messageId);
                            setFollowUpModalOpen(true);
                            
                            toast({
                              title: "Success",
                              description: "Quote status updated to SENT. You can now restart the follow-up workflow.",
                            });
                          } else {
                            toast({
                              title: "Error",
                              description: "No outbound message found to regenerate.",
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          console.error("Error updating quote status:", error);
                          toast({
                            title: "Error",
                            description: "Failed to update quote status. Please try again.",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={isLoadingN8nResponse}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Regenerate Email
                    </Button>
                    </div>
                  )
                ) : null}
              </CardFooter>
            </Card>
            
            {/* Follow-up Status Card - Shows communication status */}
            {quoteRequest.emailThread && (
              <div className="mt-6">
                <FollowUpStatus quoteRequest={quoteRequest} />
              </div>
            )}
          </div>
        </div>
      ) : null}
      
      {/* Follow-up Modal - Opens when follow-up button is clicked */}
      {selectedMessageId && quoteRequest && (
        <FollowUpModal
          open={followUpModalOpen}
          onOpenChange={setFollowUpModalOpen}
          quoteRequest={quoteRequest}
          messageId={selectedMessageId}
          supplierId={selectedSupplierId || undefined}
          onFollowUpSent={handleFollowUpSent}
          initialReason="Needs revision"
          initialWorkflowBranch="needs_revision"
          onPreviewGenerated={handleFollowUpPreview}
        />
      )}
      
      {/* Email Preview Modal - Opens when preview button is clicked */}
      <EmailPreviewModalWithEditor
        open={showEmailPreview}
        onOpenChange={(open) => {
          setShowEmailPreview(open);
          // Clear state when modal is closed to prevent stale data
          if (!open) {
            setEditedEmailContent(null);
            setWebhookResponse(null);
          }
        }}
        message={previewEmailData?.message || (previewMessageId ? findMessageById(previewMessageId) : null)}
        webhookResponse={editedEmailContent || webhookResponse}
        onApprove={handleApproveFollowUp}
        onRevise={handleReviseFollowUp}
        onEdit={handleEditEmail}
        showApprovalButtons={!!(editedEmailContent || webhookResponse || previewEmailData)}
        isSending={isPreviewLoading}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quote request? This action cannot be undone.
              {quoteRequest?.emailThread && (
                <span className="block mt-2 text-yellow-600">
                  Warning: This quote has an email thread with {quoteRequest.emailThread.messages?.length || 0} message(s). 
                  The email thread will also be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuoteRequest}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Quote Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Accept Quote Confirmation Dialog */}
      <AcceptQuoteConfirmationDialog
        open={showAcceptConfirmation}
        onOpenChange={setShowAcceptConfirmation}
        supplier={acceptConfirmationData?.supplier || null}
        quoteItems={acceptConfirmationData?.quoteItems || []}
        quotedTotal={acceptConfirmationData?.quotedTotal || 0}
        otherSuppliersCount={acceptConfirmationData?.otherSuppliersCount || 0}
        isProcessing={isConvertingToOrder}
        onConfirm={handleConfirmAcceptQuote}
      />
    </AppLayout>
  )
}