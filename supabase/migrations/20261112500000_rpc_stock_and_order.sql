-- RPC functions with SECURITY DEFINER to bypass RLS for critical operations
-- These run with the function creator's privileges (postgres), not the caller's

-- 1. Validate and decrement stock atomically
CREATE OR REPLACE FUNCTION public.validate_and_decrement_stock(
  p_items jsonb  -- array of {seller_listing_id, quantity, product_name}
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  listing record;
  out_of_stock text[] := '{}';
  result jsonb;
BEGIN
  -- First pass: validate all items have sufficient stock
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, stock INTO listing
    FROM seller_listings
    WHERE id = (item->>'seller_listing_id')::uuid;

    IF listing IS NULL THEN
      out_of_stock := array_append(out_of_stock,
        COALESCE(item->>'product_name', item->>'seller_listing_id') || ': Product not found');
    ELSIF listing.stock < (item->>'quantity')::int THEN
      out_of_stock := array_append(out_of_stock,
        COALESCE(item->>'product_name', item->>'seller_listing_id') || ': Only ' || listing.stock || ' left in stock (requested ' || (item->>'quantity')::int || ')');
    END IF;
  END LOOP;

  IF array_length(out_of_stock, 1) > 0 THEN
    RETURN jsonb_build_object('success', false, 'details', to_jsonb(out_of_stock));
  END IF;

  -- Second pass: decrement stock
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE seller_listings
    SET stock = stock - (item->>'quantity')::int,
        updated_at = now()
    WHERE id = (item->>'seller_listing_id')::uuid;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Restore stock (for cancelled orders)
CREATE OR REPLACE FUNCTION public.restore_order_stock(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE seller_listings sl
  SET stock = sl.stock + oi.quantity,
      updated_at = now()
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.seller_listing_id = sl.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Place order atomically (create order + items)
CREATE OR REPLACE FUNCTION public.place_order(
  p_profile_id uuid,
  p_address_id uuid,
  p_total_amount numeric,
  p_items jsonb  -- array of {seller_listing_id, quantity, price_at_purchase}
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  item jsonb;
BEGIN
  -- Verify the profile belongs to the calling user
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_profile_id AND auth_uid = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Create the order
  INSERT INTO orders (profile_id, address_id, total_amount, status)
  VALUES (p_profile_id, p_address_id, p_total_amount, 'pending')
  RETURNING id INTO v_order_id;

  -- Create order items
  INSERT INTO order_items (order_id, seller_listing_id, quantity, price_at_purchase)
  SELECT
    v_order_id,
    (item->>'seller_listing_id')::uuid,
    (item->>'quantity')::int,
    (item->>'price_at_purchase')::numeric
  FROM jsonb_array_elements(p_items) AS item;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$$;

-- 4. Sync order status from fulfillments
CREATE OR REPLACE FUNCTION public.sync_order_status_rpc(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fulfillment record;
  v_status_priority text[] := ARRAY['delivered', 'out_for_delivery', 'in_transit', 'shipped', 'pending'];
  v_lowest_idx int := 0;
  v_idx int;
  v_new_status text;
  v_fulfillment_to_order jsonb := '{
    "pending": "processing",
    "shipped": "shipped",
    "in_transit": "in_transit",
    "out_for_delivery": "out_for_delivery",
    "delivered": "delivered"
  }'::jsonb;
  v_has_fulfillments boolean := false;
BEGIN
  FOR v_fulfillment IN
    SELECT status FROM fulfillments WHERE order_id = p_order_id AND status != 'cancelled'
  LOOP
    v_has_fulfillments := true;
    v_idx := array_position(v_status_priority, v_fulfillment.status);
    IF v_idx IS NOT NULL AND v_idx > v_lowest_idx THEN
      v_lowest_idx := v_idx;
    END IF;
  END LOOP;

  IF NOT v_has_fulfillments THEN
    RETURN jsonb_build_object('success', true, 'message', 'No active fulfillments');
  END IF;

  v_new_status := v_fulfillment_to_order->>v_status_priority[v_lowest_idx];
  IF v_new_status IS NULL THEN
    v_new_status := 'processing';
  END IF;

  UPDATE orders SET status = v_new_status, updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$;

-- 5. Create fulfillment
CREATE OR REPLACE FUNCTION public.create_fulfillment_rpc(
  p_order_id uuid,
  p_seller_id uuid,
  p_tracking_number text DEFAULT NULL,
  p_carrier text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT NULL  -- array of {order_item_id, quantity}
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_status text;
  v_fulfillment_id uuid;
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

  -- Create the fulfillment
  INSERT INTO fulfillments (order_id, seller_id, tracking_number, carrier, notes, status)
  VALUES (p_order_id, p_seller_id, p_tracking_number, p_carrier, p_notes, 'shipped')
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

  -- Sync order status
  PERFORM sync_order_status_rpc(p_order_id);

  RETURN jsonb_build_object('success', true, 'fulfillment_id', v_fulfillment_id);
END;
$$;

-- 6. Update fulfillment status
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
BEGIN
  -- Get and update the fulfillment
  UPDATE fulfillments SET status = p_status, updated_at = now()
  WHERE id = p_fulfillment_id
  RETURNING order_id INTO v_order_id;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fulfillment not found');
  END IF;

  -- Sync order status
  PERFORM sync_order_status_rpc(v_order_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Cancel fulfillment
CREATE OR REPLACE FUNCTION public.cancel_fulfillment_rpc(p_fulfillment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  UPDATE fulfillments SET status = 'cancelled', updated_at = now()
  WHERE id = p_fulfillment_id
  RETURNING order_id INTO v_order_id;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fulfillment not found');
  END IF;

  PERFORM sync_order_status_rpc(v_order_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. Update order status (for seller actions like confirm, process)
CREATE OR REPLACE FUNCTION public.update_order_status_rpc(
  p_order_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE orders SET status = p_status, updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. Cancel order with reason and stock restore
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

  -- Restore stock
  UPDATE seller_listings sl
  SET stock = sl.stock + oi.quantity,
      updated_at = now()
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.seller_listing_id = sl.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.validate_and_decrement_stock(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_order_stock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, uuid, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_order_status_rpc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_fulfillment_rpc(uuid, uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_fulfillment_status_rpc(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_fulfillment_rpc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status_rpc(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_rpc(uuid, text) TO authenticated;
