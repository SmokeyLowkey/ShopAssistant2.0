-- AlterTable
ALTER TABLE "edited_emails" ADD COLUMN     "supplierId" TEXT;

-- CreateIndex
CREATE INDEX "edited_emails_supplierId_idx" ON "edited_emails"("supplierId");

-- CreateIndex
CREATE INDEX "edited_emails_quoteRequestId_supplierId_emailType_idx" ON "edited_emails"("quoteRequestId", "supplierId", "emailType");

-- AddForeignKey
ALTER TABLE "edited_emails" ADD CONSTRAINT "edited_emails_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
