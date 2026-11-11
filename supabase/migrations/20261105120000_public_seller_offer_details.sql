GRANT SELECT (id, business_name, business_type)
ON public.sellers
TO anon, authenticated;

DROP POLICY IF EXISTS "public read sellers with active listings"
ON public.sellers;

CREATE POLICY "public read sellers with active listings"
ON public.sellers
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.seller_listings
    JOIN public.products
      ON products.id = seller_listings.product_id
    WHERE seller_listings.seller_id = sellers.id
      AND seller_listings.status = 'active'
      AND products.status = 'approved'
  )
);
