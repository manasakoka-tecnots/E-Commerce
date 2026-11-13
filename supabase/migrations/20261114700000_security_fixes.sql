-- ============================================================
-- Comprehensive Security Fixes
-- Fixes: search_path, permission keys, RLS policies, caller
-- checks, TOCTOU races, double-cancellation, REVOKE grants
-- ============================================================

-- ============================================================
-- 1. Fix SECURITY DEFINER functions missing SET search_path
--    + REVOKE ALL FROM PUBLIC on each
-- ============================================================

-- 1a. get_staff_location_ids
CREATE OR REPLACE FUNCTION public.get_staff_location_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(sla.location_id),
    ARRAY[]::uuid[]
  )
  FROM staff_location_assignments sla
  JOIN seller_staff ss ON ss.id = sla.staff_id
  WHERE ss.profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
    AND ss.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.get_staff_location_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_location_ids() TO authenticated;

-- 1b. staff_has_permission
CREATE OR REPLACE FUNCTION public.staff_has_permission(p_location_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff_location_assignments sla
    JOIN seller_staff ss ON ss.id = sla.staff_id
    WHERE ss.profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
      AND ss.status = 'active'
      AND sla.location_id = p_location_id
      AND p_permission = ANY(sla.permissions)
  );
$$;

REVOKE ALL ON FUNCTION public.staff_has_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_has_permission(uuid, text) TO authenticated;

-- 1c. is_staff_member
CREATE OR REPLACE FUNCTION public.is_staff_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM seller_staff
    WHERE profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_member() TO authenticated;

-- 1d. get_staff_seller_id
CREATE OR REPLACE FUNCTION public.get_staff_seller_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT seller_id FROM seller_staff
  WHERE profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
    AND status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_staff_seller_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_seller_id() TO authenticated;

-- ============================================================
-- 2. Fix accept_staff_invite: add search_path + FOR UPDATE lock
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_staff_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff seller_staff%ROWTYPE;
  v_profile_id uuid;
  v_existing_staff_id uuid;
