-- Fix: use INSERT ON CONFLICT instead of SELECT-then-INSERT to avoid duplicate key errors
-- Also add "missing" as a valid adjustment_type

CREATE OR REPLACE FUNCTION adjust_location_inventory(
  p_location_id uuid,
  p_listing_id uuid,
  p_adjustment_type text,
  p_quantity_change integer,
  p_reason text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_variant_id uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_old_available integer;
  v_new_available integer;
  v_inv_id uuid;
  v_seller_id uuid;
BEGIN
  -- Verify location belongs to current seller
  SELECT seller_id INTO v_seller_id FROM seller_locations WHERE id = p_location_id;
  IF v_seller_id != get_current_seller_id() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Upsert: try INSERT first, handle conflict gracefully
  IF p_variant_id IS NOT NULL THEN
    -- Try to get existing record
    SELECT id, available INTO v_inv_id, v_old_available
    FROM location_inventory
    WHERE location_id = p_location_id AND listing_id = p_listing_id AND variant_id = p_variant_id
    FOR UPDATE;

    IF v_inv_id IS NULL THEN
      -- Insert with exception handling for race conditions
      BEGIN
        INSERT INTO location_inventory (location_id, listing_id, variant_id, available)
        VALUES (p_location_id, p_listing_id, p_variant_id, 0)
        RETURNING id, available INTO v_inv_id, v_old_available;
      EXCEPTION WHEN unique_violation THEN
        SELECT id, available INTO v_inv_id, v_old_available
        FROM location_inventory
        WHERE location_id = p_location_id AND listing_id = p_listing_id AND variant_id = p_variant_id
        FOR UPDATE;
      END;
    END IF;
  ELSE
    SELECT id, available INTO v_inv_id, v_old_available
    FROM location_inventory
    WHERE location_id = p_location_id AND listing_id = p_listing_id AND variant_id IS NULL
    FOR UPDATE;

    IF v_inv_id IS NULL THEN
      BEGIN
        INSERT INTO location_inventory (location_id, listing_id, variant_id, available)
        VALUES (p_location_id, p_listing_id, NULL, 0)
        RETURNING id, available INTO v_inv_id, v_old_available;
      EXCEPTION WHEN unique_violation THEN
        SELECT id, available INTO v_inv_id, v_old_available
        FROM location_inventory
        WHERE location_id = p_location_id AND listing_id = p_listing_id AND variant_id IS NULL
        FOR UPDATE;
      END;
    END IF;
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

  -- If variant, also sync product_variants.stock
  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants
    SET stock = (
      SELECT COALESCE(SUM(available), 0)
      FROM location_inventory li
      JOIN seller_locations sl ON sl.id = li.location_id
      WHERE li.listing_id = p_listing_id AND li.variant_id = p_variant_id AND sl.seller_id = v_seller_id
    )
    WHERE id = p_variant_id;
  END IF;

  RETURN json_build_object('old_available', v_old_available, 'new_available', v_new_available);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION adjust_location_inventory(uuid, uuid, text, integer, text, uuid, uuid) TO authenticated;
