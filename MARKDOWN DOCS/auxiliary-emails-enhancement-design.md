# Auxiliary Emails Enhancement Design

## Overview

This document outlines the design for enhancing auxiliary emails in the supplier management system. The enhancement will allow users to add a name and phone number to each auxiliary email, making the emails more personal.

## Current Implementation

Currently, auxiliary emails are stored as a simple string array (`String[]`) in the `Supplier` model. The UI allows adding and removing email addresses, but there's no way to associate additional contact information with these emails.

## Proposed Solution

We will create a separate `AuxiliaryEmail` table with a foreign key relationship to the `Supplier` model. This will allow us to store structured data for each auxiliary email, including:
- Email address
- Name (optional)
- Phone number (optional)

## Implementation Plan

### 1. Database Schema Update

We'll update the Prisma schema to create a new `AuxiliaryEmail` model:

```prisma
// New AuxiliaryEmail model
model AuxiliaryEmail {
  id          String    @id @default(cuid())
  email       String    // The email address
  name        String?   // Optional contact name
  phone       String?   // Optional contact phone number
  
  // Relation to Supplier
  supplier    Supplier  @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  supplierId  String
  
  // Timestamps
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  @@map("auxiliary_emails")
  @@index([supplierId])
  @@unique([supplierId, email]) // Ensure email uniqueness per supplier
}

// Update to Supplier model
model Supplier {
  // ... existing fields ...
  
  // Remove the existing auxiliaryEmails field:
  // auxiliaryEmails String[] @default([])
  
  // Add the relation to AuxiliaryEmail
  auxiliaryEmails AuxiliaryEmail[]
  
  // ... rest of the model ...
}
```

### 2. Migration Strategy

We'll create a migration that:
1. Creates the new `auxiliary_emails` table
2. Migrates existing data from the `auxiliaryEmails` array to the new table with empty name and phone fields
3. Removes the `auxiliaryEmails` column from the `suppliers` table

#### Migration Script

