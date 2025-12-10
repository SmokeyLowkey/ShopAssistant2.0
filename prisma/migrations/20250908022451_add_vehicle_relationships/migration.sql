-- AlterTable
ALTER TABLE "chat_pick_lists" ADD COLUMN     "vehicleId" TEXT;

-- AlterTable
ALTER TABLE "quote_requests" ADD COLUMN     "vehicleId" TEXT;

-- AddForeignKey
ALTER TABLE "chat_pick_lists" ADD CONSTRAINT "chat_pick_lists_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
