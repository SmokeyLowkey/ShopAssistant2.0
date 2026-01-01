/**
 * n8n Webhook API client for making requests to n8n services
 */
import { apiRequest } from './client';

/**
 * Helper function to extract the actual data from n8n webhook responses
 * which can come in different formats
 */
function extractWebhookResponseData<T>(response: any): T {
  // Handle empty or null response
  if (!response) {
    console.warn('Empty response received in extractWebhookResponseData');
    return {} as T;
  }
  
  console.log('Response type in extractWebhookResponseData:', Array.isArray(response) ? 'Array' : typeof response);
  
  // Handle different response formats
  if (Array.isArray(response) && response.length > 0) {
    console.log('Processing array response with length:', response.length);

    // Format 1: Array with response.body structure
    if (response[0].response && response[0].response.body) {
      return response[0].response.body;
    }

    // Format 2: Array with output containing JSON string
    if (response[0].output && typeof response[0].output === 'string') {
      try {
        const outputText = response[0].output;
        // Try to extract JSON from markdown code block if present
        if (outputText.includes('```json')) {
          const jsonStartIndex = outputText.indexOf('```json\n') + 8;
          const jsonEndIndex = outputText.lastIndexOf('\n```');
          if (jsonStartIndex > 8 && jsonEndIndex > jsonStartIndex) {
            const jsonString = outputText.substring(jsonStartIndex, jsonEndIndex);
            return JSON.parse(jsonString);
          }
        }
        
        // If no markdown code block, try to parse the entire output as JSON
        try {
          return JSON.parse(outputText);
        } catch (e) {
          console.error('Failed to parse output as JSON:', e);
        }
      } catch (error) {
        console.error('Error extracting JSON from output:', error);
      }
    }
    
    // Format 3: Follow-up webhook response format (array with email object)
    if (response[0].email && response[0].email.subject && response[0].email.body) {
      console.log('Found follow-up webhook response format with email object');
      return {
        emailContent: {
          subject: response[0].email.subject,
          body: response[0].email.body,
          bodyHtml: response[0].email.bodyHtml || response[0].email.body
        },
        messageId: response[0].metadata?.messageId || `generated-${Date.now()}`,
        suggestedNextFollowUp: '7 days'
      } as unknown as T;
    }
    
    // If we can't extract data from the array in a structured way, return the first element
    console.log('Returning first element of array as fallback');
    return response[0] as T;
  }
  
  // Format 4: Direct response object with emailContent
  if (response.emailContent) {
    console.log('Found direct response with emailContent');
    return response as T;
  }
  
  // Format 5: Response with email field (new format from follow-up webhook)
  if (response.email && response.email.subject && response.email.body) {
    console.log('Found response with email field');
    // Transform to expected format
    return {
      emailContent: {
        subject: response.email.subject,
        body: response.email.body,
        bodyHtml: response.email.bodyHtml || response.email.body
      },
      messageId: response.metadata?.messageId || `generated-${Date.now()}`,
      suggestedNextFollowUp: '7 days'
    } as unknown as T;
  }
  
  // Format 6: Response with fullResponse.data.email structure
  if (response.fullResponse?.data?.email) {
    const email = response.fullResponse.data.email;
    console.log('Found response with fullResponse.data.email structure');
    return {
      emailContent: {
        subject: email.subject,
        body: email.body,
        bodyHtml: email.bodyHtml || email.body
      },
      messageId: response.metadata?.messageId || `generated-${Date.now()}`,
      suggestedNextFollowUp: '7 days'
    } as unknown as T;
  }
  
  // Format 7: Response with id, threadId, and subject (minimal email response)
  if (response.id && response.threadId && response.subject) {
    console.log('Found minimal email response with id, threadId, and subject');
    // Transform to expected format
    return {
      emailContent: {
        subject: response.subject,
        body: `Follow-up email regarding quote request. Thread ID: ${response.threadId}`,
        bodyHtml: `<p>Follow-up email regarding quote request. Thread ID: ${response.threadId}</p>`
      },
      messageId: response.id,
      suggestedNextFollowUp: '7 days'
    } as unknown as T;
  }
  
  // If we reach here, return the response as is (original format)
  console.log('No recognized format found, returning response as is');
  
  // Check if response has an 'output' field with text (n8n plain text response)
  if (response.output && typeof response.output === 'string') {
    console.log('Found plain text output from n8n, treating as success');
    // Return a success response indicating the webhook processed the data
    // but didn't return structured pricing data
    return {
      success: true,
      message: 'Price update processed by n8n',
      textOutput: response.output,
      updatedItems: [] // Empty array to prevent errors
    } as unknown as T;
  }
  
  return response;
}

