-- Allow sellers (not just admins) to update and delete brands.
-- Previously only the admin role was permitted by RLS, which caused
-- the seller brands page save/delete to silently fail when the
-- service-role key was unavailable.

-- Drop the old admin-only UPDATE policy
DROP POLICY IF EXISTS "Admins can update brands" ON brands;

-- Recreate as a seller+admin UPDATE policy
CREATE POLICY "Sellers and admins can update brands"
  ON brands FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_uid = auth.uid()
      AND profiles.role IN ('seller', 'admin')
    )
  );

-- Add a DELETE policy for sellers and admins (was missing entirely)
DROP POLICY IF EXISTS "Sellers and admins can delete brands" ON brands;
CREATE POLICY "Sellers and admins can delete brands"
  ON brands FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_uid = auth.uid()
      AND profiles.role IN ('seller', 'admin')
    )
  );
