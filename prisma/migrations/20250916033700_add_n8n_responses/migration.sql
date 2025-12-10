-- CreateTable
CREATE TABLE "N8nResponse" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "messageId" TEXT,
    "responseType" TEXT NOT NULL,
    "responseData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "N8nResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "N8nResponse_quoteRequestId_idx" ON "N8nResponse"("quoteRequestId");

-- CreateIndex
CREATE INDEX "N8nResponse_messageId_idx" ON "N8nResponse"("messageId");

-- AddForeignKey
ALTER TABLE "N8nResponse" ADD CONSTRAINT "N8nResponse_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;