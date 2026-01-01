"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  Calendar, 
  CheckCircle, 
  AlertTriangle,
  ShoppingCart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppLayout } from "@/components/layout/app-layout";
import { FulfillmentMethodSelector } from "@/components/ui/fulfillment-method-selector";
import { formatCurrency } from "@/lib/api";
import { FulfillmentMethod } from "@prisma/client";

// Import API functions
import { getQuoteRequest } from "@/lib/api/quote-requests";

// Function to convert quote to order
const convertQuoteToOrder = async (quoteId: string, data: any) => {
  try {
    const response = await fetch(`/api/quote-requests/${quoteId}/convert-to-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to convert quote to order');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error converting quote to order:', error);
    throw error;
  }
};

export default function ConvertQuoteToOrderPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;
  
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  
  // Fulfillment state
  const [currentStep, setCurrentStep] = useState(1);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod | null>(null);
  const [itemFulfillment, setItemFulfillment] = useState<Record<string, FulfillmentMethod>>({});
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [shippingAddress, setShippingAddress] = useState({
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "USA",
  });
  const [specialInstructions, setSpecialInstructions] = useState("");
  
  useEffect(() => {
    const fetchQuoteDetails = async () => {
      try {
        setLoading(true);
        const response = await getQuoteRequest(quoteId);
        const data = response.data;
        setQuote(data);
        
        // Set default fulfillment method if suggested
        if ('suggestedFulfillmentMethod' in data && data.suggestedFulfillmentMethod) {
          setFulfillmentMethod(data.suggestedFulfillmentMethod as FulfillmentMethod);
        }
        
        setError(null);
      } catch (err) {
        console.error("Error fetching quote details:", err);
        setError("Failed to load quote details. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuoteDetails();
  }, [quoteId]);
  
  const handleFulfillmentMethodSelected = (
    method: FulfillmentMethod, 
    itemMethods: Record<string, FulfillmentMethod>
  ) => {
    setFulfillmentMethod(method);
    setItemFulfillment(itemMethods);
    setCurrentStep(2);
  };
  
  const handleSubmit = async () => {
    try {
      setConverting(true);
      
      // Prepare data for conversion
      const conversionData = {
        fulfillmentMethod,
        itemFulfillment: Object.entries(itemFulfillment).map(([itemId, method]) => ({
          itemId,
          method,
        })),
        pickupLocation: fulfillmentMethod === 'PICKUP' || fulfillmentMethod === 'SPLIT' ? pickupLocation : null,
        pickupDate: fulfillmentMethod === 'PICKUP' || fulfillmentMethod === 'SPLIT' ? pickupDate : null,
        shippingAddress: fulfillmentMethod === 'DELIVERY' || fulfillmentMethod === 'SPLIT' ? shippingAddress : null,
        specialInstructions,
      };
      
      // Call API to convert quote to order
      const result = await convertQuoteToOrder(quoteId, conversionData);
      
      if (result.data) {
        // Redirect to the new order page
        router.push(`/orders/${result.data.orderId}`);
      } else {
        setError("Failed to convert quote to order. Please try again.");
        setConverting(false);
      }
    } catch (err) {
      console.error("Error converting quote to order:", err);
      setError("An error occurred while converting the quote to an order.");
      setConverting(false);
    }
  };
  
  // Helper function to format dates
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
            {loading ? "Loading Quote..." : `Convert Quote ${quote?.quoteNumber} to Order`}
          </h1>
          <p className="text-slate-400">Select fulfillment options and create an order</p>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center p-12">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
            <p className="text-sm text-slate-400">Loading quote details...</p>
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
          {/* Quote Summary Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="text-white">Quote Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Quote Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">Quote Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quote Number:</span>
                      <span className="text-white font-medium">{quote.quoteNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Title:</span>
                      <span className="text-white">{quote.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Request Date:</span>
                      <span className="text-white">{formatDate(quote.requestDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <Badge className="bg-green-600 text-white">Approved</Badge>
                    </div>
                  </div>
                </div>
                
                {/* Supplier Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">Supplier</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Name:</span>
                      <Link href={`/suppliers/${quote.supplier.id}`} className="text-white hover:underline">
                        {quote.supplier.name}
                      </Link>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <a href={`mailto:${quote.supplier.email}`} className="text-white hover:underline">
                        {quote.supplier.email}
                      </a>
                    </div>
                  </div>
                </div>
                
                {/* Financial Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">Financial Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-300">Total Amount:</span>
                      <span className="text-orange-500 text-lg">{formatCurrency(quote.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Items:</span>
                      <span className="text-white">{quote.items.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Conversion Steps */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="text-white">
                {currentStep === 1 ? "Step 1: Select Fulfillment Method" : "Step 2: Provide Fulfillment Details"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {currentStep === 1 ? (
                <FulfillmentMethodSelector 
                  items={quote.items} 
                  onMethodSelected={handleFulfillmentMethodSelected}
                  suggestedMethod={quote?.suggestedFulfillmentMethod as FulfillmentMethod || 'DELIVERY' as FulfillmentMethod}
                />
              ) : (
                <div className="space-y-6">
                  {/* Pickup Information (for PICKUP or SPLIT) */}
                  {(fulfillmentMethod === 'PICKUP' || fulfillmentMethod === 'SPLIT') && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-white">Pickup Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="pickupLocation" className="text-white">Pickup Location</Label>
                          <Input
                            id="pickupLocation"
                            value={pickupLocation}
                            onChange={(e) => setPickupLocation(e.target.value)}
                            placeholder="Enter pickup location"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pickupDate" className="text-white">Pickup Date</Label>
                          <Input
                            id="pickupDate"
                            type="date"
                            value={pickupDate}
                            onChange={(e) => setPickupDate(e.target.value)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Shipping Information (for DELIVERY or SPLIT) */}
                  {(fulfillmentMethod === 'DELIVERY' || fulfillmentMethod === 'SPLIT') && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-white">Shipping Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="street" className="text-white">Street Address</Label>
                          <Input
                            id="street"
                            value={shippingAddress.street}
                            onChange={(e) => setShippingAddress({...shippingAddress, street: e.target.value})}
                            placeholder="Enter street address"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city" className="text-white">City</Label>
                          <Input
                            id="city"
                            value={shippingAddress.city}
                            onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
                            placeholder="Enter city"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state" className="text-white">State</Label>
                          <Input
                            id="state"
                            value={shippingAddress.state}
                            onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
                            placeholder="Enter state"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="zipCode" className="text-white">Zip Code</Label>
                          <Input
                            id="zipCode"
                            value={shippingAddress.zipCode}
                            onChange={(e) => setShippingAddress({...shippingAddress, zipCode: e.target.value})}
                            placeholder="Enter zip code"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="country" className="text-white">Country</Label>
                          <Input
                            id="country"
                            value={shippingAddress.country}
                            onChange={(e) => setShippingAddress({...shippingAddress, country: e.target.value})}
                            placeholder="Enter country"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Special Instructions */}
                  <div className="space-y-2">
                    <Label htmlFor="specialInstructions" className="text-white">Special Instructions</Label>
                    <Textarea
                      id="specialInstructions"
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      placeholder="Enter any special instructions for this order"
                      className="bg-slate-700 border-slate-600 text-white min-h-[100px]"
                    />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      Back to Fulfillment Method
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={converting}
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      {converting ? (
                        <>
                          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          Converting...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Create Order
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Quote Items */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="text-white">Quote Items</CardTitle>
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
                  {quote.items.map((item: any) => (
                    <TableRow key={item.id} className="border-slate-700">
                      <TableCell className="font-medium text-white">{item.partNumber}</TableCell>
                      <TableCell className="text-slate-300">{item.description}</TableCell>
                      <TableCell className="text-right text-slate-300">{item.quantity}</TableCell>
                      <TableCell className="text-right text-slate-300">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right text-white font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          item.availability === 'IN_STOCK' ? 'default' :
                          item.availability === 'BACKORDERED' ? 'outline' :
                          item.availability === 'SPECIAL_ORDER' ? 'destructive' : 'secondary'
                        }>
                          {item.availability}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {fulfillmentMethod === 'SPLIT' ? (
                          <Badge variant={itemFulfillment[item.id] === 'PICKUP' ? 'default' : 'outline'}>
                            {itemFulfillment[item.id] || (item.suggestedFulfillmentMethod as string) || 'DELIVERY'}
                          </Badge>
                        ) : (
                          <Badge variant={fulfillmentMethod === 'PICKUP' ? 'default' : 'outline'}>
                            {fulfillmentMethod || (item.suggestedFulfillmentMethod as string) || 'DELIVERY'}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}