"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { OrderStatus, Priority } from "@prisma/client"
import { createOrder, calculateOrderTotals, CreateOrderData, CreateOrderItemData } from "@/lib/api/orders"
import { getSuppliers, Supplier } from "@/lib/api/suppliers"
import { getParts } from "@/lib/api/parts"
import { getPickList, getPickListItems, updatePickListItem, deletePickListItem } from "@/lib/api/picklists"
import {
  ArrowLeft,
  Package,
  Truck,
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
  Trash2,
  X,
  Search,
  ShoppingCart,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { ScrollArea } from "@/components/ui/scroll-area"

// Form schema
const orderFormSchema = z.object({
  supplierIds: z.array(z.string()).min(1, {
    message: "At least one supplier is required",
  }),
  status: z.nativeEnum(OrderStatus).default(OrderStatus.PENDING_QUOTE),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  expectedDelivery: z.string().optional(),
  notes: z.string().optional(),
  shippingMethod: z.string().optional(),
  trackingNumber: z.string().optional(),
})

type OrderFormValues = z.infer<typeof orderFormSchema>

// Interface for pick list items
interface PickListItem {
  id: string
  partNumber: string
  description: string
  estimatedPrice?: number
  quantity: number
  isOrdered: boolean
  price?: number // For backward compatibility with UI
  partId?: string // For backward compatibility with order creation
}

export default function NewOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  
  // State for suppliers
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [showSupplierSelector, setShowSupplierSelector] = useState(false)
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([])
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("")
  
  // State for pick list
  const [pickList, setPickList] = useState<PickListItem[]>([])
  const [pickListId, setPickListId] = useState<string | null>(null)
  const [loadingPickList, setLoadingPickList] = useState(false)
  
  // State for order totals
  const [orderTotals, setOrderTotals] = useState({
    subtotal: 0,
    tax: 0,
    shipping: 0,
    total: 0,
  })
  
  // Initialize form
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      status: OrderStatus.PENDING_QUOTE,
      priority: Priority.MEDIUM,
      notes: "",
      shippingMethod: "",
      trackingNumber: "",
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
  
  // Check for pick list in local storage first (for backward compatibility)
  // Then try to fetch from the database
  useEffect(() => {
    const loadPickList = async () => {
      setLoadingPickList(true)
      
      try {
        // First check local storage (backward compatibility)
        const storedPickList = localStorage.getItem("pickList")
        if (storedPickList) {
          try {
            const parsedPickList = JSON.parse(storedPickList)
            if (Array.isArray(parsedPickList) && parsedPickList.length > 0) {
              setPickList(parsedPickList)
              
              // Calculate order totals
              const orderItems: CreateOrderItemData[] = parsedPickList.map(item => ({
                partId: item.partId,
                quantity: item.quantity,
                unitPrice: item.price || item.estimatedPrice || 0,
              }))
              
              const totals = calculateOrderTotals(orderItems, 0, 0)
              setOrderTotals(totals)
              setLoadingPickList(false)
              return
            }
          } catch (error) {
            console.error("Error parsing pick list from storage:", error)
          }
        }
        
        // If no pick list in local storage, try to fetch from API
        // Get the pick list ID from URL params
        const pickListIdParam = searchParams.get("pickListId")
        if (pickListIdParam) {
          const response = await getPickList(pickListIdParam)
          if (response.data) {
            setPickListId(response.data.id)
            
            // Get the items for this pick list
            const itemsResponse = await getPickListItems(response.data.id)
            if (itemsResponse.data) {
              const items = itemsResponse.data.map((item: any) => ({
                ...item,
                price: item.estimatedPrice // Map estimatedPrice to price for compatibility
              }))
              setPickList(items)
              
              // Calculate order totals
              const orderItems: CreateOrderItemData[] = items.map((item: any) => ({
                partId: item.partId || "", // This might need to be fetched separately
                quantity: item.quantity,
                unitPrice: item.estimatedPrice || 0,
              }))
              
              const totals = calculateOrderTotals(orderItems, 0, 0)
              setOrderTotals(totals)
            }
          }
        }
      } catch (error) {
        console.error("Error loading pick list:", error)
        toast({
          title: "Error",
          description: "Failed to load pick list. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoadingPickList(false)
      }
    }
    
    loadPickList()
  }, [searchParams])
  
  // Filter suppliers based on search term
  const filteredSuppliers = suppliers.filter(supplier => 
    supplier.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
    (supplier.contactName && supplier.contactName.toLowerCase().includes(supplierSearchTerm.toLowerCase()))
  )
  
  // Handle supplier selection
  const handleSupplierSelect = (supplier: Supplier) => {
    // Check if supplier is already selected
    const isSelected = selectedSuppliers.some(s => s.id === supplier.id)
    
    if (isSelected) {
      // Remove supplier if already selected
      const updatedSuppliers = selectedSuppliers.filter(s => s.id !== supplier.id)
      setSelectedSuppliers(updatedSuppliers)
      form.setValue("supplierIds", updatedSuppliers.map(s => s.id))
    } else {
      // Add supplier if not already selected
      const updatedSuppliers = [...selectedSuppliers, supplier]
      setSelectedSuppliers(updatedSuppliers)
      form.setValue("supplierIds", updatedSuppliers.map(s => s.id))
    }
  }
  
  // Close supplier selector
  const closeSupplierSelector = () => {
    setShowSupplierSelector(false)
  }
  
  // Handle quantity update
  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromPickList(id)
      return
    }
    
    // Update locally first for immediate UI feedback
    const updatedPickList = pickList.map(item => 
      item.id === id ? { ...item, quantity } : item
    )
    
    setPickList(updatedPickList)
    
    // Update order totals
    const orderItems: CreateOrderItemData[] = updatedPickList.map(item => ({
      partId: item.partId || "",
      quantity: item.quantity,
      unitPrice: item.price || item.estimatedPrice || 0,
    }))
    
    const totals = calculateOrderTotals(orderItems, 0, 0)
    setOrderTotals(totals)
    
    // If we have a pick list ID, update in the database
    if (pickListId) {
      try {
        await updatePickListItem(pickListId, id, { quantity })
      } catch (error) {
        console.error("Error updating item quantity:", error)
        toast({
          title: "Error",
          description: "Failed to update item quantity. Please try again.",
          variant: "destructive",
        })
      }
    }
  }
  
  // Remove item from pick list
  const removeFromPickList = async (id: string) => {
    // Update locally first for immediate UI feedback
    const updatedPickList = pickList.filter(item => item.id !== id)
    setPickList(updatedPickList)
    
    // Update order totals
    const orderItems: CreateOrderItemData[] = updatedPickList.map(item => ({
      partId: item.partId || "",
      quantity: item.quantity,
      unitPrice: item.price || item.estimatedPrice || 0,
    }))
    
    const totals = calculateOrderTotals(orderItems, 0, 0)
    setOrderTotals(totals)
    
    // If we have a pick list ID, update in the database
    if (pickListId) {
      try {
        await deletePickListItem(pickListId, id)
      } catch (error) {
        console.error("Error removing item from pick list:", error)
        toast({
          title: "Error",
          description: "Failed to remove item from pick list. Please try again.",
          variant: "destructive",
        })
      }
    }
  }
  
  // Clear pick list
  const clearPickList = () => {
    setPickList([])
    setOrderTotals({
      subtotal: 0,
      tax: 0,
      shipping: 0,
      total: 0,
    })
    localStorage.removeItem("pickList")
    
    // We don't delete the pick list from the database, just clear it locally
    // The user might want to go back to the parts page and continue adding items
  }
  
  // Form submission handler
  const onSubmit = async (data: OrderFormValues) => {
    if (pickList.length === 0) {
      toast({
        title: "Error",
        description: "Your pick list is empty. Please add items before creating an order.",
        variant: "destructive",
      })
      return
    }
    
    setIsSubmitting(true)
    setSubmitError(null)
    
    try {
      // Prepare order items
      const orderItems: CreateOrderItemData[] = pickList.map(item => ({
        partId: item.partId || "", // This might need to be fetched separately
        quantity: item.quantity,
        unitPrice: item.price || item.estimatedPrice || 0,
      }))
      
      // Calculate order totals
      const totals = calculateOrderTotals(orderItems, 0, 0)
      
      // Create an order for each selected supplier
      for (const supplierId of data.supplierIds) {
        // Prepare order data
        const orderData: CreateOrderData = {
          supplierId: supplierId,
          status: data.status,
          subtotal: totals.subtotal,
          tax: totals.tax,
          shipping: totals.shipping,
          total: totals.total,
          notes: data.notes || undefined,
          shippingAddress: undefined, // Add UI for this if needed
          trackingNumber: data.trackingNumber || undefined,
          items: orderItems,
        }
        
        // Submit to API
        await createOrder(orderData)
      }
      
      setSubmitSuccess(true)
      toast({
        title: "Orders created",
        description: `${data.supplierIds.length} order(s) have been successfully created.`,
      })
      
      // Clear pick list from storage
      localStorage.removeItem("pickList")
      
      // If we have a pick list ID, mark items as ordered in the database
      if (pickListId) {
        try {
          // Update each item to mark it as ordered
          for (const item of pickList) {
            await updatePickListItem(pickListId, item.id, { isOrdered: true })
          }
        } catch (error) {
          console.error("Error updating pick list items:", error)
        }
      }
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push("/orders")
      }, 1500)
    } catch (error) {
      console.error("Error creating order:", error)
      setSubmitError("Failed to create order. Please try again.")
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Request Quote</CardTitle>
              <CardDescription>
                Request a quote for parts and supplies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitSuccess ? (
                <div className="bg-green-50 p-6 rounded-lg text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-green-800">Order Created Successfully</h3>
                  <p className="text-green-600 mt-2">Redirecting to orders list...</p>
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
                                              {supplier.contactName && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                  Contact: {supplier.contactName}
                                                </div>
                                              )}
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
                                  <div className="flex justify-end mt-4">
                                    <Button onClick={closeSupplierSelector}>
                                      Done
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <FormControl>
                                <Input
                                  value="Pending Quote"
                                  disabled
                                  className="bg-slate-100"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Priority</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select priority" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value={Priority.LOW}>Low</SelectItem>
                                  <SelectItem value={Priority.MEDIUM}>Medium</SelectItem>
                                  <SelectItem value={Priority.HIGH}>High</SelectItem>
                                  <SelectItem value={Priority.CRITICAL}>Critical</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

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

                    <div className="flex justify-end gap-4">
                      <Button variant="outline" type="button" asChild>
                        <Link href="/orders">Cancel</Link>
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting || pickList.length === 0 || selectedSuppliers.length === 0}
                      >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Get Quote
                      </Button>
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
              <CardTitle className="text-md font-medium">
                Pick List
                {pickListId && (
                  <Badge variant="outline" className="ml-2">
                    From Database
                  </Badge>
                )}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearPickList}
                disabled={pickList.length === 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {loadingPickList ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
                </div>
              ) : pickList.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Your pick list is empty</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add items from the parts page
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
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pickList.map((item) => (
                          <TableRow key={item.id}>
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
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                >
                                  -
                                </Button>
                                <span className="w-8 text-center">{item.quantity}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              ${(item.price || item.estimatedPrice || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              ${((item.price || item.estimatedPrice || 0) * item.quantity).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => removeFromPickList(item.id)}
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
                    <div className="flex justify-between">
                      <span className="text-sm">Tax</span>
                      <span>${orderTotals.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Shipping</span>
                      <span>${orderTotals.shipping.toFixed(2)}</span>
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
        </div>
      </div>
    </div>
  )
}