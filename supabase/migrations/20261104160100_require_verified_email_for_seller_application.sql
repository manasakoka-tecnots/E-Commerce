ALTER FUNCTION public.submit_seller_application(text, text, text)
RENAME TO submit_seller_application_after_email_check;

REVOKE ALL
ON FUNCTION public.submit_seller_application_after_email_check(text, text, text)
FROM PUBLIC, anon, authenticated;

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
  current_email_confirmed_at timestamptz;
BEGIN
  SELECT email_confirmed_at
  INTO current_email_confirmed_at
  FROM auth.users
  WHERE id = auth.uid();

  IF current_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Verify your email address before applying as a seller';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.submit_seller_application_after_email_check(
    business_name_input,
    business_address_input,
    business_type_input
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_seller_application(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_seller_application(text, text, text) TO authenticated;
