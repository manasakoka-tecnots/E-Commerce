-- Temporary grants to allow server-side API routes to insert products
-- The anon key is used by Next.js API routes on the server side
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_listings TO anon;
GRANT SELECT ON public.sellers TO anon;
GRANT SELECT ON public.categories TO anon;
