-- Allow reading location assignments for invited staff (needed for invite accept page)
CREATE POLICY "anyone_read_invited_staff_locations"
  ON staff_location_assignments FOR SELECT
  USING (
    staff_id IN (
      SELECT id FROM seller_staff
      WHERE invite_token IS NOT NULL AND status = 'invited'
    )
  );
