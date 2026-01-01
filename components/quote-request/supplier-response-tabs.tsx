"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Star, Mail, Clock, CheckCircle, XCircle, AlertCircle, Paperclip, Eye, RefreshCw, ThumbsUp, ThumbsDown, Edit2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  path: string;
}

interface EmailMessage {
  id: string;
  direction: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  bodyHtml: string | null;
  sentAt: Date | null;
  receivedAt: Date | null;
  createdAt: Date;
  attachments: EmailAttachment[];
}

interface EmailThread {
  id: string;
  subject: string;
  status: string;
  messages: EmailMessage[];
}

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
    contactPerson: string | null;
    rating: number | null;
  };
  emailThread: EmailThread;
}

interface SupplierResponseTabsProps {
  emailThreads: QuoteRequestEmailThread[];
  onSelectSupplier?: (supplierId: string) => void;
  onPreviewMessage?: (messageId: string) => void;
  onRefreshPrices?: (supplierId: string) => void;
  onAcceptQuote?: (supplierId: string, threadId: string) => void;
  onRejectQuote?: (supplierId: string, threadId: string) => void;
  onRequestRevision?: (supplierId: string, threadId: string) => void;
  isRefreshingPrices?: boolean;
  quoteStatus?: string;
  quoteItems?: any[];
  notes?: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'RESPONDED':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'SENT':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'NO_RESPONSE':
      return <XCircle className="h-4 w-4 text-gray-500" />;
    case 'ACCEPTED':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'REJECTED':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'NOT_SELECTED':
      return <XCircle className="h-4 w-4 text-gray-400" />;
    default:
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'RESPONDED':
      return 'bg-green-500/10 text-green-700 dark:text-green-400';
    case 'SENT':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
    case 'NO_RESPONSE':
      return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    case 'ACCEPTED':
      return 'bg-green-600/10 text-green-800 dark:text-green-300';
    case 'REJECTED':
      return 'bg-red-500/10 text-red-700 dark:text-red-400';
    case 'NOT_SELECTED':
      return 'bg-gray-400/10 text-gray-600 dark:text-gray-500';
    default:
      return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
  }
};

