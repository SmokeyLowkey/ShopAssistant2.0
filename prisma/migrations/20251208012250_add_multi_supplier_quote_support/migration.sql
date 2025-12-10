-- CreateEnum
CREATE TYPE "QuoteThreadStatus" AS ENUM ('SENT', 'RESPONDED', 'ACCEPTED', 'REJECTED', 'NO_RESPONSE');

-- AlterTable
ALTER TABLE "quote_requests" ADD COLUMN     "selectedSupplierId" TEXT;

-- CreateTable
CREATE TABLE "quote_request_email_threads" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "emailThreadId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "QuoteThreadStatus" NOT NULL DEFAULT 'SENT',
    "responseDate" TIMESTAMP(3),
    "quotedAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_request_email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quote_request_email_threads_emailThreadId_key" ON "quote_request_email_threads"("emailThreadId");

-- CreateIndex
CREATE INDEX "quote_request_email_threads_quoteRequestId_idx" ON "quote_request_email_threads"("quoteRequestId");

-- CreateIndex
CREATE INDEX "quote_request_email_threads_supplierId_idx" ON "quote_request_email_threads"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_request_email_threads_quoteRequestId_supplierId_key" ON "quote_request_email_threads"("quoteRequestId", "supplierId");

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_selectedSupplierId_fkey" FOREIGN KEY ("selectedSupplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_email_threads" ADD CONSTRAINT "quote_request_email_threads_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_email_threads" ADD CONSTRAINT "quote_request_email_threads_emailThreadId_fkey" FOREIGN KEY ("emailThreadId") REFERENCES "email_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_email_threads" ADD CONSTRAINT "quote_request_email_threads_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
