-- Allow authenticated users to update their own orders (for cancellation)
CREATE POLICY "Users can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid()))
  WITH CHECK (profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid()));

-- Allow authenticated users to update fulfillments for their own orders
CREATE POLICY "Users can update fulfillments for own orders"
  ON fulfillments FOR UPDATE
  TO authenticated
  USING (order_id IN (SELECT id FROM orders WHERE profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid())));

-- Allow authenticated users to read order_items for their own orders
CREATE POLICY "Users can read own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (order_id IN (SELECT id FROM orders WHERE profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid())));