export function SupplierResponseTabs({
  emailThreads,
  onSelectSupplier,
  onPreviewMessage,
  onRefreshPrices,
  onAcceptQuote,
  onRejectQuote,
  onRequestRevision,
  isRefreshingPrices,
  quoteStatus,
  quoteItems,
  notes
}: SupplierResponseTabsProps) {
  // Debug logging to verify data structure
  console.log('[SupplierResponseTabs] Email threads data:', {
    threadCount: emailThreads?.length || 0,
    threads: emailThreads?.map(t => ({
      supplierId: t.supplierId,
      supplierName: t.supplier?.name,
      emailThreadId: t.emailThread?.id,
      messageCount: t.emailThread?.messages?.length || 0,
      messages: t.emailThread?.messages?.map(m => ({
        id: m.id,
        direction: m.direction,
        subject: m.subject?.substring(0, 50)
      }))
    }))
  });

  if (!emailThreads || emailThreads.length === 0) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="py-8 text-center text-slate-400">
          <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-white">No email threads yet.</p>
          <p className="text-sm mt-2">Send the quote request to create email threads.</p>
        </CardContent>
      </Card>
    );
  }

  // Sort: primary first, then by creation date
  const sortedThreads = [...emailThreads].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return 0;
  });

  return (
    <Tabs defaultValue={sortedThreads[0]?.supplierId} className="w-full">
      <TabsList className="grid w-full bg-slate-700" style={{ gridTemplateColumns: `repeat(${sortedThreads.length}, minmax(0, 1fr))` }}>
        {sortedThreads.map(thread => (
          <TabsTrigger key={thread.supplierId} value={thread.supplierId} className="relative data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-300">
            <div className="flex flex-col items-start gap-1 w-full">
              <div className="flex items-center gap-2 w-full">
                {thread.isPrimary && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                <span className="truncate">{thread.supplier.name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {getStatusIcon(thread.status)}
                {thread.quotedAmount && (
                  <span className="font-semibold text-green-400">
                    ${thread.quotedAmount.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </TabsTrigger>
        ))}
      </TabsList>

      {sortedThreads.map(thread => (
        <TabsContent key={thread.supplierId} value={thread.supplierId}>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-white">
                    {thread.supplier.name}
                    {thread.isPrimary && (
                      <Badge variant="secondary">Primary</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {thread.supplier.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {thread.supplier.email}
                      </span>
                    )}
                    {thread.supplier.contactPerson && (
                      <span className="block text-sm mt-1">
                        Contact: {thread.supplier.contactPerson}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="text-right space-y-2">
                  {thread.supplier.rating && (
                    <div className="flex items-center gap-1 text-sm text-white">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{Number(thread.supplier.rating).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quote Information */}
              <div className="space-y-3">
                {thread.quotedAmount && (
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">Quoted Amount</div>
                    <div className="text-2xl font-bold text-green-400">
                      ${thread.quotedAmount.toFixed(2)}
                    </div>
                    {thread.responseDate && (
                      <div className="text-xs text-slate-400 mt-1">
                        Responded {formatDistanceToNow(new Date(thread.responseDate), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                )}

                {/* Supplier-specific actions */}
                {(() => {
                  // Check if we're waiting for a response (latest message is outbound)
                  const messages = thread.emailThread?.messages || [];
                  const sortedMessages = [...messages].sort((a, b) => {
                    const dateA = new Date(a.sentAt || a.receivedAt || a.createdAt);
                    const dateB = new Date(b.sentAt || b.receivedAt || b.createdAt);
                    return dateB.getTime() - dateA.getTime();
                  });

                  const latestMessage = sortedMessages[0];
                  const isWaitingForResponse = latestMessage?.direction === 'OUTBOUND';

                  return (
                    <div className="flex flex-wrap gap-2">
                      {isWaitingForResponse && (
                        <div className="w-full p-3 bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
                            <Clock className="h-4 w-4" />
                            <span>Waiting for supplier response...</span>
                          </div>
                        </div>
                      )}

                      {onRefreshPrices && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log('[SupplierTab] Refresh Prices clicked for supplier:', {
                              supplierId: thread.supplierId,
                              supplierName: thread.supplier.name,
                              threadId: thread.emailThread.id,
                              junctionId: thread.id
                            });
                            onRefreshPrices(thread.supplierId);
                          }}
                          disabled={isRefreshingPrices || isWaitingForResponse}
                        >
                          <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshingPrices ? 'animate-spin' : ''}`} />
                          Refresh Prices
                        </Button>
                      )}

                      {thread.status === 'RESPONDED' && (
                        <>
                          {onAcceptQuote && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => onAcceptQuote(thread.supplier.id, thread.emailThread.id)}
                              disabled={isWaitingForResponse}
                            >
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              Accept Quote
                            </Button>
                          )}
                          {onRejectQuote && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                              onClick={() => onRejectQuote(thread.supplier.id, thread.emailThread.id)}
                              disabled={isWaitingForResponse}
                            >
                              <ThumbsDown className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          )}
                          {onRequestRevision && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-600 text-amber-600 hover:bg-amber-600 hover:text-white"
                              onClick={() => onRequestRevision(thread.supplier.id, thread.emailThread.id)}
                              disabled={isWaitingForResponse}
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              Request Revision
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Quote Items Table */}
              {(() => {
                // Filter items to only show those for this supplier
                const supplierItems = quoteItems?.filter((item: any) => item.supplierId === thread.supplierId) || [];

                return supplierItems.length > 0 && (
                  <>
                    <Separator className="my-4 bg-slate-700" />
                    <div>
                      <h4 className="font-semibold text-sm mb-3 text-white">Quote Items</h4>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead className="text-slate-300">Part Number</TableHead>
                            <TableHead className="text-slate-300">Description</TableHead>
                            <TableHead className="text-right text-slate-300">Quantity</TableHead>
                            <TableHead className="text-right text-slate-300">Unit Price</TableHead>
                            <TableHead className="text-right text-slate-300">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {supplierItems.map((item: any, index: number) => (
                            <TableRow key={item.id || index} className="border-slate-700">
                              <TableCell className="font-medium text-white">{item.partNumber}</TableCell>
                              <TableCell className="text-slate-300">{item.description}</TableCell>
                              <TableCell className="text-right text-white">{item.quantity}</TableCell>
                              <TableCell className="text-right text-white">
                                {item.unitPrice ? formatCurrency(item.unitPrice) : "TBD"}
                              </TableCell>
                              <TableCell className="text-right text-white">
                                {item.totalPrice ? formatCurrency(item.totalPrice) : "TBD"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                );
              })()}

              {/* Notes */}
              {notes && (
                <>
                  <Separator className="my-4 bg-slate-700" />
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-white">Notes</h4>
                    <p className="text-sm text-slate-400">{notes}</p>
                  </div>
                </>
              )}

              <Separator className="my-4 bg-slate-700" />

              {/* Email Thread Messages */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-white">Communication History</h4>
                {thread.emailThread.messages.length > 0 ? (
                  <div className="space-y-3">
                    {thread.emailThread.messages.map(message => (
                      <div
                        key={message.id}
                        className={`border rounded-lg p-3 ${
                          message.direction === 'OUTBOUND'
                            ? 'bg-blue-900/20 border-blue-600'
                            : 'bg-green-900/20 border-green-600'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant={message.direction === 'OUTBOUND' ? 'default' : 'secondary'}>
                              {message.direction === 'OUTBOUND' ? 'Sent' : 'Received'}
                            </Badge>
                            <span className="text-slate-400">
                              {message.sentAt
                                ? format(new Date(message.sentAt), 'MMM d, yyyy h:mm a')
                                : message.receivedAt
                                ? format(new Date(message.receivedAt), 'MMM d, yyyy h:mm a')
                                : format(new Date(message.createdAt), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          {onPreviewMessage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onPreviewMessage(message.id)}
                              className="h-7 px-2 text-slate-400 hover:text-white"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Preview
                            </Button>
                          )}
                        </div>
                        <div className="text-sm">
                          <div className="font-medium mb-1 text-white">{message.subject}</div>
                          <div className="text-slate-400 line-clamp-3">
                            {message.body.substring(0, 200)}
                            {message.body.length > 200 && '...'}
                          </div>
                        </div>
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-700 space-y-1">
                            <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
                              <Paperclip className="h-3 w-3" />
                              <span>{message.attachments.length} attachment(s)</span>
                            </div>
                            <div className="space-y-1">
                              {message.attachments.map(attachment => (
                                <a
                                  key={attachment.id}
                                  href={`/api/attachments/${attachment.id}/download`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                                >
                                  <Paperclip className="h-3 w-3" />
                                  <span className="truncate">{attachment.filename}</span>
                                  <span className="text-slate-500">
                                    ({(attachment.size / 1024).toFixed(1)} KB)
                                  </span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No messages yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
