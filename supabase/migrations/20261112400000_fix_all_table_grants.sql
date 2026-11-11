-- Fix ALL table grants to ensure service_role, authenticated, and anon roles
-- have proper access. This fixes "permission denied for table X" errors.

-- Grant ALL to service_role on every table (service_role is the admin)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT ALL ON %I TO service_role', tbl);
    EXECUTE format('GRANT ALL ON %I TO authenticated', tbl);
    EXECUTE format('GRANT SELECT ON %I TO anon', tbl);
  END LOOP;
END $$;

-- Also grant on sequences
DO $$
DECLARE
  seq text;
BEGIN
  FOR seq IN
    SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('GRANT ALL ON SEQUENCE %I TO service_role', seq);
    EXECUTE format('GRANT ALL ON SEQUENCE %I TO authenticated', seq);
    EXECUTE format('GRANT SELECT ON SEQUENCE %I TO anon', seq);
  END LOOP;
END $$;

-- Specific anon INSERT grants for tables that need it (cart, orders for guest checkout, etc.)
GRANT INSERT ON cart_items TO anon;
GRANT INSERT, UPDATE, DELETE ON cart_items TO anon;
