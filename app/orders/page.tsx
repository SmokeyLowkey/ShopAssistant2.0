"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getOrders, getOrderStatusLabel, formatCurrency } from "@/lib/api"
import { getQuoteRequests, getQuoteRequestsBySupplier, deleteQuoteRequest } from "@/lib/api/quote-requests"
import {
  Search,
  Truck,
  Settings,
  BarChart3,
  Package,
  Users,
  Wrench,
  FileText,
  Plus,
  Filter,
  MoreHorizontal,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Eye,
  Trash2,
  AlertTriangle,
  ShoppingCart,
  DollarSign,
  TruckIcon,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { OrderStatus, QuoteStatus } from "@prisma/client"
import { AppLayout } from "@/components/layout/app-layout"
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
import { toast } from "@/components/ui/use-toast"

// Interface for the transformed order data
interface DisplayOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderDate: string;
  expectedDelivery?: string | null;
  actualDelivery?: string | null;
  supplier: {
    id: string;
    name: string;
  };
  vehicle?: {
    id: string;
    vehicleId: string;
    make: string;
    model: string;
  } | null;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  itemCount: number;
}

// Interface for the transformed quote request data
interface DisplayQuoteRequest {
  id: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  requestDate: string;
  expiryDate?: string | null;
  supplier: {
    id: string;
    name: string;
  };
  totalAmount?: number;
  itemCount: number;
  isQuoteRequest: true; // Flag to distinguish from orders
  vehicle?: {
    id: string;
    vehicleId: string;
    make: string;
    model: string;
  } | null;
}

