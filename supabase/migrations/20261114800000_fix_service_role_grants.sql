-- Fix: Grant service_role access to staff tables
-- service_role needs full access for admin operations and API routes
GRANT ALL ON seller_staff TO service_role;
GRANT ALL ON staff_location_assignments TO service_role;
