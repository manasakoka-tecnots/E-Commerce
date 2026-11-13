-- Fix: Staff members can't read their own seller_staff record after login
-- Root cause: The staff_read_own_record policy does a subquery against profiles
-- which may be blocked by profiles RLS, causing a recursive deadlock.
-- Solution: Use a SECURITY DEFINER helper function to bypass RLS for the lookup.

-- Helper function to get current user's profile_id without hitting RLS
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;

-- Drop and recreate the staff_read_own_record policy using the helper
DROP POLICY IF EXISTS "staff_read_own_record" ON seller_staff;
CREATE POLICY "staff_read_own_record"
  ON seller_staff FOR SELECT
  USING (profile_id = get_my_profile_id());

-- Also fix staff_read_own_assignments on staff_location_assignments
DROP POLICY IF EXISTS "staff_read_own_assignments" ON staff_location_assignments;
CREATE POLICY "staff_read_own_assignments"
  ON staff_location_assignments FOR SELECT
  USING (
    staff_id IN (
      SELECT id FROM seller_staff WHERE profile_id = get_my_profile_id()
    )
  );
