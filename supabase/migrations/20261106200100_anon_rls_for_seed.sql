-- Allow anon role to insert/select products and seller_listings for server-side API routes
CREATE POLICY "anon_insert_products" ON public.products
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "anon_select_products" ON public.products
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_insert_seller_listings" ON public.seller_listings
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "anon_select_sellers" ON public.sellers
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_select_categories" ON public.categories
  FOR SELECT TO anon
  USING (true);
