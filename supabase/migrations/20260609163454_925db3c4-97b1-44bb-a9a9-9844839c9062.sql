CREATE SEQUENCE IF NOT EXISTS public.commission_invoice_seq START 1;

CREATE OR REPLACE FUNCTION public.release_escrow_for_milestone(
  _milestone_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m          RECORD;
  c          RECORD;
  rate       numeric;
  commission numeric;
  net_amount numeric;
  ledger_id  uuid;
  inv_no     text;
  pr_id      uuid;
  inv_id     uuid;
BEGIN
  SELECT * INTO m FROM public.contract_milestones WHERE id = _milestone_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  SELECT * INTO c FROM public.contracts WHERE id = m.contract_id;
  IF auth.uid() <> c.founder_id THEN
    RAISE EXCEPTION 'Only the founder can release escrow';
  END IF;
  IF m.status NOT IN ('submitted', 'approved') THEN
    RAISE EXCEPTION 'Milestone must be submitted or approved to release escrow';
  END IF;
  IF c.escrow_balance < m.amount THEN
    RAISE EXCEPTION 'Insufficient escrow balance';
  END IF;
  IF m.amount <= 0 THEN
    RAISE EXCEPTION 'Milestone amount must be greater than zero';
  END IF;

  SELECT COALESCE(value::numeric, 0.15) INTO rate
  FROM public.platform_settings WHERE key = 'commission_rate' LIMIT 1;
  IF rate IS NULL THEN rate := 0.15; END IF;

  commission := ROUND(m.amount * rate, 2);
  net_amount := m.amount - commission;

  UPDATE public.contract_milestones
  SET status = 'approved', updated_at = now()
  WHERE id = _milestone_id;

  UPDATE public.contracts
  SET escrow_balance = escrow_balance - m.amount
  WHERE id = c.id;

  INSERT INTO public.escrow_ledger (
    contract_id, milestone_id, entry_type, amount, balance_after, notes, created_by
  ) VALUES (
    c.id, _milestone_id, 'released', m.amount,
    (SELECT escrow_balance FROM public.contracts WHERE id = c.id),
    'Milestone: ' || m.title, auth.uid()
  ) RETURNING id INTO ledger_id;

  INSERT INTO public.payment_records (
    milestone_id, contract_id, startup_id, builder_id,
    declared_amount, confirmed_amount, payment_method,
    transaction_ref, status, confirmed_at, declared_at
  ) VALUES (
    _milestone_id, c.id, c.founder_id, c.builder_id,
    m.amount, m.amount, 'escrow',
    'ESCROW-' || _milestone_id::text, 'confirmed', now(), now()
  ) RETURNING id INTO pr_id;

  inv_no := 'INV-' || to_char(now(),'YYYY') || '-' ||
            lpad(nextval('commission_invoice_seq')::text, 4, '0');
  INSERT INTO public.commission_invoices (
    payment_record_id, invoice_number, base_amount, commission_rate,
    commission_amount, due_date, status
  ) VALUES (
    pr_id, inv_no, m.amount, rate, commission, (CURRENT_DATE + 7), 'generated'
  ) RETURNING id INTO inv_id;

  UPDATE public.contract_milestones
  SET status = 'escrow_released', updated_at = now()
  WHERE id = _milestone_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    c.builder_id, 'escrow_released',
    'Payment released from escrow',
    'Milestone "' || m.title || '" approved. ₹' || net_amount || ' being transferred.',
    '/workspace/' || c.id
  );

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    c.founder_id, 'commission_invoice',
    'Commission invoice ' || inv_no,
    'Platform fee of ₹' || commission || ' due in 7 days.',
    '/workspace/' || c.id
  );

  RETURN ledger_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_escrow_for_milestone(uuid) TO authenticated;

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
  IF auth.uid() <> c.founder_id THEN
    RAISE EXCEPTION 'Only the founder can fund escrow';
  END IF;
  IF c.escrow_funded THEN
    RAISE EXCEPTION 'Escrow already funded';
  END IF;
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Escrow amount must be greater than zero';
  END IF;

  UPDATE public.contracts SET
    escrow_funded = true,
    escrow_balance = _amount,
    escrow_funded_at = now(),
    escrow_transaction_ref = _transaction_ref,
    status = CASE
      WHEN (
        EXISTS(SELECT 1 FROM public.contract_signatures
               WHERE contract_id = _contract_id AND role = 'founder') AND
        EXISTS(SELECT 1 FROM public.contract_signatures
               WHERE contract_id = _contract_id AND role = 'builder')
      ) THEN 'contract_active'
      ELSE c.status
    END
  WHERE id = _contract_id;

  INSERT INTO public.escrow_ledger (
    contract_id, entry_type, amount, balance_after, notes, created_by
  ) VALUES (
    _contract_id, 'funded', _amount, _amount, _transaction_ref, auth.uid()
  ) RETURNING id INTO ledger_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    c.builder_id, 'escrow_funded', 'Escrow funded',
    'The founder has deposited funds. Contract is now active.',
    '/contracts/' || _contract_id
  );

  RETURN ledger_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fund_escrow(uuid, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_escrow(
  _contract_id uuid,
  _milestone_id uuid,
  _direction text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD;
  m RECORD;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'super_admin')
  ) THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO c FROM public.contracts WHERE id = _contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;

  IF _direction = 'release_to_builder' THEN
    IF _milestone_id IS NOT NULL THEN
      SELECT * INTO m FROM public.contract_milestones WHERE id = _milestone_id;
      UPDATE public.contracts
      SET escrow_balance = escrow_balance - m.amount
      WHERE id = _contract_id;
      INSERT INTO public.escrow_ledger (
        contract_id, milestone_id, entry_type, amount, balance_after, notes, created_by
      ) VALUES (
        _contract_id, _milestone_id, 'released', m.amount,
        (SELECT escrow_balance FROM public.contracts WHERE id = _contract_id),
        'Admin dispute resolution: released to builder', auth.uid()
      );
      UPDATE public.contract_milestones
      SET status = 'escrow_released', updated_at = now()
      WHERE id = _milestone_id;
    END IF;
  ELSIF _direction = 'refund_to_founder' THEN
    INSERT INTO public.escrow_ledger (
      contract_id, milestone_id, entry_type, amount, balance_after, notes, created_by
    ) VALUES (
      _contract_id, _milestone_id, 'refunded',
      COALESCE((SELECT amount FROM public.contract_milestones WHERE id = _milestone_id), c.escrow_balance),
      0, 'Admin dispute resolution: refunded to founder', auth.uid()
    );
    UPDATE public.contracts
    SET escrow_balance = 0, escrow_funded = false
    WHERE id = _contract_id;
  ELSE
    RAISE EXCEPTION 'direction must be release_to_builder or refund_to_founder';
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_id, actor_role, action_type, entity_type, entity_id, metadata
  ) VALUES (
    auth.uid(), 'admin', 'admin_resolve_escrow', 'contracts', _contract_id,
    jsonb_build_object(
      'direction', _direction,
      'milestone_id', _milestone_id,
      'balance_before', c.escrow_balance
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_escrow(uuid, uuid, text) TO authenticated;