GRANT SELECT ON public.profiles TO authenticated;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read categories" ON public.categories;
CREATE POLICY "public read categories"
ON public.categories
FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT ON public.categories TO anon, authenticated;
