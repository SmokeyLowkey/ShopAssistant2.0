-- CreateTable
CREATE TABLE "edited_emails" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "emailType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edited_emails_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "edited_emails" ADD CONSTRAINT "edited_emails_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "edited_emails_quoteRequestId_idx" ON "edited_emails"("quoteRequestId");