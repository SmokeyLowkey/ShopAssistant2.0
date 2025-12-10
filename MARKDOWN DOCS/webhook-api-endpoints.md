# Webhook API Endpoints for n8n Integration

This document outlines the webhook API endpoints needed for integrating the construction dashboard application with n8n for AI processing. Each webhook will have both development and production URLs.

## 1. Parts Search AI Webhook

### Endpoint: `/api/webhooks/parts-search`

**Purpose**: Process natural language part search queries and return matching parts

**Request Payload**:
```json
{
  "query": "String - The natural language search query",
  "vehicleContext": {
    "make": "Optional - Vehicle make",
    "model": "Optional - Vehicle model",
    "year": "Optional - Vehicle year"
  },
  "filters": {
    "category": "Optional - Part category",
    "inStock": "Optional - Boolean for in-stock items only"
  },
  "conversationId": "Optional - ID of ongoing conversation for context"
}
```

**Response Payload**:
```json
{
  "results": [
    {
      "partId": "String - Part ID",
      "partNumber": "String - Part number",
      "description": "String - Part description",
      "price": "Number - Part price",
      "availability": "String - Availability status",
      "imageUrl": "String - URL to part image",
      "compatibility": "Array - Compatible vehicles",
      "matchConfidence": "Number - AI confidence score (0-100)"
    }
  ],
  "suggestedFilters": [
    {
      "type": "String - Filter type (category, brand, etc.)",
      "value": "String - Suggested value",
      "count": "Number - Result count with this filter"
    }
  ],
  "relatedQueries": ["String - Related search queries"],
  "conversationNextSteps": ["String - Suggested next user actions"]
}
```

**Environment URLs**:
- Development: `https://dev-n8n.example.com/webhook/parts-search`
- Production: `https://n8n.example.com/webhook/parts-search`

## 2. Email Integration Webhooks

### 2.1 Quote Request Generation Webhook

### Endpoint: `/api/webhooks/email/quote-request`

**Purpose**: Generate a professional quote request email based on selected parts

**Request Payload**:
```json
{
  "quoteRequestId": "String - ID of the quote request",
  "supplier": {
    "id": "String - Supplier ID",
    "name": "String - Supplier name",
    "email": "String - Supplier email",
    "contactPerson": "String - Contact person name"
  },
  "items": [
    {
      "partNumber": "String - Part number",
      "description": "String - Part description",
      "quantity": "Number - Requested quantity"
    }
  ],
  "requirements": {
    "deliveryDate": "String - Required delivery date",
    "specialInstructions": "String - Any special instructions",
    "shippingMethod": "String - Preferred shipping method"
  },
  "organization": {
    "name": "String - Organization name",
    "contactInfo": "String - Contact information"
  }
}
```

**Response Payload**:
```json
{
  "emailContent": {
    "subject": "String - Generated email subject",
    "body": "String - Generated email body (plain text)",
    "bodyHtml": "String - Generated email body (HTML)"
  },
  "messageId": "String - Generated message ID for tracking",
  "suggestedFollowUp": "String - Suggested follow-up date"
}
```

### 2.2 Email Parser Webhook

### Endpoint: `/api/webhooks/email/parse`

**Purpose**: Parse incoming supplier emails to extract quote information

**Request Payload**:
```json
{
  "emailId": "String - Email ID",
  "threadId": "String - Email thread ID",
  "from": "String - Sender email",
  "subject": "String - Email subject",
  "body": "String - Email body (plain text)",
  "bodyHtml": "String - Email body (HTML)",
  "receivedAt": "String - Timestamp when email was received",
  "attachments": [
    {
      "filename": "String - Attachment filename",
      "contentType": "String - MIME type",
      "url": "String - URL to download attachment"
    }
  ],
  "quoteRequestId": "String - Associated quote request ID if available"
}
```

**Response Payload**:
```json
{
  "extractedData": {
    "quoteItems": [
      {
        "partNumber": "String - Identified part number",
        "description": "String - Part description",
        "quantity": "Number - Quantity",
        "unitPrice": "Number - Unit price",
        "totalPrice": "Number - Total price",
        "availability": "String - Availability information",
        "leadTime": "String - Lead time information"
      }
    ],
    "terms": "String - Payment/delivery terms",
    "validUntil": "String - Quote expiration date",
    "totalAmount": "Number - Total quote amount",
    "currency": "String - Currency code",
    "additionalNotes": "String - Any additional information"
  },
  "confidence": "Number - Confidence score of extraction (0-100)",
  "suggestedActions": [
    {
      "type": "String - Action type (follow-up, clarify, etc.)",
      "reason": "String - Reason for suggested action",
      "priority": "String - Priority level"
    }
  ]
}
```

### 2.3 Follow-up Email Generation Webhook

### Endpoint: `/api/webhooks/email/follow-up`

**Purpose**: Generate follow-up emails for quote requests

**Request Payload**:
```json
{
  "quoteRequestId": "String - Quote request ID",
  "threadId": "String - Email thread ID",
  "supplier": {
    "id": "String - Supplier ID",
    "name": "String - Supplier name",
    "email": "String - Supplier email"
  },
  "previousCommunication": {
    "lastContactDate": "String - Date of last contact",
    "messagesSummary": "String - Summary of previous messages"
  },
  "followUpReason": "String - Reason for follow-up (no response, missing info, etc.)",
  "missingInformation": ["String - List of missing information items"]
}
```