// Combined type for display items
type DisplayItem = DisplayOrder | DisplayQuoteRequest;

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"all" | "orders" | "quotes">("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [quoteToDelete, setQuoteToDelete] = useState<{ id: string; number: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // State for data
  const [items, setItems] = useState<DisplayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState([
    { label: "Total Orders", value: "0", icon: Package },
    { label: "Pending", value: "0", icon: Clock, color: "text-yellow-600" },
    { label: "In Transit", value: "0", icon: TruckIcon, color: "text-blue-600" },
    { label: "Delivered", value: "0", icon: CheckCircle, color: "text-green-600" },
  ])

  // Fetch orders and quote requests data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Fetch orders
        const ordersResponse = await getOrders()
        
        // Transform orders data to display format
        const displayOrders: DisplayOrder[] = ordersResponse.data.map((order: any) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          orderDate: new Date(order.orderDate).toLocaleDateString(),
          expectedDelivery: order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString() : null,
          actualDelivery: order.actualDelivery ? new Date(order.actualDelivery).toLocaleDateString() : null,
          supplier: order.supplier,
          vehicle: order.vehicle,
          subtotal: order.subtotal,
          tax: order.tax || 0,
          shipping: order.shipping || 0,
          total: order.total,
          itemCount: order.orderItems?.length || 0,
        }))
        
        // Fetch quote requests, including those with email threads
        const quotesResponse = await getQuoteRequests({ includeWithEmailThread: true })
        
        console.log("Quote requests fetched:", quotesResponse.data.length);
        
        // Log each quote request with its email thread info
        quotesResponse.data.forEach((quote: any, index: number) => {
          console.log(`Quote #${index + 1}: ID=${quote.id}, Number=${quote.quoteNumber}, Title=${quote.title}`);
          console.log(`  Has EmailThread: ${quote.emailThread ? 'Yes' : 'No'}`);
          if (quote.emailThread) {
            console.log(`  EmailThread ID: ${quote.emailThread.id}`);
            console.log(`  Message Count: ${quote.emailThread.messages?.length || 0}`);
          }
        });
        
        // Transform quote requests data to display format
        const displayQuotes: DisplayQuoteRequest[] = quotesResponse.data.map((quote: any) => ({
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          title: quote.title,
          status: quote.status,
          requestDate: new Date(quote.requestDate).toLocaleDateString(),
          expiryDate: quote.expiryDate ? new Date(quote.expiryDate).toLocaleDateString() : null,
          supplier: quote.supplier,
          totalAmount: quote.totalAmount,
          itemCount: quote.items?.length || 0,
          isQuoteRequest: true,
          vehicle: quote.vehicle || null,
        }))
        
        // Combine orders and quotes
        const allItems = [...displayOrders, ...displayQuotes]
        setItems(allItems)
        
        // Update stats
        const totalOrders = displayOrders.length
        const pendingOrders = displayOrders.filter(o =>
          o.status === OrderStatus.PENDING ||
          o.status === OrderStatus.PENDING_QUOTE ||
          o.status === OrderStatus.PROCESSING
        ).length
        const inTransit = displayOrders.filter(o => o.status === OrderStatus.IN_TRANSIT).length
        const delivered = displayOrders.filter(o => o.status === OrderStatus.DELIVERED).length
        
        // Add quote requests to pending count
        const pendingQuotes = displayQuotes.length
        
        setStats([
          { label: "Total Orders & Quotes", value: (totalOrders + pendingQuotes).toString(), icon: Package },
          { label: "Pending", value: (pendingOrders + pendingQuotes).toString(), icon: Clock, color: "text-yellow-600" },
          { label: "In Transit", value: inTransit.toString(), icon: TruckIcon, color: "text-blue-600" },
          { label: "Delivered", value: delivered.toString(), icon: CheckCircle, color: "text-green-600" },
        ])
        
        setError(null)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Failed to load orders and quotes. Please try again later.")
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  // Handle delete quote request
  const handleDeleteQuote = async () => {
    if (!quoteToDelete) return

    try {
      setIsDeleting(true)
      await deleteQuoteRequest(quoteToDelete.id)

      toast({
        title: "Quote Request Deleted",
        description: `Quote ${quoteToDelete.number} has been permanently deleted.`,
      })

      // Remove from local state
      setItems(prevItems => prevItems.filter(item => item.id !== quoteToDelete.id))
      
      // Update stats
      const remainingItems = items.filter(item => item.id !== quoteToDelete.id)
      const orders = remainingItems.filter(item => !('isQuoteRequest' in item))
      const quotes = remainingItems.filter(item => 'isQuoteRequest' in item)
      
      setStats([
        { label: "Total Orders & Quotes", value: remainingItems.length.toString(), icon: Package },
        { label: "Pending", value: quotes.length.toString(), icon: Clock, color: "text-yellow-600" },
        { label: "In Transit", value: orders.filter((o: any) => o.status === OrderStatus.IN_TRANSIT).length.toString(), icon: TruckIcon, color: "text-blue-600" },
        { label: "Delivered", value: orders.filter((o: any) => o.status === OrderStatus.DELIVERED).length.toString(), icon: CheckCircle, color: "text-green-600" },
      ])
    } catch (error: any) {
      console.error("Error deleting quote request:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to delete quote request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setQuoteToDelete(null)
    }
  }

  // Filter items
  const filteredItems = items.filter((item) => {
    // Filter by view mode
    if (viewMode === "orders" && 'isQuoteRequest' in item) {
      return false
    }
    if (viewMode === "quotes" && !('isQuoteRequest' in item)) {
      return false
    }
    
    // Search filtering
    let matchesSearch = false
    
    if ('isQuoteRequest' in item) {
      // Quote request search
      matchesSearch = (
        item.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    } else {
      // Order search
      matchesSearch = (
        item.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.vehicle?.vehicleId ? item.vehicle.vehicleId.toLowerCase().includes(searchTerm.toLowerCase()) : false)
      )
    }
    
    // Status filtering
    let matchesStatus = statusFilter === "all"
    if (!matchesStatus) {
      if ('isQuoteRequest' in item) {
        // For quote requests, we need to map QuoteStatus to OrderStatus for filtering
        // This is a simplification - you might want to handle this differently
        matchesStatus = item.status === statusFilter
      } else {
        matchesStatus = item.status === statusFilter
      }
    }
    
    // Date filtering
    let matchesDate = true
    if (dateFilter !== "all") {
      const today = new Date()
      const itemDate = new Date('isQuoteRequest' in item ? item.requestDate : item.orderDate)
      
      switch (dateFilter) {
        case "today":
          matchesDate =
            itemDate.getDate() === today.getDate() &&
            itemDate.getMonth() === today.getMonth() &&
            itemDate.getFullYear() === today.getFullYear()
          break
        case "thisWeek":
          const startOfWeek = new Date(today)
          startOfWeek.setDate(today.getDate() - today.getDay()) // Start of week (Sunday)
          matchesDate = itemDate >= startOfWeek && itemDate <= today
          break
        case "thisMonth":
          matchesDate =
            itemDate.getMonth() === today.getMonth() &&
            itemDate.getFullYear() === today.getFullYear()
          break
        case "thisYear":
          matchesDate = itemDate.getFullYear() === today.getFullYear()
          break
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate
  })

  // Helper function to get quote status badge
  const getQuoteStatusBadge = (status: QuoteStatus) => {
    switch (status) {
      case QuoteStatus.DRAFT:
        return <Badge className="bg-slate-600 text-white">Draft</Badge>
      case QuoteStatus.SENT:
        return <Badge className="bg-blue-600 text-white">Sent</Badge>
      case QuoteStatus.RECEIVED:
        return <Badge className="bg-purple-600 text-white">Received</Badge>
      case QuoteStatus.UNDER_REVIEW:
        return <Badge className="bg-yellow-600 text-white">Under Review</Badge>
      case QuoteStatus.APPROVED:
        return <Badge className="bg-green-600 text-white">Approved</Badge>
      case QuoteStatus.REJECTED:
        return <Badge className="bg-red-600 text-white">Rejected</Badge>
      case QuoteStatus.EXPIRED:
        return <Badge className="bg-orange-600 text-white">Expired</Badge>
      case QuoteStatus.CONVERTED_TO_ORDER:
        return <Badge className="bg-indigo-600 text-white">Converted</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }
  
  // Helper function to get order status badge
  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
        return <Badge className="bg-yellow-600 text-white">Pending</Badge>
      case OrderStatus.PENDING_QUOTE:
        return <Badge className="bg-blue-600 text-white">Pending Quote</Badge>
      case OrderStatus.PROCESSING:
        return <Badge className="bg-purple-600 text-white">Processing</Badge>
      case OrderStatus.IN_TRANSIT:
        return <Badge className="bg-indigo-600 text-white">In Transit</Badge>
      case OrderStatus.DELIVERED:
        return <Badge className="bg-green-600 text-white">Delivered</Badge>
      case OrderStatus.CANCELLED:
        return <Badge className="bg-red-600 text-white">Cancelled</Badge>
      case OrderStatus.RETURNED:
        return <Badge className="bg-orange-600 text-white">Returned</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <AppLayout 
      activeRoute="/orders" 
      searchValue={searchTerm} 
      onSearch={(value) => setSearchTerm(value)}
      searchPlaceholder="Search orders..."
    >
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Order Management</h1>
          <p className="text-slate-400">Track and manage your parts orders</p>
        </div>
        <div className="flex gap-2">
          <Link href="/orders/quote-request">
            <Button variant="outline" className="border-orange-600 text-orange-600 hover:bg-orange-50">
              <Mail className="w-4 h-4 mr-2" />
              Request Quote
            </Button>
          </Link>
          <Link href="/orders/new">
            <Button className="bg-orange-600 hover:bg-orange-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Order Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color || "text-white"}`}>{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color || "text-slate-400"}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* View Mode Selector */}
            <div className="flex rounded-md overflow-hidden border border-slate-600">
              <Button
                variant={viewMode === "all" ? "default" : "outline"}
                className={`rounded-none ${viewMode === "all" ? "bg-orange-600 hover:bg-orange-700" : "text-slate-300 hover:bg-slate-700"}`}
                onClick={() => setViewMode("all")}
              >
                All
              </Button>
              <Button
                variant={viewMode === "orders" ? "default" : "outline"}
                className={`rounded-none ${viewMode === "orders" ? "bg-orange-600 hover:bg-orange-700" : "text-orange-600 hover:bg-orange-50"}`}
                onClick={() => setViewMode("orders")}
              >
                Orders
              </Button>
              <Button
                variant={viewMode === "quotes" ? "default" : "outline"}
                className={`rounded-none ${viewMode === "quotes" ? "bg-orange-600 hover:bg-orange-700" : "text-orange-600 hover:bg-orange-50"}`}
                onClick={() => setViewMode("quotes")}
              >
                Quote Requests
              </Button>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600 text-white">
                <SelectItem value="all">All Status</SelectItem>
                {Object.values(OrderStatus).map((status) => (
                  <SelectItem key={status} value={status}>
                    {getOrderStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600 text-white">
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="thisWeek">This Week</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="border-orange-600 text-orange-600 hover:bg-orange-50">
              <Filter className="w-4 h-4 mr-2" />
              More Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders and Quotes Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-white">
            {viewMode === "all" ? "Orders & Quote Requests" : viewMode === "orders" ? "Orders" : "Quote Requests"}
            ({filteredItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
                <p className="text-sm text-slate-400">Loading orders...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-900/20 p-4 rounded-md text-center">
              <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
              <p className="text-red-500 font-medium">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 border-red-500 text-red-500 hover:bg-red-900/20"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-300">Order #</TableHead>
                  <TableHead className="text-slate-300">Date</TableHead>
                  <TableHead className="text-slate-300">Supplier</TableHead>
                  <TableHead className="text-slate-300">Vehicle</TableHead>
                  <TableHead className="text-slate-300">Items</TableHead>
                  <TableHead className="text-slate-300">Total</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Delivery</TableHead>
                  <TableHead className="text-right text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow className="border-slate-700">
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-8 w-8 text-slate-500" />
                        <p className="text-slate-400">No items found</p>
                        <p className="text-sm text-slate-500">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    if ('isQuoteRequest' in item) {
                      // Render quote request row
                      const quote = item;
                      return (
                        <TableRow key={quote.id} className="border-slate-700 bg-slate-800/50">
                          <TableCell className="font-medium text-white">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-orange-500" />
                              <Link href={`/orders/quote-request/${quote.id}`} className="text-white hover:text-orange-400 hover:underline">
                                {quote.quoteNumber}
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300">{quote.requestDate}</TableCell>
                          <TableCell>
                            <Link href={`/suppliers/${quote.supplier.id}`} className="text-slate-300 hover:text-white hover:underline">
                              {quote.supplier.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {quote.vehicle ? (
                              <Link href={`/vehicles/${quote.vehicle.id}`} className="text-slate-300 hover:text-white hover:underline">
                                {quote.vehicle.make} {quote.vehicle.model}
                              </Link>
                            ) : (
                              <span className="text-slate-500">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-slate-600 text-slate-300">{quote.itemCount} items</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-white">
                            {quote.totalAmount ? formatCurrency(quote.totalAmount) : "Pending"}
                          </TableCell>
                          <TableCell>{getQuoteStatusBadge(quote.status)}</TableCell>
                          <TableCell>
                            {quote.expiryDate ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-300">{quote.expiryDate}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500">Not set</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-700">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-white">
                                <Link href={`/orders/quote-request/${quote.id}`}>
                                  <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Quote
                                  </DropdownMenuItem>
                                </Link>
                                <Link href={`/orders/quote-request/${quote.id}/edit`}>
                                  <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Quote
                                  </DropdownMenuItem>
                                </Link>
                                <Link href={`/orders/quote-request/${quote.id}/convert`}>
                                  <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                    <ShoppingCart className="w-4 h-4 mr-2" />
                                    Convert to Order
                                  </DropdownMenuItem>
                                </Link>
                                {(quote.status === QuoteStatus.DRAFT || quote.status === QuoteStatus.REJECTED || quote.status === QuoteStatus.EXPIRED) && (
                                  <>
                                    <DropdownMenuSeparator className="bg-slate-600" />
                                    <DropdownMenuItem
                                      className="hover:bg-slate-700 cursor-pointer text-red-400 focus:text-red-400"
                                      onClick={() => {
                                        setQuoteToDelete({ id: quote.id, number: quote.quoteNumber })
                                        setDeleteDialogOpen(true)
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete Quote
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    } else {
                      // Render order row
                      const order = item;
                      return (
                        <TableRow key={order.id} className="border-slate-700">
                          <TableCell className="font-medium text-white">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-orange-500" />
                              <Link href={`/orders/${order.id}`} className="text-white hover:text-orange-400 hover:underline">
                                {order.orderNumber}
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300">{order.orderDate}</TableCell>
                          <TableCell>
                            <Link href={`/suppliers/${order.supplier.id}`} className="text-slate-300 hover:text-white hover:underline">
                              {order.supplier.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {order.vehicle ? (
                              <Link href={`/vehicles/${order.vehicle.id}`} className="text-slate-300 hover:text-white hover:underline">
                                {order.vehicle.make} {order.vehicle.model}
                              </Link>
                            ) : (
                              <span className="text-slate-500">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-slate-600 text-slate-300">{order.itemCount} items</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-white">
                            {formatCurrency(order.total)}
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>
                            {order.actualDelivery ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-3 h-3" />
                                <span>{order.actualDelivery}</span>
                              </div>
                            ) : order.expectedDelivery ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-300">{order.expectedDelivery}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500">Not scheduled</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-700">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-white">
                                <Link href={`/orders/${order.id}`}>
                                  <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                </Link>
                                <Link href={`/orders/${order.id}/edit`}>
                                  <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Order
                                  </DropdownMenuItem>
                                </Link>
                                <Link href={`/orders/new?duplicate=${order.id}`}>
                                  <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                                    <ShoppingCart className="w-4 h-4 mr-2" />
                                    Reorder
                                  </DropdownMenuItem>
                                </Link>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    }
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote Request?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Are you sure you want to delete quote request <span className="font-semibold text-white">{quoteToDelete?.number}</span>? 
              This action cannot be undone and will also delete any associated email threads.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="bg-slate-700 text-white hover:bg-slate-600 border-slate-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuote}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              Delete Quote Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
