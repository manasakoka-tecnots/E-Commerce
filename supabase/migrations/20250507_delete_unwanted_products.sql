-- Delete all JBL, adapter, and headphone products that should not be on the site
-- First delete related data in correct order (respecting foreign keys), then products

-- Delete from order_items (references seller_listings)
DELETE FROM order_items WHERE seller_listing_id IN (
  SELECT sl.id FROM seller_listings sl
  JOIN products p ON p.id = sl.product_id
  WHERE p.name ILIKE '%JBL%' OR p.name ILIKE '%adapter%' OR p.name ILIKE '%headphone%'
);

-- Delete from collection_products
DELETE FROM collection_products WHERE product_id IN (
  SELECT id FROM products WHERE
    name ILIKE '%JBL%' OR name ILIKE '%adapter%' OR name ILIKE '%headphone%'
);

-- Delete from product_variants
DELETE FROM product_variants WHERE product_id IN (
  SELECT id FROM products WHERE
    name ILIKE '%JBL%' OR name ILIKE '%adapter%' OR name ILIKE '%headphone%'
);

-- Delete from product_images
DELETE FROM product_images WHERE product_id IN (
  SELECT id FROM products WHERE
    name ILIKE '%JBL%' OR name ILIKE '%adapter%' OR name ILIKE '%headphone%'
);

-- Delete from cart_items (if references seller_listings)
DELETE FROM cart_items WHERE seller_listing_id IN (
  SELECT sl.id FROM seller_listings sl
  JOIN products p ON p.id = sl.product_id
  WHERE p.name ILIKE '%JBL%' OR p.name ILIKE '%adapter%' OR p.name ILIKE '%headphone%'
);

-- Delete from seller_listings
DELETE FROM seller_listings WHERE product_id IN (
  SELECT id FROM products WHERE
    name ILIKE '%JBL%' OR name ILIKE '%adapter%' OR name ILIKE '%headphone%'
);

-- Delete the products
DELETE FROM products WHERE
  name ILIKE '%JBL%' OR name ILIKE '%adapter%' OR name ILIKE '%headphone%';
