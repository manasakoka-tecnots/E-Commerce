DROP POLICY IF EXISTS "approved sellers submit pending listings"
ON public.seller_listings;

DROP POLICY IF EXISTS "approved sellers publish own listings"
ON public.seller_listings;

CREATE POLICY "approved sellers publish own listings"
ON public.seller_listings
FOR INSERT
TO authenticated
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