BEGIN
  -- Lock the row to prevent TOCTOU race (two users accepting same token)
  SELECT * INTO v_staff
  FROM seller_staff
  WHERE invite_token = p_token
    AND status = 'invited'
  FOR UPDATE;

  IF v_staff.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired invite link.');
  END IF;

  IF v_staff.invite_expires_at IS NOT NULL AND v_staff.invite_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'This invite link has expired. Please ask the store owner to resend the invite.');
  END IF;

  SELECT id INTO v_profile_id
  FROM profiles
  WHERE auth_uid = auth.uid();

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'You must be logged in to accept this invite.');
  END IF;

  SELECT id INTO v_existing_staff_id
  FROM seller_staff
  WHERE profile_id = v_profile_id
    AND seller_id = v_staff.seller_id
    AND status = 'active'
    AND id != v_staff.id;

  IF v_existing_staff_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'You are already a staff member of this store.');
  END IF;

  UPDATE seller_staff
  SET profile_id = v_profile_id,
      status = 'active',
      activated_at = now(),
      invite_token = NULL,
      invite_expires_at = NULL,
      updated_at = now()
  WHERE id = v_staff.id;

  RETURN jsonb_build_object(
    'success', true,
    'staff_id', v_staff.id,
    'seller_id', v_staff.seller_id,
    'role', v_staff.role,
    'name', v_staff.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_staff_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_staff_invite(text) TO authenticated;

-- ============================================================
-- 3. Fix permission key mismatch: inventory_manage → inventory_edit
--    Also add SET search_path to adjust_location_inventory
-- ============================================================
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

  -- If user is staff, check they have inventory_edit permission at this location
  -- (was inventory_manage — now matches frontend permission key)
  IF public.is_staff_member() THEN
    IF NOT public.staff_has_permission(p_location_id, 'inventory_edit') THEN
      RAISE EXCEPTION 'Staff does not have inventory_edit permission at this location';
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.adjust_location_inventory(uuid, uuid, text, integer, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_location_inventory(uuid, uuid, text, integer, text, uuid) TO authenticated;

-- ============================================================
-- 4. Fix anon RLS on seller_staff — hide tokens from public
--    Create safe invite lookup function instead
-- ============================================================

-- Drop the overly permissive policy that exposes all invited staff data (including tokens, emails, PINs)
DROP POLICY IF EXISTS "read_by_invite_token" ON seller_staff;
DROP POLICY IF EXISTS "anyone_read_by_invite_token" ON seller_staff;

-- Drop overly permissive policy on staff_location_assignments
DROP POLICY IF EXISTS "anyone_read_invited_staff_locations" ON staff_location_assignments;

-- Revoke anon SELECT from these tables (anon should never read staff data directly)
REVOKE SELECT ON seller_staff FROM anon;
REVOKE SELECT ON staff_location_assignments FROM anon;

-- Create a safe function for the invite page that returns ONLY public info
CREATE OR REPLACE FUNCTION public.get_staff_invite_info(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff record;
  v_seller_name text;
  v_location_names text[];
BEGIN
  -- Only return safe fields — never expose email, PIN, token, or internal IDs
  SELECT id, name, role, seller_id, status, invite_expires_at
  INTO v_staff
  FROM seller_staff
  WHERE invite_token = p_token AND status = 'invited';

  IF v_staff IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'Invalid or expired invite link.');
  END IF;

  IF v_staff.invite_expires_at IS NOT NULL AND v_staff.invite_expires_at < now() THEN
    RETURN jsonb_build_object('found', false, 'error', 'This invite link has expired.');
  END IF;

  SELECT business_name INTO v_seller_name FROM sellers WHERE id = v_staff.seller_id;

  SELECT array_agg(sl.name) INTO v_location_names
  FROM staff_location_assignments sla
  JOIN seller_locations sl ON sl.id = sla.location_id
  WHERE sla.staff_id = v_staff.id;

  RETURN jsonb_build_object(
    'found', true,
    'name', v_staff.name,
    'role', v_staff.role,
    'seller_name', COALESCE(v_seller_name, 'Store'),
    'locations', COALESCE(to_jsonb(v_location_names), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_invite_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_invite_info(text) TO anon, authenticated;

-- ============================================================
-- 5. Fix cancel_order_rpc: prevent double cancellation + add caller check
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_order_rpc(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_caller_profile_id uuid;
  v_caller_seller_id uuid;
  v_is_order_owner boolean;
  v_is_order_seller boolean;
BEGIN
  -- Get the order
  SELECT id, status, profile_id INTO v_order
  FROM orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Prevent double cancellation
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is already cancelled');
  END IF;

  -- Only allow cancellation of orders in valid states
  IF v_order.status NOT IN ('pending', 'confirmed', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order cannot be cancelled in current status: ' || v_order.status);
  END IF;

  -- Verify caller is either the order owner or the seller/staff
  SELECT id INTO v_caller_profile_id FROM profiles WHERE auth_uid = auth.uid();

  v_is_order_owner := (v_order.profile_id = v_caller_profile_id);

  v_caller_seller_id := public.get_current_seller_id();
  v_is_order_seller := EXISTS (
    SELECT 1 FROM order_items oi
    JOIN seller_listings sl ON sl.id = oi.seller_listing_id
    WHERE oi.order_id = p_order_id
      AND sl.seller_id = v_caller_seller_id
  );

  IF NOT v_is_order_owner AND NOT v_is_order_seller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to cancel this order');
  END IF;

  -- Update order
  UPDATE orders
  SET status = 'cancelled',
      cancellation_reason = p_reason,
      cancelled_at = now(),
      updated_at = now()
  WHERE id = p_order_id
    AND status != 'cancelled';  -- Extra safety: no-op if already cancelled

  -- Restore global stock (seller_listings)
  UPDATE seller_listings sl
  SET stock = sl.stock + oi.quantity,
      updated_at = now()
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.seller_listing_id = sl.id;

  -- Restore location-level stock
  PERFORM restore_location_stock_for_order(p_order_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order_rpc(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_order_rpc(uuid, text) TO authenticated;

-- ============================================================
-- 6. Fix update_order_status_rpc: add caller authorization
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_order_status_rpc(
  p_order_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_seller_id uuid;
BEGIN
  -- Verify caller is a seller/staff with items in this order
  v_caller_seller_id := public.get_current_seller_id();

  IF v_caller_seller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM order_items oi
    JOIN seller_listings sl ON sl.id = oi.seller_listing_id
    WHERE oi.order_id = p_order_id
      AND sl.seller_id = v_caller_seller_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this order');
  END IF;

  UPDATE orders SET status = p_status, updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_status_rpc(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status_rpc(uuid, text) TO authenticated;

-- ============================================================
-- 7. Fix update_fulfillment_status_rpc: add caller authorization
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_fulfillment_status_rpc(
  p_fulfillment_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_fulfillment_seller_id uuid;
  v_caller_seller_id uuid;
BEGIN
  -- Get fulfillment and verify ownership
  SELECT f.order_id, f.seller_id INTO v_order_id, v_fulfillment_seller_id
  FROM fulfillments f WHERE f.id = p_fulfillment_id;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fulfillment not found');
  END IF;

  v_caller_seller_id := public.get_current_seller_id();
  IF v_caller_seller_id IS NULL OR v_caller_seller_id != v_fulfillment_seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this fulfillment');
  END IF;

  UPDATE fulfillments SET status = p_status, updated_at = now()
  WHERE id = p_fulfillment_id;

  PERFORM sync_order_status_rpc(v_order_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_fulfillment_status_rpc(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_fulfillment_status_rpc(uuid, text) TO authenticated;

-- ============================================================
-- 8. Fix cancel_fulfillment_rpc: add caller authorization
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_fulfillment_rpc(p_fulfillment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_fulfillment_seller_id uuid;
  v_caller_seller_id uuid;
BEGIN
  SELECT f.order_id, f.seller_id INTO v_order_id, v_fulfillment_seller_id
  FROM fulfillments f WHERE f.id = p_fulfillment_id;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fulfillment not found');
  END IF;

  v_caller_seller_id := public.get_current_seller_id();
  IF v_caller_seller_id IS NULL OR v_caller_seller_id != v_fulfillment_seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this fulfillment');
  END IF;

  UPDATE fulfillments SET status = 'cancelled', updated_at = now()
  WHERE id = p_fulfillment_id;

  PERFORM sync_order_status_rpc(v_order_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_fulfillment_rpc(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_fulfillment_rpc(uuid) TO authenticated;

-- ============================================================
-- 9. Fix commit_location_stock_for_order: add caller check
--    Only the order's customer or the seller should be able to trigger this
-- ============================================================
CREATE OR REPLACE FUNCTION public.commit_location_stock_for_order(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_location_id uuid;
  v_seller_id uuid;
  v_old_committed integer;
  v_old_available integer;
  v_order_profile_id uuid;
  v_caller_profile_id uuid;
BEGIN
  -- Verify caller is the order owner
  SELECT profile_id INTO v_order_profile_id FROM orders WHERE id = p_order_id;

  IF v_order_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  SELECT id INTO v_caller_profile_id FROM profiles WHERE auth_uid = auth.uid();
  IF v_caller_profile_id IS NULL OR v_caller_profile_id != v_order_profile_id THEN
    -- Also allow sellers/staff for this order
    IF NOT EXISTS (
      SELECT 1 FROM order_items oi
      JOIN seller_listings sl ON sl.id = oi.seller_listing_id
      WHERE oi.order_id = p_order_id
        AND sl.seller_id = public.get_current_seller_id()
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
  END IF;

  FOR v_item IN
    SELECT oi.id AS order_item_id, oi.seller_listing_id, oi.quantity,
           oi.variant_id,
           sl_inner.seller_id
    FROM order_items oi
    JOIN seller_listings sl_inner ON sl_inner.id = oi.seller_listing_id
    WHERE oi.order_id = p_order_id
  LOOP
    v_seller_id := v_item.seller_id;

    v_location_id := get_best_fulfillment_location(v_seller_id, v_item.seller_listing_id, v_item.quantity);

    IF v_location_id IS NOT NULL THEN
      IF v_item.variant_id IS NOT NULL THEN
        SELECT available, committed INTO v_old_available, v_old_committed
        FROM location_inventory
        WHERE location_id = v_location_id
          AND listing_id = v_item.seller_listing_id
          AND variant_id = v_item.variant_id
        FOR UPDATE;
      ELSE
        SELECT available, committed INTO v_old_available, v_old_committed
        FROM location_inventory
        WHERE location_id = v_location_id
          AND listing_id = v_item.seller_listing_id
          AND variant_id IS NULL
        FOR UPDATE;
      END IF;

      IF v_old_available IS NOT NULL AND v_old_available >= v_item.quantity THEN
        IF v_item.variant_id IS NOT NULL THEN
          UPDATE location_inventory
          SET available = available - v_item.quantity,
              committed = committed + v_item.quantity,
              updated_at = now()
          WHERE location_id = v_location_id
            AND listing_id = v_item.seller_listing_id
            AND variant_id = v_item.variant_id;
        ELSE
          UPDATE location_inventory
          SET available = available - v_item.quantity,
              committed = committed + v_item.quantity,
              updated_at = now()
          WHERE location_id = v_location_id
            AND listing_id = v_item.seller_listing_id
            AND variant_id IS NULL;
        END IF;

        INSERT INTO inventory_adjustments (
          location_id, listing_id, adjustment_type, quantity_change,
          old_available, new_available, reason, reference_id
        ) VALUES (
          v_location_id, v_item.seller_listing_id, 'order_committed',
          -v_item.quantity, v_old_available, v_old_available - v_item.quantity,
          'Order ' || p_order_id::text, p_order_id
        );
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.commit_location_stock_for_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_location_stock_for_order(uuid) TO authenticated;

-- ============================================================
-- 10. Fix restore_location_stock_for_order: add caller check
-- ============================================================
CREATE OR REPLACE FUNCTION public.restore_location_stock_for_order(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adj record;
  v_order_profile_id uuid;
  v_caller_profile_id uuid;
BEGIN
  -- Verify caller is the order owner or a seller/staff for the order
  SELECT profile_id INTO v_order_profile_id FROM orders WHERE id = p_order_id;

  SELECT id INTO v_caller_profile_id FROM profiles WHERE auth_uid = auth.uid();

  IF v_caller_profile_id != v_order_profile_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM order_items oi
      JOIN seller_listings sl ON sl.id = oi.seller_listing_id
      WHERE oi.order_id = p_order_id
        AND sl.seller_id = public.get_current_seller_id()
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
  END IF;

  FOR v_adj IN
    SELECT ia.location_id, ia.listing_id, ia.quantity_change, oi.variant_id
    FROM inventory_adjustments ia
    JOIN order_items oi ON oi.seller_listing_id = ia.listing_id AND oi.order_id = p_order_id
    WHERE ia.reference_id = p_order_id
      AND ia.adjustment_type = 'order_committed'
  LOOP
    IF v_adj.variant_id IS NOT NULL THEN
      UPDATE location_inventory
      SET available = available + ABS(v_adj.quantity_change),
          committed = GREATEST(committed - ABS(v_adj.quantity_change), 0),
          updated_at = now()
      WHERE location_id = v_adj.location_id
        AND listing_id = v_adj.listing_id
        AND variant_id = v_adj.variant_id;
    ELSE
      UPDATE location_inventory
      SET available = available + ABS(v_adj.quantity_change),
          committed = GREATEST(committed - ABS(v_adj.quantity_change), 0),
          updated_at = now()
      WHERE location_id = v_adj.location_id
        AND listing_id = v_adj.listing_id
        AND variant_id IS NULL;
    END IF;
  END LOOP;

  DELETE FROM inventory_adjustments
  WHERE reference_id = p_order_id AND adjustment_type = 'order_committed';

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_location_stock_for_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_location_stock_for_order(uuid) TO authenticated;

-- ============================================================
-- 11. Fix restore_order_stock: add caller check
-- ============================================================
CREATE OR REPLACE FUNCTION public.restore_order_stock(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_profile_id uuid;
  v_caller_profile_id uuid;
BEGIN
  SELECT profile_id INTO v_order_profile_id FROM orders WHERE id = p_order_id;

  SELECT id INTO v_caller_profile_id FROM profiles WHERE auth_uid = auth.uid();

  IF v_caller_profile_id != v_order_profile_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM order_items oi
      JOIN seller_listings sl ON sl.id = oi.seller_listing_id
      WHERE oi.order_id = p_order_id
        AND sl.seller_id = public.get_current_seller_id()
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
  END IF;

  UPDATE seller_listings sl
  SET stock = sl.stock + oi.quantity,
      updated_at = now()
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.seller_listing_id = sl.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_order_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_order_stock(uuid) TO authenticated;

-- ============================================================
-- 12. REVOKE ALL FROM PUBLIC on existing SECURITY DEFINER functions
--     that were not already fixed above
-- ============================================================
REVOKE ALL ON FUNCTION public.get_best_fulfillment_location(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_best_fulfillment_location(uuid, uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.fulfill_location_stock(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_location_stock(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.create_fulfillment_rpc(uuid, uuid, text, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_fulfillment_rpc(uuid, uuid, text, text, text, jsonb, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_low_stock_alerts(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_low_stock_alerts(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_and_decrement_stock(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_and_decrement_stock(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.place_order(uuid, uuid, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, uuid, numeric, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_order_status_rpc(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_order_status_rpc(uuid) TO authenticated;
