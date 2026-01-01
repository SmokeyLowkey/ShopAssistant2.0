"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { getQuoteRequest, updateQuoteRequest, updateQuoteRequestItem, addQuoteRequestItem, deleteQuoteRequestItem, createQuoteRequest } from "@/lib/api/quote-requests"
import { getVehicles, Vehicle } from "@/lib/api/vehicles"
import { getSuppliers, Supplier } from "@/lib/api/suppliers"
import { QuoteStatus } from "@prisma/client"
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle, Loader2, MessageSquare, ChevronDown, X, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/use-toast"
import { formatDate } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AppLayout } from "@/components/layout/app-layout"

export default function EditQuoteRequestPage() {
  const router = useRouter()
  const params = useParams()
  const quoteRequestId = params.id as string
  
  const [quoteRequest, setQuoteRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [notes, setNotes] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [items, setItems] = useState<any[]>([])
  const [vehicleId, setVehicleId] = useState<string | undefined>(undefined)
  const [supplierId, setSupplierId] = useState<string>("")  
  const [additionalSupplierIds, setAdditionalSupplierIds] = useState<string[]>([])
  const [showSupplierSelector, setShowSupplierSelector] = useState(false)
  // State for vehicles and suppliers
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingVehicles, setLoadingVehicles] = useState(false)
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  
  // Fetch quote request data
  useEffect(() => {
    const fetchQuoteRequest = async () => {
      try {
        setLoading(true)
        const response = await getQuoteRequest(quoteRequestId)
        const data = response.data
        
        setQuoteRequest(data)
        setTitle(data.title || "")
        setDescription(data.description || "")
        setNotes(data.notes || "")
        setExpiryDate(data.expiryDate ? new Date(data.expiryDate).toISOString().split('T')[0] : "")
        setItems(data.items || [])
        setVehicleId(data.vehicleId || undefined)
        setSupplierId(data.supplierId || "")
        
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
  
  // Fetch vehicles
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoadingVehicles(true)
        const response = await getVehicles()
        setVehicles(response.data)
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
  }, [])
  
  // Fetch suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setLoadingSuppliers(true)
        const response = await getSuppliers()
        setSuppliers(response.data)
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
  }, [])
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      
      // Update quote request
      const updateData = {
        title,
        description,
        notes,
        expiryDate: expiryDate || undefined,
        vehicleId: vehicleId || null,
      }
      
      console.log('Updating quote request with data:', updateData)
      
      // Filter out incomplete items
      const validItems = items.filter(item => 
        item.partNumber && item.description && item.quantity
      )
      
      // Update quote request with all items at once
      await updateQuoteRequest(quoteRequestId, {
        ...updateData,
        items: validItems,
        additionalSupplierIds, // Send additional supplier IDs to backend
      })
      
      const totalSuppliers = 1 + additionalSupplierIds.length
      const message = totalSuppliers > 1 
        ? `Quote request updated and will be sent to ${totalSuppliers} suppliers`
        : "Quote request updated successfully"
      
      toast({
        title: "Success",
        description: message,
      })
      
      // Redirect back to quote request view
      router.push(`/orders/quote-request/${quoteRequestId}`)
    } catch (error: any) {
      console.error("Error updating quote request:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      toast({
        title: "Error",
        description: error?.error || error?.message || "Failed to update quote request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }
  
  // Handle adding a new item
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        partNumber: "",
        description: "",
        quantity: 1,
        unitPrice: undefined,
        totalPrice: undefined,
      },
    ])
  }
  
  // Handle removing an item
  const handleRemoveItem = async (index: number) => {
    const item = items[index]
    
    // If item has an ID, delete it from the server
    if (item.id) {
      try {
        await deleteQuoteRequestItem(quoteRequestId, item.id)
        toast({
          title: "Item Removed",
          description: "The item has been removed from the quote request.",
        })
      } catch (error) {
        console.error("Error deleting item:", error)
        toast({
          title: "Error",
          description: "Failed to remove item. Please try again.",
          variant: "destructive",
        })
        return
      }
    }
    
    // Remove from local state
    const newItems = [...items]
    newItems.splice(index, 1)
    setItems(newItems)
  }
  
  // Handle item field changes
  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    }
    
    // Auto-calculate total price if unit price and quantity are available
    if (field === 'unitPrice' || field === 'quantity') {
      const item = newItems[index]
      if (item.unitPrice && item.quantity) {
        item.totalPrice = item.unitPrice * item.quantity
      }
    }
    
    setItems(newItems)
  }
  
  // Handle additional supplier toggle
  const handleAdditionalSupplierToggle = (suppId: string) => {
    if (additionalSupplierIds.includes(suppId)) {
      setAdditionalSupplierIds(additionalSupplierIds.filter(id => id !== suppId))
    } else {
      setAdditionalSupplierIds([...additionalSupplierIds, suppId])
    }
  }
  
  // Check if the quote request can be edited
  const canEdit = quoteRequest && 
    quoteRequest.status !== QuoteStatus.CONVERTED_TO_ORDER &&
    quoteRequest.status !== QuoteStatus.REJECTED
  
  return (
    <AppLayout activeRoute="/orders">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="mr-4 text-slate-400 hover:text-white"
          onClick={() => router.push(`/orders/quote-request/${quoteRequestId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white">Edit Quote Request</h1>
          <p className="text-slate-400">Edit the basic information for this quote request</p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" className="text-orange-600 hover:bg-slate-700 hover:text-white" asChild>
          <Link href={`/parts?quoteRequestId=${quoteRequestId}`}>
            <MessageSquare className="w-4 h-4 mr-1" />
            Go to Parts Search
          </Link>
        </Button>
      </div>
      
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
      ) : !canEdit ? (
        <div className="bg-yellow-900/20 p-8 rounded-md text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-4" />
          <p className="text-yellow-500 font-medium text-lg">
            This quote request cannot be edited because it has been {
              quoteRequest?.status === QuoteStatus.CONVERTED_TO_ORDER ? 'converted to an order' : 'rejected'
            }.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-4"
            asChild
          >
            <Link href={`/orders/quote-request/${quoteRequestId}`}>
              View Quote Request
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6">
            {quoteRequest?.status === QuoteStatus.DRAFT && (
              <div className="bg-blue-900/20 border border-blue-700 p-4 rounded-md">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-600">Draft Quote Request</p>
                    <p className="text-sm text-black mt-1">
                      This quote request is in draft status. After saving your changes, you can send it to the supplier from the quote details page.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="text-white">Quote Request Details</CardTitle>
                <CardDescription className="text-slate-400">
                  Edit the basic information for this quote request
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-white">Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiryDate" className="text-white">Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier" className="text-white">Supplier *</Label>
                  <Select
                    value={supplierId}
                    onValueChange={(value) => setSupplierId(value)}
                    required
                  >
                    <SelectTrigger id="supplier">
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {suppliers.length === 0 && !loadingSuppliers && (
                    <p className="text-sm text-yellow-600">
                      No suppliers found. <Link href="/suppliers/new" className="underline">Create one</Link>
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-white">Also Send to Additional Suppliers (Optional)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSupplierSelector(!showSupplierSelector)}
                    >
                      {showSupplierSelector ? (
                        <><X className="w-4 h-4 mr-1" /> Hide</>
                      ) : (
                        <><Copy className="w-4 h-4 mr-1" /> Select Suppliers</>
                      )}
                    </Button>
                  </div>
                  
                  {showSupplierSelector && (
                    <Card className="border-slate-600">
                      <CardContent className="pt-4">
                        <p className="text-sm text-slate-500 mb-3">
                          Select additional suppliers to create duplicate quote requests with the same items.
                        </p>
                        <ScrollArea className="h-48">
                          <div className="space-y-2">
                            {suppliers
                              .filter(s => s.id !== supplierId)
                              .map((supplier) => (
                                <div
                                  key={supplier.id}
                                  className="flex items-center space-x-2 p-2 rounded hover:bg-slate-100"
                                >
                                  <Checkbox
                                    id={`supplier-${supplier.id}`}
                                    checked={additionalSupplierIds.includes(supplier.id)}
                                    onCheckedChange={() => handleAdditionalSupplierToggle(supplier.id)}
                                  />
                                  <label
                                    htmlFor={`supplier-${supplier.id}`}
                                    className="flex-1 text-sm cursor-pointer"
                                  >
                                    {supplier.name}
                                    {supplier.email && (
                                      <span className="text-xs text-slate-500 block">{supplier.email}</span>
                                    )}
                                  </label>
                                </div>
                              ))}
                          </div>
                        </ScrollArea>
                        {additionalSupplierIds.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm font-medium mb-2">Selected ({additionalSupplierIds.length}):</p>
                            <div className="flex flex-wrap gap-2">
                              {additionalSupplierIds.map((suppId) => {
                                const supplier = suppliers.find(s => s.id === suppId)
                                return supplier ? (
                                  <Badge key={suppId} variant="secondary" className="flex items-center gap-1">
                                    {supplier.name}
                                    <X
                                      className="w-3 h-3 cursor-pointer"
                                      onClick={() => handleAdditionalSupplierToggle(suppId)}
                                    />
                                  </Badge>
                                ) : null
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="vehicle" className="text-white">Vehicle</Label>
                  <Select
                    value={vehicleId || "none"}
                    onValueChange={(value) => setVehicleId(value === "none" ? undefined : value)}
                  >
                    <SelectTrigger id="vehicle">
                      <SelectValue placeholder="Select a vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.make} {vehicle.model} ({vehicle.vehicleId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-white">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-white">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Additional notes for the supplier"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white">Items</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          <Plus className="w-4 h-4 mr-1" />
                          Add Item
                          <ChevronDown className="w-4 h-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleAddItem}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Manually
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/parts?quoteRequestId=${quoteRequestId}`}>
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Go to Parts Search
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="border border-slate-700 rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Part Number</TableHead>
                          <TableHead className="text-slate-300">Description</TableHead>
                          <TableHead className="text-right text-slate-300">Quantity</TableHead>
                          <TableHead className="text-right text-slate-300">Unit Price</TableHead>
                          <TableHead className="text-right text-slate-300">Total</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length === 0 ? (
                          <TableRow className="border-slate-700">
                            <TableCell colSpan={6} className="text-center py-4 text-slate-400">
                              No items added. Click "Add Item" to add a new item.
                            </TableCell>
                          </TableRow>
                        ) : (
                          items.map((item, index) => (
                            <TableRow key={item.id || `new-${index}`} className="border-slate-700">
                              <TableCell>
                                <Input
                                  value={item.partNumber || ""}
                                  onChange={(e) => handleItemChange(index, "partNumber", e.target.value)}
                                  placeholder="Part #"
                                  className="w-full bg-slate-700 border-slate-600 text-white"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.description || ""}
                                  onChange={(e) => handleItemChange(index, "description", e.target.value)}
                                  placeholder="Description"
                                  className="w-full bg-slate-700 border-slate-600 text-white"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity || ""}
                                  onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value, 10))}
                                  className="w-20 ml-auto bg-slate-700 border-slate-600 text-white"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice || ""}
                                  onChange={(e) => handleItemChange(index, "unitPrice", parseFloat(e.target.value))}
                                  className="w-24 ml-auto bg-slate-700 border-slate-600 text-white"
                                  placeholder="0.00"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.totalPrice || ""}
                                  onChange={(e) => handleItemChange(index, "totalPrice", parseFloat(e.target.value))}
                                  className="w-24 ml-auto bg-slate-700 border-slate-600 text-white"
                                  placeholder="0.00"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(index)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/orders/quote-request/${quoteRequestId}`)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </div>
        </form>
      )}
    </AppLayout>
  )
}