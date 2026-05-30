
-- 1) admin_audit_logs: only allow inserts where actor_id = auth.uid()
DROP POLICY IF EXISTS aal_insert_self ON public.admin_audit_logs;
CREATE POLICY aal_insert_self ON public.admin_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- 2) user_roles: prevent self privilege escalation / re-grant after revoke
CREATE OR REPLACE FUNCTION public.user_has_any_role(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid)
$$;

DROP POLICY IF EXISTS roles_insert_self_once ON public.user_roles;
CREATE POLICY roles_insert_self_once ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = ANY (ARRAY['startup'::app_role, 'builder'::app_role])
    AND NOT public.user_has_any_role(auth.uid())
  );

-- 3) builder_profiles: hide phone from non-owners via column-level grants
REVOKE SELECT (phone) ON public.builder_profiles FROM anon, authenticated;
GRANT SELECT (phone) ON public.builder_profiles TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_builder_phone()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone FROM public.builder_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.set_my_builder_phone(_phone text)
RETURNS void
LANGUAGE sql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.builder_profiles SET phone = _phone, updated_at = now() WHERE id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_builder_phone() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_my_builder_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_builder_phone() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_builder_phone(text) TO authenticated;

-- 4) message-attachments: allow conversation participants to read
CREATE POLICY ma_read_conversation_member ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND public.is_conversation_participant(
      NULLIF((storage.foldername(name))[2], '')::uuid,
      auth.uid()
    )
  );

-- 5) payment-proofs: restrict reads to uploader or admins
DROP POLICY IF EXISTS payment_proofs_select_authenticated ON storage.objects;
CREATE POLICY payment_proofs_select_own_or_admin ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- 6) Function search_path hardening
CREATE OR REPLACE FUNCTION public.mask_account(_acc text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN _acc IS NULL OR length(_acc) <= 4 THEN _acc
    ELSE repeat('•', greatest(length(_acc)-4,0)) || right(_acc,4) END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_single_default_pm()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.payment_methods SET is_default = false
    WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END; $$;

-- 7) Revoke EXECUTE from anon on SECURITY DEFINER functions that should only run for signed-in users
REVOKE EXECUTE ON FUNCTION public.bootstrap_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_payment_record(uuid, numeric, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_commission_payment(uuid, boolean, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_contract_from_offer(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_builder_default_payment(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_delete_project(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_any_role(uuid) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.bootstrap_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment_record(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_commission_payment(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_contract_from_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_builder_default_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_delete_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_any_role(uuid) TO authenticated;
