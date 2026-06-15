
-- 1. Non-negative escrow balance
ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_escrow_balance_nonneg;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_escrow_balance_nonneg CHECK (escrow_balance >= 0);

-- 2. Lock down escrow_ledger inserts (only SECURITY DEFINER functions may write)
DROP POLICY IF EXISTS el_insert_system ON public.escrow_ledger;
REVOKE INSERT, UPDATE, DELETE ON public.escrow_ledger FROM authenticated, anon;
GRANT ALL ON public.escrow_ledger TO service_role;

-- 3. Prevent duplicate active commission payments per invoice
DROP INDEX IF EXISTS public.commission_payments_one_active_per_invoice;
CREATE UNIQUE INDEX commission_payments_one_active_per_invoice
  ON public.commission_payments (invoice_id)
  WHERE status <> 'rejected';

-- 4. Sequence grant
GRANT USAGE ON SEQUENCE public.commission_invoice_seq TO authenticated, service_role;

-- 5. Harden fund_escrow: require full amount, lock contract row
CREATE OR REPLACE FUNCTION public.fund_escrow(_contract_id uuid, _amount numeric, _transaction_ref text, _screenshot_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
  ledger_id uuid;
BEGIN
  -- Row-lock the contract for the duration of the txn
  SELECT * INTO c FROM public.contracts WHERE id = _contract_id FOR UPDATE;
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
  IF c.escrow_amount IS NOT NULL AND _amount < c.escrow_amount THEN
    RAISE EXCEPTION 'Escrow deposit (%) is less than the contract amount (%)', _amount, c.escrow_amount;
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
$function$;

-- 6. release_escrow_for_milestone: lock contract row, require approved status
CREATE OR REPLACE FUNCTION public.release_escrow_for_milestone(_milestone_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Row-lock the contract to prevent concurrent releases racing the balance check
  SELECT * INTO c FROM public.contracts WHERE id = m.contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF auth.uid() <> c.founder_id THEN
    RAISE EXCEPTION 'Only the founder can release escrow';
  END IF;
  IF m.status <> 'approved' THEN
    RAISE EXCEPTION 'Milestone must be approved before escrow can be released (current status: %)', m.status;
  END IF;
  IF m.amount <= 0 THEN
    RAISE EXCEPTION 'Milestone amount must be greater than zero';
  END IF;
  IF c.escrow_balance < m.amount THEN
    RAISE EXCEPTION 'Insufficient escrow balance (balance: %, milestone: %)', c.escrow_balance, m.amount;
  END IF;

  SELECT COALESCE(value::numeric, 0.15) INTO rate
  FROM public.platform_settings WHERE key = 'commission_rate' LIMIT 1;
  IF rate IS NULL THEN rate := 0.15; END IF;

  commission := ROUND(m.amount * rate, 2);
  net_amount := m.amount - commission;

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
    'Milestone "' || m.title || '" approved. ' || net_amount || ' being transferred.',
    '/workspace/' || c.id
  );

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    c.founder_id, 'commission_invoice',
    'Commission invoice ' || inv_no,
    'Platform fee of ' || commission || ' due in 7 days.',
    '/workspace/' || c.id
  );

  RETURN ledger_id;
END;
$function$;

