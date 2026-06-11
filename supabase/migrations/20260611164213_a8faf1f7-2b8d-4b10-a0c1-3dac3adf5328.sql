
-- 1. admin_set_user_status
CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  _user_id uuid, _status text, _reason text DEFAULT NULL, _notify boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF _status NOT IN ('active','flagged','suspended','banned','under_review') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  INSERT INTO public.user_status (user_id, status, reason, flagged_by, updated_at)
  VALUES (_user_id, _status, _reason, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        flagged_by = EXCLUDED.flagged_by,
        updated_at = now();

  IF _notify THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (_user_id, 'account_status',
      'Account status updated: ' || _status,
      COALESCE(_reason, 'An admin updated your account status.'),
      '/settings');
  END IF;

  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(),
    CASE WHEN public.has_role(auth.uid(),'super_admin') THEN 'super_admin' ELSE 'admin' END,
    'user_status_' || _status, 'user_status', _user_id,
    jsonb_build_object('reason', _reason, 'notified', _notify));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_status(uuid,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid,text,text,boolean) TO authenticated;

-- 2. admin_set_user_role
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF _role IN ('admin','super_admin') AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Only super_admin can assign admin roles';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);

  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(),
    CASE WHEN public.has_role(auth.uid(),'super_admin') THEN 'super_admin' ELSE 'admin' END,
    'role_changed', 'user_roles', _user_id,
    jsonb_build_object('new_role', _role));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) TO authenticated;

-- 3. admin_adjust_commission_invoice
CREATE OR REPLACE FUNCTION public.admin_adjust_commission_invoice(
  _invoice_id uuid, _action text, _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv RECORD;
  pr RECORD;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF _action NOT IN ('waive','mark_paid','reopen') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  SELECT * INTO inv FROM public.commission_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  SELECT * INTO pr FROM public.payment_records WHERE id = inv.payment_record_id;

  IF _action = 'waive' THEN
    UPDATE public.commission_invoices SET status = 'waived' WHERE id = _invoice_id;
    IF pr.id IS NOT NULL THEN
      UPDATE public.payment_records SET status = 'settled' WHERE id = pr.id;
      UPDATE public.contract_milestones SET status = 'fully_settled' WHERE id = pr.milestone_id;
    END IF;
  ELSIF _action = 'mark_paid' THEN
    UPDATE public.commission_invoices SET status = 'paid' WHERE id = _invoice_id;
    IF pr.id IS NOT NULL THEN
      UPDATE public.payment_records SET status = 'settled' WHERE id = pr.id;
      UPDATE public.contract_milestones SET status = 'fully_settled' WHERE id = pr.milestone_id;
    END IF;
  ELSIF _action = 'reopen' THEN
    UPDATE public.commission_invoices SET status = 'generated' WHERE id = _invoice_id;
  END IF;

  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(),
    CASE WHEN public.has_role(auth.uid(),'super_admin') THEN 'super_admin' ELSE 'admin' END,
    'invoice_' || _action, 'commission_invoices', _invoice_id,
    jsonb_build_object('notes', _notes, 'invoice_number', inv.invoice_number));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_commission_invoice(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_commission_invoice(uuid,text,text) TO authenticated;

-- 4. Seed platform settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('commission_rate', '0.15'::jsonb),
  ('placement_fee_percent', '8.33'::jsonb),
  ('escrow_release_grace_days', '7'::jsonb)
ON CONFLICT (key) DO NOTHING;
