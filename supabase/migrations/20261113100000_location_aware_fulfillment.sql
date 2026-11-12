-- ============================================================
-- Location-Aware Fulfillment & Committed Stock Tracking
-- Links fulfillments to locations, auto-picks best location,
-- and syncs committed stock per location on order/cancel.
-- ============================================================

-- 1. Add location_id to fulfillments table
ALTER TABLE fulfillments ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES seller_locations(id);
CREATE INDEX IF NOT EXISTS idx_fulfillments_location ON fulfillments(location_id);

-- 2. Auto-select best fulfillment location for a listing
-- Returns the location_id with highest priority that has enough stock
CREATE OR REPLACE FUNCTION public.get_best_fulfillment_location(
  p_seller_id uuid,
  p_listing_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location_id uuid;
BEGIN
  SELECT sl.id INTO v_location_id
  FROM seller_locations sl
  JOIN location_inventory li ON li.location_id = sl.id AND li.listing_id = p_listing_id
  WHERE sl.seller_id = p_seller_id
    AND sl.is_active = true
    AND li.available >= p_quantity
  ORDER BY
    sl.is_default DESC,          -- default location first
    sl.fulfillment_priority ASC, -- then by priority (lower = higher priority)
    li.available DESC             -- then by most stock
  LIMIT 1;

  -- Fallback: if no location has enough stock, return the default active location
  IF v_location_id IS NULL THEN
    SELECT sl.id INTO v_location_id
    FROM seller_locations sl
    WHERE sl.seller_id = p_seller_id AND sl.is_active = true
    ORDER BY sl.is_default DESC, sl.fulfillment_priority ASC
    LIMIT 1;
  END IF;

  RETURN v_location_id;
END;
$$;

-- 3. Commit stock at location level when order is placed
-- Called after validate_and_decrement_stock succeeds
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
BEGIN
  -- For each order item, find the best location and commit stock there
  FOR v_item IN
    SELECT oi.id AS order_item_id, oi.seller_listing_id, oi.quantity,
           sl_inner.seller_id
    FROM order_items oi
    JOIN seller_listings sl_inner ON sl_inner.id = oi.seller_listing_id
    WHERE oi.order_id = p_order_id
  LOOP
    v_seller_id := v_item.seller_id;

    -- Find best location
    v_location_id := get_best_fulfillment_location(v_seller_id, v_item.seller_listing_id, v_item.quantity);

    IF v_location_id IS NOT NULL THEN
      -- Get current values
      SELECT available, committed INTO v_old_available, v_old_committed
      FROM location_inventory
      WHERE location_id = v_location_id AND listing_id = v_item.seller_listing_id
      FOR UPDATE;

      IF v_old_available IS NOT NULL AND v_old_available >= v_item.quantity THEN
        -- Decrement available, increment committed
        UPDATE location_inventory
        SET available = available - v_item.quantity,
            committed = committed + v_item.quantity,
            updated_at = now()
        WHERE location_id = v_location_id AND listing_id = v_item.seller_listing_id;

        -- Record adjustment
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

-- 4. Restore location stock when order is cancelled
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
  v_current_available integer;
BEGIN
  -- Find all order_committed adjustments for this order and reverse them
  FOR v_adj IN
    SELECT ia.location_id, ia.listing_id, ia.quantity_change
    FROM inventory_adjustments ia
    WHERE ia.reference_id = p_order_id
      AND ia.adjustment_type = 'order_committed'
  LOOP
    -- Get current available
    SELECT available INTO v_current_available
    FROM location_inventory
    WHERE location_id = v_adj.location_id AND listing_id = v_adj.listing_id
    FOR UPDATE;

    IF v_current_available IS NOT NULL THEN
      -- Reverse: add back to available, remove from committed
      UPDATE location_inventory
      SET available = available + ABS(v_adj.quantity_change),
          committed = GREATEST(0, committed - ABS(v_adj.quantity_change)),
          updated_at = now()
      WHERE location_id = v_adj.location_id AND listing_id = v_adj.listing_id;

      -- Record cancellation adjustment
      INSERT INTO inventory_adjustments (
        location_id, listing_id, adjustment_type, quantity_change,
        old_available, new_available, reason, reference_id
      ) VALUES (
        v_adj.location_id, v_adj.listing_id, 'order_cancelled',
        ABS(v_adj.quantity_change), v_current_available,
        v_current_available + ABS(v_adj.quantity_change),
        'Order cancelled ' || p_order_id::text, p_order_id
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Fulfill from location — decrement committed stock when fulfillment ships
CREATE OR REPLACE FUNCTION public.fulfill_location_stock(
  p_fulfillment_id uuid,
  p_location_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_old_committed integer;
BEGIN
  -- For each fulfillment item, reduce committed at the specified location
  FOR v_item IN
    SELECT fi.order_item_id, fi.quantity, oi.seller_listing_id
    FROM fulfillment_items fi
    JOIN order_items oi ON oi.id = fi.order_item_id
    WHERE fi.fulfillment_id = p_fulfillment_id
  LOOP
    SELECT committed INTO v_old_committed
    FROM location_inventory
    WHERE location_id = p_location_id AND listing_id = v_item.seller_listing_id
    FOR UPDATE;

    IF v_old_committed IS NOT NULL THEN
      UPDATE location_inventory
      SET committed = GREATEST(0, committed - v_item.quantity),
          updated_at = now()
      WHERE location_id = p_location_id AND listing_id = v_item.seller_listing_id;

      -- Record fulfillment adjustment
      INSERT INTO inventory_adjustments (
        location_id, listing_id, adjustment_type, quantity_change,
        old_available, new_available, reason, reference_id
      ) VALUES (
        p_location_id, v_item.seller_listing_id, 'order_fulfilled',
        -v_item.quantity,
        (SELECT available FROM location_inventory WHERE location_id = p_location_id AND listing_id = v_item.seller_listing_id),
        (SELECT available FROM location_inventory WHERE location_id = p_location_id AND listing_id = v_item.seller_listing_id),
        'Fulfillment ' || p_fulfillment_id::text, p_fulfillment_id
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Update create_fulfillment_rpc to accept location_id
CREATE OR REPLACE FUNCTION public.create_fulfillment_rpc(
  p_order_id uuid,
  p_seller_id uuid,
  p_tracking_number text DEFAULT NULL,
  p_carrier text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT NULL,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_status text;
  v_fulfillment_id uuid;
  v_effective_location uuid;
BEGIN
  -- Check order status
  SELECT status INTO v_order_status FROM orders WHERE id = p_order_id;
  IF v_order_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order_status NOT IN ('processing', 'shipped', 'in_transit', 'out_for_delivery') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Order must be in Processing status. Current: ' || v_order_status);
  END IF;

  -- Resolve location: use provided or auto-select default
  v_effective_location := p_location_id;
  IF v_effective_location IS NULL THEN
    SELECT id INTO v_effective_location
    FROM seller_locations
    WHERE seller_id = p_seller_id AND is_active = true
    ORDER BY is_default DESC, fulfillment_priority ASC
    LIMIT 1;
  END IF;

  -- Create the fulfillment with location
  INSERT INTO fulfillments (order_id, seller_id, tracking_number, carrier, notes, status, location_id)
  VALUES (p_order_id, p_seller_id, p_tracking_number, p_carrier, p_notes, 'shipped', v_effective_location)
  RETURNING id INTO v_fulfillment_id;

  -- Add fulfillment items if provided
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    INSERT INTO fulfillment_items (fulfillment_id, order_item_id, quantity)
    SELECT
      v_fulfillment_id,
      (item->>'order_item_id')::uuid,
      (item->>'quantity')::int
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  -- Reduce committed stock at the fulfillment location
  IF v_effective_location IS NOT NULL THEN
    PERFORM fulfill_location_stock(v_fulfillment_id, v_effective_location);
  END IF;

  -- Sync order status
  PERFORM sync_order_status_rpc(p_order_id);

  RETURN jsonb_build_object('success', true, 'fulfillment_id', v_fulfillment_id, 'location_id', v_effective_location);
END;
$$;

-- 7. Update cancel_order_rpc to also restore location stock
CREATE OR REPLACE FUNCTION public.cancel_order_rpc(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update order
  UPDATE orders
  SET status = 'cancelled',
      cancellation_reason = p_reason,
      cancelled_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

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

-- 8. Get low stock items for a seller (items below threshold at any location)
CREATE OR REPLACE FUNCTION public.get_low_stock_alerts(
  p_seller_id uuid,
  p_threshold integer DEFAULT 5
)
RETURNS TABLE(
  listing_id uuid,
  product_name text,
  sku text,
  location_id uuid,
  location_name text,
  available integer,
  committed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT li.listing_id, p.name AS product_name,
         COALESCE(sl_listing.sku, p.sku) AS sku,
         li.location_id, sloc.name AS location_name,
         li.available, li.committed
  FROM location_inventory li
  JOIN seller_locations sloc ON sloc.id = li.location_id
  JOIN seller_listings sl_listing ON sl_listing.id = li.listing_id
  JOIN products p ON p.id = sl_listing.product_id
  WHERE sloc.seller_id = p_seller_id
    AND sloc.is_active = true
    AND li.available <= p_threshold
  ORDER BY li.available ASC, p.name ASC;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_best_fulfillment_location(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_location_stock_for_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_location_stock_for_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_location_stock(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_low_stock_alerts(uuid, integer) TO authenticated;
-- Re-grant updated functions
GRANT EXECUTE ON FUNCTION public.create_fulfillment_rpc(uuid, uuid, text, text, text, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_rpc(uuid, text) TO authenticated;
