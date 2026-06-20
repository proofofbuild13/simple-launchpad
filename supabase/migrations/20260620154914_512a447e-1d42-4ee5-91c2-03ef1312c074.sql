
-- 1) Hide builder_profiles.phone from all authenticated users; only owner + admins
REVOKE SELECT (phone) ON public.builder_profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_builder_phone()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone FROM public.builder_profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_builder_phone() TO authenticated;

-- 2) Explicit admin-only INSERT policy for commission_invoices
DROP POLICY IF EXISTS ci_insert_admin ON public.commission_invoices;
CREATE POLICY ci_insert_admin ON public.commission_invoices
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS ci_delete_admin ON public.commission_invoices;
CREATE POLICY ci_delete_admin ON public.commission_invoices
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 3) Explicit admin-only INSERT/UPDATE/DELETE for escrow_ledger
DROP POLICY IF EXISTS el_insert_admin ON public.escrow_ledger;
CREATE POLICY el_insert_admin ON public.escrow_ledger
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS el_update_admin ON public.escrow_ledger;
CREATE POLICY el_update_admin ON public.escrow_ledger
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS el_delete_admin ON public.escrow_ledger;
CREATE POLICY el_delete_admin ON public.escrow_ledger
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 4) Explicit admin DELETE policy for payments
DROP POLICY IF EXISTS pay_delete_admin ON public.payments;
CREATE POLICY pay_delete_admin ON public.payments
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
