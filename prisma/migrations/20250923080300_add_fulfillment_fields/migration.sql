-- CreateEnum
CREATE TYPE "FulfillmentMethod" AS ENUM ('PICKUP', 'DELIVERY', 'SPLIT');

-- CreateEnum
CREATE TYPE "ItemAvailability" AS ENUM ('IN_STOCK', 'BACKORDERED', 'SPECIAL_ORDER', 'UNKNOWN');

-- Add fulfillment fields to Order model
ALTER TABLE "orders" ADD COLUMN "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'DELIVERY';
ALTER TABLE "orders" ADD COLUMN "partialFulfillment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "pickupLocation" TEXT;
ALTER TABLE "orders" ADD COLUMN "pickupDate" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "shippingCarrier" TEXT;

-- Add fulfillment fields to OrderItem model
ALTER TABLE "order_items" ADD COLUMN "availability" "ItemAvailability" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "order_items" ADD COLUMN "fulfillmentMethod" "FulfillmentMethod";
ALTER TABLE "order_items" ADD COLUMN "trackingNumber" TEXT;
ALTER TABLE "order_items" ADD COLUMN "expectedDelivery" TIMESTAMP(3);
ALTER TABLE "order_items" ADD COLUMN "actualDelivery" TIMESTAMP(3);

-- Add availability fields to QuoteRequestItem model
ALTER TABLE "quote_request_items" ADD COLUMN "availability" "ItemAvailability" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "quote_request_items" ADD COLUMN "estimatedDeliveryDays" INTEGER;
ALTER TABLE "quote_request_items" ADD COLUMN "suggestedFulfillmentMethod" TEXT;

-- Add suggested fulfillment method to QuoteRequest model
ALTER TABLE "quote_requests" ADD COLUMN "suggestedFulfillmentMethod" TEXT;