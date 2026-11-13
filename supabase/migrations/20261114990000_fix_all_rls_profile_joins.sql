-- Fix: "current transaction is aborted" error on seller_listings, order_items, etc.
-- Root cause: RLS policies on seller_listings, order_items, fulfillments, etc.
-- have inline JOIN profiles subqueries. When evaluated, they trigger profiles RLS,
-- which calls get_seller_customer_profile_ids() — creating a complex cross-table
-- evaluation chain that can fail.
-- Solution: Replace ALL inline "JOIN profiles" in RLS policies with the existing
-- get_my_profile_id() SECURITY DEFINER helper function.

-- Also create a helper for "am I a staff member of this seller?"
CREATE OR REPLACE FUNCTION public.get_my_seller_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM sellers s
  WHERE s.profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_seller_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_seller_id() TO authenticated;

-- 1. Fix staff_read_seller_listings — replace inline profiles join
DROP POLICY IF EXISTS "staff_read_seller_listings" ON seller_listings;
CREATE POLICY "staff_read_seller_listings" ON seller_listings
FOR SELECT TO authenticated
USING (
  seller_id IN (SELECT public.get_my_staff_seller_ids())
);

-- 2. Fix seller read own order_items — replace inline profiles joins
DROP POLICY IF EXISTS "seller read own order_items" ON order_items;
CREATE POLICY "seller read own order_items" ON order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM seller_listings sl
    WHERE sl.id = order_items.seller_listing_id
    AND (
      sl.seller_id = public.get_my_seller_id()
      OR
      sl.seller_id IN (SELECT public.get_my_staff_seller_ids())
    )
  )
);

-- 3. Fix fulfillments read — replace inline profiles joins
DROP POLICY IF EXISTS "seller_staff_read_fulfillments" ON fulfillments;
CREATE POLICY "seller_staff_read_fulfillments" ON fulfillments
FOR SELECT TO authenticated
USING (
  seller_id = public.get_my_seller_id()
  OR
  seller_id IN (SELECT public.get_my_staff_seller_ids())
);

-- 4. Fix fulfillment_items read — replace inline profiles joins
DROP POLICY IF EXISTS "seller_staff_read_fulfillment_items" ON fulfillment_items;
CREATE POLICY "seller_staff_read_fulfillment_items" ON fulfillment_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fulfillments f
    WHERE f.id = fulfillment_items.fulfillment_id
    AND (
      f.seller_id = public.get_my_seller_id()
      OR
      f.seller_id IN (SELECT public.get_my_staff_seller_ids())
    )
  )
);

-- 5. Fix staff_read_own_seller — replace inline profiles join
DROP POLICY IF EXISTS "staff_read_own_seller" ON sellers;
CREATE POLICY "staff_read_own_seller" ON sellers
FOR SELECT TO authenticated
USING (
  id IN (SELECT public.get_my_staff_seller_ids())
);

-- 6. Simplify extended_profiles_read to avoid expensive cross-table function
DROP POLICY IF EXISTS "extended_profiles_read" ON profiles;
CREATE POLICY "extended_profiles_read" ON profiles
FOR SELECT TO authenticated
USING (
  -- Own profile
  auth_uid = auth.uid()
  OR
  -- Admin
  public.is_marketplace_admin()
  OR
  -- Seller/staff can read customer profiles for their orders
  id IN (SELECT public.get_seller_customer_profile_ids())
);
