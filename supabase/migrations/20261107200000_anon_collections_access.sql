-- Allow anon role to insert/update/delete collections and collection_products
-- This enables the seller demo mode to persist collections to the database

CREATE POLICY "anon_insert_collections" ON public.collections
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_collections" ON public.collections
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_delete_collections" ON public.collections
  FOR DELETE TO anon USING (true);

CREATE POLICY "anon_insert_collection_products" ON public.collection_products
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_delete_collection_products" ON public.collection_products
  FOR DELETE TO anon USING (true);
