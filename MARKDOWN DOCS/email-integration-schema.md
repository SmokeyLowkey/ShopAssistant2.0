# Email Integration Schema Updates

To support the AI-powered quote request system, we need to update the database schema to store both inbound and outbound emails. This document outlines the necessary schema changes to implement this functionality.

## 1. New Email Communication Models

```prisma
// Email Communication Models
model EmailThread {
  id              String          @id @default(cuid())
  subject         String
  externalThreadId String?        // External email thread ID for tracking
  status          EmailThreadStatus
  
  // Organization Context
  organization    Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  organizationId  String
  
  // Relationships
  supplier        Supplier?       @relation(fields: [supplierId], references: [id])
  supplierId      String?
  quoteRequest    QuoteRequest?   @relation(fields: [quoteRequestId], references: [id])
  quoteRequestId  String?         @unique
  order           Order?          @relation(fields: [orderId], references: [id])
  orderId         String?         @unique
  
  // Content
  messages        EmailMessage[]
  
  // Metadata
  createdBy       User            @relation(fields: [createdById], references: [id])
  createdById     String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  @@index([organizationId])
  @@index([supplierId])
  @@index([status])
  @@map("email_threads")
}

model EmailMessage {
  id              String          @id @default(cuid())
  thread          EmailThread     @relation(fields: [threadId], references: [id], onDelete: Cascade)
  threadId        String
  
  // Message Details
  direction       EmailDirection
  from            String
  to              String[]
  cc              String[]        @default([])
  bcc             String[]        @default([])
  subject         String
  body            String          @db.Text
  bodyHtml        String?         @db.Text
  
  // Email Metadata
  externalMessageId String?       // ID from email provider
  sentAt          DateTime?
  receivedAt      DateTime?
  
  // Attachments
  attachments     EmailAttachment[]
  
  // AI Processing
  isProcessed     Boolean         @default(false)
  extractedData   Json?           // Structured data extracted by AI
  
  // Timestamps
  createdAt       DateTime        @default(now())
  
  @@index([threadId])
  @@index([direction])
  @@map("email_messages")
}

model EmailAttachment {
  id              String          @id @default(cuid())
  message         EmailMessage    @relation(fields: [messageId], references: [id], onDelete: Cascade)
  messageId       String
  
  // Attachment Details
  filename        String
  contentType     String
  size            Int
  storageKey      String          // Path/key to stored file
  
  // Timestamps
  createdAt       DateTime        @default(now())
  
  @@map("email_attachments")
}

// Quote Request Model
model QuoteRequest {
  id              String          @id @default(cuid())
  quoteNumber     String          // QR-2024-001
  
  organization    Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  organizationId  String
  
  // Status
  status          QuoteStatus     @default(DRAFT)
  
  // Relationships
  supplier        Supplier        @relation(fields: [supplierId], references: [id])
  supplierId      String
  emailThread     EmailThread?
  items           QuoteRequestItem[]
  
  // Dates
  requestedDate   DateTime        @default(now())
  expiryDate      DateTime?
  followUpDate    DateTime?
  
  // Quote Details
  totalAmount     Decimal?        @db.Decimal(10,2)
  currency        String          @default("USD")
  terms           String?
  notes           String?
  
  // Timestamps
  createdBy       User            @relation(fields: [createdById], references: [id])
  createdById     String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  @@unique([organizationId, quoteNumber])
  @@index([organizationId])
  @@index([supplierId])
  @@index([status])
  @@map("quote_requests")
}

model QuoteRequestItem {
  id              String          @id @default(cuid())
  quoteRequest    QuoteRequest    @relation(fields: [quoteRequestId], references: [id], onDelete: Cascade)
  quoteRequestId  String
  
  // Item Details
  partNumber      String
  description     String
  quantity        Int
  unitPrice       Decimal?        @db.Decimal(10,2)
  totalPrice      Decimal?        @db.Decimal(10,2)
  
  // Part Reference (optional)
  part            Part?           @relation(fields: [partId], references: [id])
  partId          String?
  
  // Status
  isQuoted        Boolean         @default(false)
  
  // Timestamps
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  @@map("quote_request_items")
}

// Enums
enum EmailThreadStatus {
  DRAFT
  SENT
  WAITING_RESPONSE
  RESPONSE_RECEIVED
  FOLLOW_UP_NEEDED
  COMPLETED
  CONVERTED_TO_ORDER
  CANCELLED
}

enum EmailDirection {
  OUTBOUND
  INBOUND
}

enum QuoteStatus {
  DRAFT
  SENT
  RECEIVED
  UNDER_REVIEW
  APPROVED
  REJECTED
  EXPIRED
  CONVERTED_TO_ORDER
}
```

## 2. Updates to Existing Models

```prisma
// Add to Order model
model Order {
  // Existing fields...
  
  // New fields
  quoteReference  String?         // Reference to the quote number
  emailThread     EmailThread?
}

// Add to Supplier model
model Supplier {
  // Existing fields...
  
  // New fields
  emailThreads    EmailThread[]
  quoteRequests   QuoteRequest[]
}

// Add to User model
model User {
  // Existing fields...
  
  // New fields
  emailThreadsCreated EmailThread[]
  quoteRequestsCreated QuoteRequest[]
}

// Add to Organization model
model Organization {
  // Existing fields...
  
  // New fields
  emailThreads    EmailThread[]
  quoteRequests   QuoteRequest[]
}

// Add to Part model
model Part {
  // Existing fields...
  
  // New fields
  quoteItems      QuoteRequestItem[]
}
```

## 3. Implementation Notes

1. **Email Storage**: 
   - All email content (both inbound and outbound) will be stored in the `EmailMessage` model
   - HTML and plain text versions are stored separately
   - Attachments are stored with references to their storage location

2. **Thread Management**:
   - Each quote request is associated with an email thread
   - The thread can be linked to an order when the quote is approved
   - Thread status tracks the overall state of the communication

3. **AI Processing**:
   - The `extractedData` field in `EmailMessage` stores structured data extracted by AI
   - This enables quick access to key information without parsing the entire email again

4. **Quote Request Workflow**:
   - Quote requests start in DRAFT status
   - When emails are sent, status changes to SENT
   - AI monitors for responses and updates status accordingly
   - Approved quotes can be converted to orders

5. **Security Considerations**:
   - Email content should be encrypted at rest
   - Access controls should limit visibility to authorized users within the organization
   - Sensitive information in emails should be identified and handled appropriately

## 4. Migration Strategy

1. Create the new tables in the database
2. Add the new fields to existing tables
3. Update the application code to use the new schema
4. Implement the email integration service
5. Add the AI processing capabilities for email content