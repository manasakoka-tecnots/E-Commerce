GRANT SELECT ON public.products, public.seller_listings TO anon, authenticated;

DROP POLICY IF EXISTS "public read approved products"
ON public.products;

CREATE POLICY "public read approved products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (status = 'approved');

ALTER TABLE public.seller_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read active listings for approved products"
ON public.seller_listings;

CREATE POLICY "public read active listings for approved products"
ON public.seller_listings
FOR SELECT
TO anon, authenticated
USING (
  status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.products
    WHERE products.id = seller_listings.product_id
      AND products.status = 'approved'
  )
);
