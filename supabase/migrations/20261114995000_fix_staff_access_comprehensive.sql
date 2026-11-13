-- Comprehensive fix for staff access issues
-- Problem: Staff members get redirected to customer view because:
-- 1. get_my_seller_id() only checks sellers table, returns NULL for staff
-- 2. is_seller_for_order() has inline JOINs that can fail in complex query chains
-- 3. No dedicated staff policy on orders table
-- Solution: Unify get_my_seller_id() with get_current_seller_id() logic,
-- rewrite is_seller_for_order() using safe helpers, add staff orders policy.

-- ==========================================================================
-- 1. Fix get_my_seller_id() to handle BOTH sellers and staff
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.get_my_seller_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Direct seller
    (
      SELECT s.id FROM sellers s
      WHERE s.profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
      LIMIT 1
    ),
    -- Staff member's seller
    (
      SELECT ss.seller_id FROM seller_staff ss
      WHERE ss.profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
        AND ss.status = 'active'
      LIMIT 1
    )
  );
$$;

-- ==========================================================================
-- 2. Fix is_seller_for_order() using safe helper functions
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.is_seller_for_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN seller_listings sl ON sl.id = oi.seller_listing_id
    WHERE oi.order_id = p_order_id
    AND sl.seller_id = public.get_my_seller_id()
  );
$$;

-- ==========================================================================
-- 3. Fix get_current_seller_id() to match get_my_seller_id()
-- (keep both in sync — some older policies reference this one)
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.get_current_seller_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT s.id FROM sellers s
      WHERE s.profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
      LIMIT 1
    ),
    (
      SELECT ss.seller_id FROM seller_staff ss
      WHERE ss.profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
        AND ss.status = 'active'
      LIMIT 1
    )
  );
$$;

-- ==========================================================================
-- 4. Simplify order_items policy (get_my_seller_id now covers both cases)
-- ==========================================================================
DROP POLICY IF EXISTS "seller read own order_items" ON order_items;
CREATE POLICY "seller read own order_items" ON order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM seller_listings sl
    WHERE sl.id = order_items.seller_listing_id
    AND sl.seller_id = public.get_my_seller_id()
  )
  OR public.is_marketplace_admin()
);

-- ==========================================================================
-- 5. Simplify seller_listings policy
-- ==========================================================================
DROP POLICY IF EXISTS "staff_read_seller_listings" ON seller_listings;
CREATE POLICY "staff_read_seller_listings" ON seller_listings
FOR SELECT TO authenticated
USING (
  seller_id = public.get_my_seller_id()
);

-- ==========================================================================
-- 6. Simplify fulfillments policy
-- ==========================================================================
DROP POLICY IF EXISTS "seller_staff_read_fulfillments" ON fulfillments;
CREATE POLICY "seller_staff_read_fulfillments" ON fulfillments
FOR SELECT TO authenticated
USING (
  seller_id = public.get_my_seller_id()
  OR public.is_marketplace_admin()
);

-- ==========================================================================
-- 7. Simplify fulfillment_items policy
-- ==========================================================================
DROP POLICY IF EXISTS "seller_staff_read_fulfillment_items" ON fulfillment_items;
CREATE POLICY "seller_staff_read_fulfillment_items" ON fulfillment_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fulfillments f
    WHERE f.id = fulfillment_items.fulfillment_id
    AND (
      f.seller_id = public.get_my_seller_id()
      OR public.is_marketplace_admin()
    )
  )
);

-- ==========================================================================
-- 8. Simplify sellers read policy for staff
-- ==========================================================================
DROP POLICY IF EXISTS "staff_read_own_seller" ON sellers;
CREATE POLICY "staff_read_own_seller" ON sellers
FOR SELECT TO authenticated
USING (
  id = public.get_my_seller_id()
);

-- ==========================================================================
-- 9. Simplify extended_profiles_read (use get_my_seller_id instead of expensive function)
-- ==========================================================================
DROP POLICY IF EXISTS "extended_profiles_read" ON profiles;
CREATE POLICY "extended_profiles_read" ON profiles
FOR SELECT TO authenticated
USING (
  auth_uid = auth.uid()
  OR public.is_marketplace_admin()
  OR id IN (SELECT public.get_seller_customer_profile_ids())
);

-- ==========================================================================
-- 10. Optimize get_seller_customer_profile_ids() to use get_my_seller_id()
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.get_seller_customer_profile_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT o.profile_id
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN seller_listings sl ON sl.id = oi.seller_listing_id
  WHERE sl.seller_id = public.get_my_seller_id();
$$;

-- ==========================================================================
-- 11. Fix seller update order status policy to include staff
-- ==========================================================================
DROP POLICY IF EXISTS "seller update order status" ON orders;
CREATE POLICY "seller update order status" ON orders
FOR UPDATE TO authenticated
USING (
  public.is_seller_for_order(id)
  OR public.is_marketplace_admin()
)
WITH CHECK (
  public.is_seller_for_order(id)
  OR public.is_marketplace_admin()
);
