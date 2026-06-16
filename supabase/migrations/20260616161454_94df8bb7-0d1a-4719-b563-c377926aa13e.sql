
-- 1. Hide builder phone column from non-owners (owner reads via get_my_builder_phone RPC)
REVOKE SELECT (phone) ON public.builder_profiles FROM anon, authenticated;

-- 2. Restrict payment_records UPDATE to startup + admin only (builder confirms via SECURITY DEFINER RPC)
DROP POLICY IF EXISTS pr_update_parties ON public.payment_records;
CREATE POLICY pr_update_startup_admin ON public.payment_records
  FOR UPDATE
  USING (startup_id = auth.uid()
         OR public.has_role(auth.uid(),'admin')
         OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (startup_id = auth.uid()
              OR public.has_role(auth.uid(),'admin')
              OR public.has_role(auth.uid(),'super_admin'));

-- 3. Remove startup self-update on placement_fees; admins manage status/amount/verification
DROP POLICY IF EXISTS "Startup updates own placement fees" ON public.placement_fees;
