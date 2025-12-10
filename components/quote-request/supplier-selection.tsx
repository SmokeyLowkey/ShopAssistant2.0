"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  contactPerson: string | null;
  rating: number | null;
}

interface SupplierSelectionInputProps {
  primarySupplierId: string;
  additionalSupplierIds: string[];
  onPrimaryChange: (id: string) => void;
  onAdditionalChange: (ids: string[]) => void;
  suppliers: Supplier[];
}

export function SupplierSelectionInput({
  primarySupplierId,
  additionalSupplierIds,
  onPrimaryChange,
  onAdditionalChange,
  suppliers,
}: SupplierSelectionInputProps) {
  const [availableAdditionalSuppliers, setAvailableAdditionalSuppliers] = useState<Supplier[]>([]);

  // Filter out the primary supplier from additional suppliers list
  useEffect(() => {
    const filtered = suppliers.filter(s => s.id !== primarySupplierId && s.email);
    setAvailableAdditionalSuppliers(filtered);
  }, [primarySupplierId, suppliers]);

  const handleAdditionalToggle = (supplierId: string, checked: boolean) => {
    if (checked) {
      onAdditionalChange([...additionalSupplierIds, supplierId]);
    } else {
      onAdditionalChange(additionalSupplierIds.filter(id => id !== supplierId));
    }
  };

  const totalSuppliers = 1 + additionalSupplierIds.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supplier Selection</CardTitle>
        <CardDescription>
          Select a primary supplier and optionally add additional suppliers for price comparison
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Supplier */}
        <div className="space-y-2">
          <Label htmlFor="primary-supplier">Primary Supplier *</Label>
          <Select value={primarySupplierId} onValueChange={onPrimaryChange}>
            <SelectTrigger id="primary-supplier">
              <SelectValue placeholder="Select primary supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers
                .filter(s => s.email)
                .map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{supplier.name}</span>
                      {supplier.rating && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ⭐ {supplier.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Additional Suppliers */}
        {availableAdditionalSuppliers.length > 0 && (
          <div className="space-y-3">
            <Label>Additional Suppliers (Optional)</Label>
            <p className="text-sm text-muted-foreground">
              Send this quote to multiple suppliers for price comparison
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
              {availableAdditionalSuppliers.map(supplier => (
                <div key={supplier.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`supplier-${supplier.id}`}
                    checked={additionalSupplierIds.includes(supplier.id)}
                    onCheckedChange={(checked) =>
                      handleAdditionalToggle(supplier.id, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={`supplier-${supplier.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div>{supplier.name}</div>
                        {supplier.contactPerson && (
                          <div className="text-xs text-muted-foreground">
                            Contact: {supplier.contactPerson}
                          </div>
                        )}
                      </div>
                      {supplier.rating && (
                        <span className="text-xs text-muted-foreground">
                          ⭐ {supplier.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {totalSuppliers > 1 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This quote will be sent to <strong>{totalSuppliers} suppliers</strong> for price comparison.
              You'll be able to compare responses and select the best offer.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
