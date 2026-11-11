ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can read products"
ON public.products;

CREATE POLICY "authenticated users can read products"
ON public.products
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);