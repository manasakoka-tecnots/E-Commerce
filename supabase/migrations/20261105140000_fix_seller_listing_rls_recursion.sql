CREATE OR REPLACE FUNCTION public.seller_has_public_active_listing(p_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.seller_listings
    JOIN public.products
      ON products.id = seller_listings.product_id
    WHERE seller_listings.seller_id = p_seller_id
      AND seller_listings.status = 'active'
      AND products.status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.seller_has_public_active_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_has_public_active_listing(uuid)
TO anon, authenticated;

DROP POLICY IF EXISTS "public read sellers with active listings"
ON public.sellers;

CREATE POLICY "public read sellers with active listings"
ON public.sellers
FOR SELECT
TO anon, authenticated
USING (public.seller_has_public_active_listing(id));
