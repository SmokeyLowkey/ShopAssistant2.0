"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Mail,
  Search,
  AlertTriangle,
  Check,
  X,
  Loader2,
  User,
  FileText,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getOrphanedEmails, assignOrphanedEmail, OrphanedEmail, mergeEmailThreads } from "@/lib/api/emails"
import { getQuoteRequestsBySupplier, getQuoteRequestsWithoutEmail } from "@/lib/api/quote-requests"

// Use the interface from lib/api/quote-requests.ts
import { QuoteRequest as ApiQuoteRequest } from "@/lib/api/quote-requests";

// Local interface that extends the API interface
interface QuoteRequest extends ApiQuoteRequest {}

export default function OrphanedEmailsPage() {
  const router = useRouter()
  const [orphanedEmails, setOrphanedEmails] = useState<OrphanedEmail[]>([])
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEmail, setSelectedEmail] = useState<OrphanedEmail | null>(null)
  const [selectedQuoteRequest, setSelectedQuoteRequest] = useState<string>("")
  const [isAssigning, setIsAssigning] = useState(false)
  const [quoteRequestSearchTerm, setQuoteRequestSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewEmailDialogOpen, setIsViewEmailDialogOpen] = useState(false)
  const [viewingEmail, setViewingEmail] = useState<OrphanedEmail | null>(null)
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false)
  const [mergeData, setMergeData] = useState<{
    sourceThreadId: string;
    targetThreadId: string;
    quoteRequestId: string;
    quoteRequestNumber: string;
  } | null>(null)

  // Fetch orphaned emails and quote requests
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Fetch orphaned emails
        const orphanedEmailsResponse = await getOrphanedEmails(searchTerm)
        setOrphanedEmails(orphanedEmailsResponse.data)
        
        // Fetch quote requests without email threads
        const quoteRequestsResponse = await getQuoteRequestsWithoutEmail()
        console.log("Quote Requests Without Email Response:", quoteRequestsResponse)
        
        // Log the structure of the first quote request if available
        if (quoteRequestsResponse.data && quoteRequestsResponse.data.length > 0) {
          console.log("First Quote Request Structure:", JSON.stringify(quoteRequestsResponse.data[0], null, 2))
        } else {
          console.log("No quote requests without email threads found")
        }
        
        setQuoteRequests(quoteRequestsResponse.data)
        
        setError(null)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Failed to load data. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [searchTerm])

  // Filter quote requests based on search term and matching supplier
  const filteredQuoteRequests = quoteRequests.filter(quoteRequest => {
    // Debug logging
    console.log("Quote Request:", quoteRequest.id, quoteRequest.quoteNumber, "Supplier:", quoteRequest.supplier.id)
    
    // Only show quote requests for the same supplier as the selected email
    if (selectedEmail && quoteRequest.supplier.id !== selectedEmail.supplier.id) {
      console.log("Filtering out due to supplier mismatch")
      return false
    }
    
    // Filter by search term
    const matchesSearchTerm =
      quoteRequest.quoteNumber.toLowerCase().includes(quoteRequestSearchTerm.toLowerCase()) ||
      quoteRequest.title.toLowerCase().includes(quoteRequestSearchTerm.toLowerCase())
    
    if (!matchesSearchTerm) {
      console.log("Filtering out due to search term mismatch")
    }
    
    return matchesSearchTerm
  })
  
  // Debug logging for selected email and filtered quote requests
  useEffect(() => {
    if (selectedEmail) {
      console.log("Selected Email Supplier ID:", selectedEmail.supplier.id)
      console.log("Filtered Quote Requests Count:", filteredQuoteRequests.length)
      
      // Log all quote requests for this supplier to debug filtering
      const supplierQuoteRequests = quoteRequests.filter(qr => qr.supplier.id === selectedEmail.supplier.id)
      console.log("All Quote Requests for this supplier:", supplierQuoteRequests.length)
    }
  }, [selectedEmail, filteredQuoteRequests, quoteRequests])

  // Handle assigning an email to a quote request
  const handleAssignToQuoteRequest = async () => {
    if (!selectedEmail || !selectedQuoteRequest) return
    
    setIsAssigning(true)
    
    try {
      // Call the API to assign the email to the quote request
      const response = await assignOrphanedEmail(selectedEmail.id, selectedQuoteRequest)
      
      if (response.success) {
        // Check if threads were merged
        if (response.merged) {
          // Show success message for merged threads
          toast({
            title: "Email threads merged",
            description: `Email has been successfully merged with the existing thread for this quote request`,
          })
        } else {
          // Show success message for normal assignment
          toast({
            title: "Email assigned",
            description: `Email has been successfully assigned to the quote request`,
          })
        }
        
        // Remove the email from the orphaned list
        setOrphanedEmails(orphanedEmails.filter(e => e.id !== selectedEmail.id))
        
        // Close the dialog
        setIsDialogOpen(false)
        setSelectedEmail(null)
        setSelectedQuoteRequest("")
        setQuoteRequestSearchTerm("")
      } else {
        throw new Error("Failed to assign email: API returned unsuccessful response")
      }
    } catch (error) {
      // Handle API error object
      const errorObj = error && typeof error === 'object' && 'error' in error
        ? (error as { error: string; details?: string })
        : null;
      
      const errorMessage = errorObj?.error ||
        (error instanceof Error ? error.message : 'Unknown error');
      
      const errorDetails = errorObj?.details || '';
      
      console.error("Error assigning email:", errorMessage);
      
      // Special handling for quote request already having an email thread
      if (errorMessage === "Quote request already has an associated email thread") {
        // Find the quote request details
        const quoteRequest = quoteRequests.find(qr => qr.id === selectedQuoteRequest);
        
        if (quoteRequest && quoteRequest.emailThread) {
          // Set up merge data
          setMergeData({
            sourceThreadId: selectedEmail.id,
            targetThreadId: quoteRequest.emailThread.id,
            quoteRequestId: quoteRequest.id,
            quoteRequestNumber: quoteRequest.quoteNumber
          });
          
          // Open merge confirmation dialog
          setIsMergeDialogOpen(true);
        } else {
          toast({
            title: "Cannot assign email",
            description: "This quote request already has an associated email thread. Please select a different quote request.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: `Failed to assign email: ${errorMessage}`,
          variant: "destructive",
        });
      }
    } finally {
      setIsAssigning(false)
    }
  }

  // Open the assign dialog for a specific email
  const openAssignDialog = (email: OrphanedEmail) => {
    setSelectedEmail(email)
    setSelectedQuoteRequest("")
    setQuoteRequestSearchTerm("")
    
    // Fetch all quote requests for this supplier, including those with email threads
    const fetchQuoteRequestsForSupplier = async () => {
      try {
        const response = await getQuoteRequestsBySupplier(email.supplier.id)
        console.log("All Quote Requests for Supplier:", email.supplier.id)
        console.log("Count:", response.data.length)
        console.log("With Email Threads:", response.data.filter((qr: QuoteRequest) => qr.emailThread).length)
        setQuoteRequests(response.data)
      } catch (error) {
        console.error("Error fetching quote requests for supplier:", error)
      }
    }
    
    fetchQuoteRequestsForSupplier()
    
    setIsDialogOpen(true)
  }

  // Open the view email dialog
  const openViewEmailDialog = (email: OrphanedEmail) => {
    setViewingEmail(email)
    setIsViewEmailDialogOpen(true)
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-5xl">
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
            <p className="text-sm text-slate-400">Loading orphaned emails...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 max-w-5xl">
        <div className="bg-red-900/20 p-6 rounded-md text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-500 mb-2">{error}</h3>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 border-red-500 text-red-500 hover:bg-red-900/20"
            onClick={() => router.refresh()}
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Orphaned Emails</h1>
          <p className="text-slate-500">
            Manage emails that need to be associated with quote requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search emails by sender or subject..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orphaned Emails List */}
      <Card>
        <CardHeader>
          <CardTitle>Orphaned Emails</CardTitle>
          <CardDescription>
            These emails are associated with suppliers but not with any quote request
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orphanedEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Orphaned Emails</h3>
              <p className="text-slate-500 max-w-md">
                All emails have been properly associated with quote requests.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphanedEmails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="font-medium">{email.from}</TableCell>
                    <TableCell>{email.subject}</TableCell>
                    <TableCell>
                      <Link href={`/suppliers/${email.supplier.id}`} className="text-blue-500 hover:underline">
                        {email.supplier.name}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(email.receivedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openViewEmailDialog(email)}
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          View Email
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAssignDialog(email)}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          Assign to Quote
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign to Quote Request Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Email to Quote Request</DialogTitle>
            <DialogDescription>
              Associate this email with a quote request for the same supplier.
            </DialogDescription>
          </DialogHeader>
          
          {selectedEmail && (
            <div className="bg-slate-100 p-3 rounded-md mb-4">
              <div className="text-sm font-medium">From: {selectedEmail.from}</div>
              <div className="text-sm text-slate-500">Subject: {selectedEmail.subject}</div>
              <div className="text-sm text-slate-500 mt-1">
                Supplier: {selectedEmail.supplier.name}
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Search Quote Requests</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by quote number or title..."
                  className="pl-10"
                  value={quoteRequestSearchTerm}
                  onChange={(e) => setQuoteRequestSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="border rounded-md max-h-60 overflow-y-auto">
              {filteredQuoteRequests.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  No matching quote requests found for this supplier
                </div>
              ) : (
                <div className="divide-y">
                  {filteredQuoteRequests.map((quoteRequest) => (
                    <div
                      key={quoteRequest.id}
                      className={`p-3 cursor-pointer hover:bg-slate-100 ${selectedQuoteRequest === quoteRequest.id ? 'bg-slate-100' : ''}`}
                      onClick={() => setSelectedQuoteRequest(quoteRequest.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{quoteRequest.quoteNumber}</div>
                          <div className="text-sm text-slate-500">{quoteRequest.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {quoteRequest.status}
                            </Badge>
                            
                            {quoteRequest.emailThread && (
                              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200">
                                Has Email Thread
                              </Badge>
                            )}
                          </div>
                        </div>
                        {selectedQuoteRequest === quoteRequest.id && (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAssignToQuoteRequest}
              disabled={!selectedQuoteRequest || isAssigning}
            >
              {isAssigning ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Assign to Quote Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Email Dialog */}
      <Dialog open={isViewEmailDialogOpen} onOpenChange={setIsViewEmailDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
            <DialogDescription>
              View the complete email content
            </DialogDescription>
          </DialogHeader>
          
          {viewingEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">From</h3>
                  <div className="text-sm bg-slate-100 p-2 rounded-md">
                    {viewingEmail.from}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-1">To</h3>
                  <div className="text-sm bg-slate-100 p-2 rounded-md">
                    {viewingEmail.to}
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Subject</h3>
                <div className="text-sm bg-slate-100 p-2 rounded-md">
                  {viewingEmail.subject}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Received</h3>
                <div className="text-sm bg-slate-100 p-2 rounded-md">
                  {formatDate(viewingEmail.receivedAt)}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Supplier</h3>
                <div className="text-sm bg-slate-100 p-2 rounded-md flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{viewingEmail.supplier.name}</span>
                  <Link
                    href={`/suppliers/${viewingEmail.supplier.id}`}
                    className="text-blue-500 hover:underline ml-auto"
                  >
                    <ExternalLink className="h-3 w-3 inline mr-1" />
                    View Supplier
                  </Link>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Message</h3>
                {viewingEmail.bodyHtml ? (
                  <div
                    className="bg-white border rounded-md p-4 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: viewingEmail.bodyHtml }}
                  />
                ) : (
                  <div className="bg-white border rounded-md p-4 whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {viewingEmail.body}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsViewEmailDialogOpen(false)}
            >
              Close
            </Button>
            {viewingEmail && (
              <Button
                type="button"
                onClick={() => {
                  setIsViewEmailDialogOpen(false)
                  openAssignDialog(viewingEmail)
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Assign to Quote Request
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Confirmation Dialog */}
      <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge Email Threads?</DialogTitle>
            <DialogDescription>
              This quote request already has an associated email thread. Would you like to merge the two threads?
            </DialogDescription>
          </DialogHeader>
          
          {mergeData && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
                <p className="text-sm text-amber-800">
                  Merging will move all messages from the orphaned email thread to the existing thread for quote request <span className="font-medium">{mergeData.quoteRequestNumber}</span>.
                </p>
                <p className="text-sm text-amber-800 mt-2">
                  The orphaned email thread will be deleted after merging.
                </p>
              </div>
              
              <DialogFooter className="sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsMergeDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={async () => {
                    try {
                      setIsAssigning(true);
                      
                      // Call the merge API
                      const response = await mergeEmailThreads(
                        mergeData.sourceThreadId,
                        mergeData.targetThreadId
                      );
                      
                      if (response.success) {
                        // Remove the email from the orphaned list
                        setOrphanedEmails(orphanedEmails.filter(e => e.id !== mergeData.sourceThreadId));
                        
                        // Show success message
                        toast({
                          title: "Email threads merged",
                          description: `Email has been successfully merged with the existing thread for quote request ${mergeData.quoteRequestNumber}`,
                        });
                        
                        // Close all dialogs
                        setIsMergeDialogOpen(false);
                        setIsDialogOpen(false);
                        setSelectedEmail(null);
                        setSelectedQuoteRequest("");
                        setQuoteRequestSearchTerm("");
                      }
                    } catch (error) {
                      console.error("Error merging email threads:", error);
                      
                      toast({
                        title: "Error",
                        description: "Failed to merge email threads. Please try again.",
                        variant: "destructive",
                      });
                    } finally {
                      setIsAssigning(false);
                    }
                  }}
                  disabled={isAssigning}
                >
                  {isAssigning ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Merge Threads
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}