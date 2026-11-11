-- Rename postal_code to pincode in addresses table
-- The application code uses 'pincode' (Indian terminology) but the original schema used 'postal_code'
ALTER TABLE addresses RENAME COLUMN postal_code TO pincode;