// Define n8n webhook URLs from environment variables with better error handling
const getWebhookUrl = (webhookType: string): string => {
  const envVar = `${webhookType.toUpperCase()}_WEBHOOK_URL`;
  const url = process.env[envVar] || '';
  
  if (!url) {
    console.warn(`${envVar} is not defined in environment variables`);
    
    // For development, we could check for a fallback environment variable
    // but we won't hardcode any URLs for security reasons
    const fallbackEnvVar = `${webhookType.toUpperCase()}_WEBHOOK_URL_FALLBACK`;
    const fallbackUrl = process.env[fallbackEnvVar] || '';
    
    if (fallbackUrl) {
      console.log(`Using fallback environment variable ${fallbackEnvVar}`);
      return fallbackUrl;
    }
  }
  
  return url;
};

// Parts Search Webhook
export interface PartsSearchRequest {
  query: string;
  vehicleContext?: {
    make?: string;
    model?: string;
    year?: number;
    serialNumber?: string;
  };
  filters?: {
    category?: string;
    inStock?: boolean;
  };
  conversationId?: string;
}

export interface PartsSearchResult {
  partId: string;
  partNumber: string;
  description: string;
  price: number;
  availability: string;
  imageUrl?: string;
  compatibility: string[];
  matchConfidence: number;
}

export interface PartsSearchResponse {
  results: PartsSearchResult[];
  suggestedFilters: {
    type: string;
    value: string;
    count: number;
  }[];
  relatedQueries: string[];
  conversationNextSteps: string[];
}