**Response Payload**:
```json
{
  "emailContent": {
    "subject": "String - Generated email subject",
    "body": "String - Generated email body (plain text)",
    "bodyHtml": "String - Generated email body (HTML)"
  },
  "messageId": "String - Generated message ID for tracking",
  "suggestedNextFollowUp": "String - Suggested next follow-up date if needed"
}
```

### 2.4 Order Confirmation Email Webhook

### Endpoint: `/api/webhooks/email/order-confirmation`

**Purpose**: Generate order confirmation emails when quotes are approved

**Request Payload**:
```json
{
  "orderId": "String - Order ID",
  "orderNumber": "String - Order number",
  "quoteRequestId": "String - Original quote request ID",
  "supplier": {
    "id": "String - Supplier ID",
    "name": "String - Supplier name",
    "email": "String - Supplier email"
  },
  "items": [
    {
      "partNumber": "String - Part number",
      "description": "String - Part description",
      "quantity": "Number - Ordered quantity",
      "unitPrice": "Number - Unit price",
      "totalPrice": "Number - Total price"
    }
  ],
  "orderDetails": {
    "totalAmount": "Number - Total order amount",
    "currency": "String - Currency code",
    "paymentTerms": "String - Payment terms",
    "deliveryAddress": "String - Delivery address",
    "requestedDeliveryDate": "String - Requested delivery date"
  }
}
```

**Response Payload**:
```json
{
  "emailContent": {
    "subject": "String - Generated email subject",
    "body": "String - Generated email body (plain text)",
    "bodyHtml": "String - Generated email body (HTML)"
  },
  "messageId": "String - Generated message ID for tracking",
  "purchaseOrderAttachment": {
    "filename": "String - PO attachment filename",
    "contentType": "String - MIME type",
    "content": "String - Base64 encoded content"
  }
}
```

## 3. Customer Support AI Webhook

### Endpoint: `/api/webhooks/customer-support`

**Purpose**: Process customer support queries and retrieve relevant information

**Request Payload**:
```json
{
  "query": "String - The support query",
  "conversationId": "String - ID of ongoing conversation for context",
  "previousMessages": [
    {
      "role": "String - 'user' or 'assistant'",
      "content": "String - Message content",
      "timestamp": "String - Message timestamp"
    }
  ],
  "userContext": {
    "userId": "String - User ID",
    "role": "String - User role",
    "organizationId": "String - Organization ID"
  },
  "dataAccess": {
    "includeOrders": "Boolean - Include order data",
    "includeQuotes": "Boolean - Include quote data",
    "includeSupplierCommunications": "Boolean - Include supplier communications"
  }
}
```

**Response Payload**:
```json
{
  "response": "String - AI response to the query",
  "sources": [
    {
      "type": "String - Source type (order, quote, email, etc.)",
      "id": "String - Source ID",
      "relevance": "Number - Relevance score",
      "snippet": "String - Relevant excerpt"
    }
  ],
  "suggestedActions": [
    {
      "type": "String - Action type",
      "description": "String - Action description",
      "data": "Object - Any data needed for the action"
    }
  ],
  "needsHumanEscalation": "Boolean - Whether query needs human attention",
  "escalationReason": "String - Reason for escalation if needed"
}
```

**Environment URLs**:
- Development: `https://dev-n8n.example.com/webhook/customer-support`
- Production: `https://n8n.example.com/webhook/customer-support`

## 4. Implementation Notes

### Environment Configuration

- Store webhook URLs in environment variables to easily switch between development and production
- Example configuration in `.env` file:

```
# n8n Webhook URLs - Development
PARTS_SEARCH_WEBHOOK_URL=https://dev-n8n.example.com/webhook/parts-search
QUOTE_REQUEST_WEBHOOK_URL=https://dev-n8n.example.com/webhook/email/quote-request
EMAIL_PARSER_WEBHOOK_URL=https://dev-n8n.example.com/webhook/email/parse
FOLLOW_UP_WEBHOOK_URL=https://dev-n8n.example.com/webhook/email/follow-up
ORDER_CONFIRMATION_WEBHOOK_URL=https://dev-n8n.example.com/webhook/email/order-confirmation
CUSTOMER_SUPPORT_WEBHOOK_URL=https://dev-n8n.example.com/webhook/customer-support

# n8n Webhook URLs - Production
# PARTS_SEARCH_WEBHOOK_URL=https://n8n.example.com/webhook/parts-search
# QUOTE_REQUEST_WEBHOOK_URL=https://n8n.example.com/webhook/email/quote-request
# EMAIL_PARSER_WEBHOOK_URL=https://n8n.example.com/webhook/email/parse
# FOLLOW_UP_WEBHOOK_URL=https://n8n.example.com/webhook/email/follow-up
# ORDER_CONFIRMATION_WEBHOOK_URL=https://n8n.example.com/webhook/email/order-confirmation
# CUSTOMER_SUPPORT_WEBHOOK_URL=https://n8n.example.com/webhook/customer-support
```

### Authentication and Security

- Implement webhook authentication using API keys or JWT tokens
- Add request signing for additional security
- Set up rate limiting to prevent abuse
- Ensure HTTPS for all webhook communications

### Error Handling

- Implement robust error handling for webhook failures
- Set up retry mechanisms for temporary failures
- Log detailed error information for debugging
- Provide fallback behavior when AI services are unavailable

### Monitoring and Logging

- Set up monitoring for webhook performance and reliability
- Log all webhook requests and responses for debugging and auditing
- Create alerts for webhook failures or performance degradation
- Implement analytics to track usage patterns and optimize performance