-- Fix: Staff members (like Tom) can't see orders because is_seller_for_order()
-- only checks seller ownership, not staff membership.
-- Also fix: is_seller_owner() to NOT return true for staff (was conflating staff with owner).

-- 1. Update is_seller_for_order() to also check staff membership
CREATE OR REPLACE FUNCTION public.is_seller_for_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN seller_listings sl ON sl.id = oi.seller_listing_id
    WHERE oi.order_id = p_order_id
    AND (
      -- Seller owner
      sl.seller_id IN (
        SELECT s.id FROM sellers s
        JOIN profiles p ON p.id = s.profile_id
        WHERE p.auth_uid = auth.uid()
      )
      OR
      -- Staff member of the seller
      sl.seller_id IN (
        SELECT ss.seller_id FROM seller_staff ss
        JOIN profiles p ON p.id = ss.profile_id
        WHERE p.auth_uid = auth.uid()
        AND ss.status = 'active'
      )
    )
  );
$$;

-- 2. Update the order_items seller read policy to also allow staff
DROP POLICY IF EXISTS "seller read own order_items" ON order_items;
CREATE POLICY "seller read own order_items" ON order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM seller_listings sl
    WHERE sl.id = order_items.seller_listing_id
    AND (
      -- Seller owner
      sl.seller_id IN (
        SELECT s.id FROM sellers s
        JOIN profiles p ON p.id = s.profile_id
        WHERE p.auth_uid = auth.uid()
      )
      OR
      -- Staff member
      sl.seller_id IN (
        SELECT ss.seller_id FROM seller_staff ss
        JOIN profiles p ON p.id = ss.profile_id
        WHERE p.auth_uid = auth.uid()
        AND ss.status = 'active'
      )
    )
  )
);

-- 3. Allow staff to read fulfillments for their seller's orders
DROP POLICY IF EXISTS "seller_read_fulfillments" ON fulfillments;
DROP POLICY IF EXISTS "seller read own fulfillments" ON fulfillments;
CREATE POLICY "seller_staff_read_fulfillments" ON fulfillments
FOR SELECT TO authenticated
USING (
  seller_id IN (
    SELECT s.id FROM sellers s
    JOIN profiles p ON p.id = s.profile_id
    WHERE p.auth_uid = auth.uid()
  )
  OR
  seller_id IN (
    SELECT ss.seller_id FROM seller_staff ss
    JOIN profiles p ON p.id = ss.profile_id
    WHERE p.auth_uid = auth.uid()
    AND ss.status = 'active'
  )
);

-- 4. Allow staff to read fulfillment_items for their seller's fulfillments
DROP POLICY IF EXISTS "seller_read_fulfillment_items" ON fulfillment_items;
DROP POLICY IF EXISTS "seller read own fulfillment_items" ON fulfillment_items;
CREATE POLICY "seller_staff_read_fulfillment_items" ON fulfillment_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fulfillments f
    WHERE f.id = fulfillment_items.fulfillment_id
    AND (
      f.seller_id IN (
        SELECT s.id FROM sellers s
        JOIN profiles p ON p.id = s.profile_id
        WHERE p.auth_uid = auth.uid()
      )
      OR
      f.seller_id IN (
        SELECT ss.seller_id FROM seller_staff ss
        JOIN profiles p ON p.id = ss.profile_id
        WHERE p.auth_uid = auth.uid()
        AND ss.status = 'active'
      )
    )
  )
);

-- 5. Allow staff to read profiles (needed for customer names in orders)
-- Staff should be able to read profiles referenced by orders they can see
DROP POLICY IF EXISTS "staff_read_profiles_for_orders" ON profiles;
CREATE POLICY "staff_read_profiles_for_orders" ON profiles
FOR SELECT TO authenticated
USING (
  -- Own profile
  auth_uid = auth.uid()
  OR
  -- Admin
  EXISTS (SELECT 1 FROM profiles p WHERE p.auth_uid = auth.uid() AND p.role = 'admin')
  OR
  -- Seller or staff can read customer profiles for their orders
  id IN (
    SELECT o.profile_id FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN seller_listings sl ON sl.id = oi.seller_listing_id
    WHERE sl.seller_id IN (
      SELECT s.id FROM sellers s
      JOIN profiles p2 ON p2.id = s.profile_id
      WHERE p2.auth_uid = auth.uid()
      UNION
      SELECT ss.seller_id FROM seller_staff ss
      JOIN profiles p2 ON p2.id = ss.profile_id
      WHERE p2.auth_uid = auth.uid() AND ss.status = 'active'
    )
  )
);

-- 6. Allow staff to read sellers table (needed for seller info display)
DROP POLICY IF EXISTS "staff_read_own_seller" ON sellers;
CREATE POLICY "staff_read_own_seller" ON sellers
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT ss.seller_id FROM seller_staff ss
    JOIN profiles p ON p.id = ss.profile_id
    WHERE p.auth_uid = auth.uid()
    AND ss.status = 'active'
  )
);

-- 7. Allow staff to read seller_listings (needed for products/inventory)
DROP POLICY IF EXISTS "staff_read_seller_listings" ON seller_listings;
CREATE POLICY "staff_read_seller_listings" ON seller_listings
FOR SELECT TO authenticated
USING (
  seller_id IN (
    SELECT ss.seller_id FROM seller_staff ss
    JOIN profiles p ON p.id = ss.profile_id
    WHERE p.auth_uid = auth.uid()
    AND ss.status = 'active'
  )
);