-- 7. confirm_payment_record: read rate from settings, reject escrow PRs
CREATE OR REPLACE FUNCTION public.confirm_payment_record(_id uuid, _confirmed_amount numeric, _screenshot text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pr RECORD;
  inv_id uuid;
  inv_no text;
  commission numeric;
  rate numeric;
BEGIN
  SELECT * INTO pr FROM public.payment_records WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment record not found'; END IF;
  IF auth.uid() <> pr.builder_id THEN RAISE EXCEPTION 'Only the builder can confirm'; END IF;
  IF pr.payment_method = 'escrow' THEN
    RAISE EXCEPTION 'Escrow payments are auto-confirmed and cannot be re-confirmed';
  END IF;
  IF pr.status <> 'declared' THEN
    RAISE EXCEPTION 'Payment record is not awaiting confirmation (status: %)', pr.status;
  END IF;

  SELECT COALESCE(value::numeric, 0.15) INTO rate
  FROM public.platform_settings WHERE key = 'commission_rate' LIMIT 1;
  IF rate IS NULL THEN rate := 0.15; END IF;

  IF _confirmed_amount = pr.declared_amount THEN
    UPDATE public.payment_records
      SET confirmed_amount = _confirmed_amount,
          screenshot_url = COALESCE(_screenshot, screenshot_url),
          status = 'confirmed',
          confirmed_at = now()
      WHERE id = _id;

    commission := ROUND(pr.declared_amount * rate, 2);
    inv_no := 'INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('commission_invoice_seq')::text, 4, '0');

    INSERT INTO public.commission_invoices (
      payment_record_id, invoice_number, base_amount, commission_rate, commission_amount, due_date, status
    ) VALUES (
      pr.id, inv_no, pr.declared_amount, rate, commission, (CURRENT_DATE + 7), 'generated'
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

    -- Notify admins
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT ur.user_id, 'payment_dispute_admin', 'New payment dispute',
           'A payment dispute was auto-raised on contract ' || pr.contract_id,
           '/admin/disputes'
    FROM public.user_roles ur WHERE ur.role IN ('admin','super_admin');

    RETURN NULL;
  END IF;
END;
$function$;

-- 8. admin_resolve_escrow: refund deducts only milestone amount
CREATE OR REPLACE FUNCTION public.admin_resolve_escrow(_contract_id uuid, _milestone_id uuid, _direction text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
  m RECORD;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'super_admin')
  ) THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO c FROM public.contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;

  IF _direction = 'release_to_builder' THEN
    IF _milestone_id IS NULL THEN RAISE EXCEPTION 'milestone_id required'; END IF;
    SELECT * INTO m FROM public.contract_milestones WHERE id = _milestone_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
    IF c.escrow_balance < m.amount THEN
      RAISE EXCEPTION 'Insufficient escrow balance';
    END IF;
    UPDATE public.contracts SET escrow_balance = escrow_balance - m.amount WHERE id = _contract_id;
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

  ELSIF _direction = 'refund_to_founder' THEN
    IF _milestone_id IS NULL THEN RAISE EXCEPTION 'milestone_id required'; END IF;
    SELECT * INTO m FROM public.contract_milestones WHERE id = _milestone_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
    IF c.escrow_balance < m.amount THEN
      RAISE EXCEPTION 'Insufficient escrow balance for refund';
    END IF;
    UPDATE public.contracts SET escrow_balance = escrow_balance - m.amount WHERE id = _contract_id;
    INSERT INTO public.escrow_ledger (
      contract_id, milestone_id, entry_type, amount, balance_after, notes, created_by
    ) VALUES (
      _contract_id, _milestone_id, 'refunded', m.amount,
      (SELECT escrow_balance FROM public.contracts WHERE id = _contract_id),
      'Admin dispute resolution: refunded to founder', auth.uid()
    );
    UPDATE public.contract_milestones
    SET status = 'cancelled', updated_at = now()
    WHERE id = _milestone_id;
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
$function$;

-- 9. create_contract_from_offer: builder-only acceptance
CREATE OR REPLACE FUNCTION public.create_contract_from_offer(_offer_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o RECORD;
  new_contract_id uuid;
  num_milestones int;
  per_amount numeric;
  i int;
  start_d date;
  hires_count int;
  cap int;
  new_proj_status text;
  lock_proj boolean;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id = _offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;

  IF auth.uid() <> o.builder_id THEN
    RAISE EXCEPTION 'Only the builder can accept the offer';
  END IF;

  SELECT id INTO new_contract_id FROM public.contracts WHERE offer_id = _offer_id LIMIT 1;
  IF new_contract_id IS NOT NULL THEN
    RETURN new_contract_id;
  END IF;

  UPDATE public.offers SET status = 'offer_accepted', updated_at = now() WHERE id = _offer_id;
  start_d := COALESCE(o.start_date, CURRENT_DATE);

  INSERT INTO public.contracts (
    project_id, founder_id, builder_id, offer_id,
    escrow_amount, status, start_date,
    ip_assignment, nda_included
  ) VALUES (
    o.project_id, o.founder_id, o.builder_id, o.id,
    COALESCE(o.compensation, 0), 'contract_drafted', start_d,
    true, false
  ) RETURNING id INTO new_contract_id;

  num_milestones := CASE
    WHEN o.duration ILIKE '12%' THEN 12
    WHEN o.duration ILIKE '6%'  THEN 6
    WHEN o.duration ILIKE '3%'  THEN 3
    ELSE 3
  END;
  per_amount := ROUND(COALESCE(o.compensation, 0)::numeric / num_milestones, 2);

  FOR i IN 1..num_milestones LOOP
    INSERT INTO public.contract_milestones (contract_id, title, description, amount, due_date, order_index, status)
    VALUES (
      new_contract_id, 'Milestone ' || i,
      'Auto-generated milestone ' || i || ' of ' || num_milestones,
      per_amount, (start_d + (i * 30))::date, i - 1, 'in_progress'
    );
  END LOOP;

  IF o.submission_id IS NOT NULL THEN
    UPDATE public.submissions SET status = 'hired', updated_at = now() WHERE id = o.submission_id;
  END IF;

  SELECT COUNT(*) INTO hires_count FROM public.contracts WHERE project_id = o.project_id;
  SELECT max_hires INTO cap FROM public.projects WHERE id = o.project_id;
  lock_proj := cap IS NOT NULL AND hires_count >= cap;
  new_proj_status := CASE WHEN lock_proj THEN 'hiring_in_progress' ELSE 'reviewing_submissions' END;

  UPDATE public.projects
  SET hire_locked = lock_proj,
      status = new_proj_status,
      updated_at = now()
  WHERE id = o.project_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (o.founder_id, 'contract_drafted', 'Contract drafted',
    'Contract created from accepted offer. Review milestones and sign.',
    '/contracts/' || new_contract_id);
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (o.builder_id, 'contract_drafted', 'Your contract has been drafted',
    'Open the contract workspace to review terms and milestones.',
    '/contracts/' || new_contract_id);

  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(), NULL, 'contract_created', 'contract', new_contract_id,
    jsonb_build_object('offer_id', o.id, 'project_id', o.project_id, 'builder_id', o.builder_id, 'founder_id', o.founder_id));

  RETURN new_contract_id;
END;
$function$;

-- 10. raise_dispute: atomic insert + milestone update + admin notifications
CREATE OR REPLACE FUNCTION public.raise_dispute(_milestone_id uuid, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD;
  c RECORD;
  dispute_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'Reason required'; END IF;

  SELECT * INTO m FROM public.contract_milestones WHERE id = _milestone_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  SELECT * INTO c FROM public.contracts WHERE id = m.contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF auth.uid() <> c.founder_id AND auth.uid() <> c.builder_id THEN
    RAISE EXCEPTION 'Only contract parties can raise a dispute';
  END IF;
  IF m.status = 'fully_settled' THEN
    RAISE EXCEPTION 'Milestone already fully settled';
  END IF;

  INSERT INTO public.disputes (contract_id, milestone_id, raised_by, reason, status)
  VALUES (c.id, _milestone_id, auth.uid(), _reason, 'open')
  RETURNING id INTO dispute_id;

  UPDATE public.contract_milestones SET status = 'dispute', updated_at = now() WHERE id = _milestone_id;

  -- Notify the other party
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    CASE WHEN auth.uid() = c.founder_id THEN c.builder_id ELSE c.founder_id END,
    'milestone_dispute', 'Dispute opened',
    'A dispute was opened on "' || m.title || '": ' || _reason,
    '/workspace/' || c.id
  );

  -- Notify admins
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT ur.user_id, 'dispute_opened_admin', 'New dispute opened',
         'Dispute on contract ' || c.id || ': ' || _reason,
         '/admin/disputes/' || dispute_id
  FROM public.user_roles ur WHERE ur.role IN ('admin','super_admin');

  RETURN dispute_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.raise_dispute(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raise_dispute(uuid, text) TO authenticated;

-- 11. resolve_dispute: atomic dispute resolution + escrow action
CREATE OR REPLACE FUNCTION public.resolve_dispute(_dispute_id uuid, _direction text, _resolution text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d RECORD;
  new_status text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO d FROM public.disputes WHERE id = _dispute_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;

  IF _direction NOT IN ('release_to_builder','refund_to_founder','close_no_action') THEN
    RAISE EXCEPTION 'direction must be release_to_builder, refund_to_founder, or close_no_action';
  END IF;

  IF _direction IN ('release_to_builder','refund_to_founder') THEN
    IF d.milestone_id IS NULL THEN
      RAISE EXCEPTION 'Dispute has no milestone; cannot move escrow';
    END IF;
    PERFORM public.admin_resolve_escrow(d.contract_id, d.milestone_id, _direction);
  END IF;

  new_status := CASE
    WHEN _direction = 'release_to_builder' THEN 'resolved_builder'
    WHEN _direction = 'refund_to_founder' THEN 'resolved_founder'
    ELSE 'closed'
  END;

  UPDATE public.disputes
  SET status = new_status,
      resolution = COALESCE(_resolution, resolution),
      resolved_at = now(),
      updated_at = now()
  WHERE id = _dispute_id;

  -- Notify both contract parties
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT c.founder_id, 'dispute_resolved', 'Dispute resolved',
         COALESCE(_resolution, 'Admin resolved the dispute.'),
         '/workspace/' || c.id
  FROM public.contracts c WHERE c.id = d.contract_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT c.builder_id, 'dispute_resolved', 'Dispute resolved',
         COALESCE(_resolution, 'Admin resolved the dispute.'),
         '/workspace/' || c.id
  FROM public.contracts c WHERE c.id = d.contract_id;

  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(),
    CASE WHEN public.has_role(auth.uid(),'super_admin') THEN 'super_admin' ELSE 'admin' END,
    'resolve_dispute', 'disputes', _dispute_id,
    jsonb_build_object('direction', _direction, 'resolution', _resolution));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text) TO authenticated;
