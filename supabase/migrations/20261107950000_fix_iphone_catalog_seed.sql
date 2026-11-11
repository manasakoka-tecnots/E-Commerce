-- Fix is_catalog_seed for iPhone product (and any other products where it's null)
UPDATE products SET is_catalog_seed = false WHERE is_catalog_seed IS NULL;

-- Set default for future inserts
ALTER TABLE products ALTER COLUMN is_catalog_seed SET DEFAULT false;
