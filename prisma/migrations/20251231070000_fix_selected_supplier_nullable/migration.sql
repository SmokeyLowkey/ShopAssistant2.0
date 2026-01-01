-- Ensure selectedSupplierId column is nullable
ALTER TABLE "quote_requests" ALTER COLUMN "selectedSupplierId" DROP NOT NULL;

-- Drop existing foreign key constraint
ALTER TABLE "quote_requests" DROP CONSTRAINT IF EXISTS "quote_requests_selectedSupplierId_fkey";

-- Re-create foreign key constraint with proper ON DELETE behavior
ALTER TABLE "quote_requests"
ADD CONSTRAINT "quote_requests_selectedSupplierId_fkey"
FOREIGN KEY ("selectedSupplierId")
REFERENCES "suppliers"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
