-- AlterTable
ALTER TABLE "quote_request_items" ADD COLUMN     "supplierId" TEXT;

-- CreateIndex
CREATE INDEX "quote_request_items_supplierId_idx" ON "quote_request_items"("supplierId");

-- CreateIndex
CREATE INDEX "quote_request_items_quoteRequestId_supplierId_idx" ON "quote_request_items"("quoteRequestId", "supplierId");

-- AddForeignKey
ALTER TABLE "quote_request_items" ADD CONSTRAINT "quote_request_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
