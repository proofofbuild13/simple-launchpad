
-- 1. Builder phone: revoke column-level SELECT so it's only accessible via SECURITY DEFINER funcs
REVOKE SELECT (phone) ON public.builder_profiles FROM authenticated, anon, PUBLIC;

-- 2. Restrict policies from public -> authenticated by recreating them

-- commission_invoices
DROP POLICY IF EXISTS ci_select_parties ON public.commission_invoices;
CREATE POLICY ci_select_parties ON public.commission_invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.payment_records pr
            WHERE pr.id = commission_invoices.payment_record_id
              AND (pr.startup_id = auth.uid() OR pr.builder_id = auth.uid()))
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
  );

DROP POLICY IF EXISTS ci_update_admin ON public.commission_invoices;
CREATE POLICY ci_update_admin ON public.commission_invoices
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- commission_payments
DROP POLICY IF EXISTS cp_select_parties ON public.commission_payments;
CREATE POLICY cp_select_parties ON public.commission_payments
  FOR SELECT TO authenticated
  USING (
    startup_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
  );

DROP POLICY IF EXISTS cp_update_admin ON public.commission_payments;
CREATE POLICY cp_update_admin ON public.commission_payments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- disputes
DROP POLICY IF EXISTS disp_select ON public.disputes;
CREATE POLICY disp_select ON public.disputes
  FOR SELECT TO authenticated
  USING (
    raised_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = disputes.contract_id
               AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid()))
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
  );

DROP POLICY IF EXISTS disp_update_admin ON public.disputes;
CREATE POLICY disp_update_admin ON public.disputes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- employment_offers
DROP POLICY IF EXISTS "Admin reads all employment offers" ON public.employment_offers;
CREATE POLICY "Admin reads all employment offers" ON public.employment_offers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Builder sees own employment offers" ON public.employment_offers;
CREATE POLICY "Builder sees own employment offers" ON public.employment_offers
  FOR SELECT TO authenticated
  USING (builder_id = auth.uid());

DROP POLICY IF EXISTS "Builder responds to own employment offers" ON public.employment_offers;
CREATE POLICY "Builder responds to own employment offers" ON public.employment_offers
  FOR UPDATE TO authenticated
  USING (builder_id = auth.uid())
  WITH CHECK (builder_id = auth.uid());

DROP POLICY IF EXISTS "Startup creates employment offers" ON public.employment_offers;
CREATE POLICY "Startup creates employment offers" ON public.employment_offers
  FOR INSERT TO authenticated
  WITH CHECK (startup_id = auth.uid());

DROP POLICY IF EXISTS "Startup sees own employment offers" ON public.employment_offers;
CREATE POLICY "Startup sees own employment offers" ON public.employment_offers
  FOR SELECT TO authenticated
  USING (startup_id = auth.uid());

DROP POLICY IF EXISTS "Startup updates own employment offers" ON public.employment_offers;
CREATE POLICY "Startup updates own employment offers" ON public.employment_offers
  FOR UPDATE TO authenticated
  USING (startup_id = auth.uid())
  WITH CHECK (startup_id = auth.uid());

-- payment_records
DROP POLICY IF EXISTS pr_select_parties ON public.payment_records;
CREATE POLICY pr_select_parties ON public.payment_records
  FOR SELECT TO authenticated
  USING (
    startup_id = auth.uid() OR builder_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
  );

DROP POLICY IF EXISTS pr_update_parties ON public.payment_records;
CREATE POLICY pr_update_parties ON public.payment_records
  FOR UPDATE TO authenticated
  USING (
    startup_id = auth.uid() OR builder_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
  )
  WITH CHECK (
    startup_id = auth.uid() OR builder_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
  );

-- placement_fees
DROP POLICY IF EXISTS "Admin manages placement fees" ON public.placement_fees;
CREATE POLICY "Admin manages placement fees" ON public.placement_fees
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Builder sees own placement fees" ON public.placement_fees;
CREATE POLICY "Builder sees own placement fees" ON public.placement_fees
  FOR SELECT TO authenticated
  USING (builder_id = auth.uid());

DROP POLICY IF EXISTS "Startup sees own placement fees" ON public.placement_fees;
CREATE POLICY "Startup sees own placement fees" ON public.placement_fees
  FOR SELECT TO authenticated
  USING (startup_id = auth.uid());

DROP POLICY IF EXISTS "Startup updates own placement fees" ON public.placement_fees;
CREATE POLICY "Startup updates own placement fees" ON public.placement_fees
  FOR UPDATE TO authenticated
  USING (startup_id = auth.uid())
  WITH CHECK (startup_id = auth.uid());

-- project_invitations
DROP POLICY IF EXISTS "Builders can update invitation status" ON public.project_invitations;
CREATE POLICY "Builders can update invitation status" ON public.project_invitations
  FOR UPDATE TO authenticated
  USING (builder_id = auth.uid())
  WITH CHECK (builder_id = auth.uid());

DROP POLICY IF EXISTS "Founders can create invitations" ON public.project_invitations;
CREATE POLICY "Founders can create invitations" ON public.project_invitations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_invitations.project_id AND p.founder_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their own invitations" ON public.project_invitations;
CREATE POLICY "Users can view their own invitations" ON public.project_invitations
  FOR SELECT TO authenticated
  USING (
    builder_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_invitations.project_id AND p.founder_id = auth.uid())
  );

-- 3. Realtime: enable RLS on realtime.messages with authenticated-only access for broadcast/presence
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
