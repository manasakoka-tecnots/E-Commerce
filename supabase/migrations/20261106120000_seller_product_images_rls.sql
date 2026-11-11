-- Allow sellers to manage product_images for their own products
CREATE POLICY "sellers manage own product images"
ON public.product_images
FOR ALL
TO authenticated
USING (
  product_id IN (
    SELECT p.id FROM public.products p
    JOIN public.sellers s ON s.id = p.seller_id
    JOIN public.profiles pr ON pr.id = s.profile_id
    WHERE pr.auth_uid = auth.uid()
  )
)
WITH CHECK (
  product_id IN (
    SELECT p.id FROM public.products p
    JOIN public.sellers s ON s.id = p.seller_id
    JOIN public.profiles pr ON pr.id = s.profile_id
    WHERE pr.auth_uid = auth.uid()
  )
);
