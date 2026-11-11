-- Comprehensive RLS fix: ensure ALL tables have proper INSERT/UPDATE/DELETE policies
-- This prevents silent RLS failures across the entire app.
-- Uses SECURITY DEFINER helper functions to avoid recursion.

-- ===========================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- ===========================================

-- Check if current user owns a profile
CREATE OR REPLACE FUNCTION public.is_profile_owner(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_profile_id AND auth_uid = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_profile_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_profile_owner(uuid) TO authenticated;

-- Check if current user is a seller (returns seller_id or null)
CREATE OR REPLACE FUNCTION public.get_current_seller_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id FROM sellers s
  JOIN profiles p ON p.id = s.profile_id
  WHERE p.auth_uid = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_current_seller_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_seller_id() TO authenticated;

-- Check if current user owns a seller record
CREATE OR REPLACE FUNCTION public.is_seller_owner(p_seller_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sellers s
    JOIN profiles p ON p.id = s.profile_id
    WHERE s.id = p_seller_id AND p.auth_uid = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_seller_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_seller_owner(uuid) TO authenticated;

-- ===========================================
-- 1. PROFILES — fix missing UPDATE policy for own profile
-- ===========================================
-- Original "own profile" FOR ALL still exists, but let's ensure it covers all ops
-- No changes needed — the FOR ALL policy covers INSERT/UPDATE/DELETE for own profile

-- ===========================================
-- 2. SELLERS — fix: seller can update own record (store settings, etc.)
-- ===========================================
-- Drop the old "owner" FOR ALL that uses subquery (potential recursion risk)
DROP POLICY IF EXISTS "owner" ON sellers;

-- Sellers can read their own record
CREATE POLICY "seller read own" ON sellers
FOR SELECT TO authenticated
USING (public.is_profile_owner(profile_id));

-- Sellers can insert their own record (during registration)
CREATE POLICY "seller insert own" ON sellers
FOR INSERT TO authenticated
WITH CHECK (public.is_profile_owner(profile_id));

-- Sellers can update their own record (store settings, shipping, etc.)
CREATE POLICY "seller update own" ON sellers
FOR UPDATE TO authenticated
USING (public.is_profile_owner(profile_id))
WITH CHECK (public.is_profile_owner(profile_id));

-- Sellers can deactivate/delete their own record
CREATE POLICY "seller delete own" ON sellers
FOR DELETE TO authenticated
USING (public.is_profile_owner(profile_id));

-- Keep admin policies — drop and recreate to avoid conflicts
DROP POLICY IF EXISTS "admin" ON sellers;
DROP POLICY IF EXISTS "admins read seller records" ON sellers;
DROP POLICY IF EXISTS "admins update seller records" ON sellers;

CREATE POLICY "admin manage sellers" ON sellers
FOR ALL TO authenticated
USING (public.is_marketplace_admin())
WITH CHECK (public.is_marketplace_admin());

-- Public can read approved sellers (for storefront)
-- This policy may already exist, so drop first
DROP POLICY IF EXISTS "public read sellers with active listings" ON sellers;
CREATE POLICY "public read active sellers" ON sellers
FOR SELECT
USING (status = 'approved');

-- ===========================================
-- 3. CART_ITEMS — replace old "owner" FOR ALL with specific policies
-- ===========================================
DROP POLICY IF EXISTS "owner" ON cart_items;

CREATE POLICY "cart_items_select_own" ON cart_items
FOR SELECT TO authenticated
USING (public.is_profile_owner(profile_id));

CREATE POLICY "cart_items_insert_own" ON cart_items
FOR INSERT TO authenticated
WITH CHECK (public.is_profile_owner(profile_id));

CREATE POLICY "cart_items_update_own" ON cart_items
FOR UPDATE TO authenticated
USING (public.is_profile_owner(profile_id))
WITH CHECK (public.is_profile_owner(profile_id));

CREATE POLICY "cart_items_delete_own" ON cart_items
FOR DELETE TO authenticated
USING (public.is_profile_owner(profile_id));

-- ===========================================
-- 4. REVIEWS — replace old "owner" FOR ALL with specific policies
-- ===========================================
DROP POLICY IF EXISTS "owner" ON reviews;

-- Anyone can read reviews (public)
CREATE POLICY "reviews_public_read" ON reviews
FOR SELECT USING (true);

-- Authenticated users can create reviews for their own profile
CREATE POLICY "reviews_insert_own" ON reviews
FOR INSERT TO authenticated
WITH CHECK (public.is_profile_owner(profile_id));

-- Users can update their own reviews
CREATE POLICY "reviews_update_own" ON reviews
FOR UPDATE TO authenticated
USING (public.is_profile_owner(profile_id))
WITH CHECK (public.is_profile_owner(profile_id));

-- Users can delete their own reviews
CREATE POLICY "reviews_delete_own" ON reviews
FOR DELETE TO authenticated
USING (public.is_profile_owner(profile_id));

-- Keep admin read
DROP POLICY IF EXISTS "admin read" ON reviews;
CREATE POLICY "admin_read_reviews" ON reviews
FOR SELECT TO authenticated
USING (public.is_marketplace_admin());

-- ===========================================
-- 5. NOTIFICATIONS — replace old "owner" FOR ALL
-- ===========================================
DROP POLICY IF EXISTS "owner" ON notifications;

CREATE POLICY "notifications_select_own" ON notifications
FOR SELECT TO authenticated
USING (public.is_profile_owner(profile_id));

CREATE POLICY "notifications_insert_own" ON notifications
FOR INSERT TO authenticated
WITH CHECK (public.is_profile_owner(profile_id));

CREATE POLICY "notifications_update_own" ON notifications
FOR UPDATE TO authenticated
USING (public.is_profile_owner(profile_id))
WITH CHECK (public.is_profile_owner(profile_id));

CREATE POLICY "notifications_delete_own" ON notifications
FOR DELETE TO authenticated
USING (public.is_profile_owner(profile_id));

-- ===========================================
-- 6. ORDERS — fix seller update policy to use SECURITY DEFINER
-- ===========================================
DROP POLICY IF EXISTS "seller update order status" ON orders;

CREATE POLICY "seller update order status" ON orders
FOR UPDATE TO authenticated
USING (public.is_seller_for_order(id))
WITH CHECK (public.is_seller_for_order(id));

-- ===========================================
-- 7. SELLER_PAYOUTS — add missing seller policies
-- ===========================================
-- Sellers can request payouts (insert)
DO $$ BEGIN
  CREATE POLICY "seller_insert_own_payouts" ON seller_payouts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_seller_owner(seller_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Sellers can update own payouts (e.g., cancel request)
DO $$ BEGIN
  CREATE POLICY "seller_update_own_payouts" ON seller_payouts
  FOR UPDATE TO authenticated
  USING (public.is_seller_owner(seller_id))
  WITH CHECK (public.is_seller_owner(seller_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================
-- 8. SELLER_LISTINGS — ensure sellers can manage inventory
-- ===========================================
-- Most policies exist, but ensure UPDATE for stock management works
-- The existing policies use subqueries; let's add a SECURITY DEFINER version
DO $$ BEGIN
  CREATE POLICY "seller_update_own_listings_stock" ON seller_listings
  FOR UPDATE TO authenticated
  USING (seller_id = public.get_current_seller_id())
  WITH CHECK (seller_id = public.get_current_seller_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================
-- GRANTS — ensure all tables have proper grants
-- ===========================================
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sellers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cart_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON seller_listings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON collection_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON discounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON seller_payouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON seller_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON seller_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fulfillments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fulfillment_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON brands TO authenticated;

-- Also grant to anon for public read access
GRANT SELECT ON products TO anon;
GRANT SELECT ON product_images TO anon;
GRANT SELECT ON product_variants TO anon;
GRANT SELECT ON seller_listings TO anon;
GRANT SELECT ON categories TO anon;
GRANT SELECT ON collections TO anon;
GRANT SELECT ON collection_products TO anon;
GRANT SELECT ON brands TO anon;
GRANT SELECT ON sellers TO anon;
GRANT SELECT ON reviews TO anon;
GRANT SELECT ON discounts TO anon;
