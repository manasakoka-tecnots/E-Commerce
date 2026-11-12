-- ============================================================
-- Multi-Location Inventory Management (Shopify-style)
-- ============================================================

-- 1. Seller Locations (warehouses, stores, fulfillment centers)
CREATE TABLE IF NOT EXISTS seller_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'warehouse' CHECK (type IN ('warehouse', 'store', 'fulfillment_center')),
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  country text DEFAULT 'India',
  phone text,
  email text,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  fulfillment_priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Per-Location Inventory
CREATE TABLE IF NOT EXISTS location_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES seller_locations(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES seller_listings(id) ON DELETE CASCADE,
  available integer NOT NULL DEFAULT 0 CHECK (available >= 0),
  committed integer NOT NULL DEFAULT 0 CHECK (committed >= 0),
  incoming integer NOT NULL DEFAULT 0 CHECK (incoming >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(location_id, listing_id)
);

-- 3. Inventory Adjustments (audit trail)
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES seller_locations(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES seller_listings(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('set', 'adjust', 'transfer_out', 'transfer_in', 'order_committed', 'order_fulfilled', 'order_cancelled', 'correction')),
  quantity_change integer NOT NULL,
  old_available integer NOT NULL DEFAULT 0,
  new_available integer NOT NULL DEFAULT 0,
  reason text,
  reference_id uuid,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- 4. Inventory Transfers
CREATE TABLE IF NOT EXISTS inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  from_location_id uuid NOT NULL REFERENCES seller_locations(id),
  to_location_id uuid NOT NULL REFERENCES seller_locations(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'in_transit', 'received', 'cancelled')),
  reference_number text,
  tracking_number text,
  carrier text,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  shipped_at timestamptz,
  received_at timestamptz
);

-- 5. Transfer Line Items
CREATE TABLE IF NOT EXISTS transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES seller_listings(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  received_quantity integer DEFAULT 0 CHECK (received_quantity >= 0),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seller_locations_seller ON seller_locations(seller_id);
CREATE INDEX IF NOT EXISTS idx_location_inventory_location ON location_inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_location_inventory_listing ON location_inventory(listing_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_location ON inventory_adjustments(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_listing ON inventory_adjustments(listing_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_seller ON inventory_transfers(seller_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);

-- RLS Policies
ALTER TABLE seller_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;

-- Helper function to get seller_id from auth
CREATE OR REPLACE FUNCTION get_current_seller_id()
RETURNS uuid AS $$
  SELECT s.id FROM sellers s
  JOIN profiles p ON p.id = s.profile_id
  WHERE p.auth_uid = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Seller Locations: sellers manage their own
CREATE POLICY "sellers_manage_own_locations" ON seller_locations
  FOR ALL USING (seller_id = get_current_seller_id());

CREATE POLICY "admins_manage_all_locations" ON seller_locations
  FOR ALL USING (is_marketplace_admin());

-- Location Inventory: sellers manage their own
CREATE POLICY "sellers_manage_own_location_inventory" ON location_inventory
  FOR ALL USING (
    location_id IN (SELECT id FROM seller_locations WHERE seller_id = get_current_seller_id())
  );

CREATE POLICY "admins_manage_all_location_inventory" ON location_inventory
  FOR ALL USING (is_marketplace_admin());

-- Inventory Adjustments: sellers read their own
CREATE POLICY "sellers_read_own_adjustments" ON inventory_adjustments
  FOR SELECT USING (
    location_id IN (SELECT id FROM seller_locations WHERE seller_id = get_current_seller_id())
  );

CREATE POLICY "sellers_insert_own_adjustments" ON inventory_adjustments
  FOR INSERT WITH CHECK (
    location_id IN (SELECT id FROM seller_locations WHERE seller_id = get_current_seller_id())
  );

CREATE POLICY "admins_manage_all_adjustments" ON inventory_adjustments
  FOR ALL USING (is_marketplace_admin());

-- Inventory Transfers: sellers manage their own
CREATE POLICY "sellers_manage_own_transfers" ON inventory_transfers
  FOR ALL USING (seller_id = get_current_seller_id());

CREATE POLICY "admins_manage_all_transfers" ON inventory_transfers
  FOR ALL USING (is_marketplace_admin());

-- Transfer Items: access through transfer
CREATE POLICY "sellers_manage_own_transfer_items" ON transfer_items
  FOR ALL USING (
    transfer_id IN (SELECT id FROM inventory_transfers WHERE seller_id = get_current_seller_id())
  );

CREATE POLICY "admins_manage_all_transfer_items" ON transfer_items
  FOR ALL USING (is_marketplace_admin());

-- Grants
GRANT ALL ON seller_locations TO authenticated;
GRANT ALL ON location_inventory TO authenticated;
GRANT ALL ON inventory_adjustments TO authenticated;
GRANT ALL ON inventory_transfers TO authenticated;
GRANT ALL ON transfer_items TO authenticated;

-- RPC: Adjust inventory at a location (atomic)
CREATE OR REPLACE FUNCTION adjust_location_inventory(
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
BEGIN
  -- Verify location belongs to current seller
  SELECT seller_id INTO v_seller_id FROM seller_locations WHERE id = p_location_id;
  IF v_seller_id != get_current_seller_id() THEN
    RAISE EXCEPTION 'Not authorized';
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

GRANT EXECUTE ON FUNCTION adjust_location_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_seller_id TO authenticated;
