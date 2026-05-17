
-- Fix: super_admin should have full admin access on commission/payment/dispute tables.
-- Existing RLS only checked the 'admin' role, so a super_admin sees an empty
-- AdminCommissions queue and cannot verify commission payments.

DROP POLICY IF EXISTS cp_select_parties ON public.commission_payments;
CREATE POLICY cp_select_parties ON public.commission_payments
FOR SELECT USING (
  startup_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.commission_invoices ci
    JOIN public.payment_records pr ON pr.id = ci.payment_record_id
    WHERE ci.id = commission_payments.invoice_id AND pr.builder_id = auth.uid()
  )
);

DROP POLICY IF EXISTS cp_update_admin ON public.commission_payments;
CREATE POLICY cp_update_admin ON public.commission_payments
FOR UPDATE USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
);

DROP POLICY IF EXISTS ci_select_parties ON public.commission_invoices;
CREATE POLICY ci_select_parties ON public.commission_invoices
FOR SELECT USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.payment_records pr
    WHERE pr.id = commission_invoices.payment_record_id
      AND (pr.startup_id = auth.uid() OR pr.builder_id = auth.uid())
  )
);

DROP POLICY IF EXISTS ci_update_admin ON public.commission_invoices;
CREATE POLICY ci_update_admin ON public.commission_invoices
FOR UPDATE USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
);

DROP POLICY IF EXISTS pr_select_parties ON public.payment_records;
CREATE POLICY pr_select_parties ON public.payment_records
FOR SELECT USING (
  startup_id = auth.uid() OR builder_id = auth.uid()
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
);

DROP POLICY IF EXISTS pr_update_parties ON public.payment_records;
CREATE POLICY pr_update_parties ON public.payment_records
FOR UPDATE USING (
  startup_id = auth.uid() OR builder_id = auth.uid()
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
);

DROP POLICY IF EXISTS disp_select ON public.disputes;
CREATE POLICY disp_select ON public.disputes
FOR SELECT USING (
  raised_by = auth.uid()
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = disputes.contract_id
      AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
  )
);

DROP POLICY IF EXISTS disp_update_admin ON public.disputes;
CREATE POLICY disp_update_admin ON public.disputes
FOR UPDATE USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
);
