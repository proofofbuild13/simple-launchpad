CREATE OR REPLACE FUNCTION public.any_admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE role IN ('admin'::app_role, 'super_admin'::app_role)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.any_admin_exists() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.any_admin_exists() TO anon, authenticated;