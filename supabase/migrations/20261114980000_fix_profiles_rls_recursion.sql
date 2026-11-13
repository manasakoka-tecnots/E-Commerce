-- Fix: "infinite recursion detected in policy for relation 'profiles'"
-- Root cause: The "staff_read_profiles_for_orders" policy on the profiles table
-- contains subqueries that SELECT from profiles itself, causing infinite recursion.
-- Solution: Replace inline profiles subqueries with SECURITY DEFINER helper functions.

-- 1. Helper: Get all seller IDs the current user has staff access to
CREATE OR REPLACE FUNCTION public.get_my_staff_seller_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ss.seller_id
  FROM seller_staff ss
  WHERE ss.profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
    AND ss.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.get_my_staff_seller_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_staff_seller_ids() TO authenticated;

-- 2. Helper: Get profile IDs of customers for orders belonging to current user's seller(s)
CREATE OR REPLACE FUNCTION public.get_seller_customer_profile_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT o.profile_id
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN seller_listings sl ON sl.id = oi.seller_listing_id
  WHERE sl.seller_id IN (
    -- Seller owner
    SELECT s.id FROM sellers s
    JOIN profiles p ON p.id = s.profile_id
    WHERE p.auth_uid = auth.uid()
    UNION
    -- Staff member
    SELECT ss.seller_id FROM seller_staff ss
    JOIN profiles p ON p.id = ss.profile_id
    WHERE p.auth_uid = auth.uid() AND ss.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.get_seller_customer_profile_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_customer_profile_ids() TO authenticated;

-- 3. Drop the recursive policy
DROP POLICY IF EXISTS "staff_read_profiles_for_orders" ON profiles;

-- 4. Also drop "admins read profiles" if it has inline subqueries (it uses is_marketplace_admin() which is safe, but let's consolidate)
DROP POLICY IF EXISTS "admins read profiles" ON profiles;

-- 5. Recreate a single, non-recursive profiles SELECT policy for sellers/staff/admins
-- The original "own profile" policy (auth.uid() = auth_uid) handles own-profile reads.
-- This new policy handles: admin reads + seller/staff reading customer profiles.
CREATE POLICY "extended_profiles_read" ON profiles
FOR SELECT TO authenticated
USING (
  -- Own profile (redundant with "own profile" but harmless, ensures coverage)
  auth_uid = auth.uid()
  OR
  -- Admin can read all profiles
  public.is_marketplace_admin()
  OR
  -- Seller/staff can read customer profiles for their orders
  id IN (SELECT public.get_seller_customer_profile_ids())
);
