-- ============================================================
-- Fix: Add seller ownership validation to all RPC functions
-- Prevents cross-seller data access via SECURITY DEFINER RPCs
-- ============================================================

-- 1. get_best_fulfillment_location — validate caller owns the seller_id
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
  v_caller_seller uuid;
BEGIN
  -- Validate caller owns this seller
  SELECT s.id INTO v_caller_seller
  FROM sellers s
  JOIN profiles p ON p.id = s.profile_id
  WHERE p.auth_uid = auth.uid() AND s.id = p_seller_id;

  IF v_caller_seller IS NULL THEN
    RAISE EXCEPTION 'Not authorized: seller does not belong to current user';
  END IF;

  SELECT sl.id INTO v_location_id
  FROM seller_locations sl
  JOIN location_inventory li ON li.location_id = sl.id AND li.listing_id = p_listing_id
  WHERE sl.seller_id = p_seller_id
    AND sl.is_active = true
    AND li.available >= p_quantity
  ORDER BY
    sl.is_default DESC,
    sl.fulfillment_priority ASC,
    li.available DESC
  LIMIT 1;

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

-- 2. fulfill_location_stock — validate location belongs to fulfillment's seller
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
  v_fulfillment_seller uuid;
  v_location_seller uuid;
BEGIN
  -- Get the seller who owns this fulfillment
  SELECT seller_id INTO v_fulfillment_seller
  FROM fulfillments WHERE id = p_fulfillment_id;

  IF v_fulfillment_seller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fulfillment not found');
  END IF;

  -- Verify the location belongs to the same seller
  SELECT seller_id INTO v_location_seller
  FROM seller_locations WHERE id = p_location_id;

  IF v_location_seller IS NULL OR v_location_seller != v_fulfillment_seller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Location does not belong to fulfillment seller');
  END IF;

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

-- 3. create_fulfillment_rpc — validate caller owns the seller_id and location
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
  v_caller_seller uuid;
  v_location_owner uuid;
BEGIN
  -- Validate caller owns this seller account
  SELECT s.id INTO v_caller_seller
  FROM sellers s
  JOIN profiles p ON p.id = s.profile_id
  WHERE p.auth_uid = auth.uid() AND s.id = p_seller_id;

  IF v_caller_seller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized: seller does not belong to current user');
  END IF;

  -- Validate seller has items in this order
  IF NOT EXISTS (
    SELECT 1 FROM order_items oi
    JOIN seller_listings sl ON sl.id = oi.seller_listing_id
    WHERE oi.order_id = p_order_id AND sl.seller_id = p_seller_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seller has no items in this order');
  END IF;

  -- Check order status
  SELECT status INTO v_order_status FROM orders WHERE id = p_order_id;
  IF v_order_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order_status NOT IN ('processing', 'shipped', 'in_transit', 'out_for_delivery') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Order must be in Processing status. Current: ' || v_order_status);
  END IF;

  -- Resolve location
  v_effective_location := p_location_id;

  -- If location provided, validate it belongs to this seller
  IF v_effective_location IS NOT NULL THEN
    SELECT seller_id INTO v_location_owner FROM seller_locations WHERE id = v_effective_location;
    IF v_location_owner IS NULL OR v_location_owner != p_seller_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Location does not belong to this seller');
    END IF;
  ELSE
    SELECT id INTO v_effective_location
    FROM seller_locations
    WHERE seller_id = p_seller_id AND is_active = true
    ORDER BY is_default DESC, fulfillment_priority ASC
    LIMIT 1;
  END IF;

  INSERT INTO fulfillments (order_id, seller_id, tracking_number, carrier, notes, status, location_id)
  VALUES (p_order_id, p_seller_id, p_tracking_number, p_carrier, p_notes, 'shipped', v_effective_location)
  RETURNING id INTO v_fulfillment_id;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    INSERT INTO fulfillment_items (fulfillment_id, order_item_id, quantity)
    SELECT
      v_fulfillment_id,
      (item->>'order_item_id')::uuid,
      (item->>'quantity')::int
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  IF v_effective_location IS NOT NULL THEN
    PERFORM fulfill_location_stock(v_fulfillment_id, v_effective_location);
  END IF;

  PERFORM sync_order_status_rpc(p_order_id);

  RETURN jsonb_build_object('success', true, 'fulfillment_id', v_fulfillment_id, 'location_id', v_effective_location);
END;
$$;

-- 4. get_low_stock_alerts — validate caller owns the seller_id
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
DECLARE
  v_caller_seller uuid;
BEGIN
  -- Validate caller owns this seller
  SELECT s.id INTO v_caller_seller
  FROM sellers s
  JOIN profiles p ON p.id = s.profile_id
  WHERE p.auth_uid = auth.uid() AND s.id = p_seller_id;

  IF v_caller_seller IS NULL THEN
    RAISE EXCEPTION 'Not authorized: seller does not belong to current user';
  END IF;

  RETURN QUERY
  SELECT li.listing_id, p_prod.name AS product_name,
         COALESCE(sl_listing.sku, p_prod.sku) AS sku,
         li.location_id, sloc.name AS location_name,
         li.available, li.committed
  FROM location_inventory li
  JOIN seller_locations sloc ON sloc.id = li.location_id
  JOIN seller_listings sl_listing ON sl_listing.id = li.listing_id
  JOIN products p_prod ON p_prod.id = sl_listing.product_id
  WHERE sloc.seller_id = p_seller_id
    AND sloc.is_active = true
    AND li.available <= p_threshold
  ORDER BY li.available ASC, p_prod.name ASC;
END;
$$;

-- Re-grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_best_fulfillment_location(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_location_stock(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_fulfillment_rpc(uuid, uuid, text, text, text, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_low_stock_alerts(uuid, integer) TO authenticated;
