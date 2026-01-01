SELECT 
  id,
  "orderDate"::text as order_date_text,
  "createdAt"::text as created_at_text,
  "orderDate",
  "createdAt"
FROM orders 
WHERE id = 'cmjtrr4qj001115lpp6e1sa3j';
