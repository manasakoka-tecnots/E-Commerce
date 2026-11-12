-- Add variant_id and variant_title to order_items so we know WHICH variant was ordered
-- This fixes: committed stock showing for ALL variants instead of just the ordered one,
-- and enables showing variant details (size/color) on order pages.

-- 1. Add columns
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_title text;

-- 2. Recreate place_order to store variant info
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

  INSERT INTO order_items (order_id, seller_listing_id, quantity, price_at_purchase, variant_id, variant_title)
  SELECT
    v_order_id,
    (elem->>'seller_listing_id')::uuid,
    (elem->>'quantity')::int,
    (elem->>'price_at_purchase')::numeric,
    CASE WHEN elem->>'variant_id' IS NOT NULL AND elem->>'variant_id' != ''
      THEN (elem->>'variant_id')::uuid ELSE NULL END,
    NULLIF(elem->>'variant_title', '')
  FROM jsonb_array_elements(p_items) AS elem;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$$;

-- 3. Update commit_location_stock_for_order to use variant_id
-- This ensures only the specific ordered variant gets committed stock, not all variants
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
      -- If variant_id is set, commit stock for that specific variant row
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

-- 4. Update restore_location_stock_for_order to also use variant_id
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
BEGIN
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

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.place_order(uuid, uuid, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_location_stock_for_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_location_stock_for_order(uuid) TO authenticated;
