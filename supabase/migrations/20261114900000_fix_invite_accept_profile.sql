-- Fix accept_staff_invite: auto-create profile if it doesn't exist
-- Root cause: regular signups don't create profiles rows, only seller registration does.
-- When a new user accepts a staff invite, we need to create their profile automatically.

CREATE OR REPLACE FUNCTION public.accept_staff_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff seller_staff%ROWTYPE;
  v_profile_id uuid;
  v_existing_staff_id uuid;
  v_auth_uid uuid;
  v_auth_email text;
BEGIN
  v_auth_uid := auth.uid();

  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'You must be logged in to accept this invite. Please sign in first.');
  END IF;

  -- Lock the row to prevent TOCTOU race (two users accepting same token)
  SELECT * INTO v_staff
  FROM seller_staff
  WHERE invite_token = p_token
    AND status = 'invited'
  FOR UPDATE;

  IF v_staff.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired invite link.');
  END IF;

  IF v_staff.invite_expires_at IS NOT NULL AND v_staff.invite_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'This invite link has expired. Please ask the store owner to resend the invite.');
  END IF;

  -- Find existing profile
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE auth_uid = v_auth_uid;

  -- Auto-create profile if it doesn't exist (new users who signed up but never visited the app)
  IF v_profile_id IS NULL THEN
    -- Get email from auth.users
    SELECT email INTO v_auth_email
    FROM auth.users
    WHERE id = v_auth_uid;

    INSERT INTO profiles (auth_uid, email, full_name, role)
    VALUES (v_auth_uid, v_auth_email, v_staff.name, 'customer')
    RETURNING id INTO v_profile_id;
  END IF;

  -- Check if already a staff member of this store
  SELECT id INTO v_existing_staff_id
  FROM seller_staff
  WHERE profile_id = v_profile_id
    AND seller_id = v_staff.seller_id
    AND status = 'active'
    AND id != v_staff.id;

  IF v_existing_staff_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'You are already a staff member of this store.');
  END IF;

  -- Activate the staff member
  UPDATE seller_staff
  SET profile_id = v_profile_id,
      status = 'active',
      activated_at = now(),
      invite_token = NULL,
      invite_expires_at = NULL,
      updated_at = now()
  WHERE id = v_staff.id;

  RETURN jsonb_build_object(
    'success', true,
    'staff_id', v_staff.id,
    'seller_id', v_staff.seller_id,
    'role', v_staff.role,
    'name', v_staff.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_staff_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_staff_invite(text) TO authenticated;
