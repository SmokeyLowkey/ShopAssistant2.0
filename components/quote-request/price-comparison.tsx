"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface QuoteRequestEmailThread {
  id: string;
  supplierId: string;
  isPrimary: boolean;
  status: string;
  responseDate: Date | null;
  quotedAmount: number | null;
  supplier: {
    id: string;
    name: string;
    email: string | null;
    rating: number | null;
  };
}

interface PriceComparisonTableProps {
  emailThreads: QuoteRequestEmailThread[];
  onSelectSupplier: (supplierId: string) => void;
  selectedSupplierId?: string;
}

export function PriceComparisonTable({
  emailThreads,
  onSelectSupplier,
  selectedSupplierId,
}: PriceComparisonTableProps) {
  // Filter only responded threads
  const respondedThreads = emailThreads.filter(
    t => t.status === 'RESPONDED' && t.quotedAmount !== null
  );

  // Sort by price (ascending)
  const sortedByPrice = [...respondedThreads].sort((a, b) =>
    (a.quotedAmount || 0) - (b.quotedAmount || 0)
  );

  if (sortedByPrice.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No price quotes received yet.</p>
        <p className="text-sm mt-2">Suppliers haven't responded with pricing information.</p>
      </div>
    );
  }

  const bestPrice = sortedByPrice[0]?.quotedAmount || 0;

  const calculateResponseTime = (thread: QuoteRequestEmailThread) => {
    if (!thread.responseDate) return 'N/A';
    return formatDistanceToNow(new Date(thread.responseDate), { addSuffix: true });
  };

  const calculateSavings = (amount: number) => {
    if (amount === bestPrice) return null;
    return amount - bestPrice;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Price Comparison</h3>
        <Badge variant="outline">
          {respondedThreads.length} of {emailThreads.length} responded
        </Badge>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Total Quote</TableHead>
              <TableHead>Response Time</TableHead>
              <TableHead className="text-center">Rating</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedByPrice.map((thread, index) => {
              const savings = calculateSavings(thread.quotedAmount || 0);
              const isBestPrice = index === 0;
              const isSelected = selectedSupplierId === thread.supplierId;

              return (
                <TableRow
                  key={thread.id}
                  className={
                    isBestPrice
                      ? 'bg-green-500/10 dark:bg-green-900/20'
                      : isSelected
                      ? 'bg-blue-500/10 dark:bg-blue-900/20'
                      : ''
                  }
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isBestPrice && <Trophy className="h-4 w-4 text-yellow-500" />}
                      <div>
                        <div className="font-medium">{thread.supplier.name}</div>
                        {thread.isPrimary && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Primary
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      <div className="font-semibold">
                        ${thread.quotedAmount?.toFixed(2)}
                      </div>
                      {isBestPrice ? (
                        <Badge className="mt-1 bg-green-600 hover:bg-green-700">
                          Best Price
                        </Badge>
                      ) : savings && (
                        <div className="text-xs text-muted-foreground mt-1">
                          +${savings.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {calculateResponseTime(thread)}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {thread.supplier.rating ? (
                      <div className="flex items-center justify-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">
                          {thread.supplier.rating.toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isSelected ? (
                      <Badge>Selected</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant={isBestPrice ? "default" : "outline"}
                        onClick={() => onSelectSupplier(thread.supplierId)}
                      >
                        Select
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {sortedByPrice.length > 1 && (
        <div className="text-sm text-muted-foreground text-center">
          <p>
            Potential savings: ${(sortedByPrice[sortedByPrice.length - 1].quotedAmount! - bestPrice).toFixed(2)} by choosing the best price
          </p>
        </div>
      )}
    </div>
  );
}
