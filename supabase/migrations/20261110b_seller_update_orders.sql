-- Allow sellers to update order status for orders containing their products
DROP POLICY IF EXISTS "seller update order status" ON orders;
CREATE POLICY "seller update order status" ON orders
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM order_items oi
    JOIN seller_listings sl ON sl.id = oi.seller_listing_id
    JOIN sellers s ON s.id = sl.seller_id
    JOIN profiles p ON p.id = s.profile_id
    WHERE oi.order_id = orders.id
    AND p.auth_uid = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM order_items oi
    JOIN seller_listings sl ON sl.id = oi.seller_listing_id
    JOIN sellers s ON s.id = sl.seller_id
    JOIN profiles p ON p.id = s.profile_id
    WHERE oi.order_id = orders.id
    AND p.auth_uid = auth.uid()
  )
);
