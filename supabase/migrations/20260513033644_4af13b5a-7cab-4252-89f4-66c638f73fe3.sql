
-- Sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS public.commission_invoice_seq START 1;

-- payment_records
CREATE TABLE public.payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  startup_id uuid NOT NULL,
  builder_id uuid NOT NULL,
  declared_amount numeric NOT NULL,
  confirmed_amount numeric,
  payment_method text NOT NULL,
  transaction_ref text NOT NULL,
  screenshot_url text,
  notes text,
  payment_provider text,
  provider_ref text,
  status text NOT NULL DEFAULT 'declared',
  declared_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY pr_select_parties ON public.payment_records FOR SELECT TO authenticated
  USING (startup_id = auth.uid() OR builder_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY pr_insert_founder ON public.payment_records FOR INSERT TO authenticated
  WITH CHECK (startup_id = auth.uid());
CREATE POLICY pr_update_parties ON public.payment_records FOR UPDATE TO authenticated
  USING (startup_id = auth.uid() OR builder_id = auth.uid() OR has_role(auth.uid(),'admin'));

CREATE TRIGGER pr_touch BEFORE UPDATE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- commission_invoices
CREATE TABLE public.commission_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_record_id uuid NOT NULL UNIQUE,
  invoice_number text NOT NULL UNIQUE,
  base_amount numeric NOT NULL,
  commission_rate numeric NOT NULL DEFAULT 0.15,
  commission_amount numeric NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'generated',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY ci_select_parties ON public.commission_invoices FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR EXISTS (
      SELECT 1 FROM public.payment_records pr
      WHERE pr.id = commission_invoices.payment_record_id
        AND (pr.startup_id = auth.uid() OR pr.builder_id = auth.uid())
    )
  );
CREATE POLICY ci_update_admin ON public.commission_invoices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER ci_touch BEFORE UPDATE ON public.commission_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- commission_payments
CREATE TABLE public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  startup_id uuid NOT NULL,
  amount numeric NOT NULL,
  transaction_ref text NOT NULL,
  screenshot_url text,
  payment_provider text,
  provider_ref text,
  status text NOT NULL DEFAULT 'submitted',
  admin_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  verified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY cp_select_parties ON public.commission_payments FOR SELECT TO authenticated
  USING (
    startup_id = auth.uid() OR has_role(auth.uid(),'admin') OR EXISTS (
      SELECT 1 FROM public.commission_invoices ci
      JOIN public.payment_records pr ON pr.id = ci.payment_record_id
      WHERE ci.id = commission_payments.invoice_id AND pr.builder_id = auth.uid()
    )
  );
CREATE POLICY cp_insert_founder ON public.commission_payments FOR INSERT TO authenticated
  WITH CHECK (startup_id = auth.uid());
CREATE POLICY cp_update_admin ON public.commission_payments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER cp_touch BEFORE UPDATE ON public.commission_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Confirm payment + auto-generate commission invoice OR open dispute
CREATE OR REPLACE FUNCTION public.confirm_payment_record(
  _id uuid,
  _confirmed_amount numeric,
  _screenshot text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pr RECORD;
  inv_id uuid;
  inv_no text;
  commission numeric;
BEGIN
  SELECT * INTO pr FROM public.payment_records WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment record not found'; END IF;
  IF auth.uid() <> pr.builder_id THEN RAISE EXCEPTION 'Only the builder can confirm'; END IF;

  IF _confirmed_amount = pr.declared_amount THEN
    UPDATE public.payment_records
      SET confirmed_amount = _confirmed_amount,
          screenshot_url = COALESCE(_screenshot, screenshot_url),
          status = 'confirmed',
          confirmed_at = now()
      WHERE id = _id;

    commission := ROUND(pr.declared_amount * 0.15, 2);
    inv_no := 'INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('commission_invoice_seq')::text, 4, '0');

    INSERT INTO public.commission_invoices (
      payment_record_id, invoice_number, base_amount, commission_rate, commission_amount, due_date, status
    ) VALUES (
      pr.id, inv_no, pr.declared_amount, 0.15, commission, (CURRENT_DATE + 7), 'generated'
    ) RETURNING id INTO inv_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (pr.startup_id, 'commission_invoice', 'Commission invoice ' || inv_no,
      'Platform fee of ' || commission || ' due in 7 days.',
      '/contracts/' || pr.contract_id || '/workspace');

    RETURN inv_id;
  ELSE
    UPDATE public.payment_records
      SET confirmed_amount = _confirmed_amount,
          screenshot_url = COALESCE(_screenshot, screenshot_url),
          status = 'disputed',
          confirmed_at = now()
      WHERE id = _id;

    INSERT INTO public.disputes (contract_id, milestone_id, raised_by, reason, status)
    VALUES (pr.contract_id, pr.milestone_id, auth.uid(),
      'Payment mismatch: declared ' || pr.declared_amount || ' vs confirmed ' || _confirmed_amount,
      'open');

    UPDATE public.contract_milestones SET status = 'dispute' WHERE id = pr.milestone_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (pr.startup_id, 'payment_dispute', 'Payment amount disputed',
      'Builder confirmed a different amount. Admin notified.',
      '/contracts/' || pr.contract_id || '/workspace');

    RETURN NULL;
  END IF;
END;
$$;

-- Admin verifies commission payment
CREATE OR REPLACE FUNCTION public.verify_commission_payment(
  _payment_id uuid,
  _approve boolean,
  _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cp RECORD;
  ci RECORD;
  pr RECORD;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO cp FROM public.commission_payments WHERE id = _payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  SELECT * INTO ci FROM public.commission_invoices WHERE id = cp.invoice_id;
  SELECT * INTO pr FROM public.payment_records WHERE id = ci.payment_record_id;

  IF _approve THEN
    UPDATE public.commission_payments SET status='admin_verified', verified_at=now(), verified_by=auth.uid(), admin_notes=_notes WHERE id=_payment_id;
    UPDATE public.commission_invoices SET status='paid' WHERE id=cp.invoice_id;
    UPDATE public.payment_records SET status='settled' WHERE id=pr.id;
    UPDATE public.contract_milestones SET status='paid' WHERE id=pr.milestone_id;

    INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
      (pr.startup_id,'commission_verified','Commission verified','Milestone fully settled.','/contracts/'||pr.contract_id||'/workspace'),
      (pr.builder_id,'commission_verified','Milestone fully settled','Platform commission verified by admin.','/contracts/'||pr.contract_id||'/workspace');
  ELSE
    UPDATE public.commission_payments SET status='rejected', verified_at=now(), verified_by=auth.uid(), admin_notes=_notes WHERE id=_payment_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (cp.startup_id,'commission_rejected','Commission payment rejected', COALESCE(_notes,'Please resubmit.'),'/contracts/'||pr.contract_id||'/workspace');
  END IF;
END;
$$;

-- Storage bucket for proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs','payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "payment_proofs_select_authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs');
CREATE POLICY "payment_proofs_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
