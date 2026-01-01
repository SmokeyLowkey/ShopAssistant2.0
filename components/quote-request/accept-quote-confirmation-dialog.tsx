"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AcceptQuoteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: {
    id: string;
    name: string;
    email: string;
    contactPerson?: string;
  } | null;
  quoteItems: Array<{
    partNumber: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  quotedTotal: number;
  otherSuppliersCount: number;
  isProcessing: boolean;
  onConfirm: () => Promise<void>;
}

export function AcceptQuoteConfirmationDialog({
  open,
  onOpenChange,
  supplier,
  quoteItems,
  quotedTotal,
  otherSuppliersCount,
  isProcessing,
  onConfirm,
}: AcceptQuoteConfirmationDialogProps) {
  const [verifiedPrices, setVerifiedPrices] = useState(false);
  const [verifiedTerms, setVerifiedTerms] = useState(false);
  const [understoodOrderCreation, setUnderstoodOrderCreation] = useState(false);

  const allVerified = verifiedPrices && verifiedTerms && understoodOrderCreation;

  const handleConfirm = async () => {
    if (!allVerified || isProcessing) return;
    await onConfirm();
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Prevent closing during processing
    if (isProcessing) return;

    // Reset checkboxes when closing
    if (!newOpen) {
      setVerifiedPrices(false);
      setVerifiedTerms(false);
      setUnderstoodOrderCreation(false);
    }

    onOpenChange(newOpen);
  };

  if (!supplier) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Accept Quote & Create Order</DialogTitle>
          <DialogDescription>
            Review the quote details and confirm to automatically create an order with {supplier.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Supplier Information */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold mb-2">Supplier Details</h3>
            <div className="space-y-1 text-sm">
              <p><strong>Name:</strong> {supplier.name}</p>
              <p><strong>Email:</strong> {supplier.email}</p>
              {supplier.contactPerson && (
                <p><strong>Contact:</strong> {supplier.contactPerson}</p>
              )}
            </div>
          </div>

          {/* Quote Items */}
          <div>
            <h3 className="font-semibold mb-2">Quote Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Part Number</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Unit Price</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2 font-mono text-xs">{item.partNumber}</td>
                      <td className="p-2">{item.description}</td>
                      <td className="p-2 text-right">{item.quantity}</td>
                      <td className="p-2 text-right">${Number(item.unitPrice).toFixed(2)}</td>
                      <td className="p-2 text-right font-semibold">${Number(item.totalPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted border-t-2">
                  <tr>
                    <td colSpan={4} className="p-2 text-right font-semibold">Total:</td>
                    <td className="p-2 text-right font-bold text-lg">
                      ${quotedTotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Warning about other suppliers */}
          {otherSuppliersCount > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {otherSuppliersCount} other supplier{otherSuppliersCount > 1 ? 's' : ''} will be marked as NOT_SELECTED when you accept this quote.
              </AlertDescription>
            </Alert>
          )}

          {/* Verification Checkboxes */}
          <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <h3 className="font-semibold mb-3">Required Verifications</h3>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="verify-prices"
                checked={verifiedPrices}
                onCheckedChange={(checked) => setVerifiedPrices(checked as boolean)}
                disabled={isProcessing}
              />
              <label
                htmlFor="verify-prices"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                I have reviewed and verified all item prices
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="verify-terms"
                checked={verifiedTerms}
                onCheckedChange={(checked) => setVerifiedTerms(checked as boolean)}
                disabled={isProcessing}
              />
              <label
                htmlFor="verify-terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                I have confirmed the delivery terms and timeline
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="verify-order"
                checked={understoodOrderCreation}
                onCheckedChange={(checked) => setUnderstoodOrderCreation(checked as boolean)}
                disabled={isProcessing}
              />
              <label
                htmlFor="verify-order"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                I understand this will create an order with {supplier.name}
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allVerified || isProcessing}
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Order...
              </>
            ) : (
              "Accept & Create Order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
