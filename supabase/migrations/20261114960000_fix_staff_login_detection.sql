-- Fix: Staff members can't be detected during login because RLS blocks
-- the seller_staff query. Solution: Create an RPC function with SECURITY DEFINER
-- that returns the staff record directly, bypassing RLS.

-- 1. Function to get current user's active staff record (for login routing)
CREATE OR REPLACE FUNCTION public.get_my_staff_record()
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_result json;
BEGIN
  -- Get profile_id for current user
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE auth_uid = auth.uid();

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get active staff record
  SELECT json_build_object(
    'id', ss.id,
    'seller_id', ss.seller_id,
    'role', ss.role,
    'status', ss.status,
    'name', ss.name
  ) INTO v_result
  FROM seller_staff ss
  WHERE ss.profile_id = v_profile_id
    AND ss.status = 'active'
  LIMIT 1;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_staff_record() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_staff_record() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_staff_record() TO service_role;

-- 2. Also ensure the RLS policies are correct (belt + suspenders)
-- Re-grant service_role access to tables
GRANT ALL ON seller_staff TO service_role;
GRANT ALL ON staff_location_assignments TO service_role;
GRANT ALL ON profiles TO service_role;

-- Recreate the staff_read_own_record policy with a simpler approach
-- Use auth.uid() directly via a join to profiles, inside SECURITY DEFINER helper
DROP POLICY IF EXISTS "staff_read_own_record" ON seller_staff;
DROP POLICY IF EXISTS "staff_read_own_record_v2" ON seller_staff;

CREATE POLICY "staff_read_own_record"
  ON seller_staff FOR SELECT
  USING (profile_id = get_my_profile_id());

-- 3. Also allow staff to UPDATE their own last_login_at
DROP POLICY IF EXISTS "staff_update_own_login" ON seller_staff;
CREATE POLICY "staff_update_own_login"
  ON seller_staff FOR UPDATE
  USING (profile_id = get_my_profile_id())
  WITH CHECK (profile_id = get_my_profile_id());
