-- Grant anon INSERT/UPDATE/DELETE on collections and collection_products
-- (Previous migration only had SELECT for anon)
GRANT INSERT, UPDATE, DELETE ON public.collections TO anon;
GRANT INSERT, DELETE ON public.collection_products TO anon;
