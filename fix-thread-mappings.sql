-- Fix incorrect email thread mappings
-- Run this SQL to delete the incorrect junction table records
-- Then either re-send the quote or use the sync endpoint to recreate correct links

-- First, check current mappings (should show the swapped threads)
SELECT
  qret.id,
  qret."supplierId",
  s.name as "supplierName",
  s.email as "supplierEmail",
  qret."emailThreadId"
FROM "QuoteRequestEmailThread" qret
JOIN "Supplier" s ON s.id = qret."supplierId"
WHERE qret."quoteRequestId" = 'YOUR_QUOTE_REQUEST_ID_HERE'
ORDER BY qret."isPrimary" DESC;

-- Delete the incorrect mappings for this quote request
-- IMPORTANT: Replace 'YOUR_QUOTE_REQUEST_ID_HERE' with your actual quote request ID
DELETE FROM "QuoteRequestEmailThread"
WHERE "quoteRequestId" = 'YOUR_QUOTE_REQUEST_ID_HERE';

-- After running this, the sync-threads endpoint will recreate the links correctly
-- Or just re-send the quote request and it will create them correctly
