-- Remove duplicate JBL Flip 6 products (keep only f7502971-32a8-4192-8943-287050de6922)
DELETE FROM public.products
WHERE name = 'JBL Flip 6 Portable Bluetooth Speaker'
  AND id != 'f7502971-32a8-4192-8943-287050de6922';

-- Also remove the orphaned anon-inserted listings that are invisible
DELETE FROM public.seller_listings
WHERE product_id NOT IN (SELECT id FROM public.products);
