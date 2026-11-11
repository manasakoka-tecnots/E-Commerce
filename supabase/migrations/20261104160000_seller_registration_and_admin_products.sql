CREATE OR REPLACE FUNCTION public.submit_seller_application(
  business_name_input text,
  business_address_input text,
  business_type_input text DEFAULT NULL
)
RETURNS TABLE (seller_id uuid, seller_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_email text;
  current_full_name text;
  confirmed_phone text;
  current_profile_id uuid;
  current_role text;
  existing_seller_id uuid;
  existing_seller_status text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to apply as a seller';
  END IF;

  IF length(trim(coalesce(business_name_input, ''))) < 2 THEN
    RAISE EXCEPTION 'Business name must be at least 2 characters';
  END IF;

  SELECT email, raw_user_meta_data ->> 'full_name', phone
  INTO current_email, current_full_name, confirmed_phone
  FROM auth.users
  WHERE id = current_user_id
    AND phone_confirmed_at IS NOT NULL;

  IF NOT FOUND OR confirmed_phone IS NULL THEN
    RAISE EXCEPTION 'Verify your mobile phone number before applying';
  END IF;

  IF current_email IS NULL THEN
    RAISE EXCEPTION 'Your account must have a verified email address';
  END IF;

  SELECT id, role
  INTO current_profile_id, current_role
  FROM public.profiles
  WHERE auth_uid = current_user_id
  FOR UPDATE;

  IF current_role = 'admin' THEN
    RAISE EXCEPTION 'Administrator accounts cannot apply as sellers';
  END IF;

  IF current_profile_id IS NULL THEN
    INSERT INTO public.profiles (auth_uid, email, full_name, role)
    VALUES (current_user_id, current_email, current_full_name, 'seller')
    RETURNING id INTO current_profile_id;
  ELSE
    UPDATE public.profiles
    SET email = current_email,
        full_name = coalesce(current_full_name, full_name),
        role = 'seller'
    WHERE id = current_profile_id;
  END IF;

  SELECT id, status
  INTO existing_seller_id, existing_seller_status
  FROM public.sellers
  WHERE profile_id = current_profile_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF existing_seller_id IS NOT NULL AND existing_seller_status <> 'rejected' THEN
    RAISE EXCEPTION 'A seller application already exists with status: %', existing_seller_status;
  END IF;

  IF existing_seller_id IS NOT NULL THEN
    UPDATE public.sellers
    SET business_name = trim(business_name_input),
        business_address = nullif(trim(coalesce(business_address_input, '')), ''),
        business_type = nullif(trim(coalesce(business_type_input, '')), ''),
        status = 'pending'
    WHERE id = existing_seller_id;

    seller_id := existing_seller_id;
  ELSE
    INSERT INTO public.sellers (
      profile_id, business_name, business_address, business_type, status
    )
    VALUES (
      current_profile_id,
      trim(business_name_input),
      nullif(trim(coalesce(business_address_input, '')), ''),
      nullif(trim(coalesce(business_type_input, '')), ''),
      'pending'
    )
    RETURNING id INTO seller_id;
  END IF;

  seller_status := 'pending';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_seller_application(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_seller_application(text, text, text) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.products, public.product_images, public.seller_listings
TO authenticated;

DROP POLICY IF EXISTS "admins manage products" ON public.products;
CREATE POLICY "admins manage products"
ON public.products
FOR ALL
TO authenticated
USING (public.is_marketplace_admin())
WITH CHECK (public.is_marketplace_admin());

DROP POLICY IF EXISTS "admins manage product images" ON public.product_images;
CREATE POLICY "admins manage product images"
ON public.product_images
FOR ALL
TO authenticated
USING (public.is_marketplace_admin())
WITH CHECK (public.is_marketplace_admin());

DROP POLICY IF EXISTS "admins manage seller listings" ON public.seller_listings;
CREATE POLICY "admins manage seller listings"
ON public.seller_listings
FOR ALL
TO authenticated
USING (public.is_marketplace_admin())
WITH CHECK (public.is_marketplace_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

DROP POLICY IF EXISTS "public read product image objects" ON storage.objects;
CREATE POLICY "public read product image objects"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "admins manage product image objects" ON storage.objects;
CREATE POLICY "admins manage product image objects"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_marketplace_admin()
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_marketplace_admin()
);
