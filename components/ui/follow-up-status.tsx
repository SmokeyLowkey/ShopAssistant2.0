import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, Mail, CheckCircle, AlertTriangle, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FollowUpStatusProps {
  quoteRequest: any;
}

export function FollowUpStatus({ quoteRequest }: FollowUpStatusProps) {
  const now = new Date();

  // Check if this is a multi-supplier quote
  const isMultiSupplier = quoteRequest.emailThreads && quoteRequest.emailThreads.length > 1;

  if (isMultiSupplier) {
    // Multi-supplier mode: Show supplier comparison data
    const threads = quoteRequest.emailThreads;
    const totalSuppliers = threads.length;

    // Count suppliers who responded
    const respondedSuppliers = threads.filter((t: any) =>
      t.status === 'RESPONDED' ||
      t.status === 'ACCEPTED' ||
      t.emailThread?.messages?.some((m: any) => m.direction === 'INBOUND')
    );
    const respondedCount = respondedSuppliers.length;
    const responseRate = totalSuppliers > 0 ? Math.round((respondedCount / totalSuppliers) * 100) : 0;

    // Get quoted amounts from quote request items
    const supplierQuotes = threads.map((t: any) => {
      // Get ONLY items for THIS SPECIFIC supplier with prices
      const supplierItems = quoteRequest.items?.filter((item: any) =>
        item.supplierId === t.supplierId &&
        item.totalPrice != null &&
        item.totalPrice > 0
      ) || [];

      // Calculate total ONLY from THIS supplier's priced items
      const totalFromItems = supplierItems.reduce((sum: number, item: any) =>
        sum + (Number(item.totalPrice) || 0), 0
      );

      console.log(`[FollowUpStatus] Supplier ${t.supplier?.name}:`, {
        supplierId: t.supplierId,
        itemCount: supplierItems.length,
        total: totalFromItems,
        items: supplierItems.map((i: any) => ({
          partNumber: i.partNumber,
          price: i.totalPrice,
          itemSupplierId: i.supplierId
        }))
      });

      // Use item total if available, otherwise use quotedAmount from thread
      const total = totalFromItems > 0 ? totalFromItems : (t.quotedAmount || 0);

      return {
        supplierId: t.supplierId,
        supplierName: t.supplier?.name,
        total,
        items: supplierItems
      };
    }).filter((q: any) => q.total > 0);

    console.log('[FollowUpStatus] All supplier quotes:', supplierQuotes);

    const quotedAmounts = supplierQuotes.map((q: any) => q.total);
    const lowestQuote = quotedAmounts.length > 0 ? Math.min(...quotedAmounts) : null;
    const highestQuote = quotedAmounts.length > 0 ? Math.max(...quotedAmounts) : null;
    const averageQuote = quotedAmounts.length > 0
      ? quotedAmounts.reduce((sum, val) => sum + val, 0) / quotedAmounts.length
      : null;

    // Find which supplier has the best price
    const bestSupplier = lowestQuote !== null
      ? supplierQuotes.find((q: any) => q.total === lowestQuote)
      : null;

    // Calculate average response time for suppliers who responded
    const responseTimes = respondedSuppliers
      .filter((t: any) => t.responseDate)
      .map((t: any) => {
        const sentMessage = t.emailThread?.messages?.find((m: any) => m.direction === 'OUTBOUND');
        if (sentMessage && sentMessage.sentAt) {
          const sent = new Date(sentMessage.sentAt);
          const responded = new Date(t.responseDate);
          return (responded.getTime() - sent.getTime()) / (1000 * 60 * 60); // hours
        }
        return null;
      })
      .filter((t: number | null) => t !== null);

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum: number, val: number) => sum + val, 0) / responseTimes.length
      : null;

    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-lg text-white">Supplier Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Response rate */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-white">Supplier Response Rate</span>
                <span className="text-sm font-medium text-white">{respondedCount}/{totalSuppliers} ({responseRate}%)</span>
              </div>
              <Progress value={responseRate} className="h-2" />
            </div>

            {/* Average response time */}
            {avgResponseTime !== null && (
              <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-400">Avg. Response Time</span>
                </div>
                <span className="text-sm font-semibold text-white">
                  {avgResponseTime < 24
                    ? `${Math.round(avgResponseTime)}h`
                    : `${Math.round(avgResponseTime / 24)}d`}
                </span>
              </div>
            )}

            {/* Price comparison */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-400">Price Comparison</h4>

              {quotedAmounts.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {lowestQuote !== null && (
                      <div className="flex items-start gap-2 p-3 bg-green-900/20 rounded-lg border border-green-600">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-900/30">
                          <TrendingDown className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Best Price</p>
                          <p className="text-lg font-bold text-green-400">
                            ${lowestQuote.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}

                    {highestQuote !== null && (
                      <div className="flex items-start gap-2 p-3 bg-orange-900/20 rounded-lg border border-orange-600">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-900/30">
                          <TrendingUp className="w-4 h-4 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Highest</p>
                          <p className="text-lg font-bold text-orange-400">
                            ${highestQuote.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {averageQuote !== null && (
                    <div className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg border border-blue-600">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-blue-400">Average Quote</span>
                      </div>
                      <span className="text-lg font-bold text-blue-400">${averageQuote.toFixed(2)}</span>
                    </div>
                  )}

                  {lowestQuote !== null && highestQuote !== null && lowestQuote !== highestQuote && (
                    <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg">
                      <span className="text-xs text-slate-400">Price Difference</span>
                      <span className="text-sm font-semibold text-orange-400">
                        ${(highestQuote - lowestQuote).toFixed(2)} ({Math.round(((highestQuote - lowestQuote) / highestQuote) * 100)}%)
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center p-4 bg-slate-700/30 rounded-lg border border-dashed border-slate-600">
                  <p className="text-sm text-slate-400">Waiting for supplier quotes...</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Single supplier mode: Show original message-based tracking
  const messages = quoteRequest.emailThread?.messages || [];
  const outboundMessages = messages.filter((m: any) => m.direction === 'OUTBOUND');

  type MessageStatus = 'responded' | 'follow-up-sent' | 'overdue' | 'awaiting';

  const messageStatuses: MessageStatus[] = outboundMessages.map((message: any) => {
    const expectedResponseBy = message.expectedResponseBy ? new Date(message.expectedResponseBy) : null;
    const hasResponse = messages.some((m: any) =>
      m.direction === 'INBOUND' &&
      ((m.inReplyTo === message.id) ||
       (m.receivedAt && message.sentAt && new Date(m.receivedAt) > new Date(message.sentAt))) &&
      m.receivedAt
    );
    const followUpSent = message.followUpSentAt !== null;

    if (hasResponse) {
      return 'responded';
    } else if (followUpSent) {
      return 'follow-up-sent';
    } else if (expectedResponseBy && now > expectedResponseBy) {
      return 'overdue';
    } else {
      return 'awaiting';
    }
  });

  const respondedCount = messageStatuses.filter((s: MessageStatus) => s === 'responded').length;
  const followUpSentCount = messageStatuses.filter((s: MessageStatus) => s === 'follow-up-sent').length;
  const overdueCount = messageStatuses.filter((s: MessageStatus) => s === 'overdue').length;
  const awaitingCount = messageStatuses.filter((s: MessageStatus) => s === 'awaiting').length;

  // Calculate response rate
  const responseRate = outboundMessages.length > 0
    ? Math.round((respondedCount / outboundMessages.length) * 100)
    : 0;

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="border-b border-slate-700">
        <CardTitle className="text-lg text-white">Communication Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Response rate */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-white">Response Rate</span>
              <span className="text-sm font-medium text-white">{responseRate}%</span>
            </div>
            <Progress value={responseRate} className="h-2" />
          </div>

          {/* Status counts */}
          <div className="grid grid-cols-2 gap-4">
            {respondedCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-900/30">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{respondedCount}</p>
                  <p className="text-xs text-slate-400">Responded</p>
                </div>
              </div>
            )}

            {awaitingCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-900/30">
                  <Clock className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{awaitingCount}</p>
                  <p className="text-xs text-slate-400">Awaiting</p>
                </div>
              </div>
            )}

            {overdueCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-900/30">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{overdueCount}</p>
                  <p className="text-xs text-slate-400">Overdue</p>
                </div>
              </div>
            )}

            {followUpSentCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-900/30">
                  <Mail className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{followUpSentCount}</p>
                  <p className="text-xs text-slate-400">Follow-ups</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
