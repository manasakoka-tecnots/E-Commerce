-- Delete all seed/dummy products (seller_id = demo catalog seller)
-- Keep only products added by real sellers through the dashboard

-- Delete order_items referencing seed seller listings
DELETE FROM order_items WHERE seller_listing_id IN (
  SELECT id FROM seller_listings WHERE seller_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003'
);

-- Delete cart_items referencing seed seller listings
DELETE FROM cart_items WHERE seller_listing_id IN (
  SELECT id FROM seller_listings WHERE seller_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003'
);

-- Delete collection_products for seed products
DELETE FROM collection_products WHERE product_id IN (
  SELECT product_id FROM seller_listings WHERE seller_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003'
);

-- Delete product_variants for seed products
DELETE FROM product_variants WHERE product_id IN (
  SELECT product_id FROM seller_listings WHERE seller_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003'
);

-- Delete product_images for seed products
DELETE FROM product_images WHERE product_id IN (
  SELECT product_id FROM seller_listings WHERE seller_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003'
);

-- Delete seed seller listings
DELETE FROM seller_listings WHERE seller_id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003';

-- Delete seed products (products with is_catalog_seed = true OR belonging to the seed seller)
DELETE FROM products WHERE id IN (
  SELECT p.id FROM products p
  WHERE p.is_catalog_seed = true
  OR NOT EXISTS (SELECT 1 FROM seller_listings sl WHERE sl.product_id = p.id)
);

-- Delete the demo seller and profile
DELETE FROM sellers WHERE id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb003';
DELETE FROM profiles WHERE id = 'f1b6ea1e-1d3b-4a2c-a87e-01bce5efb001';
