-- Fix: Grant service_role access to inventory-related tables
-- The service_role needs access for admin operations and seeding data

GRANT ALL ON seller_locations TO service_role;
GRANT ALL ON location_inventory TO service_role;
GRANT ALL ON inventory_adjustments TO service_role;
-- inventory_transfers and inventory_transfer_items may not exist yet
DO $$ BEGIN
  EXECUTE 'GRANT ALL ON inventory_transfers TO service_role';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN
  EXECUTE 'GRANT ALL ON inventory_transfer_items TO service_role';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
