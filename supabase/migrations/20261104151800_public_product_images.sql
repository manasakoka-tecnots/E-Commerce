GRANT SELECT ON public.product_images TO anon, authenticated;

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read images for approved products"
ON public.product_images;

CREATE POLICY "public read images for approved products"
ON public.product_images
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products
    WHERE products.id = product_images.product_id
      AND products.status = 'approved'
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'product_images'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.product_images';
  END IF;
END;
$$;
