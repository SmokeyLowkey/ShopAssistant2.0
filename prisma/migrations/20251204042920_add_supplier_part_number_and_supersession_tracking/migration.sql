-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "supplierNotes" TEXT;

-- AlterTable
ALTER TABLE "parts" ADD COLUMN     "supersededBy" TEXT,
ADD COLUMN     "supersedes" TEXT,
ADD COLUMN     "supersessionDate" TIMESTAMP(3),
ADD COLUMN     "supersessionNotes" TEXT,
ADD COLUMN     "supplierPartNumber" TEXT;

-- AlterTable
ALTER TABLE "quote_request_items" ADD COLUMN     "alternativeReason" TEXT,
ADD COLUMN     "isSuperseded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalPartNumber" TEXT,
ADD COLUMN     "supersessionNotes" TEXT,
ADD COLUMN     "supplierNotes" TEXT;
