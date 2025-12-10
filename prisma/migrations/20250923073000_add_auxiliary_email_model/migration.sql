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

-- Migrate existing data
-- This will be handled by a separate script

-- AlterTable
ALTER TABLE "suppliers" DROP COLUMN "auxiliaryEmails";