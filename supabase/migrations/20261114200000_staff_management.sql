-- ============================================================
-- Staff Management System for Multi-Location Access Control
-- ============================================================

-- 1. seller_staff: Staff members linked to a seller
CREATE TABLE IF NOT EXISTS seller_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'associate' CHECK (role IN ('admin', 'manager', 'associate')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'inactive', 'removed')),
  pin_code text, -- 4-6 digit PIN for quick POS login
  invited_at timestamptz DEFAULT now(),
  activated_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_seller_staff_seller ON seller_staff(seller_id);
CREATE INDEX idx_seller_staff_email ON seller_staff(email);
CREATE INDEX idx_seller_staff_profile ON seller_staff(profile_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX idx_seller_staff_unique_email ON seller_staff(seller_id, email) WHERE status != 'removed';

-- 2. staff_location_assignments: Which locations a staff member can access
CREATE TABLE IF NOT EXISTS staff_location_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES seller_staff(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES seller_locations(id) ON DELETE CASCADE,
  permissions text[] NOT NULL DEFAULT ARRAY['inventory_view', 'orders_view'],
  created_at timestamptz DEFAULT now(),
  UNIQUE(staff_id, location_id)
);

CREATE INDEX idx_staff_location_staff ON staff_location_assignments(staff_id);
CREATE INDEX idx_staff_location_location ON staff_location_assignments(location_id);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON seller_staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON staff_location_assignments TO authenticated;
GRANT SELECT ON seller_staff TO anon;
GRANT SELECT ON staff_location_assignments TO anon;

-- 4. RLS
ALTER TABLE seller_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_location_assignments ENABLE ROW LEVEL SECURITY;

-- seller_staff policies
CREATE POLICY "sellers_manage_own_staff"
  ON seller_staff FOR ALL
  USING (seller_id = get_current_seller_id())
  WITH CHECK (seller_id = get_current_seller_id());

CREATE POLICY "staff_read_own_record"
  ON seller_staff FOR SELECT
  USING (profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1));

CREATE POLICY "admins_manage_all_staff"
  ON seller_staff FOR ALL
  USING (is_marketplace_admin())
  WITH CHECK (is_marketplace_admin());

-- staff_location_assignments policies
CREATE POLICY "sellers_manage_own_staff_locations"
  ON staff_location_assignments FOR ALL
  USING (
    staff_id IN (SELECT id FROM seller_staff WHERE seller_id = get_current_seller_id())
  )
  WITH CHECK (
    staff_id IN (SELECT id FROM seller_staff WHERE seller_id = get_current_seller_id())
  );

CREATE POLICY "staff_read_own_assignments"
  ON staff_location_assignments FOR SELECT
  USING (
    staff_id IN (
      SELECT id FROM seller_staff
      WHERE profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "admins_manage_all_staff_locations"
  ON staff_location_assignments FOR ALL
  USING (is_marketplace_admin())
  WITH CHECK (is_marketplace_admin());

-- 5. Helper function: Get current staff member's assigned location IDs
CREATE OR REPLACE FUNCTION get_staff_location_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    array_agg(sla.location_id),
    ARRAY[]::uuid[]
  )
  FROM staff_location_assignments sla
  JOIN seller_staff ss ON ss.id = sla.staff_id
  WHERE ss.profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
    AND ss.status = 'active';
$$;

-- 6. Helper function: Check if current user is staff with a specific permission at a location
CREATE OR REPLACE FUNCTION staff_has_permission(p_location_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff_location_assignments sla
    JOIN seller_staff ss ON ss.id = sla.staff_id
    WHERE ss.profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
      AND ss.status = 'active'
      AND sla.location_id = p_location_id
      AND p_permission = ANY(sla.permissions)
  );
$$;

-- 7. Helper: Check if current user is a staff member (not the seller owner)
CREATE OR REPLACE FUNCTION is_staff_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM seller_staff
    WHERE profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
      AND status = 'active'
  );
$$;

-- 8. Helper: Get seller_id for current staff member
CREATE OR REPLACE FUNCTION get_staff_seller_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT seller_id FROM seller_staff
  WHERE profile_id = (SELECT id FROM profiles WHERE auth_uid = auth.uid() LIMIT 1)
    AND status = 'active'
  LIMIT 1;
$$;

-- 9. Grant execute on functions
GRANT EXECUTE ON FUNCTION get_staff_location_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION staff_has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_staff_member() TO authenticated;
GRANT EXECUTE ON FUNCTION get_staff_seller_id() TO authenticated;
