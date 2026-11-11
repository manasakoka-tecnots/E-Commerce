-- ============================================================
-- Remove ALL remaining seed/demo data from the database
-- Keep only data created by real users through the dashboard
-- ============================================================

-- 1. Delete order_items referencing seed product listings
DELETE FROM order_items WHERE seller_listing_id IN (
  SELECT sl.id FROM seller_listings sl
  JOIN products p ON p.id = sl.product_id
  WHERE p.is_catalog_seed = true
);

-- 2. Delete cart_items referencing seed product listings
DELETE FROM cart_items WHERE seller_listing_id IN (
  SELECT sl.id FROM seller_listings sl
  JOIN products p ON p.id = sl.product_id
  WHERE p.is_catalog_seed = true
);

-- 3. Delete collection_products for seed products
DELETE FROM collection_products WHERE product_id IN (
  SELECT id FROM products WHERE is_catalog_seed = true
);

-- 4. Delete product_variants for seed products
DELETE FROM product_variants WHERE product_id IN (
  SELECT id FROM products WHERE is_catalog_seed = true
);

-- 5. Delete product_images for seed products
DELETE FROM product_images WHERE product_id IN (
  SELECT id FROM products WHERE is_catalog_seed = true
);

-- 6. Delete seller_listings for seed products
DELETE FROM seller_listings WHERE product_id IN (
  SELECT id FROM products WHERE is_catalog_seed = true
);

-- 7. Delete all catalog seed products
DELETE FROM products WHERE is_catalog_seed = true;

-- 8. Delete orphan products (no seller listing = not added by any real seller)
DELETE FROM product_images WHERE product_id IN (
  SELECT p.id FROM products p
  WHERE NOT EXISTS (SELECT 1 FROM seller_listings sl WHERE sl.product_id = p.id)
);
DELETE FROM product_variants WHERE product_id IN (
  SELECT p.id FROM products p
  WHERE NOT EXISTS (SELECT 1 FROM seller_listings sl WHERE sl.product_id = p.id)
);
DELETE FROM products WHERE id IN (
  SELECT p.id FROM products p
  WHERE NOT EXISTS (SELECT 1 FROM seller_listings sl WHERE sl.product_id = p.id)
);

-- 9. Delete the demo catalog seller and profile (if not already deleted)
DELETE FROM sellers WHERE id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003';
DELETE FROM profiles WHERE id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb001';

-- 10. Remove categories not used by any remaining product
DELETE FROM categories WHERE id NOT IN (
  SELECT DISTINCT category_id FROM products WHERE category_id IS NOT NULL
);

-- 11. Remove product_images with external URLs (Wikipedia/Wikimedia seed images)
DELETE FROM product_images WHERE storage_path LIKE 'https://%';
