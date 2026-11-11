-- Fulfillment system (Shopify-style)
-- Supports partial fulfillments, multiple shipments per order, tracking

-- Fulfillments table: one per shipment
CREATE TABLE IF NOT EXISTS fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','shipped','in_transit','out_for_delivery','delivered','cancelled')),
  tracking_number text,
  carrier text,
  tracking_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  shipped_at timestamptz,
  delivered_at timestamptz
);

-- Fulfillment line items: which order_items (and how many) are in each fulfillment
CREATE TABLE IF NOT EXISTS fulfillment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fulfillments_order_id ON fulfillments(order_id);
CREATE INDEX IF NOT EXISTS idx_fulfillments_seller_id ON fulfillments(seller_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_items_fulfillment_id ON fulfillment_items(fulfillment_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_items_order_item_id ON fulfillment_items(order_item_id);

-- RLS
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_items ENABLE ROW LEVEL SECURITY;

-- Fulfillments: sellers can CRUD their own, customers can read for their orders
DROP POLICY IF EXISTS "seller_manage_fulfillments" ON fulfillments;
CREATE POLICY "seller_manage_fulfillments" ON fulfillments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sellers s
      JOIN profiles p ON p.id = s.profile_id
      WHERE s.id = fulfillments.seller_id AND p.auth_uid = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sellers s
      JOIN profiles p ON p.id = s.profile_id
      WHERE s.id = fulfillments.seller_id AND p.auth_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customer_read_fulfillments" ON fulfillments;
CREATE POLICY "customer_read_fulfillments" ON fulfillments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.id = o.profile_id
      WHERE o.id = fulfillments.order_id AND p.auth_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin_read_fulfillments" ON fulfillments;
CREATE POLICY "admin_read_fulfillments" ON fulfillments
  FOR SELECT TO authenticated
  USING (public.is_marketplace_admin());

-- Fulfillment items: same access as parent fulfillment
DROP POLICY IF EXISTS "seller_manage_fulfillment_items" ON fulfillment_items;
CREATE POLICY "seller_manage_fulfillment_items" ON fulfillment_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fulfillments f
      JOIN sellers s ON s.id = f.seller_id
      JOIN profiles p ON p.id = s.profile_id
      WHERE f.id = fulfillment_items.fulfillment_id AND p.auth_uid = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fulfillments f
      JOIN sellers s ON s.id = f.seller_id
      JOIN profiles p ON p.id = s.profile_id
      WHERE f.id = fulfillment_items.fulfillment_id AND p.auth_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customer_read_fulfillment_items" ON fulfillment_items;
CREATE POLICY "customer_read_fulfillment_items" ON fulfillment_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fulfillments f
      JOIN orders o ON o.id = f.order_id
      JOIN profiles p ON p.id = o.profile_id
      WHERE f.id = fulfillment_items.fulfillment_id AND p.auth_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin_read_fulfillment_items" ON fulfillment_items;
CREATE POLICY "admin_read_fulfillment_items" ON fulfillment_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fulfillments f WHERE f.id = fulfillment_items.fulfillment_id
      AND (SELECT public.is_marketplace_admin())
    )
  );

-- Grant permissions to authenticated role
GRANT ALL ON fulfillments TO authenticated;
GRANT ALL ON fulfillment_items TO authenticated;
