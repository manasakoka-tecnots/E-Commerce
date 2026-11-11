ALTER FUNCTION public.submit_seller_application(text, text, text, text)
RENAME TO submit_seller_application_unvalidated;

REVOKE ALL ON FUNCTION public.submit_seller_application_unvalidated(text, text, text, text)
FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.submit_seller_application(
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
BEGIN
  IF length(trim(coalesce(business_name_input, ''))) < 2 THEN
    RAISE EXCEPTION 'Business name must be at least 2 characters';
  END IF;

  IF length(trim(coalesce(business_address_input, ''))) < 10
     OR trim(business_address_input) !~ '[0-9]{6}$' THEN
    RAISE EXCEPTION 'Enter a complete business address with a 6-digit PIN code';
  END IF;

  IF length(trim(coalesce(business_type_input, ''))) < 2 THEN
    RAISE EXCEPTION 'Business category and structure are required';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.submit_seller_application_unvalidated(
    business_name_input,
    business_address_input,
    business_type_input,
    gst_number_input
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_seller_application(text, text, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_seller_application(text, text, text, text)
TO authenticated;
