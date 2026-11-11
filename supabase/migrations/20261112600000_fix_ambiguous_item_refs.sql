-- Fix "column reference 'item' is ambiguous" errors in RPC functions
-- The variable declaration `item jsonb` conflicts with `AS item` table alias

-- 1. Fix validate_and_decrement_stock
CREATE OR REPLACE FUNCTION public.validate_and_decrement_stock(
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elem jsonb;
  listing record;
  out_of_stock text[] := '{}';
BEGIN
  FOR elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, stock INTO listing
    FROM seller_listings
    WHERE id = (elem->>'seller_listing_id')::uuid;

    IF listing IS NULL THEN
      out_of_stock := array_append(out_of_stock,
        COALESCE(elem->>'product_name', elem->>'seller_listing_id') || ': Product not found');
    ELSIF listing.stock < (elem->>'quantity')::int THEN
      out_of_stock := array_append(out_of_stock,
        COALESCE(elem->>'product_name', elem->>'seller_listing_id') || ': Only ' || listing.stock || ' left in stock (requested ' || (elem->>'quantity')::int || ')');
    END IF;
  END LOOP;

  IF array_length(out_of_stock, 1) > 0 THEN
    RETURN jsonb_build_object('success', false, 'details', to_jsonb(out_of_stock));
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE seller_listings
    SET stock = stock - (elem->>'quantity')::int,
        updated_at = now()
    WHERE id = (elem->>'seller_listing_id')::uuid;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Fix place_order
CREATE OR REPLACE FUNCTION public.place_order(
  p_profile_id uuid,
  p_address_id uuid,
  p_total_amount numeric,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_profile_id AND auth_uid = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  INSERT INTO orders (profile_id, address_id, total_amount, status)
  VALUES (p_profile_id, p_address_id, p_total_amount, 'pending')
  RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, seller_listing_id, quantity, price_at_purchase)
  SELECT
    v_order_id,
    (elem->>'seller_listing_id')::uuid,
    (elem->>'quantity')::int,
    (elem->>'price_at_purchase')::numeric
  FROM jsonb_array_elements(p_items) AS elem;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$$;

-- 3. Fix create_fulfillment_rpc
CREATE OR REPLACE FUNCTION public.create_fulfillment_rpc(
  p_order_id uuid,
  p_seller_id uuid,
  p_tracking_number text DEFAULT NULL,
  p_carrier text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT NULL
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
  SELECT status INTO v_order_status FROM orders WHERE id = p_order_id;
  IF v_order_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order_status NOT IN ('processing', 'shipped', 'in_transit', 'out_for_delivery') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Order must be in Processing status. Current: ' || v_order_status);
  END IF;

  INSERT INTO fulfillments (order_id, seller_id, tracking_number, carrier, notes, status)
  VALUES (p_order_id, p_seller_id, p_tracking_number, p_carrier, p_notes, 'shipped')
  RETURNING id INTO v_fulfillment_id;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    INSERT INTO fulfillment_items (fulfillment_id, order_item_id, quantity)
    SELECT
      v_fulfillment_id,
      (elem->>'order_item_id')::uuid,
      (elem->>'quantity')::int
    FROM jsonb_array_elements(p_items) AS elem;
  END IF;

  PERFORM sync_order_status_rpc(p_order_id);

  RETURN jsonb_build_object('success', true, 'fulfillment_id', v_fulfillment_id);
END;
$$;

-- Re-grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_and_decrement_stock(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, uuid, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_fulfillment_rpc(uuid, uuid, text, text, text, jsonb) TO authenticated;
