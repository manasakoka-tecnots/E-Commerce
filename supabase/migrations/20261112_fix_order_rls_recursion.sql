-- Fix infinite recursion: order_items policy queries orders, orders policy queries order_items

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can update own orders" ON orders;
DROP POLICY IF EXISTS "Users can update fulfillments for own orders" ON fulfillments;
DROP POLICY IF EXISTS "Users can read own order items" ON order_items;

-- Create a SECURITY DEFINER function to check order ownership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_order_owner(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders o
    JOIN profiles p ON p.id = o.profile_id
    WHERE o.id = p_order_id
    AND p.auth_uid = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_order_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_order_owner(uuid) TO authenticated;

-- Customer can SELECT their own orders
CREATE POLICY "customer read own orders" ON orders
FOR SELECT TO authenticated
USING (public.is_order_owner(id));

-- Customer can UPDATE their own orders (for cancellation)
CREATE POLICY "customer update own orders" ON orders
FOR UPDATE TO authenticated
USING (public.is_order_owner(id))
WITH CHECK (public.is_order_owner(id));

-- Customer can read order_items for their own orders (uses SECURITY DEFINER, no recursion)
CREATE POLICY "customer read own order items" ON order_items
FOR SELECT TO authenticated
USING (public.is_order_owner(order_id));

-- Customer can update fulfillments for their own orders
CREATE POLICY "customer update own fulfillments" ON fulfillments
FOR UPDATE TO authenticated
USING (public.is_order_owner(order_id));

-- Grant UPDATE on orders and fulfillments to authenticated
GRANT UPDATE ON orders TO authenticated;
GRANT UPDATE ON fulfillments TO authenticated;
