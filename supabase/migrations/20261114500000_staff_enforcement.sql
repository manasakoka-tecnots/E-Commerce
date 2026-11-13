-- ============================================================
-- Staff Enforcement: Make RLS and functions work for staff members
-- ============================================================
-- Problem: get_current_seller_id() only checks sellers table.
-- Staff members are not in sellers, so they get NULL and all
-- RLS policies block them from accessing any seller data.
--
-- Fix: Update get_current_seller_id() to fall back to staff's seller_id.
-- Also fix is_seller_for_order() so staff can see orders.
-- ============================================================

-- 1. Fix get_current_seller_id() to handle staff members
-- Now returns seller_id whether user is a direct seller OR active staff
CREATE OR REPLACE FUNCTION public.get_current_seller_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- First: check if user is a direct seller
    (
      SELECT s.id FROM sellers s
      JOIN profiles p ON p.id = s.profile_id
      WHERE p.auth_uid = auth.uid()
      LIMIT 1
    ),
    -- Fallback: check if user is active staff and return their seller_id
    (
      SELECT ss.seller_id FROM seller_staff ss
      JOIN profiles p ON p.id = ss.profile_id
      WHERE p.auth_uid = auth.uid()
        AND ss.status = 'active'
      LIMIT 1
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_current_seller_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_seller_id() TO authenticated;

-- 2. Fix is_seller_for_order() to also match staff members
-- Staff who belong to a seller should be able to see that seller's orders
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
      AND sl.seller_id = public.get_current_seller_id()
  );
$$;

REVOKE ALL ON FUNCTION public.is_seller_for_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_seller_for_order(uuid) TO authenticated;

-- 3. Fix is_seller_owner() to also work for staff
-- This is used in seller_payouts RLS policies
CREATE OR REPLACE FUNCTION public.is_seller_owner(p_seller_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_seller_id = public.get_current_seller_id();
$$;

REVOKE ALL ON FUNCTION public.is_seller_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_seller_owner(uuid) TO authenticated;

-- 4. Fix adjust_location_inventory() to use updated get_current_seller_id()
-- The existing function already calls get_current_seller_id() so it will
-- automatically work for staff now. But we need to add a permission check
-- for staff members at the location level.
CREATE OR REPLACE FUNCTION public.adjust_location_inventory(
  p_location_id uuid,
  p_listing_id uuid,
  p_adjustment_type text,
  p_quantity_change integer,
  p_reason text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_old_available integer;
  v_new_available integer;
  v_inv_id uuid;
  v_seller_id uuid;
  v_current_seller_id uuid;
BEGIN
  v_current_seller_id := public.get_current_seller_id();

  -- Verify location belongs to current seller (or staff's seller)
  SELECT seller_id INTO v_seller_id FROM seller_locations WHERE id = p_location_id;
  IF v_seller_id IS NULL OR v_seller_id != v_current_seller_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- If user is staff, check they have inventory_manage permission at this location
  IF public.is_staff_member() THEN
    IF NOT public.staff_has_permission(p_location_id, 'inventory_manage') THEN
      RAISE EXCEPTION 'Staff does not have inventory_manage permission at this location';
    END IF;
  END IF;

  -- Get or create location_inventory record
  SELECT id, available INTO v_inv_id, v_old_available
  FROM location_inventory
  WHERE location_id = p_location_id AND listing_id = p_listing_id
  FOR UPDATE;

  IF v_inv_id IS NULL THEN
    v_old_available := 0;
    INSERT INTO location_inventory (location_id, listing_id, available)
    VALUES (p_location_id, p_listing_id, 0)
    RETURNING id, available INTO v_inv_id, v_old_available;
  END IF;

  -- Calculate new available
  IF p_adjustment_type = 'set' THEN
    v_new_available := p_quantity_change;
  ELSE
    v_new_available := v_old_available + p_quantity_change;
  END IF;

  IF v_new_available < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_old_available, p_quantity_change;
  END IF;

  -- Update location inventory
  UPDATE location_inventory
  SET available = v_new_available, updated_at = now()
  WHERE id = v_inv_id;

  -- Record adjustment
  INSERT INTO inventory_adjustments (
    location_id, listing_id, adjustment_type, quantity_change,
    old_available, new_available, reason, reference_id, created_by
  )
  SELECT p_location_id, p_listing_id, p_adjustment_type,
    CASE WHEN p_adjustment_type = 'set' THEN v_new_available - v_old_available ELSE p_quantity_change END,
    v_old_available, v_new_available, p_reason, p_reference_id, p.id
  FROM profiles p WHERE p.auth_uid = auth.uid();

  -- Sync aggregate stock on seller_listings
  UPDATE seller_listings
  SET stock = (
    SELECT COALESCE(SUM(available), 0)
    FROM location_inventory li
    JOIN seller_locations sl ON sl.id = li.location_id
    WHERE li.listing_id = p_listing_id AND sl.seller_id = v_seller_id
  ), updated_at = now()
  WHERE id = p_listing_id;

  RETURN json_build_object('old_available', v_old_available, 'new_available', v_new_available);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.adjust_location_inventory(uuid, uuid, text, integer, text, uuid) TO authenticated;

-- 5. Add staff-aware RLS policy for seller_listings
-- Staff need to read seller_listings for their seller
DO $$ BEGIN
  CREATE POLICY "staff_read_seller_listings" ON seller_listings
  FOR SELECT TO authenticated
  USING (seller_id = public.get_current_seller_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Ensure staff can read sellers table for their own seller
DO $$ BEGIN
  CREATE POLICY "staff_read_own_seller" ON sellers
  FOR SELECT TO authenticated
  USING (id = public.get_current_seller_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