export async function searchParts(data: PartsSearchRequest): Promise<PartsSearchResponse> {
  const url = getWebhookUrl('PARTS_SEARCH');
  if (!url) throw new Error('Parts search webhook URL not configured');
  
  // Log the outgoing payload details
  console.log('[Parts Search API] Sending payload to n8n webhook:', JSON.stringify({
    payloadCount: 1,
    query: data.query,
    hasVehicleContext: !!data.vehicleContext,
    vehicleDetails: data.vehicleContext ? {
      make: data.vehicleContext.make,
      model: data.vehicleContext.model,
      year: data.vehicleContext.year,
      serialNumber: data.vehicleContext.serialNumber
    } : null,
    hasFilters: !!data.filters,
    filterDetails: data.filters,
    conversationId: data.conversationId,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  // Make the API request
  const response = await apiRequest<any>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  console.log('[Parts Search API] Received response from n8n webhook');
  
  // Extract the actual data from the response
  return extractWebhookResponseData<PartsSearchResponse>(response);
}

// Email Quote Request Webhook
export interface QuoteRequestEmailData {
  quoteRequestId: string;
  quoteNumber: string;
  supplierId: string; // CRITICAL: The specific supplier ID this request is for
  isPrimary?: boolean; // Indicates if this is the primary supplier
  suggestedFulfillmentMethod?: string;
  pickListId?: string;
  
  // Timing information
  timing: {
    requestDate: string;
    expiryDate?: string;
    expectedResponseDate?: string;
  };
  
  // Supplier information
  supplier: {
    id: string;
    name: string;
    email: string;
    contactPerson?: string;
  };
  
  // Items
  items: {
    partNumber: string;
    description: string;
    quantity: number;
  }[];
  
  // Requirements
  requirements?: {
    deliveryDate?: string;
    specialInstructions?: string;
    shippingMethod?: string;
    requestedResponseDate?: string;
    expectedDeliveryTimeframe?: string;
  };
  
  // Special instructions and notes (also available at root level)
  specialInstructions?: string;
  notes?: string;
  description?: string;
  
  // Organization information
  organization: {
    id: string;
    name: string;
    contactInfo: string;
  };
  
  // User information
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  
  // Email thread creation info
  emailThread?: {
    createdById: string;
  };
  
  // Vehicle information
  vehicle?: {
    id: string;
    vehicleId: string;
    make: string;
    model: string;
    year: number;
    serialNumber?: string;
  };
  
  // Legacy fields (kept for backward compatibility)
  additionalSupplierIds?: string;
  additionalSuppliers?: {
    id: string;
    name: string;
    email: string;
    contactPerson?: string;
  }[];
}

export interface QuoteRequestEmailResponse {
  emailContent: {
    subject: string;
    body: string;
    bodyHtml: string;
  };
  messageId: string;
  suggestedFollowUp: string;
}

export async function generateQuoteRequestEmail(data: QuoteRequestEmailData): Promise<QuoteRequestEmailResponse> {
  const url = getWebhookUrl('QUOTE_REQUEST');
  if (!url) throw new Error('Quote request webhook URL not configured');
  
  const response = await apiRequest<any>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  return extractWebhookResponseData<QuoteRequestEmailResponse>(response);
}

// Email Parser Webhook
export interface EmailParseRequest {
  emailId: string;
  threadId: string;
  from: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  receivedAt: string;
  attachments?: {
    filename: string;
    contentType: string;
    url: string;
  }[];
  quoteRequestId?: string;
}

export interface EmailParseResponse {
  extractedData: {
    quoteItems: {
      partNumber: string;
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      availability?: string;
      leadTime?: string;
    }[];
    terms?: string;
    validUntil?: string;
    totalAmount: number;
    currency: string;
    additionalNotes?: string;
  };
  confidence: number;
  suggestedActions: {
    type: string;
    reason: string;
    priority: string;
  }[];
}

export async function parseEmail(data: EmailParseRequest): Promise<EmailParseResponse> {
  const url = getWebhookUrl('EMAIL_PARSER');
  if (!url) throw new Error('Email parser webhook URL not configured');
  
  const response = await apiRequest<any>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  return extractWebhookResponseData<EmailParseResponse>(response);
}

// Follow-up Email Webhook
export interface FollowUpEmailRequest {
  quoteRequestId: string;
  threadId: string;
  supplier: {
    id: string;
    name: string;
    email: string;
    auxiliaryEmails?: string[];
  };
  previousCommunication: {
    lastContactDate: string;
    messagesSummary: string;
  };
  followUpReason: string;
  workflowBranch: "no_response" | "needs_revision" | "accept_quote";
  missingInformation?: string[];
  additionalMessage?: string; // Add explicit support for additionalMessage
  expectedResponseBy?: string; // Add support for expectedResponseBy
  followUpSentAt?: string;    // Add support for followUpSentAt
  inReplyTo?: string;         // Add support for inReplyTo
  // Add support for custom email content
  customEmailContent?: {
    subject: string;
    body: string;
    bodyHtml?: string;
    from?: string;
    to?: string;
    direction?: 'OUTBOUND' | 'INBOUND';
  };
  user?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

export interface FollowUpEmailResponse {
  emailContent: {
    subject: string;
    body: string;
    bodyHtml: string;
  };
  messageId: string;
  suggestedNextFollowUp?: string;
}

export async function generateFollowUpEmail(data: FollowUpEmailRequest): Promise<FollowUpEmailResponse> {
  // Store custom email content for potential use later
  const hasCustomContent = !!(data.customEmailContent &&
                            data.customEmailContent.subject &&
                            data.customEmailContent.body);
  
  // Add direction and user info to customEmailContent if it exists
  if (hasCustomContent && data.customEmailContent) {
    data.customEmailContent.direction = 'OUTBOUND';
    data.customEmailContent.from = data.user?.email || 'system@example.com';
    data.customEmailContent.to = data.supplier.email;
  }
  
  // Ensure missingInformation is always included when workflowBranch is "needs_revision"
  if (data.workflowBranch === "needs_revision" && !data.missingInformation) {
    data.missingInformation = data.additionalMessage ? [data.additionalMessage] : [];
    console.log("Added missingInformation array for needs_revision branch:", data.missingInformation);
  }
  
  // Get the webhook URL
  const url = getWebhookUrl('FOLLOW_UP');
  
  // Log for debugging (without revealing the actual URL)
  console.log(`Using follow-up webhook URL from environment variables: ${url ? 'URL found' : 'URL not found'}`);
  
  // If no URL is available, throw an error
  if (!url) {
    console.error('Follow-up webhook URL not configured');
    throw new Error('Follow-up webhook URL not configured. Please check your environment variables.');
  }
  
  try {
    // Always attempt to call the webhook to ensure JWT token is sent
    // Create a more detailed log that shows all important fields
    console.log(`Sending follow-up request to webhook with data:`, JSON.stringify({
      quoteRequestId: data.quoteRequestId,
      threadId: data.threadId,
      supplier: data.supplier,
      previousCommunication: data.previousCommunication,
      followUpReason: data.followUpReason,
      workflowBranch: data.workflowBranch,
      missingInformation: data.missingInformation || [],
      additionalMessage: data.additionalMessage || null,
      expectedResponseBy: data.expectedResponseBy || null,
      followUpSentAt: data.followUpSentAt || null,
      inReplyTo: data.inReplyTo || null,
      user: data.user || null,
      customEmailContent: hasCustomContent ? 'Content included' : 'Not provided'
    }));
    
    const response = await apiRequest<any>(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    // Log the response for debugging
    console.log(`Received follow-up response:`, JSON.stringify(response));
    
    // If response is empty or doesn't have expected structure, throw an error
    if (!response || Object.keys(response).length === 0) {
      console.error('Empty response from follow-up webhook');
      throw new Error('Empty response received from follow-up webhook');
    }
    
    // Extract the response data
    const extractedResponse = extractWebhookResponseData<FollowUpEmailResponse>(response);
    
    // Validate the extracted response
    if (!extractedResponse.emailContent ||
        !extractedResponse.emailContent.subject ||
        !extractedResponse.emailContent.body) {
      console.error('Invalid response format from follow-up webhook:', JSON.stringify(extractedResponse));
      throw new Error('Invalid response format from follow-up webhook: missing email content');
    }
    
    return extractedResponse;
  } catch (error) {
    console.error('Error generating follow-up email:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

// The createFallbackResponse function has been removed as we no longer want to create fallback responses
// Instead, we throw errors that will be handled by the caller

// Order Confirmation Email Webhook
export interface OrderConfirmationRequest {
  // Order identification
  orderId: string;
  orderNumber: string;
  quoteRequestId: string;
  quoteNumber: string; // Added for reference
  
  // Email tracking
  expectedResponseBy: string; // ISO timestamp for when response is expected (24 hours from order)
  
  // Fulfillment information
  fulfillmentMethod: 'PICKUP' | 'DELIVERY' | 'SPLIT';
  partialFulfillment: boolean; // Added to indicate split fulfillment
  
  // Supplier information
  supplier: {
    id: string;
    name: string;
    email: string;
    type?: string; // Added supplier type (LOCAL_DEALER, ONLINE_RETAILER, etc.)
    contactPerson?: string; // Added contact person
    phone?: string; // Added phone number
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    }; // Added supplier address
  };
  
  // Organization information
  organization: {
    id: string;
    name: string;
    contactInfo: string;
    billingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    }; // Added billing address
  };
  
  // User information
  user: {
    id: string;
    name: string;
    email: string;
    role?: string;
    phone?: string;
  };
  
  // Vehicle information (if applicable)
  vehicle?: {
    id: string;
    vehicleId: string;
    make: string;
    model: string;
    year: number;
    serialNumber?: string;
    type?: string;
  };
  
  // Email thread information with full conversation history
  emailThread?: {
    id: string;
    subject: string;
    status: string;
    messages: {
      id: string;
      direction: 'INBOUND' | 'OUTBOUND';
      subject: string;
      fromEmail: string;
      toEmail: string;
      cc?: string[];
      bcc?: string[];
      body: string;
      htmlBody?: string;
      sentAt: string;
      receivedAt?: string;
      followUpSentAt?: string;
      followUpReason?: string;
      inReplyTo?: string;
      externalMessageId?: string;
      attachments?: {
        id: string;
        filename: string;
        s3Key: string;
        extractedText?: string;
      }[];
    }[];
  };
  
  // Most recent quote content from supplier
  mostRecentQuote?: {
    id: string;
    subject: string;
    body: string;
    htmlBody?: string;
    sentAt: string;
    attachments?: {
      filename: string;
      extractedText?: string;
    }[];
  };
  
  // Items with detailed information
  items: {
    id: string; // Order item ID
    partId?: string; // Part ID if available
    partNumber: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    
    // Availability and fulfillment information
    availability: 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN';
    fulfillmentMethod?: 'PICKUP' | 'DELIVERY'; // For split fulfillment
    estimatedDeliveryDays?: number;
    leadTime?: number;
    
    // Additional part information
    supplierPartNumber?: string;
    category?: string;
    weight?: number;
    dimensions?: {
      length?: number;
      width?: number;
      height?: number;
      unit?: string;
    };
  }[];
  
  // Order details
  orderDetails: {
    // Financial information
    totalAmount: number;
    currency: string;
    paymentTerms: string;
    paymentMethod?: string;
    
    // Pickup information
    pickupLocation?: string;
    pickupDate?: string;
    pickupInstructions?: string;
    
    // Delivery information
    shippingCarrier?: string;
    trackingNumber?: string;
    shippingMethod?: string;
    deliveryAddress?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    requestedDeliveryDate?: string;
    estimatedDeliveryDate?: string;
    
    // Additional information
    notes?: string;
    specialInstructions?: string;
    purchaseOrderNumber?: string;
  };
  
  // Timestamps
  timestamps: {
    orderDate: string;
    quoteApprovalDate?: string;
    expectedFulfillmentDate?: string;
  };
}

export interface OrderConfirmationResponse {
  // Email content for sending to the supplier
  emailContent: {
    subject: string;
    body: string;
    bodyHtml: string;
  };
  messageId: string;
  
  // Optional purchase order attachment
  purchaseOrderAttachment?: {
    filename: string;
    contentType: string;
    content: string; // Base64 encoded
  };
  
  // Optional order updates to be applied to the database
  orderUpdates?: {
    trackingNumber?: string;
    shippingCarrier?: string;
    expectedDeliveryDate?: string;
    fulfillmentStatus?: string;
    items?: {
      id: string;
      availability?: 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN';
      trackingNumber?: string;
      expectedDeliveryDate?: string;
    }[];
  };
  
  // Additional information
  suggestedNextSteps?: string[];
  estimatedFulfillmentTimeline?: string;
}

export async function generateOrderConfirmationEmail(data: OrderConfirmationRequest): Promise<OrderConfirmationResponse> {
  const url = getWebhookUrl('ORDER_CONFIRMATION');
  if (!url) throw new Error('Order confirmation webhook URL not configured');

  const response = await apiRequest<any>(url, {
    method: 'POST',
    body: JSON.stringify(data),
    timeout: 600000, // 10 minutes timeout for order confirmation webhook (typically takes ~2 minutes)
  });

  return extractWebhookResponseData<OrderConfirmationResponse>(response);
}

// Customer Support Webhook
export interface CustomerSupportRequest {
  query: string;
  conversationId: string;
  previousMessages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }[];
  userContext: {
    userId: string;
    role: string;
    organizationId: string;
  };
  dataAccess: {
    includeOrders: boolean;
    includeQuotes: boolean;
    includeSupplierCommunications: boolean;
  };
}

export interface CustomerSupportResponse {
  response: string;
  sources: {
    type: string;
    id: string;
    relevance: number;
    snippet: string;
  }[];
  suggestedActions: {
    type: string;
    description: string;
    data: any;
  }[];
  needsHumanEscalation: boolean;
  escalationReason?: string;
}

export async function processCustomerSupportQuery(data: CustomerSupportRequest): Promise<CustomerSupportResponse> {
  const url = getWebhookUrl('CUSTOMER_SUPPORT');
  if (!url) throw new Error('Customer support webhook URL not configured');
  
  // Make the API request
  const response = await apiRequest<any>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  // Extract the actual data from the response
  return extractWebhookResponseData<CustomerSupportResponse>(response);
}

// Price Update Webhook
export interface PriceUpdateRequest {
  quoteRequestId: string;
  items: {
    id: string;
    partNumber: string;
    description: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    leadTime?: number;
  }[];
  supplierEmail?: {
    id: string;
    from: string;
    subject: string;
    body: string;
    bodyHtml?: string;
    receivedAt: string;
    direction: 'INBOUND';
  } | null;
}

export interface PriceUpdateResponse {
  updatedItems: {
    id: string;
    unitPrice: number;
    totalPrice: number;
    leadTime?: number;
    availability: 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN';
    estimatedDeliveryDays?: number;
    suggestedFulfillmentMethod: 'PICKUP' | 'DELIVERY';
    // Supplier part number and supersession fields
    supplierPartNumber?: string;
    isSuperseded?: boolean;
    originalPartNumber?: string;
    supersessionNotes?: string;
    // Alternative part fields
    isAlternative?: boolean;
    alternativeReason?: string;
    // Supplier notes
    supplierNotes?: string;
  }[];
  overallRecommendation: 'PICKUP' | 'DELIVERY' | 'SPLIT';
  success: boolean;
  message: string;
}

export async function updatePartPrices(data: PriceUpdateRequest): Promise<PriceUpdateResponse> {
  const url = getWebhookUrl('PRICE_UPDATE');
  if (!url) throw new Error('Price update webhook URL not configured');
  
  console.log(`Sending price update request to webhook with data:`, JSON.stringify({
    quoteRequestId: data.quoteRequestId,
    itemCount: data.items.length
  }));
  
  // Make the API request
  const response = await apiRequest<any>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  console.log(`Received price update response:`, JSON.stringify(response));
  
  // Extract the actual data from the response
  return extractWebhookResponseData<PriceUpdateResponse>(response);
}

// ============================================================================
// POST ORDER WEBHOOK - Order Update Tracking System
// ============================================================================

/**
 * Request payload for POST_ORDER_WEBHOOK
 * Sends order details and email thread to N8N for parsing tracking updates
 */
export interface PostOrderWebhookRequest {
  orderId: string;
  orderNumber: string;
  supplierId: string;
  orderDate: string;
  status: string;
  totalAmount: number;
  fulfillmentMethod: string;
  currentTracking: {
    trackingNumber?: string | null;
    shippingCarrier?: string | null;
    expectedDelivery?: string | null;
  };
  supplier: {
    id: string;
    name: string;
    email: string;
    contactPerson?: string | null;
  };
  emailThread: {
    id: string;
    messages: Array<{
      id: string;
      from: string;
      to: string;
      subject: string;
      body: string;
      sentAt: string;
      direction: string;
    }>;
  };
  items: Array<{
    id: string;
    partNumber: string;
    description: string;
    quantity: number;
    availability?: string | null;
    currentTracking?: {
      trackingNumber?: string | null;
      expectedDelivery?: string | null;
    };
  }>;
  organization: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Response from POST_ORDER_WEBHOOK
 * Contains parsed tracking information and status updates
 */
export interface PostOrderWebhookResponse {
  orderUpdates?: {
    trackingNumber?: string;
    shippingCarrier?: string;
    expectedDelivery?: string;
    status?: string;
  };
  itemUpdates?: Array<{
    id: string;
    trackingNumber?: string;
    expectedDelivery?: string;
    availability?: string;
  }>;
  supplierMessages?: Array<{
    type: 'tracking' | 'delivery' | 'status' | 'other';
    message: string;
    timestamp?: string;
  }>;
  suggestedActions?: Array<{
    action: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  success: boolean;
  message?: string;
}

/**
 * Calls N8N webhook to parse order updates from email thread
 * Used for both manual "Sync Updates" and automatic email triggers
 */
export async function postOrderWebhook(
  data: PostOrderWebhookRequest
): Promise<PostOrderWebhookResponse> {
  const url = getWebhookUrl('POST_ORDER');
  if (!url) throw new Error('Post order webhook URL not configured');

  console.log(`Sending post-order webhook request for order ${data.orderNumber}`);

  const response = await apiRequest<any>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  console.log(`Received post-order webhook response:`, JSON.stringify(response));

  return extractWebhookResponseData<PostOrderWebhookResponse>(response);
}

// ============================================================================
// ORDER FOLLOW-UP WEBHOOK - Order Follow-Up Email Generation
// ============================================================================

/**
 * Order follow-up workflow branches
 */
export type OrderFollowUpBranch =
  | 'no_confirmation'
  | 'missing_tracking'
  | 'delivery_delayed'
  | 'quality_issue'
  | 'other';

/**
 * Request payload for ORDER_FOLLOW_UP_WEBHOOK
 */
export interface OrderFollowUpRequest {
  orderId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  supplierContactPerson?: string | null;
  orderDate: string;
  status: string;
  totalAmount: number;
  trackingNumber?: string | null;
  expectedDelivery?: string | null;
  items: Array<{
    partNumber: string;
    description: string;
    quantity: number;
    availability?: string | null;
  }>;
  branch: OrderFollowUpBranch;
  userMessage?: string;
  expectedResponseDate?: string;
  previousEmails: Array<{
    from: string;
    to: string;
    subject: string;
    body: string;
    sentAt: string;
  }>;
  organization: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Response from ORDER_FOLLOW_UP_WEBHOOK
 */
export interface OrderFollowUpResponse {
  emailContent: {
    subject: string;
    body: string;
    bodyHtml: string;
  };
  suggestedFollowUpDate?: string;
  success: boolean;
  message?: string;
}

/**
 * Generates order follow-up email content via N8N
 */
export async function generateOrderFollowUpEmail(
  data: OrderFollowUpRequest
): Promise<OrderFollowUpResponse> {
  const url = getWebhookUrl('ORDER_FOLLOW_UP');
  if (!url) throw new Error('Order follow-up webhook URL not configured');

  console.log(
    `Generating order follow-up email for order ${data.orderNumber} (branch: ${data.branch})`
  );

  const response = await apiRequest<any>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  console.log(`Received order follow-up response`);

  return extractWebhookResponseData<OrderFollowUpResponse>(response);
}