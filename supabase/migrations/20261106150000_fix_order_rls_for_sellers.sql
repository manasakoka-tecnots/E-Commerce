-- Fix order RLS policies:
-- 1. Allow sellers to read orders that contain their products
-- 2. Allow sellers to read order_items for their listings
-- 3. Fix admin read policies (auth.role() doesn't work, use is_marketplace_admin())

-- Helper function: check if current user is a seller who owns a listing in an order
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
    JOIN sellers s ON s.id = sl.seller_id
    JOIN profiles p ON p.id = s.profile_id
    WHERE oi.order_id = p_order_id
      AND p.auth_uid = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_seller_for_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_seller_for_order(uuid) TO authenticated;

-- Fix admin read policy on orders (was using auth.role() = 'admin' which doesn't work)
DROP POLICY IF EXISTS "admin read" ON orders;
CREATE POLICY "admin read orders" ON orders
FOR SELECT TO authenticated
USING (public.is_marketplace_admin());

-- Add seller read policy on orders
CREATE POLICY "seller read own orders" ON orders
FOR SELECT TO authenticated
USING (public.is_seller_for_order(id));

-- Fix admin read policy on order_items
DROP POLICY IF EXISTS "admin read" ON order_items;
CREATE POLICY "admin read order_items" ON order_items
FOR SELECT TO authenticated
USING (public.is_marketplace_admin());

-- Add seller read policy on order_items (seller can see items for their listings)
CREATE POLICY "seller read own order_items" ON order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM seller_listings sl
    JOIN sellers s ON s.id = sl.seller_id
    JOIN profiles p ON p.id = s.profile_id
    WHERE sl.id = order_items.seller_listing_id
      AND p.auth_uid = auth.uid()
  )
);

-- Grant SELECT on orders and order_items to authenticated users (RLS handles row filtering)
GRANT SELECT, INSERT ON orders TO authenticated;
GRANT SELECT, INSERT ON order_items TO authenticated;
