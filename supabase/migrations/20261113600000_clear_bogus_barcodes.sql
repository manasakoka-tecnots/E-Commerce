-- Clear variant barcodes that were incorrectly populated with price values
UPDATE product_variants SET barcode = NULL WHERE barcode IS NOT NULL AND barcode ~ '^\d+$' AND price IS NOT NULL AND barcode = price::TEXT;
