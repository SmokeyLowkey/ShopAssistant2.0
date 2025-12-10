"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { QuoteStatus } from "@prisma/client"
import { createQuoteRequest, sendQuoteRequestEmail } from "@/lib/api/quote-requests"
import { getSuppliers, Supplier } from "@/lib/api/suppliers"
import { getVehicles, Vehicle } from "@/lib/api/vehicles"
import {
  ArrowLeft,
  Package,
  Truck,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
  Trash2,
  X,
  Search,
  Mail,
  Check,
  MessageSquare,
  ChevronDown,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"

// Form schema
const quoteRequestFormSchema = z.object({
  supplierIds: z.array(z.string()).min(1, {
    message: "At least one supplier is required",
  }),
  title: z.string().min(3, {
    message: "Title must be at least 3 characters",
  }),
  description: z.string().optional(),
  notes: z.string().optional(),
  expiryDate: z.date().optional(),
  vehicleId: z.string().min(1, {
    message: "Vehicle is required",
  }),
})

type QuoteRequestFormValues = z.infer<typeof quoteRequestFormSchema>

// Interface for quote request items
interface QuoteRequestItem {
  id?: string;
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
}

export default function QuoteRequestPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailProgress, setEmailProgress] = useState<{total: number, sent: number, current: string}>({
    total: 0,
    sent: 0,
    current: ''
  })
  
  // State for suppliers
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [showSupplierSelector, setShowSupplierSelector] = useState(false)
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([])
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("")
  
  // State for vehicles
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loadingVehicles, setLoadingVehicles] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  
  // State for quote request items
  const [items, setItems] = useState<QuoteRequestItem[]>([])
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [newItem, setNewItem] = useState<QuoteRequestItem>({
    partNumber: "",
    description: "",
    quantity: 1,
    unitPrice: undefined,
  })
  
  // State for order totals
  const [orderTotals, setOrderTotals] = useState({
    subtotal: 0,
    total: 0,
  })
  
  // State for conversation ID from pick list
  const [conversationId, setConversationId] = useState<string | null>(null)
  
  // Initialize form
  const form = useForm<QuoteRequestFormValues>({
    resolver: zodResolver(quoteRequestFormSchema),
    defaultValues: {
      supplierIds: [],
      title: "",
      description: "",
      notes: "",
      vehicleId: "",
    },
  })

  // Fetch suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setLoadingSuppliers(true)
        const response = await getSuppliers()
        setSuppliers(response.data)
        
        // Check if supplierId is in URL params
        const supplierIdParam = searchParams.get("supplierId")
        if (supplierIdParam) {
          const supplier = response.data.find(s => s.id === supplierIdParam)
          if (supplier) {
            setSelectedSuppliers([supplier])
            form.setValue("supplierIds", [supplier.id])
          }
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error)
        toast({
          title: "Error",
          description: "Failed to load suppliers. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoadingSuppliers(false)
      }
    }
    
    fetchSuppliers()
  }, [searchParams, form])
  
  // Fetch vehicles
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoadingVehicles(true)
        const response = await getVehicles()
        setVehicles(response.data)
        
        // Check if vehicleId is in URL params
        const vehicleIdParam = searchParams.get("vehicleId")
        if (vehicleIdParam) {
          const vehicle = response.data.find(v => v.id === vehicleIdParam)
          if (vehicle) {
            setSelectedVehicle(vehicle)
            form.setValue("vehicleId", vehicle.id)
          }
        }
      } catch (error) {
        console.error("Error fetching vehicles:", error)
        toast({
          title: "Error",
          description: "Failed to load vehicles. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoadingVehicles(false)
      }
    }
    
    fetchVehicles()
  }, [searchParams, form])
  
  // Check for pick list in URL parameter
  useEffect(() => {
    const pickListId = searchParams.get("pickListId")
    const vehicleId = searchParams.get("vehicleId")
    
    // Set vehicle ID if provided
    if (vehicleId) {
      form.setValue("vehicleId", vehicleId)
    }
    
    if (pickListId) {
      // Fetch pick list data from the API
      fetch(`/api/picklists/${pickListId}`)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            // Store conversationId for navigation
            if (data.data.conversationId) {
              setConversationId(data.data.conversationId)
            }
            
            if (data.data.items && data.data.items.length > 0) {
              // Convert pick list items to quote request items
              const quoteItems: QuoteRequestItem[] = data.data.items.map((item: any) => ({
                partNumber: item.partNumber,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.estimatedPrice,
                totalPrice: (item.estimatedPrice || 0) * item.quantity,
              }))
              
              setItems(quoteItems)
              
              // Calculate order totals
              const subtotal = quoteItems.reduce(
                (sum, item) => sum + (item.unitPrice || 0) * item.quantity,
                0
              )
              
              setOrderTotals({
                subtotal,
                total: subtotal,
              })
              
              // Set a default title based on the first item
              if (quoteItems.length > 0) {
                form.setValue("title", `Quote Request for ${quoteItems[0].partNumber} and ${quoteItems.length - 1} other items`)
              }
            }
          }
        })
        .catch(error => {
          console.error("Error fetching pick list:", error)
          toast({
            title: "Error",
            description: "Failed to load pick list items.",
            variant: "destructive",
          })
        })
    }
  }, [form, searchParams])
  
  // Filter suppliers based on search term
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())
  )
  
  // Handle supplier selection
  const handleSupplierSelect = (supplier: Supplier) => {
    // Check if supplier is already selected
    const isSelected = selectedSuppliers.some(s => s.id === supplier.id)
    
    if (isSelected) {
      // Remove supplier from selection
      const updatedSuppliers = selectedSuppliers.filter(s => s.id !== supplier.id)
      setSelectedSuppliers(updatedSuppliers)
      form.setValue("supplierIds", updatedSuppliers.map(s => s.id))
    } else {
      // Add supplier to selection
      const updatedSuppliers = [...selectedSuppliers, supplier]
      setSelectedSuppliers(updatedSuppliers)
      form.setValue("supplierIds", updatedSuppliers.map(s => s.id))
    }
  }
  
  // Add new item to the quote request
  const handleAddItem = () => {
    if (!newItem.partNumber || !newItem.description || newItem.quantity <= 0) {
      toast({
        title: "Invalid Item",
        description: "Please provide part number, description, and a quantity greater than 0.",
        variant: "destructive",
      })
      return
    }
    
    // Calculate total price
    const totalPrice = (newItem.unitPrice || 0) * newItem.quantity
    
    // Add the item to the list
    const itemWithTotal = {
      ...newItem,
      totalPrice,
    }
    
    setItems([...items, itemWithTotal])
    
    // Update order totals
    const newSubtotal = orderTotals.subtotal + totalPrice
    setOrderTotals({
      subtotal: newSubtotal,
      total: newSubtotal,
    })
    
    // Reset the new item form
    setNewItem({
      partNumber: "",
      description: "",
      quantity: 1,
      unitPrice: undefined,
    })
    
    // Close the dialog
    setShowAddItemDialog(false)
  }
  
  // Remove item from the quote request
  const handleRemoveItem = (index: number) => {
    const item = items[index]
    const newItems = [...items]
    newItems.splice(index, 1)
    setItems(newItems)
    
    // Update order totals
    const newSubtotal = orderTotals.subtotal - (item.totalPrice || 0)
    setOrderTotals({
      subtotal: newSubtotal,
      total: newSubtotal,
    })
  }
  
  // Update item quantity
  const handleUpdateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(index)
      return
    }
    
    const newItems = [...items]
    const item = newItems[index]
    
    // Calculate the old total
    const oldTotal = item.totalPrice || 0
    
    // Update the quantity and total price
    item.quantity = quantity
    item.totalPrice = (item.unitPrice || 0) * quantity
    
    setItems(newItems)
    
    // Update order totals
    const totalDifference = (item.totalPrice || 0) - oldTotal
    setOrderTotals({
      subtotal: orderTotals.subtotal + totalDifference,
      total: orderTotals.total + totalDifference,
    })
  }
  
  // Send email for a quote request
  const sendEmailForQuoteRequest = async (quoteRequestId: string, supplierName: string): Promise<boolean> => {
    try {
      setEmailProgress(prev => ({...prev, current: supplierName}))
      console.log(`Sending email for quote request ${quoteRequestId} to ${supplierName}...`)
      
      // Send the email and wait for response
      const response = await sendQuoteRequestEmail(quoteRequestId)
      
      // Check if the response exists and emails were sent successfully
      if (response && response.totalSent > 0) {
        console.log(`Email sent successfully to ${response.totalSent} supplier(s) for quote request ${quoteRequestId}`)
        setEmailProgress(prev => ({...prev, sent: prev.sent + 1}))
        return true
      }
      
      console.error(`Failed to send email to ${supplierName}: No emails sent`)
      return false
    } catch (error) {
      console.error(`Error sending email to ${supplierName}:`, error)
      return false
    }
  }

  // Form submission handler
  const onSubmit = async (data: QuoteRequestFormValues) => {
    if (items.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the quote request.",
        variant: "destructive",
      })
      return
    }
    
    if (selectedSuppliers.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one supplier for the quote request.",
        variant: "destructive",
      })
      return
    }
    
    setIsSubmitting(true)
    setSubmitError(null)
    setEmailProgress({
      total: selectedSuppliers.length,
      sent: 0,
      current: ''
    })
    
    try {
      // Get pickListId from URL if present
      const pickListId = searchParams.get("pickListId")
      
      // Create a quote request for each selected supplier
      const createdQuoteRequests = []
      
      for (const supplier of selectedSuppliers) {
        // Prepare quote request data with the same items for each supplier
        const quoteRequestData = {
          supplierId: supplier.id,
          title: data.title,
          description: data.description,
          notes: data.notes,
          expiryDate: data.expiryDate?.toISOString(),
          items: items, // Same picklist items for each supplier
          vehicleId: data.vehicleId, // Add vehicle ID if selected
          pickListId: pickListId || undefined, // Add pickListId if available
        }
        
        // Submit to API
        const response = await createQuoteRequest(quoteRequestData)
        
        if (response.data) {
          createdQuoteRequests.push({
            id: response.data.id,
            supplierId: supplier.id,
            supplierName: supplier.name
          })
        }
      }
      
      if (createdQuoteRequests.length > 0) {
        toast({
          title: "Quote Requests Created",
          description: `Created ${createdQuoteRequests.length} quote request(s) successfully.`,
        })
        
        // Immediately send emails to all suppliers
        setIsSendingEmail(true)
        
        // Send emails sequentially and wait for each to complete with 200 response
        let successCount = 0
        let failCount = 0
        
        // Process each quote request one by one
        for (let i = 0; i < createdQuoteRequests.length; i++) {
          const request = createdQuoteRequests[i]
          console.log(`Processing email ${i+1}/${createdQuoteRequests.length} for quote request ${request.id} to ${request.supplierName}`)
          
          // Wait for the email to be sent and get a 200 response
          const success = await sendEmailForQuoteRequest(request.id, request.supplierName)
          
          if (success) {
            successCount++
            toast({
              title: "Email Sent",
              description: `Successfully sent quote request to ${request.supplierName}.`,
            })
          } else {
            failCount++
            toast({
              title: "Warning",
              description: `Failed to send email to ${request.supplierName}. You can try again later.`,
              variant: "destructive",
            })
          }
          
          // Add a small delay between requests to ensure they're processed sequentially
          if (i < createdQuoteRequests.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
        
        // All emails sent, show summary and redirect to orders page
        toast({
          title: "Quote Request Process Complete",
          description: `Created ${createdQuoteRequests.length} quote requests and sent ${successCount} emails successfully.`,
        })
        
        // Redirect after a short delay
        setTimeout(() => {
          router.push("/orders")
        }, 2000)
      }
    } catch (error) {
      console.error("Error creating quote request:", error)
      setSubmitError("Failed to create quote request. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }
  

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Orders
            </Link>
          </Button>
        </div>
        <h1 className="text-2xl font-bold">Create Quote Request</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Quote Request Details</CardTitle>
              <CardDescription>
                Request quotes from suppliers for parts and supplies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSendingEmail ? (
                <div className="bg-blue-50 p-6 rounded-lg text-center">
                  <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
                  <h3 className="text-lg font-medium text-blue-800">Sending Quote Request Emails</h3>
                  <p className="text-blue-600 mt-2 mb-4">
                    Sending email to {emailProgress.current}...
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${(emailProgress.sent / emailProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-blue-600">
                    {emailProgress.sent} of {emailProgress.total} emails sent
                  </p>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    {submitError && (
                      <div className="bg-destructive/10 p-4 rounded-md flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                        <div>
                          <p className="text-destructive font-medium">Error</p>
                          <p className="text-destructive/80 text-sm">{submitError}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="supplierIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Suppliers*</FormLabel>
                            <div className="flex gap-2">
                              <Dialog open={showSupplierSelector} onOpenChange={setShowSupplierSelector}>
                                <DialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full justify-between"
                                    onClick={() => setShowSupplierSelector(true)}
                                  >
                                    {selectedSuppliers.length > 0
                                      ? `${selectedSuppliers.length} supplier(s) selected`
                                      : "Select suppliers"}
                                    <Search className="w-4 h-4 ml-2" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Select Suppliers</DialogTitle>
                                  </DialogHeader>
                                  <div className="py-4">
                                    <div className="mb-4">
                                      <Input
                                        placeholder="Search suppliers..."
                                        value={supplierSearchTerm}
                                        onChange={(e) => setSupplierSearchTerm(e.target.value)}
                                        className="mb-4"
                                      />
                                    </div>
                                    {loadingSuppliers ? (
                                      <div className="flex justify-center py-8">
                                        <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
                                      </div>
                                    ) : filteredSuppliers.length === 0 ? (
                                      <div className="text-center py-8">
                                        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-muted-foreground">No suppliers found</p>
                                        <Link href="/suppliers/new">
                                          <Button className="mt-4">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Supplier
                                          </Button>
                                        </Link>
                                      </div>
                                    ) : (
                                      <ScrollArea className="h-[300px] pr-4">
                                        <div className="space-y-2">
                                          {filteredSuppliers.map((supplier) => (
                                            <div
                                              key={supplier.id}
                                              className="p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                                              onClick={() => handleSupplierSelect(supplier)}
                                            >
                                              <div className="flex items-center justify-between">
                                                <div className="font-medium">{supplier.name}</div>
                                                {selectedSuppliers.some(s => s.id === supplier.id) && (
                                                  <Check className="h-4 w-4 text-green-500" />
                                                )}
                                              </div>
                                              {supplier.email && (
                                                <div className="text-xs text-muted-foreground">
                                                  Email: {supplier.email}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title*</FormLabel>
                            <FormControl>
                              <Input placeholder="Quote request title" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Provide a detailed description of what you're requesting" 
                                className="min-h-[100px]" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="vehicleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehicle*</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a vehicle" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {loadingVehicles ? (
                                  <div className="flex justify-center py-4">
                                    <div className="animate-spin h-4 w-4 border-2 border-primary rounded-full border-t-transparent"></div>
                                  </div>
                                ) : vehicles.length === 0 ? (
                                  <div className="p-4 text-center text-sm text-muted-foreground">
                                    No vehicles found
                                  </div>
                                ) : (
                                  vehicles.map((vehicle) => (
                                    <SelectItem key={vehicle.id} value={vehicle.id}>
                                      {vehicle.year} {vehicle.make} {vehicle.model} ({vehicle.vehicleId})
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Select the vehicle this quote request is for
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="expiryDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                onChange={(e) => {
                                  const date = e.target.value ? new Date(e.target.value) : undefined;
                                  field.onChange(date);
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              When do you need the quote by?
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Additional information for the supplier" 
                                className="min-h-[100px]" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-between gap-4">
                      <Button variant="outline" type="button" asChild>
                        <Link href="/orders">Cancel</Link>
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isSubmitting || items.length === 0 || selectedSuppliers.length === 0}
                          onClick={async () => {
                            if (items.length === 0 || selectedSuppliers.length === 0) return
                            
                            try {
                              setSaving(true)
                              const pickListId = searchParams.get("pickListId")
                              
                              // Create draft for first supplier (user can change later)
                              const response = await fetch('/api/quote-requests', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  supplierId: selectedSuppliers[0].id,
                                  title: form.getValues('title') || 'Draft Quote Request',
                                  description: form.getValues('description'),
                                  notes: form.getValues('notes'),
                                  expiryDate: form.getValues('expiryDate')?.toISOString(),
                                  items,
                                  vehicleId: form.getValues('vehicleId'),
                                  pickListId: pickListId || undefined,
                                }),
                              })
                              
                              const data = await response.json()
                              
                              if (data.data?.id) {
                                toast({
                                  title: "Draft Saved",
                                  description: "Quote request saved as draft.",
                                })
                                router.push(`/orders/quote-request/${data.data.id}/edit`)
                              }
                            } catch (error) {
                              console.error('Error saving draft:', error)
                              toast({
                                title: "Error",
                                description: "Failed to save draft. Please try again.",
                                variant: "destructive",
                              })
                            } finally {
                              setSaving(false)
                            }
                          }}
                        >
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Save className="w-4 h-4 mr-2" />
                          Save Draft
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSubmitting || items.length === 0 || selectedSuppliers.length === 0}
                        >
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {selectedSuppliers.length > 1 ? "Create Quote Requests" : "Create Quote Request"}
                        </Button>
                      </div>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">
                Quote Items
              </CardTitle>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowAddItemDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Manually
                    </DropdownMenuItem>
                    {conversationId && (
                      <DropdownMenuItem asChild>
                        <Link href={`/parts?conversation=${conversationId}`}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Go to Conversation
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Item to Quote Request</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="partNumber">Part Number*</Label>
                        <Input
                          id="partNumber"
                          value={newItem.partNumber}
                          onChange={(e) => setNewItem({ ...newItem, partNumber: e.target.value })}
                          placeholder="e.g. 1R-0750"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity*</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description*</Label>
                      <Input
                        id="description"
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        placeholder="Item description"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unitPrice">Unit Price (Optional)</Label>
                      <Input
                        id="unitPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItem.unitPrice || ""}
                        onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || undefined })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddItem}>
                        Add Item
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No items added yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add items from the parts page or use the Add Item button
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="font-medium">{item.partNumber}</div>
                              <div className="text-xs text-muted-foreground">{item.description}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                                >
                                  -
                                </Button>
                                <span className="w-8 text-center">{item.quantity}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.unitPrice ? `$${item.unitPrice.toFixed(2)}` : "TBD"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleRemoveItem(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-sm">Subtotal</span>
                      <span>${orderTotals.subtotal.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>${orderTotals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-md font-medium">Quote Request Process</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-full p-1 mt-0.5">
                    <span className="text-xs font-bold text-primary">1</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Create Quote Request</h4>
                    <p className="text-xs text-muted-foreground">Add items and select a supplier</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-full p-1 mt-0.5">
                    <span className="text-xs font-bold text-primary">2</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Send to Supplier</h4>
                    <p className="text-xs text-muted-foreground">Email the quote request to the supplier</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-full p-1 mt-0.5">
                    <span className="text-xs font-bold text-primary">3</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Receive Quote</h4>
                    <p className="text-xs text-muted-foreground">Supplier responds with pricing</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-full p-1 mt-0.5">
                    <span className="text-xs font-bold text-primary">4</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Convert to Order</h4>
                    <p className="text-xs text-muted-foreground">Approve the quote and create an order</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}