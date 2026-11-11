GRANT UPDATE ON public.seller_listings TO authenticated;

DROP POLICY IF EXISTS "approved sellers update own active listings"
ON public.seller_listings;
CREATE POLICY "approved sellers update own active listings"
ON public.seller_listings
FOR UPDATE
TO authenticated
USING (
  status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE sellers.id = seller_listings.seller_id
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
  )
)
WITH CHECK (
  status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    JOIN public.products ON products.id = seller_listings.product_id
    WHERE sellers.id = seller_listings.seller_id
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
      AND products.status = 'approved'
  )
);
