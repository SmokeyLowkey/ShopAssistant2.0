/**
 * API functions for quote requests
 */
import { apiRequest, buildQueryString } from './client';
import {
  generateQuoteRequestEmail,
  QuoteRequestEmailData,
  QuoteRequestEmailResponse,
  PriceUpdateResponse
} from './n8n-client';
import { QuoteStatus } from '@prisma/client';

// Types for quote request API
export interface QuoteRequestItem {
  id?: string;
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  supplierPartNumber?: string;
  leadTime?: number;
  isAlternative?: boolean;
  notes?: string;
}

export interface CreateQuoteRequestData {
  supplierId: string;
  title: string;
  description?: string;
  items: QuoteRequestItem[];
  notes?: string;
  expiryDate?: string;
  vehicleId?: string;
}

export interface QuoteRequest {
  id: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  supplierId: string;
  supplier: {
    id: string;
    name: string;
    email?: string;
    contactPerson?: string;
  };
  description?: string;
  notes?: string;
  requestDate: string;
  expiryDate?: string;
  responseDate?: string;
  totalAmount?: number;
  items: QuoteRequestItem[];
  emailThreadId?: string;
  emailThread?: {
    id: string;
    subject: string;
    status: string;
    messages: {
      id: string;
      direction: string;
      from: string;
      to: string[];
      subject: string;
      sentAt?: string;
      receivedAt?: string;
    }[];
  }[];
  emailThreads?: {
    id: string;
    supplierId: string;
    emailThreadId: string;
    isPrimary: boolean;
    status: string;
    responseDate?: string;
    quotedAmount?: number;
    supplier: {
      id: string;
      name: string;
      email?: string;
      contactPerson?: string;
      rating?: number;
    };
    emailThread: {
      id: string;
      subject: string;
      status: string;
      messages: {
        id: string;
        direction: string;
        from: string;
        to: string[];
        subject: string;
        body?: string;
        sentAt?: string;
        receivedAt?: string;
      }[];
    };
  }[];
  vehicleId?: string;
  vehicle?: {
    id: string;
    vehicleId: string;
    make: string;
    model: string;
    year: number;
    serialNumber?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// API functions for quote requests
export async function getQuoteRequests(params?: {
  status?: QuoteStatus;
  supplierId?: string;
  includeWithEmailThread?: boolean;
}) {
  const queryString = params ? buildQueryString(params) : '';
  const response = await apiRequest<{ data: QuoteRequest[] }>(`/api/quote-requests${queryString}`);
  return response;
}

/**
 * Get quote requests that don't have an associated email thread
 * Used for assigning orphaned emails to quote requests
 */
export async function getQuoteRequestsWithoutEmail(supplierId?: string) {
  const params: any = { includeWithEmailThread: false };
  if (supplierId) {
    params.supplierId = supplierId;
  }
  const queryString = buildQueryString(params);
  const response = await apiRequest<{ data: QuoteRequest[] }>(`/api/quote-requests${queryString}`);
  return response;
}

/**
 * Get all quote requests for a supplier, including those with email threads
 * Used for assigning orphaned emails to quote requests and merging threads
 */
export async function getQuoteRequestsBySupplier(supplierId: string) {
  const params = {
    supplierId,
    includeWithEmailThread: true
  };
  const queryString = buildQueryString(params);
  const response = await apiRequest<{ data: QuoteRequest[] }>(`/api/quote-requests${queryString}`);
  return response;
}

export async function getQuoteRequest(id: string) {
  const response = await apiRequest<{ data: QuoteRequest }>(`/api/quote-requests/${id}`);
  return response;
}

export async function createQuoteRequest(data: CreateQuoteRequestData) {
  const response = await apiRequest<{ data: QuoteRequest }>('/api/quote-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response;
}

export async function updateQuoteRequest(
  id: string,
  data: {
    title?: string;
    status?: QuoteStatus;
    description?: string;
    notes?: string;
    expiryDate?: string;
    vehicleId?: string | null;
    items?: any[];
    additionalSupplierIds?: string[]; // For sending to multiple suppliers
    selectedSupplierId?: string; // The selected supplier for order conversion
  }
) {
  const response = await apiRequest<{ data: QuoteRequest }>(`/api/quote-requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response;
}

export async function syncQuoteRequestThreads(id: string, forceResync: boolean = false) {
  const response = await apiRequest<{
    success: boolean;
    data: any;
    summary: {
      totalSuppliers: number;
      totalThreads: number;
      linked: number;
      alreadyLinked: number;
      errors: number;
    };
  }>(`/api/quote-requests/${id}/sync-threads`, {
    method: 'POST',
    body: JSON.stringify({ forceResync }),
  });
  return response;
}

export async function deleteQuoteRequest(id: string) {
  const response = await apiRequest<{ success: boolean }>(`/api/quote-requests/${id}`, {
    method: 'DELETE',
  });
  return response;
}

// API functions for quote request items
export async function addQuoteRequestItem(quoteRequestId: string, item: QuoteRequestItem) {
  const response = await apiRequest<{ data: QuoteRequestItem }>(
    `/api/quote-requests/${quoteRequestId}/items`,
    {
      method: 'POST',
      body: JSON.stringify(item),
    }
  );
  return response;
}

export async function updateQuoteRequestItem(
  quoteRequestId: string,
  itemId: string,
  data: Partial<QuoteRequestItem>
) {
  const response = await apiRequest<{ data: QuoteRequestItem }>(
    `/api/quote-requests/${quoteRequestId}/items/${itemId}`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
  return response;
}

/**
 * Auto-update thread statuses based on message direction
 */
export async function updateThreadStatuses(quoteRequestId: string) {
  const response = await apiRequest<{
    success: boolean;
    updated: number;
    message: string;
  }>(
    `/api/quote-requests/${quoteRequestId}/update-thread-statuses`,
    {
      method: 'POST',
    }
  );
  return response;
}

export async function deleteQuoteRequestItem(quoteRequestId: string, itemId: string) {
  const response = await apiRequest<{ success: boolean }>(
    `/api/quote-requests/${quoteRequestId}/items/${itemId}`,
    {
      method: 'DELETE',
    }
  );
  return response;
}

// Function to send a quote request email
export async function sendQuoteRequestEmail(quoteRequestId: string, additionalSupplierIds: string[] = []) {
  // Call the new multi-supplier send endpoint
  const response = await apiRequest<{ 
    success: boolean;
    data: {
      totalSent: number;
      totalFailed: number;
      primary: any;
      additional: any[];
      errors: any[];
    }
  }>(`/api/quote-requests/${quoteRequestId}/send`, {
    method: 'POST',
    body: JSON.stringify({ additionalSupplierIds }),
  });
  
  return response.data;
}

// Function to convert a quote request to an order
export async function convertQuoteRequestToOrder(
  quoteRequestId: string,
  payload?: { selectedSupplierId?: string }
) {
  const response = await apiRequest<{ data: { orderId: string; orderNumber: string } }>(
    `/api/quote-requests/${quoteRequestId}/convert-to-order`,
    {
      method: 'POST',
      body: JSON.stringify(payload || {}),
      timeout: 660000, // 11 minutes - allows for 10 minute webhook + 1 minute buffer
    }
  );
  return response;
}

// Function to generate a follow-up email preview
export async function generateFollowUpPreview(
  quoteRequestId: string,
  messageId: string,
  data: {
    additionalMessage?: string;
    expectedResponseBy?: Date;
    followUpReason?: string;
    workflowBranch?: "no_response" | "needs_revision" | "accept_quote";
    supplierId?: string;
  }
) {
  const response = await apiRequest<{ 
    data: { 
      email: { subject: string; body: string; bodyHtml: string };
      metadata: any;
      actions: any;
    } 
  }>(
    `/api/webhooks/email/follow-up`,
    {
      method: 'POST',
      body: JSON.stringify({
        quoteRequestId,
        messageId,
        action: 'preview',
        ...data
      }),
    }
  );
  return response;
}

// Function to get N8N responses for a quote request
export async function getN8nResponses(quoteRequestId: string) {
  const response = await apiRequest<{ data: any[] }>(
    `/api/quote-requests/${quoteRequestId}/n8n-responses`
  );
  return response;
}

// Function to send a follow-up email
export async function sendFollowUpEmail(
  quoteRequestId: string,
  messageId: string, // This is required by the API but can be a dummy value
  data: {
    additionalMessage?: string;
    expectedResponseBy?: Date;
    followUpReason?: string;
    workflowBranch?: "no_response" | "needs_revision" | "accept_quote";
    supplierId?: string;
    emailContent?: {
      subject?: string;
      body?: string;
      bodyHtml?: string;
    };
    supplier?: {
      id: string;
      name: string;
      email: string;
      auxiliaryEmails?: string[];
    };
  }
) {
  // Create the payload with all required fields
  const payload = {
    quoteRequestId,
    // Use a dummy messageId if one is not provided or is clearly a placeholder
    messageId: messageId && !messageId.includes('dummy') ? messageId : 'dummy-message-id',
    action: 'send',
    ...data
  };
  
  console.log("Sending follow-up email with payload:", {
    ...payload,
    emailContent: payload.emailContent ? "Content included" : "No content",
    additionalMessage: payload.additionalMessage || "None",
    workflowBranch: payload.workflowBranch
  });
  
  const response = await apiRequest<{ data: { messageId: string } }>(
    `/api/webhooks/email/follow-up`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return response;
}

// Function to refresh prices for a quote request
export async function refreshPrices(quoteRequestId: string, supplierId?: string) {
  console.log('[refreshPrices] Calling price update API with supplierId:', supplierId);
  const response = await apiRequest<{
    success: boolean;
    message: string;
    quoteRequest: QuoteRequest;
  }>(
    `/api/quote-requests/${quoteRequestId}/prices`,
    {
      method: 'POST',
      body: JSON.stringify({ supplierId: supplierId || null }),
    }
  );
  return response;
}

/**
 * Send quote request to multiple suppliers (primary + additional)
 */
export async function sendQuoteToMultipleSuppliers(quoteRequestId: string) {
  const response = await apiRequest<{
    success: boolean;
    data: {
      totalSent: number;
      totalFailed: number;
      primary: {
        supplierId: string;
        supplierName: string;
        emailContent: any;
        messageId: string;
      } | null;
      additional: Array<{
        supplierId: string;
        supplierName: string;
        emailContent: any;
        messageId: string;
      }>;
      errors: Array<{
        supplierId: string;
        supplierName: string;
        error: string;
      }>;
    };
  }>(
    `/api/quote-requests/${quoteRequestId}/send`,
    {
      method: 'POST',
    }
  );
  return response;
}

/**
 * Link an email thread to a quote request for a specific supplier
 * This is typically called by n8n after creating an email thread
 */
export async function linkEmailThreadToQuote(
  quoteRequestId: string,
  data: {
    supplierId: string;
    emailThreadId: string;
    isPrimary?: boolean;
  }
) {
  const response = await apiRequest<{
    data: {
      id: string;
      quoteRequestId: string;
      emailThreadId: string;
      supplierId: string;
      isPrimary: boolean;
      status: string;
      createdAt: string;
      supplier: {
        id: string;
        name: string;
        email: string | null;
      };
      emailThread: {
        id: string;
        subject: string;
        status: string;
      };
    };
  }>(
    `/api/quote-requests/${quoteRequestId}/link-email-thread`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
  return response;
}