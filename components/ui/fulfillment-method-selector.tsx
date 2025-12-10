"use client";

import { useState, useMemo } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ItemAvailability, FulfillmentMethod } from "@prisma/client";

export interface QuoteRequestItem {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  availability: ItemAvailability;
  estimatedDeliveryDays?: number;
  suggestedFulfillmentMethod?: string;
}

export interface FulfillmentSelectorProps {
  items: QuoteRequestItem[];
  onMethodSelected: (
    method: FulfillmentMethod, 
    itemMethods: Record<string, FulfillmentMethod>
  ) => void;
  suggestedMethod?: FulfillmentMethod;
}

export function FulfillmentMethodSelector({ 
  items, 
  onMethodSelected,
  suggestedMethod
}: FulfillmentSelectorProps) {
  const [method, setMethod] = useState<FulfillmentMethod>(suggestedMethod || 'DELIVERY');
  const [itemMethods, setItemMethods] = useState<Record<string, FulfillmentMethod>>({});
  
  // Determine if split fulfillment is needed based on availability
  const needsSplit = useMemo(() => {
    return items.some(item => item.availability !== 'IN_STOCK');
  }, [items]);
  
  // Handle method change
  const handleMethodChange = (newMethod: FulfillmentMethod) => {
    setMethod(newMethod);
    
    if (newMethod !== 'SPLIT') {
      // Reset item-level methods when not using split
      setItemMethods({});
    } else {
      // Initialize item methods based on availability
      const initialItemMethods: Record<string, FulfillmentMethod> = {};
      items.forEach(item => {
        initialItemMethods[item.id] = item.availability === 'IN_STOCK' ? 'PICKUP' : 'DELIVERY';
      });
      setItemMethods(initialItemMethods);
    }
  };
  
  // Handle item method change for split fulfillment
  const handleItemMethodChange = (itemId: string, itemMethod: FulfillmentMethod) => {
    setItemMethods(prev => ({
      ...prev,
      [itemId]: itemMethod
    }));
  };

  // Helper function to get badge variant based on availability
  const getAvailabilityBadgeVariant = (availability: ItemAvailability) => {
    switch (availability) {
      case 'IN_STOCK':
        return 'default';
      case 'BACKORDERED':
        return 'outline';
      case 'SPECIAL_ORDER':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Helper function to get human-readable availability label
  const getAvailabilityLabel = (availability: ItemAvailability) => {
    switch (availability) {
      case 'IN_STOCK':
        return 'In Stock';
      case 'BACKORDERED':
        return 'Backordered';
      case 'SPECIAL_ORDER':
        return 'Special Order';
      default:
        return 'Unknown';
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Select Fulfillment Method</h3>
        <RadioGroup value={method} onValueChange={(value) => handleMethodChange(value as FulfillmentMethod)}>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="PICKUP" id="pickup" />
              <Label htmlFor="pickup">Pickup (All items available in store)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="DELIVERY" id="delivery" />
              <Label htmlFor="delivery">Delivery (Ship all items)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="SPLIT" id="split" />
              <Label htmlFor="split">Split Fulfillment (Pickup available items, ship the rest)</Label>
              {needsSplit && (
                <Badge variant="outline" className="ml-2">Recommended</Badge>
              )}
            </div>
          </div>
        </RadioGroup>
      </div>
      
      {method === 'SPLIT' && (
        <div className="space-y-4">
          <h4 className="text-md font-medium">Configure Item Fulfillment</h4>
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 border rounded">
              <div>
                <p className="font-medium">{item.partNumber}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <Badge variant={getAvailabilityBadgeVariant(item.availability)}>
                  {getAvailabilityLabel(item.availability)}
                </Badge>
                {item.estimatedDeliveryDays && (
                  <span className="text-xs ml-2">
                    Est. delivery: {item.estimatedDeliveryDays} days
                  </span>
                )}
              </div>
              <Select
                value={itemMethods[item.id] || (item.availability === 'IN_STOCK' ? 'PICKUP' : 'DELIVERY')}
                onValueChange={(value) => handleItemMethodChange(item.id, value as FulfillmentMethod)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PICKUP">Pickup</SelectItem>
                  <SelectItem value="DELIVERY">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
      
      <Button 
        onClick={() => onMethodSelected(method, itemMethods)}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}