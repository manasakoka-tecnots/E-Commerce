CREATE OR REPLACE FUNCTION public.is_marketplace_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE auth_uid = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_marketplace_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_marketplace_admin() TO authenticated;

DROP POLICY IF EXISTS "own profile" ON public.profiles;
CREATE POLICY "users read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = auth_uid);

CREATE POLICY "admins read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_marketplace_admin());

DROP POLICY IF EXISTS "owner" ON public.sellers;
DROP POLICY IF EXISTS "admin" ON public.sellers;

CREATE POLICY "seller reads own seller record"
ON public.sellers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = sellers.profile_id
      AND profiles.auth_uid = auth.uid()
  )
);

CREATE POLICY "admins read seller records"
ON public.sellers
FOR SELECT
TO authenticated
USING (public.is_marketplace_admin());

CREATE POLICY "admins update seller records"
ON public.sellers
FOR UPDATE
TO authenticated
USING (public.is_marketplace_admin())
WITH CHECK (public.is_marketplace_admin());

GRANT SELECT, UPDATE ON public.sellers TO authenticated;
GRANT SELECT, INSERT ON public.seller_listings TO authenticated;

DROP POLICY IF EXISTS "seller reads own listings"
ON public.seller_listings;

CREATE POLICY "seller reads own listings"
ON public.seller_listings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE sellers.id = seller_listings.seller_id
      AND profiles.auth_uid = auth.uid()
  )
);

DROP POLICY IF EXISTS "approved sellers submit pending listings"
ON public.seller_listings;

CREATE POLICY "approved sellers submit pending listings"
ON public.seller_listings
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE sellers.id = seller_listings.seller_id
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
  )
);
