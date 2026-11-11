-- Fix: iPhone 16 Pro Max was created by a seller, not as a catalog seed
-- The storefront only shows products where is_catalog_seed = false
UPDATE public.products
SET is_catalog_seed = false
WHERE name ILIKE '%iPhone 16 Pro Max%';
