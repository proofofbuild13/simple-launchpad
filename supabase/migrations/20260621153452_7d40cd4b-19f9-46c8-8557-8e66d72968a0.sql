
-- ============================================================
-- Platform security hardening — audit fixes
-- ============================================================

-- 1. builder_profiles.phone — re-assert column-level revoke
REVOKE SELECT (phone) ON public.builder_profiles FROM anon, authenticated, PUBLIC;

-- 2. payments — add admin read policy (for dispute resolution)
DROP POLICY IF EXISTS pay_select_admin ON public.payments;
CREATE POLICY pay_select_admin ON public.payments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- 3. platform_settings — restrict to commission_rate publicly, admins see all
DROP POLICY IF EXISTS ps_select_all ON public.platform_settings;
DROP POLICY IF EXISTS ps_select_admin ON public.platform_settings;
DROP POLICY IF EXISTS ps_select_public_keys ON public.platform_settings;

CREATE POLICY ps_select_admin ON public.platform_settings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

CREATE POLICY ps_select_public_keys ON public.platform_settings
  FOR SELECT TO authenticated
  USING (key IN ('commission_rate'));

-- 4. SECURITY DEFINER hardening — revoke EXECUTE from public/authenticated
--    on internal trigger + helper functions that should never be called via RPC.

REVOKE EXECUTE ON FUNCTION public.on_new_message()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_single_default_pm()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_payment_method_change()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_employment_offer_accepted()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mask_account(text)                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid)                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_any_role(uuid)                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.any_admin_exists()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)                  FROM PUBLIC, anon, authenticated;

-- 5. SECURITY DEFINER — explicit GRANT EXECUTE for user-callable + admin RPCs
GRANT EXECUTE ON FUNCTION public.fund_escrow(uuid, numeric, text, text)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_escrow_for_milestone(uuid)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.raise_dispute(uuid, text)                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment_record(uuid, numeric, text)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_contract_from_offer(uuid)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_builder_default_payment(uuid)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.builder_payment_status(uuid)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_escrow_summary(uuid)                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_builder_phone()                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_builder_phone(text)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin()                                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_delete_project(uuid)                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_commission_invoice(uuid, text, text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_commission_payment(uuid, boolean, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_escrow(uuid, uuid, text)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, jsonb)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid)                                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text, text, boolean)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_full(uuid)                                TO authenticated;
