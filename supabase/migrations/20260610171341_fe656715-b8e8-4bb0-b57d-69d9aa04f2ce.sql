
-- 1) Builder phone: revoke column-level SELECT so the public bp_select_all policy
--    cannot leak phone numbers. Owners read phone via get_my_builder_phone() RPC.
REVOKE SELECT (phone) ON public.builder_profiles FROM authenticated, anon;

-- 2) Realtime: drop overly-permissive policy that let any authenticated user
--    subscribe to any channel topic. The app uses postgres_changes (gated by
--    table RLS) and does not rely on broadcast/presence here.
DROP POLICY IF EXISTS rt_authenticated_can_read_own ON realtime.messages;

-- 3) SECURITY DEFINER RPCs should not be callable by anon. All of these
--    require an authenticated user context internally.
REVOKE EXECUTE ON FUNCTION public.admin_resolve_escrow(uuid, uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.builder_payment_status(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fund_escrow(uuid, numeric, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_escrow_summary(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_escrow_for_milestone(uuid) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_resolve_escrow(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.builder_payment_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fund_escrow(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_escrow_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_escrow_for_milestone(uuid) TO authenticated;
