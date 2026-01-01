-- Drop the existing foreign key constraint if it exists with NOT NULL restriction
ALTER TABLE "quote_requests" DROP CONSTRAINT IF EXISTS "quote_requests_selectedSupplierId_fkey";

-- Re-add the foreign key constraint without NOT NULL restriction
ALTER TABLE "quote_requests"
ADD CONSTRAINT "quote_requests_selectedSupplierId_fkey"
FOREIGN KEY ("selectedSupplierId")
REFERENCES "suppliers"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;