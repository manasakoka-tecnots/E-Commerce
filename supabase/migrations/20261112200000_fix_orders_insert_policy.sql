-- Fix: customers cannot place orders because INSERT policy is missing on orders table.
-- The original "owner" FOR ALL policy was dropped by 20261112_fix_order_rls_recursion.sql
-- which only recreated SELECT and UPDATE policies, forgetting INSERT.

-- Allow authenticated users to insert orders where profile_id matches their own profile
CREATE POLICY "customer insert own orders" ON orders
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = profile_id
      AND profiles.auth_uid = auth.uid()
  )
);

-- Ensure INSERT is granted (idempotent)
GRANT INSERT ON orders TO authenticated;
