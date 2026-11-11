UPDATE public.sellers AS seller
SET status = 'approved'
FROM public.profiles AS profile
JOIN auth.users AS auth_user ON auth_user.id = profile.auth_uid
WHERE seller.profile_id = profile.id
  AND seller.status = 'pending'
  AND profile.role = 'seller'
  AND auth_user.email_confirmed_at IS NOT NULL
  AND length(trim(coalesce(seller.business_name, ''))) >= 2;

CREATE OR REPLACE FUNCTION public.submit_seller_application(
  business_name_input text,
  business_address_input text,
  business_type_input text DEFAULT NULL,
  gst_number_input text DEFAULT NULL
)
RETURNS TABLE (seller_id uuid, seller_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_email text;
  current_email_confirmed_at timestamptz;
  current_full_name text;
  current_profile_id uuid;
  current_role text;
  existing_seller_id uuid;
  existing_seller_status text;
  normalized_gst text := nullif(upper(trim(coalesce(gst_number_input, ''))), '');
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to apply as a seller';
  END IF;

  IF length(trim(coalesce(business_name_input, ''))) < 2 THEN
    RAISE EXCEPTION 'Business name must be at least 2 characters';
  END IF;

  IF normalized_gst IS NOT NULL
     AND normalized_gst !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' THEN
    RAISE EXCEPTION 'Enter a valid GSTIN or leave the field blank';
  END IF;

  SELECT email, email_confirmed_at, raw_user_meta_data ->> 'full_name'
  INTO current_email, current_email_confirmed_at, current_full_name
  FROM auth.users
  WHERE id = current_user_id;

  IF current_email IS NULL OR current_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Verify your email address before applying as a seller';
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
        gst_number = normalized_gst,
        status = 'approved'
    WHERE id = existing_seller_id;

    seller_id := existing_seller_id;
  ELSE
    INSERT INTO public.sellers (
      profile_id, business_name, business_address, business_type, gst_number, status
    )
    VALUES (
      current_profile_id,
      trim(business_name_input),
      nullif(trim(coalesce(business_address_input, '')), ''),
      nullif(trim(coalesce(business_type_input, '')), ''),
      normalized_gst,
      'approved'
    )
    RETURNING id INTO seller_id;
  END IF;

  seller_status := 'approved';
  RETURN NEXT;
END;
$$;
