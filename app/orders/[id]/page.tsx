"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Truck,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  AlertTriangle,
  FileText,
  Mail,
  InfoIcon,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AppLayout } from "@/components/layout/app-layout";
import { TrackingInformation } from "@/components/ui/tracking-information";
import { ThreadStatusControl } from "@/components/ui/thread-status-control";
import { CommunicationTimeline } from "@/components/ui/communication-timeline";
import { OrderFollowUpModal } from "@/components/ui/order-follow-up-modal";
import { OrderFollowUpButton } from "@/components/ui/order-follow-up-button";
import { toast } from "@/components/ui/use-toast";
import { getOrder, formatCurrency, getOrderStatusLabel } from "@/lib/api";
import { OrderStatus, FulfillmentMethod, ItemAvailability, EmailThreadStatus } from "@prisma/client";

// Helper function to get status badge
const getStatusBadge = (status: OrderStatus) => {
  switch (status) {
    case OrderStatus.PENDING:
      return <Badge className="bg-yellow-600 text-white">Pending</Badge>;
    case OrderStatus.PENDING_QUOTE:
      return <Badge className="bg-blue-600 text-white">Pending Quote</Badge>;
    case OrderStatus.PROCESSING:
      return <Badge className="bg-purple-600 text-white">Processing</Badge>;
    case OrderStatus.IN_TRANSIT:
      return <Badge className="bg-indigo-600 text-white">In Transit</Badge>;
    case OrderStatus.DELIVERED:
      return <Badge className="bg-green-600 text-white">Delivered</Badge>;
    case OrderStatus.CANCELLED:
      return <Badge className="bg-red-600 text-white">Cancelled</Badge>;
    case OrderStatus.RETURNED:
      return <Badge className="bg-orange-600 text-white">Returned</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

// Helper function to get fulfillment method badge
const getFulfillmentBadge = (method: FulfillmentMethod) => {
  switch (method) {
    case FulfillmentMethod.PICKUP:
      return <Badge className="bg-blue-600 text-white">Pickup</Badge>;
    case FulfillmentMethod.DELIVERY:
      return <Badge className="bg-amber-600 text-white">Delivery</Badge>;
    case FulfillmentMethod.SPLIT:
      return <Badge className="bg-purple-600 text-white">Split Fulfillment</Badge>;
    default:
      return <Badge variant="secondary">{method}</Badge>;
  }
};

// Helper function to format dates
const formatDate = (dateString: string | Date | null | undefined) => {
  if (!dateString) return "Not specified";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  
  const [order, setOrder] = useState<any>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailThread, setEmailThread] = useState<any>(null);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [syncingUpdates, setSyncingUpdates] = useState(false);
  
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        const data = await getOrder(orderId);
        setOrder(data);
        setOrderData(data as any);
        
        // If the order has an email thread, fetch it
        // Using 'as any' to bypass TypeScript checking since we know the structure
        const orderData = data as any;
        if (orderData.emailThreadId) {
          try {
            const threadResponse = await fetch(`/api/email-threads/${orderData.emailThreadId}`);
            if (threadResponse.ok) {
              const threadData = await threadResponse.json();
              setEmailThread(threadData);
            }
          } catch (threadErr) {
            console.error("Error fetching email thread:", threadErr);
            // Don't set the main error state, just log the error
          }
        }
        
        setError(null);
      } catch (err) {
        console.error("Error fetching order details:", err);
        setError("Failed to load order details. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrderDetails();
  }, [orderId]);
  
  // Function to handle email thread status changes
  const handleThreadStatusChange = (newStatus: EmailThreadStatus) => {
    if (emailThread) {
      setEmailThread({
        ...emailThread,
        status: newStatus
      });
    }
  };

  // Function to handle sync updates
  const handleSyncUpdates = async () => {
    try {
      setSyncingUpdates(true);

      const response = await fetch(`/api/orders/${orderId}/sync-updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to sync updates');
      }

      const data = await response.json();

      toast({
        title: "Updates synced",
        description: `Successfully synced ${data.updateCount} update(s)`,
      });

      // Refresh order data
      const updatedOrder = await getOrder(orderId);
      setOrder(updatedOrder);
      setOrderData(updatedOrder as any);
    } catch (error) {
      console.error('Error syncing updates:', error);
      toast({
        title: "Sync failed",
        description: "Failed to sync order updates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncingUpdates(false);
    }
  };

  // Function to handle follow-up sent
  const handleFollowUpSent = async () => {
    // Refresh email thread
    if (orderData?.emailThreadId) {
      try {
        const threadResponse = await fetch(`/api/email-threads/${orderData.emailThreadId}`);
        if (threadResponse.ok) {
          const threadData = await threadResponse.json();
          setEmailThread(threadData);
        }
      } catch (error) {
        console.error('Error refreshing email thread:', error);
      }
    }
  };

  return (
    <AppLayout activeRoute="/orders">
      {/* Page Header */}
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="mr-4 text-slate-400 hover:text-white"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white">
            {loading ? "Loading Order..." : `Order ${order?.orderNumber}`}
          </h1>
          <p className="text-slate-400">View and manage order details</p>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center p-12">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
            <p className="text-sm text-slate-400">Loading order details...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 p-6 rounded-md text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-500 font-medium">{error}</p>
          <Button 
            variant="outline" 
            className="mt-4 border-red-500 text-red-500 hover:bg-red-900/20"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Order Summary Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <div className="flex justify-between items-center">
                <CardTitle className="text-white">Order Summary</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncUpdates}
                    disabled={syncingUpdates}
                    className="text-blue-400 hover:bg-slate-700 hover:text-white"
                  >
                    {syncingUpdates ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync Updates
                      </>
                    )}
                  </Button>
                  <Link href={`/orders/${orderId}/edit`}>
                    <Button variant="outline" size="sm" className="text-orange-600 hover:bg-slate-700 hover:text-white">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Order
                    </Button>
                  </Link>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Cancel Order
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Order Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">Order Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Order Number:</span>
                      <span className="text-white font-medium">{order.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span>{getStatusBadge(order.status)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fulfillment:</span>
                      <span>{order.fulfillmentMethod ? getFulfillmentBadge(order.fulfillmentMethod) : <Badge variant="outline">Standard</Badge>}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Order Date:</span>
                      <span className="text-white">{formatDate(order.orderDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected Delivery:</span>
                      <span className="text-white">{formatDate(order.expectedDelivery)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Supplier Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">Supplier</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Name:</span>
                      <Link href={`/suppliers/${order.supplier.id}`} className="text-white hover:underline">
                        {order.supplier.name}
                      </Link>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <a href={`mailto:${order.supplier.email}`} className="text-white hover:underline">
                        {order.supplier.email}
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Phone:</span>
                      <span className="text-white">{order.supplier.phone || "Not provided"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="text-orange-600 hover:bg-slate-700 hover:text-white">
                      <Mail className="w-4 h-4 mr-2" />
                      Contact Supplier
                    </Button>
                  </div>
                </div>
                
                {/* Financial Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">Financial Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Subtotal:</span>
                      <span className="text-white">{formatCurrency(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tax:</span>
                      <span className="text-white">{order.tax ? formatCurrency(order.tax) : "$0.00"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Shipping:</span>
                      <span className="text-white">{order.shipping ? formatCurrency(order.shipping) : "$0.00"}</span>
                    </div>
                    <Separator className="my-2 bg-slate-700" />
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-300">Total:</span>
                      <span className="text-orange-500 text-lg">{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Fulfillment Information */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <div className="flex justify-between items-center">
                <CardTitle className="text-white">Fulfillment Information</CardTitle>
                <OrderFollowUpButton
                  order={order}
                  onClick={() => setFollowUpModalOpen(true)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <TrackingInformation order={order} orderItems={order.orderItems} />
            </CardContent>
          </Card>
          
          {/* Order Items */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="text-white">Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-300">Part Number</TableHead>
                    <TableHead className="text-slate-300">Description</TableHead>
                    <TableHead className="text-slate-300 text-right">Quantity</TableHead>
                    <TableHead className="text-slate-300 text-right">Unit Price</TableHead>
                    <TableHead className="text-slate-300 text-right">Total</TableHead>
                    <TableHead className="text-slate-300">Availability</TableHead>
                    <TableHead className="text-slate-300">Fulfillment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.orderItems.map((item: any) => (
                    <TableRow key={item.id} className="border-slate-700">
                      <TableCell className="font-medium text-white">{item.part?.partNumber || "Unknown"}</TableCell>
                      <TableCell className="text-slate-300">{item.part?.description || "Unknown"}</TableCell>
                      <TableCell className="text-right text-slate-300">{item.quantity}</TableCell>
                      <TableCell className="text-right text-slate-300">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right text-white font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          item.availability === 'IN_STOCK' ? 'default' :
                          item.availability === 'BACKORDERED' ? 'outline' :
                          item.availability === 'SPECIAL_ORDER' ? 'destructive' : 'secondary'
                        }>
                          {item.availability || 'UNKNOWN'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getFulfillmentBadge(
                          (item.fulfillmentMethod || order.fulfillmentMethod || FulfillmentMethod.DELIVERY) as FulfillmentMethod
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          {/* Notes and Additional Information */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="text-white">Notes & Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">Order Notes</h3>
                  <p className="text-slate-300">{order.notes || "No notes provided."}</p>
                </div>
                
                {order.vehicle && (
                  <div>
                    <h3 className="text-lg font-medium text-white mb-2">Vehicle Information</h3>
                    <div className="p-4 bg-slate-700/50 rounded-md">
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-400">Vehicle ID:</span>
                        <Link href={`/vehicles/${order.vehicle.id}`} className="text-white hover:underline">
                          {order.vehicle.vehicleId}
                        </Link>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Make/Model:</span>
                        <span className="text-white">{order.vehicle.make} {order.vehicle.model} ({order.vehicle.year})</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Communication History Card */}
          {orderData.emailThreadId && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="border-b border-slate-700">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Communication History</CardTitle>
                  {emailThread && (
                    <ThreadStatusControl
                      threadId={emailThread.id}
                      status={emailThread.status}
                      onStatusChange={handleThreadStatusChange}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {emailThread && emailThread.status !== 'COMPLETED' && (
                  <Alert className="mb-6 bg-blue-900/20 border-blue-800">
                    <InfoIcon className="h-4 w-4" />
                    <AlertTitle>Keep this thread open until parts are received</AlertTitle>
                    <AlertDescription>
                      This allows you to continue communication with the supplier about this order.
                      Mark as completed only when all parts have been received.
                    </AlertDescription>
                  </Alert>
                )}
                
                <CommunicationTimeline
                  emailThreadId={orderData.emailThreadId}
                  orderId={orderId}
                  conversionDate={(() => {
                    console.log('=== PASSING TO TIMELINE ===');
                    console.log('order.orderDate:', order.orderDate);
                    console.log('order.createdAt:', order.createdAt);
                    console.log('Using createdAt:', order.createdAt);
                    return order.createdAt;
                  })()}
                  onFollowUpClick={() => {}} // No follow-up needed for order communications
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Order Follow-Up Modal */}
      {order && (
        <OrderFollowUpModal
          open={followUpModalOpen}
          onOpenChange={setFollowUpModalOpen}
          order={order}
          onFollowUpSent={handleFollowUpSent}
        />
      )}
    </AppLayout>
  );
}