/*
  Warnings:

  - Made the column `vehicleId` on table `quote_requests` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "quote_requests" DROP CONSTRAINT "quote_requests_vehicleId_fkey";

-- AlterTable
ALTER TABLE "quote_requests" ALTER COLUMN "vehicleId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