```sql
-- CreateTable
CREATE TABLE "auxiliary_emails" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "phone" TEXT,
  "supplierId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "auxiliary_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auxiliary_emails_supplierId_idx" ON "auxiliary_emails"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "auxiliary_emails_supplierId_email_key" ON "auxiliary_emails"("supplierId", "email");

-- AddForeignKey
ALTER TABLE "auxiliary_emails" ADD CONSTRAINT "auxiliary_emails_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

#### Data Migration Script

```typescript
// Migration script (to be executed after schema migration)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateAuxiliaryEmails() {
  try {
    // Get all suppliers with auxiliaryEmails
    const suppliers = await prisma.supplier.findMany({
      select: {
        id: true,
        auxiliaryEmails: true,
      },
    });
    
    console.log(`Found ${suppliers.length} suppliers to migrate`);
    
    // For each supplier, create new AuxiliaryEmail records
    for (const supplier of suppliers) {
      if (supplier.auxiliaryEmails && supplier.auxiliaryEmails.length > 0) {
        console.log(`Migrating ${supplier.auxiliaryEmails.length} emails for supplier ${supplier.id}`);
        
        // Create auxiliary email records
        await Promise.all(
          supplier.auxiliaryEmails.map(email => 
            prisma.auxiliaryEmail.create({
              data: {
                email,
                supplierId: supplier.id,
                // Name and phone are left empty as per requirements
              },
            })
          )
        );
      }
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateAuxiliaryEmails();
```

#### Final Migration Step

```sql
-- RemoveColumn
ALTER TABLE "suppliers" DROP COLUMN "auxiliaryEmails";
```

### 3. API Endpoints Update

We'll update the API endpoints in `app/api/suppliers/[id]/emails/route.ts`:

#### GET Endpoint

```typescript
// GET /api/suppliers/[id]/emails
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Verify the supplier exists and belongs to the user's organization
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: session.user.organizationId,
      },
      include: {
        auxiliaryEmails: true, // Include the auxiliary emails relation
      },
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or access denied" },
        { status: 404 }
      );
    }
    
    // Return the primary email and auxiliary emails
    return NextResponse.json({
      success: true,
      primaryEmail: supplier.email,
      auxiliaryEmails: supplier.auxiliaryEmails,
    });
  } catch (error) {
    console.error("Error fetching supplier emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier emails" },
      { status: 500 }
    );
  }
}
```

#### POST Endpoint

```typescript
// POST /api/suppliers/[id]/emails
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { email, name, phone } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }
    
    // Verify the supplier exists and belongs to the user's organization
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: session.user.organizationId,
      },
      include: {
        auxiliaryEmails: true,
      },
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or access denied" },
        { status: 404 }
      );
    }
    
    // Check if the email already exists in auxiliaryEmails
    const existingAuxEmail = supplier.auxiliaryEmails.find(aux => aux.email === email);
    if (existingAuxEmail) {
      return NextResponse.json(
        { error: "Email already exists for this supplier" },
        { status: 400 }
      );
    }
    
    // Check if the email is the same as the primary email
    if (supplier.email === email) {
      return NextResponse.json(
        { error: "Email is already the primary email for this supplier" },
        { status: 400 }
      );
    }
    
    // Add the new auxiliary email
    const newAuxiliaryEmail = await prisma.auxiliaryEmail.create({
      data: {
        email,
        name: name || null,
        phone: phone || null,
        supplierId,
      },
    });
    
    return NextResponse.json({
      success: true,
      auxiliaryEmail: newAuxiliaryEmail,
    });
  } catch (error) {
    console.error("Error adding supplier email:", error);
    return NextResponse.json(
      { error: "Failed to add supplier email" },
      { status: 500 }
    );
  }
}
```

#### DELETE Endpoint

```typescript
// DELETE /api/suppliers/[id]/emails/[emailId]
// Note: We're changing the route to include the email ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string, emailId: string } }
) {
  try {
    const supplierId = params.id;
    const emailId = params.emailId;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Verify the supplier exists and belongs to the user's organization
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: session.user.organizationId,
      },
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or access denied" },
        { status: 404 }
      );
    }
    
    // Find and delete the auxiliary email
    const auxiliaryEmail = await prisma.auxiliaryEmail.findFirst({
      where: {
        id: emailId,
        supplierId,
      },
    });
    
    if (!auxiliaryEmail) {
      return NextResponse.json(
        { error: "Auxiliary email not found" },
        { status: 404 }
      );
    }
    
    // Delete the auxiliary email
    await prisma.auxiliaryEmail.delete({
      where: {
        id: emailId,
      },
    });
    
    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error removing supplier email:", error);
    return NextResponse.json(
      { error: "Failed to remove supplier email" },
      { status: 500 }
    );
  }
}
```

#### PATCH Endpoint (New)

```typescript
// PATCH /api/suppliers/[id]/emails/[emailId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string, emailId: string } }
) {
  try {
    const supplierId = params.id;
    const emailId = params.emailId;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { name, phone } = await request.json();
    
    // Verify the supplier exists and belongs to the user's organization
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: session.user.organizationId,
      },
    });
    
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found or access denied" },
        { status: 404 }
      );
    }
    
    // Find and update the auxiliary email
    const auxiliaryEmail = await prisma.auxiliaryEmail.findFirst({
      where: {
        id: emailId,
        supplierId,
      },
    });
    
    if (!auxiliaryEmail) {
      return NextResponse.json(
        { error: "Auxiliary email not found" },
        { status: 404 }
      );
    }
    
    // Update the auxiliary email
    const updatedAuxiliaryEmail = await prisma.auxiliaryEmail.update({
      where: {
        id: emailId,
      },
      data: {
        name: name !== undefined ? name : auxiliaryEmail.name,
        phone: phone !== undefined ? phone : auxiliaryEmail.phone,
      },
    });
    
    return NextResponse.json({
      success: true,
      auxiliaryEmail: updatedAuxiliaryEmail,
    });
  } catch (error) {
    console.error("Error updating supplier email:", error);
    return NextResponse.json(
      { error: "Failed to update supplier email" },
      { status: 500 }
    );
  }
}
```

### 4. UI Updates

#### Supplier Edit Page

The supplier edit page will be updated to:
- Display existing auxiliary emails with name and phone fields
- Allow editing of name and phone for existing auxiliary emails
- Add UI for adding new auxiliary emails with name and phone fields

#### Supplier Detail Page

The supplier detail page will be updated to:
- Display auxiliary emails with their associated name and phone
- Maintain the ability to add and remove auxiliary emails
- Enhance the UI to show the additional contact information

#### Supplier Creation Page

The supplier creation page will be updated to:
- Allow adding auxiliary emails with name and phone during supplier creation
- Ensure the form validation handles the new fields correctly

### 5. Testing Plan

We'll need to test:

1. **Database Migration**:
   - Verify that existing auxiliary emails are correctly migrated to the new table
   - Confirm that the `auxiliaryEmails` column is removed from the `suppliers` table

2. **API Endpoints**:
   - Test GET endpoint to ensure it returns the correct auxiliary emails with name and phone
   - Test POST endpoint to add new auxiliary emails with name and phone
   - Test DELETE endpoint to remove auxiliary emails
   - Test PATCH endpoint to update name and phone for existing auxiliary emails

3. **UI Components**:
   - Test supplier edit page to ensure it displays and allows editing of auxiliary emails
   - Test supplier detail page to ensure it displays auxiliary emails with name and phone
   - Test supplier creation page to ensure it allows adding auxiliary emails during creation

4. **Validation**:
   - Test email validation to ensure only valid emails can be added
   - Test uniqueness validation to prevent duplicate emails

5. **Error Handling**:
   - Test error handling for API failures
   - Test UI feedback for validation errors and API errors