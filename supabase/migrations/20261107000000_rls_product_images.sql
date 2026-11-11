-- Allow anon to insert product images (for catalog seeding)
CREATE POLICY "allow_anon_insert_product_images" ON public.product_images
  FOR INSERT TO anon WITH CHECK (true);

-- Allow anon to select product images
CREATE POLICY "allow_anon_select_product_images" ON public.product_images
  FOR SELECT TO anon USING (true);

-- Allow authenticated users full access to product_images
CREATE POLICY "allow_authenticated_all_product_images" ON public.product_images
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
