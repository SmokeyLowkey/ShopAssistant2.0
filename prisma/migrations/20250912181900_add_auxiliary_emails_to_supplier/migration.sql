-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN "auxiliaryEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];