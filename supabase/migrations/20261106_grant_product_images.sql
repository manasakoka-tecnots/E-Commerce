-- Grant permissions on product_images table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT SELECT, INSERT ON public.product_images TO anon;
