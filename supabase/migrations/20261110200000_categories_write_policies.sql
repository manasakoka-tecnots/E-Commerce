-- Allow authenticated users (sellers) to insert, update, and delete categories
-- Currently only SELECT policies exist, causing "permission denied" errors

-- INSERT policy
DROP POLICY IF EXISTS "authenticated insert categories" ON public.categories;
CREATE POLICY "authenticated insert categories"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE policy
DROP POLICY IF EXISTS "authenticated update categories" ON public.categories;
CREATE POLICY "authenticated update categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE policy
DROP POLICY IF EXISTS "authenticated delete categories" ON public.categories;
CREATE POLICY "authenticated delete categories"
ON public.categories
FOR DELETE
TO authenticated
USING (true);

-- Grant table-level permissions
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
