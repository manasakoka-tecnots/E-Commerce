ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS seller_id uuid
REFERENCES public.sellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS products_seller_id_idx
ON public.products (seller_id);

DROP POLICY IF EXISTS "sellers read own pending product submissions"
ON public.products;
CREATE POLICY "sellers read own pending product submissions"
ON public.products
FOR SELECT
TO authenticated
USING (
  status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE sellers.id = products.seller_id
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
  )
);

DROP POLICY IF EXISTS "approved sellers submit pending products"
ON public.products;
CREATE POLICY "approved sellers submit pending products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE sellers.id = products.seller_id
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
  )
);

DROP POLICY IF EXISTS "approved sellers submit pending listings for own products"
ON public.seller_listings;
CREATE POLICY "approved sellers submit pending listings for own products"
ON public.seller_listings
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    JOIN public.products ON products.seller_id = sellers.id
    WHERE sellers.id = seller_listings.seller_id
      AND products.id = seller_listings.product_id
      AND products.status = 'pending'
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
  )
);

DROP POLICY IF EXISTS "approved sellers update own active listings"
ON public.seller_listings;
CREATE POLICY "approved sellers update own active listings"
ON public.seller_listings
FOR UPDATE
TO authenticated
USING (
  status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE sellers.id = seller_listings.seller_id
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
  )
)
WITH CHECK (
  status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.sellers
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE sellers.id = seller_listings.seller_id
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
  )
);

DROP POLICY IF EXISTS "sellers add images to own pending products"
ON public.product_images;
CREATE POLICY "sellers add images to own pending products"
ON public.product_images
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.products
    JOIN public.sellers ON sellers.id = products.seller_id
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE products.id = product_images.product_id
      AND products.status = 'pending'
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
  )
);

DROP POLICY IF EXISTS "sellers upload images to own pending products"
ON storage.objects;
CREATE POLICY "sellers upload images to own pending products"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.products
    JOIN public.sellers ON sellers.id = products.seller_id
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE products.id::text = (storage.foldername(name))[1]
      AND products.status = 'pending'
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
  )
);

DROP POLICY IF EXISTS "sellers remove images from own pending products"
ON storage.objects;
CREATE POLICY "sellers remove images from own pending products"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1
    FROM public.products
    JOIN public.sellers ON sellers.id = products.seller_id
    JOIN public.profiles ON profiles.id = sellers.profile_id
    WHERE products.id::text = (storage.foldername(name))[1]
      AND products.status = 'pending'
      AND sellers.status = 'approved'
      AND profiles.auth_uid = auth.uid()
      AND profiles.role = 'seller'
  )
);
