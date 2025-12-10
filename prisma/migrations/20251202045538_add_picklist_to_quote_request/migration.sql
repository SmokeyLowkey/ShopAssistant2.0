-- AlterTable
ALTER TABLE "quote_requests" ADD COLUMN     "pickListId" TEXT;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_pickListId_fkey" FOREIGN KEY ("pickListId") REFERENCES "chat_pick_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
