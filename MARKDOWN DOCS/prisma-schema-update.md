# Prisma Schema Update for Auxiliary Emails

## New AuxiliaryEmail Model

Add this new model to the schema.prisma file:

```prisma
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
```

## Update to Supplier Model

Replace the existing auxiliaryEmails field in the Supplier model:

From:
```prisma
auxiliaryEmails String[] @default([])
```

To:
```prisma
auxiliaryEmails AuxiliaryEmail[]
```

## Migration Command

Since we're in dev mode, we can create a direct migration using:

```bash
npx prisma migrate dev --name add_auxiliary_email_model
```

This will:
1. Create the new `auxiliary_emails` table
2. Add the relation to the `Supplier` model
3. Remove the existing `auxiliaryEmails` column from the `suppliers` table

After running the migration, we'll need to update our code to use the new model.