-- Allow approved sellers to UPDATE their own products
DROP POLICY IF EXISTS "sellers update own products" ON public.products;
CREATE POLICY "sellers update own products"
ON public.products
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE sellers.id = products.seller_id
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE sellers.id = products.seller_id
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
  )
);

-- Also allow sellers to update their own seller_listings
DROP POLICY IF EXISTS "sellers update own listings" ON public.seller_listings;
CREATE POLICY "sellers update own listings"
ON public.seller_listings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE sellers.id = seller_listings.seller_id
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE sellers.id = seller_listings.seller_id
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
  )
);
