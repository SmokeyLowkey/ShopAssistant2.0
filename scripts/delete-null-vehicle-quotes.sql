-- First, let's see which quote requests have null vehicleId
SELECT id, "quoteNumber", title, "createdAt"
FROM quote_requests
WHERE "vehicleId" IS NULL;

-- Delete quote request items for quotes with null vehicleId
DELETE FROM quote_request_items
WHERE "quoteRequestId" IN (
  SELECT id FROM quote_requests WHERE "vehicleId" IS NULL
);

-- Delete the quote requests with null vehicleId
DELETE FROM quote_requests
WHERE "vehicleId" IS NULL;
