-- Add barcode column to product_variants
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS barcode TEXT;
