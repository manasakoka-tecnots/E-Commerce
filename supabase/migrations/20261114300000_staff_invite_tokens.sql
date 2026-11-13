-- ============================================================
-- Add invite token support to seller_staff
-- ============================================================

-- Add invite token columns
ALTER TABLE seller_staff
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;

-- Unique index on invite_token for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_staff_invite_token
  ON seller_staff(invite_token) WHERE invite_token IS NOT NULL;

-- Function to accept a staff invite:
-- 1. Validates token exists and hasn't expired
-- 2. Links the staff record to the current user's profile
-- 3. Marks status as 'active'
-- 4. Returns the staff record details
CREATE OR REPLACE FUNCTION accept_staff_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_staff seller_staff%ROWTYPE;
  v_profile_id uuid;
  v_existing_staff_id uuid;
BEGIN
  -- 1. Find the staff record by token
  SELECT * INTO v_staff
  FROM seller_staff
  WHERE invite_token = p_token
    AND status = 'invited';

  IF v_staff.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired invite link.');
  END IF;

  -- 2. Check expiry
  IF v_staff.invite_expires_at IS NOT NULL AND v_staff.invite_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'This invite link has expired. Please ask the store owner to resend the invite.');
  END IF;

  -- 3. Get current user's profile_id
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE auth_uid = auth.uid();

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'You must be logged in to accept this invite.');
  END IF;

  -- 4. Check if this profile is already linked to another active staff record for the same seller
  SELECT id INTO v_existing_staff_id
  FROM seller_staff
  WHERE profile_id = v_profile_id
    AND seller_id = v_staff.seller_id
    AND status = 'active'
    AND id != v_staff.id;

  IF v_existing_staff_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'You are already a staff member of this store.');
  END IF;

  -- 5. Activate the staff record
  UPDATE seller_staff
  SET profile_id = v_profile_id,
      status = 'active',
      activated_at = now(),
      invite_token = NULL,
      invite_expires_at = NULL,
      updated_at = now()
  WHERE id = v_staff.id;

  -- 6. Return success with info
  RETURN jsonb_build_object(
    'success', true,
    'staff_id', v_staff.id,
    'seller_id', v_staff.seller_id,
    'role', v_staff.role,
    'name', v_staff.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_staff_invite(text) TO authenticated;

-- Allow anon to read staff records by invite_token (for the invite accept page to show store info)
CREATE POLICY "anyone_read_by_invite_token"
  ON seller_staff FOR SELECT
  USING (invite_token IS NOT NULL AND status = 'invited');
