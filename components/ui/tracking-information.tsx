"use client";

import { MapPin, Truck, Package, Calendar, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FulfillmentMethod, ItemAvailability } from "@prisma/client";
import { generateTrackingLink, normalizeCarrierName } from "@/lib/utils/tracking-links";

export interface OrderItemWithTracking {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  availability: ItemAvailability;
  fulfillmentMethod?: FulfillmentMethod;
  trackingNumber?: string;
  expectedDelivery?: Date;
  actualDelivery?: Date;
}

export interface TrackingInfoProps {
  order: {
    id: string;
    orderNumber: string;
    fulfillmentMethod: FulfillmentMethod;
    partialFulfillment: boolean;
    pickupLocation?: string | null;
    pickupDate?: Date | null;
    shippingCarrier?: string | null;
    trackingNumber?: string | null;
    expectedDelivery?: Date | null;
  };
  orderItems: OrderItemWithTracking[];
}

export function TrackingInformation({ order, orderItems }: TrackingInfoProps) {
  // Helper function to format dates
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "Not specified";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Group items by fulfillment method for split fulfillment
  const pickupItems = orderItems.filter(
    (item) => item.fulfillmentMethod === "PICKUP" || 
    (order.fulfillmentMethod === "PICKUP" && !item.fulfillmentMethod)
  );
  
  const deliveryItems = orderItems.filter(
    (item) => item.fulfillmentMethod === "DELIVERY" || 
    (order.fulfillmentMethod === "DELIVERY" && !item.fulfillmentMethod)
  );

  return (
    <div className="space-y-4">
      {/* Fulfillment Method Badge */}
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-slate-300">Fulfillment Method:</span>
        <Badge className={
          order.fulfillmentMethod === "PICKUP" ? "bg-blue-600 text-white" :
          order.fulfillmentMethod === "DELIVERY" ? "bg-amber-600 text-white" :
          "bg-purple-600 text-white"
        }>
          {order.fulfillmentMethod === "PICKUP" && "Pickup"}
          {order.fulfillmentMethod === "DELIVERY" && "Delivery"}
          {order.fulfillmentMethod === "SPLIT" && "Split Fulfillment"}
        </Badge>
      </div>
      
      {/* Pickup Information */}
      {(order.fulfillmentMethod === "PICKUP" || order.fulfillmentMethod === "SPLIT") && 
       order.pickupLocation && (
        <div className="p-4 bg-blue-950/30 rounded-md border border-blue-800/50">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-300">Pickup Information</h4>
              <p className="text-sm text-blue-200/80 mt-1">Location: {order.pickupLocation}</p>
              {order.pickupDate && (
                <p className="text-sm text-blue-200/80">
                  Date: {formatDate(order.pickupDate)}
                </p>
              )}
              <p className="text-sm text-blue-200/60 mt-2">
                Please bring your order number and ID for pickup.
              </p>
              
              {order.fulfillmentMethod === "SPLIT" && pickupItems.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-sm font-medium text-blue-300">Items for Pickup:</h5>
                  <ul className="list-disc list-inside text-xs text-blue-200/80 mt-1 space-y-1">
                    {pickupItems.map(item => (
                      <li key={item.id}>
                        {item.partNumber} - {item.description} (Qty: {item.quantity})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Delivery Information */}
      {(order.fulfillmentMethod === "DELIVERY" || order.fulfillmentMethod === "SPLIT") && (
        <div className="p-4 bg-amber-950/30 rounded-md border border-amber-800/50">
          <div className="flex items-start gap-3">
            <Truck className="w-5 h-5 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-amber-300">Delivery Information</h4>
              
              {order.shippingCarrier && (
                <p className="text-sm text-amber-200/80 mt-1">
                  Carrier: {order.shippingCarrier}
                </p>
              )}
              
              {order.trackingNumber && (() => {
                const trackingLink = generateTrackingLink(
                  order.trackingNumber,
                  order.shippingCarrier ? normalizeCarrierName(order.shippingCarrier) : undefined
                );
                return (
                  <p className="text-sm text-amber-200/80">
                    Tracking Number:{" "}
                    <a
                      href={trackingLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-amber-300 hover:text-amber-100 underline inline-flex items-center gap-1"
                    >
                      {order.trackingNumber}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {trackingLink.carrier !== 'UNKNOWN' && (
                      <span className="ml-1 text-xs text-amber-200/60">
                        (Track with {trackingLink.displayName})
                      </span>
                    )}
                  </p>
                );
              })()}
              
              {order.expectedDelivery && (
                <p className="text-sm text-amber-200/80">
                  Expected Delivery: {formatDate(order.expectedDelivery)}
                </p>
              )}
              
              {order.fulfillmentMethod === "SPLIT" && deliveryItems.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-sm font-medium text-amber-300">Items for Delivery:</h5>
                  <ul className="list-disc list-inside text-xs text-amber-200/80 mt-1 space-y-1">
                    {deliveryItems.map(item => (
                      <li key={item.id}>
                        {item.partNumber} - {item.description} (Qty: {item.quantity})
                        {item.expectedDelivery && (
                          <span className="ml-1">
                            (Expected: {formatDate(item.expectedDelivery)})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Item-level Tracking for Split Fulfillment */}
      {order.fulfillmentMethod === "SPLIT" && (
        <div className="mt-6">
          <h4 className="text-md font-medium text-white mb-3">Item-level Tracking</h4>
          <div className="space-y-3">
            {orderItems.map(item => (
              <div key={item.id} className="p-3 bg-slate-700/50 border border-slate-600 rounded-md">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium text-white">{item.partNumber}</p>
                    <p className="text-sm text-slate-400">{item.description}</p>
                    <div className="flex items-center mt-2 gap-2">
                      <Badge className={
                        item.fulfillmentMethod === "PICKUP" ? "bg-blue-600 text-white" : "bg-amber-600 text-white"
                      }>
                        {item.fulfillmentMethod || order.fulfillmentMethod}
                      </Badge>
                      {item.trackingNumber && (() => {
                        const trackingLink = generateTrackingLink(item.trackingNumber);
                        return (
                          <a
                            href={trackingLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-amber-300 hover:text-amber-100 font-mono underline inline-flex items-center gap-1"
                          >
                            Tracking: {item.trackingNumber}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="text-right text-sm text-slate-300">
                    {item.expectedDelivery && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Expected: {formatDate(item.expectedDelivery)}</span>
                      </div>
                    )}
                    {item.actualDelivery && (
                      <div className="flex items-center gap-1 text-green-400 mt-1">
                        <Package className="w-4 h-4" />
                        <span>Delivered: {formatDate(item.actualDelivery)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}