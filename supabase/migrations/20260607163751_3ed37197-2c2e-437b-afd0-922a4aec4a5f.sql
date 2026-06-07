
CREATE TABLE public.escrow_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.contract_milestones(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('funded','released','refunded','commission_held')),
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.escrow_ledger TO authenticated;
GRANT ALL ON public.escrow_ledger TO service_role;
ALTER TABLE public.escrow_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY el_select_parties ON public.escrow_ledger FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = escrow_ledger.contract_id
      AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid()
           OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  ));
CREATE POLICY el_insert_system ON public.escrow_ledger FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = escrow_ledger.contract_id
      AND (c.founder_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ));
CREATE INDEX idx_el_contract ON public.escrow_ledger(contract_id);
CREATE INDEX idx_el_milestone ON public.escrow_ledger(milestone_id);

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS escrow_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escrow_provider text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS escrow_funded_at timestamptz,
  ADD COLUMN IF NOT EXISTS escrow_transaction_ref text;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ps_select_all ON public.platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY ps_admin_write ON public.platform_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
INSERT INTO public.platform_settings (key, value) VALUES ('commission_rate', '0.15')
  ON CONFLICT (key) DO NOTHING;

COMMENT ON COLUMN public.contract_milestones.status IS
  'in_progress|submitted|revision_requested|approved|awaiting_release|escrow_released|fully_settled|dispute|cancelled';

CREATE OR REPLACE FUNCTION public.fund_escrow(
  _contract_id uuid,
  _amount numeric,
  _transaction_ref text,
  _screenshot_url text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD;
  ledger_id uuid;
BEGIN
  SELECT * INTO c FROM public.contracts WHERE id = _contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF auth.uid() <> c.founder_id THEN RAISE EXCEPTION 'Only the founder can fund escrow'; END IF;
  IF c.escrow_funded THEN RAISE EXCEPTION 'Escrow already funded'; END IF;

  UPDATE public.contracts SET
    escrow_funded = true,
    escrow_balance = _amount,
    escrow_funded_at = now(),
    escrow_transaction_ref = _transaction_ref,
    status = CASE
      WHEN (
        EXISTS(SELECT 1 FROM public.contract_signatures WHERE contract_id=_contract_id AND role='founder') AND
        EXISTS(SELECT 1 FROM public.contract_signatures WHERE contract_id=_contract_id AND role='builder')
      ) THEN 'contract_active'
      ELSE c.status
    END
  WHERE id = _contract_id;

  INSERT INTO public.escrow_ledger (contract_id, entry_type, amount, balance_after, notes, created_by)
  VALUES (_contract_id, 'funded', _amount, _amount, _transaction_ref, auth.uid())
  RETURNING id INTO ledger_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (c.builder_id, 'escrow_funded', 'Escrow funded',
    'The founder has deposited funds. Contract is now active.',
    '/contracts/' || _contract_id);

  RETURN ledger_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fund_escrow(uuid, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_escrow_for_milestone(
  _milestone_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m RECORD;
  c RECORD;
  rate numeric;
  commission numeric;
  net_amount numeric;
  ledger_id uuid;
  inv_no text;
  pr_id uuid;
  inv_id uuid;
BEGIN
  SELECT * INTO m FROM public.contract_milestones WHERE id = _milestone_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  SELECT * INTO c FROM public.contracts WHERE id = m.contract_id;
  IF auth.uid() <> c.founder_id THEN RAISE EXCEPTION 'Only the founder can release escrow'; END IF;
  IF m.status <> 'approved' THEN RAISE EXCEPTION 'Milestone must be approved first'; END IF;
  IF c.escrow_balance < m.amount THEN RAISE EXCEPTION 'Insufficient escrow balance'; END IF;

  SELECT COALESCE(value::numeric, 0.15) INTO rate
  FROM public.platform_settings WHERE key = 'commission_rate' LIMIT 1;
  IF rate IS NULL THEN rate := 0.15; END IF;

  commission := ROUND(m.amount * rate, 2);
  net_amount := m.amount - commission;

  UPDATE public.contracts SET escrow_balance = escrow_balance - m.amount WHERE id = c.id;

  INSERT INTO public.escrow_ledger (contract_id, milestone_id, entry_type, amount, balance_after, notes, created_by)
  VALUES (c.id, _milestone_id, 'released', m.amount,
    (SELECT escrow_balance FROM public.contracts WHERE id = c.id),
    'Milestone: ' || m.title, auth.uid())
  RETURNING id INTO ledger_id;

  INSERT INTO public.payment_records (
    milestone_id, contract_id, startup_id, builder_id,
    declared_amount, confirmed_amount, payment_method,
    transaction_ref, status, confirmed_at, declared_at
  ) VALUES (
    _milestone_id, c.id, c.founder_id, c.builder_id,
    m.amount, m.amount, 'escrow',
    'ESCROW-' || _milestone_id::text, 'confirmed', now(), now()
  ) RETURNING id INTO pr_id;

  inv_no := 'INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('commission_invoice_seq')::text, 4, '0');
  INSERT INTO public.commission_invoices (
    payment_record_id, invoice_number, base_amount, commission_rate,
    commission_amount, due_date, status
  ) VALUES (pr_id, inv_no, m.amount, rate, commission, (CURRENT_DATE + 7), 'generated')
  RETURNING id INTO inv_id;

  UPDATE public.contract_milestones SET status = 'escrow_released', updated_at = now() WHERE id = _milestone_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (c.builder_id, 'escrow_released',
    'Payment released from escrow',
    'Milestone "' || m.title || '" approved. ₹' || net_amount || ' being transferred.',
    '/workspace/' || c.id);

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (c.founder_id, 'commission_invoice',
    'Commission invoice ' || inv_no,
    'Platform fee of ₹' || commission || ' due in 7 days.',
    '/workspace/' || c.id);

  RETURN ledger_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.release_escrow_for_milestone(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_escrow_summary(_contract_id uuid)
RETURNS TABLE (
  total_funded numeric,
  total_released numeric,
  current_balance numeric,
  milestone_count int,
  released_count int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.contracts c WHERE c.id = _contract_id
      AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid()
           OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN el.entry_type='funded' THEN el.amount END), 0),
    COALESCE(SUM(CASE WHEN el.entry_type='released' THEN el.amount END), 0),
    COALESCE((SELECT escrow_balance FROM public.contracts WHERE id = _contract_id), 0),
    (SELECT COUNT(*)::int FROM public.contract_milestones WHERE contract_id = _contract_id AND status <> 'cancelled'),
    (SELECT COUNT(*)::int FROM public.contract_milestones WHERE contract_id = _contract_id AND status IN ('escrow_released','fully_settled'))
  FROM public.escrow_ledger el
  WHERE el.contract_id = _contract_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_escrow_summary(uuid) TO authenticated;
