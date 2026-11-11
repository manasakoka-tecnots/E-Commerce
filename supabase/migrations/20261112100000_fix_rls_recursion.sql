-- Fix infinite recursion: order_items.owner queries orders, and orders.seller_update queries order_items
-- Drop the broad "owner" ALL policies that cause the circular dependency
-- They're redundant — covered by specific SELECT/UPDATE policies already in place

DROP POLICY IF EXISTS "owner" ON order_items;
DROP POLICY IF EXISTS "owner" ON orders;

-- Ensure order_items has INSERT/DELETE for the order owner (was covered by the dropped ALL policy)
-- Use the SECURITY DEFINER function to avoid recursion
CREATE POLICY "customer insert own order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (is_order_owner(order_id));

CREATE POLICY "customer delete own order items"
  ON order_items FOR DELETE
  TO authenticated
  USING (is_order_owner(order_id));
