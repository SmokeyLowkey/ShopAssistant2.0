-- DropIndex
DROP INDEX "email_threads_quoteRequestId_key";

-- CreateIndex
CREATE INDEX "email_threads_quoteRequestId_idx" ON "email_threads"("quoteRequestId");
