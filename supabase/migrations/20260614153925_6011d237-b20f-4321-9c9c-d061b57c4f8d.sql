
-- 1) payment_methods: remove admin direct SELECT (admins go through admin_get_user_full which masks)
DROP POLICY IF EXISTS pm_select_own_or_admin ON public.payment_methods;
CREATE POLICY pm_select_own ON public.payment_methods
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pm_update_own_or_admin ON public.payment_methods;
CREATE POLICY pm_update_own ON public.payment_methods
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2) Storage policy: exact resume_url match instead of LIKE
DROP POLICY IF EXISTS "Builders read own resumes" ON storage.objects;
CREATE POLICY "Builders read own resumes" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.resume_applications ra
        JOIN public.projects p ON p.id = ra.project_id
        WHERE ra.resume_url = objects.name
          AND p.founder_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- 3) Enforce one role per user (prevent race-based privilege escalation)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_unique;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- 4) Revoke EXECUTE from anon/public on SECURITY DEFINER functions; keep authenticated where needed
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;',
      r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;',
      r.nspname, r.proname, r.args);
  END LOOP;
END $$;
