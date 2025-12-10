-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN     "expectedResponseBy" TIMESTAMP(3),
ADD COLUMN     "followUpSentAt" TIMESTAMP(3),
ADD COLUMN     "inReplyTo" TEXT;

-- CreateIndex
CREATE INDEX "email_messages_inReplyTo_idx" ON "email_messages"("inReplyTo");
