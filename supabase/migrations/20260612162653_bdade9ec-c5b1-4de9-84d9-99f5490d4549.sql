
-- 1) Restrict admin_audit_logs INSERT to admins only
DROP POLICY IF EXISTS aal_insert_self ON public.admin_audit_logs;
CREATE POLICY aal_insert_admin ON public.admin_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  );

-- 2) builder_profiles: prevent direct SELECT of phone via column-level grants
REVOKE SELECT ON public.builder_profiles FROM anon, authenticated;

GRANT SELECT (
  id, full_name, username, title, domain, location, avatar_url, banner_image, bio,
  linkedin, github, portfolio, skills, experience_level, hourly_rate, work_preference,
  open_to_full_time, available, verified, featured_projects, rating, total_projects,
  completion_rate, response_time_hours, created_at, updated_at
) ON public.builder_profiles TO anon, authenticated;
