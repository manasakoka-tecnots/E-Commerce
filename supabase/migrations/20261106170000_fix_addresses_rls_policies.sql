-- Fix "permission denied for table addresses" on INSERT
--
-- The original policy ("owner" FOR ALL) uses a USING clause with a subquery
-- into profiles. For INSERT operations PostgreSQL evaluates this as WITH CHECK,
-- but the subquery can fail when the anon-key client's RLS on profiles
-- restricts visibility. Replace the single FOR ALL policy with explicit
-- per-operation policies, and use a SECURITY DEFINER helper so the
-- ownership check can always read profiles regardless of the caller's role.

-- 1. Create a SECURITY DEFINER function that checks whether the given
--    profile_id belongs to the currently authenticated user.
--    SECURITY DEFINER runs with the privileges of the function owner (postgres),
--    so it can always read the profiles table.
CREATE OR REPLACE FUNCTION public.is_owner_of_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_profile_id AND auth_uid = auth.uid()
  );
$$;

-- 2. Drop the old blanket policy
DROP POLICY IF EXISTS "owner" ON addresses;

-- 3. SELECT – users can read their own addresses
CREATE POLICY "addresses_select_own"
ON addresses
FOR SELECT
TO authenticated
USING ( public.is_owner_of_profile(profile_id) );

-- 4. INSERT – users can insert addresses linked to their own profile
CREATE POLICY "addresses_insert_own"
ON addresses
FOR INSERT
TO authenticated
WITH CHECK ( public.is_owner_of_profile(profile_id) );

-- 5. UPDATE – users can update their own addresses
CREATE POLICY "addresses_update_own"
ON addresses
FOR UPDATE
TO authenticated
USING  ( public.is_owner_of_profile(profile_id) )
WITH CHECK ( public.is_owner_of_profile(profile_id) );

-- 6. DELETE – users can delete their own addresses
CREATE POLICY "addresses_delete_own"
ON addresses
FOR DELETE
TO authenticated
USING ( public.is_owner_of_profile(profile_id) );
