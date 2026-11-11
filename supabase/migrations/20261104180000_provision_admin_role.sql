-- Automatically assign the 'admin' role to designated administrator emails
CREATE OR REPLACE FUNCTION public.handle_admin_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF lower(NEW.email) IN (
    'admin@shopora.com',
    'admin@example.com',
    'admin@marketplace.com',
    'koka.manasa@tecnots.com'
  ) OR lower(NEW.email) LIKE 'admin@%' THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_promote_admin ON public.profiles;
CREATE TRIGGER trigger_promote_admin
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_promotion();

-- Promote any existing profile matching administrator emails
UPDATE public.profiles
SET role = 'admin'
WHERE lower(email) IN (
  'admin@shopora.com',
  'admin@example.com',
  'admin@marketplace.com',
  'koka.manasa@tecnots.com'
) OR lower(email) LIKE 'admin@%';
