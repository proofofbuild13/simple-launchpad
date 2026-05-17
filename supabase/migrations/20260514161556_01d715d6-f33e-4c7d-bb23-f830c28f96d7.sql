
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY aal_select_admin ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY aal_insert_self ON public.admin_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_aal_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aal_actor ON public.admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_aal_entity ON public.admin_audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.user_status (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'active',
  reason text,
  flagged_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY us_select_own_or_admin ON public.user_status
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY us_admin_all ON public.user_status
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
  r text;
BEGIN
  SELECT role::text INTO r FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(), r, _action, _entity_type, _entity_id, COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO log_id;
  RETURN log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_any_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE role = 'admin'::app_role OR role = 'super_admin'::app_role
  ) INTO has_any_admin;
  IF has_any_admin THEN
    RETURN false;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = auth.uid();
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'super_admin'::app_role);
  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'admin_bootstrap', 'user_roles', auth.uid(), '{}'::jsonb);
  RETURN true;
END;
$$;
