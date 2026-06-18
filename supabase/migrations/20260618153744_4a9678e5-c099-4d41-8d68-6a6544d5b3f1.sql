-- Remove direct INSERT on notifications; force usage of send_notification RPC
DROP POLICY IF EXISTS notif_insert_self ON public.notifications;

-- Restrict payment_records UPDATE policy to authenticated role only
DROP POLICY IF EXISTS pr_update_startup_admin ON public.payment_records;
CREATE POLICY pr_update_startup_admin ON public.payment_records
  FOR UPDATE TO authenticated
  USING (startup_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (startup_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));