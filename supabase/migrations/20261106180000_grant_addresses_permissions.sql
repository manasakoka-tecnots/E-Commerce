-- Grant table-level permissions on addresses to authenticated and anon roles.
-- Without these GRANTs, RLS policies alone are not enough — PostgreSQL denies
-- access at the table privilege level before RLS is even evaluated.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT SELECT ON public.addresses TO anon;
