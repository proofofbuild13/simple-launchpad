-- Manual escrow bookkeeping: approve and record release in one transaction.
-- Commission is billed separately to the founder; the builder receives the
-- full milestone amount. These records do not initiate a bank transfer.

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS escrow_screenshot_url text;

-- A party may sign only for their own role, while the contract is being signed.
DROP POLICY IF EXISTS cs_insert_self ON public.contract_signatures;
CREATE POLICY cs_insert_self ON public.contract_signatures
FOR INSERT TO authenticated WITH CHECK (
  signed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_id
      AND c.status IN ('sent_for_signing', 'partially_signed')
      AND ((role = 'founder' AND c.founder_id = auth.uid())
        OR (role = 'builder' AND c.builder_id = auth.uid()))
  )
);

CREATE OR REPLACE FUNCTION public.tg_contract_on_signature()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD;
  has_founder boolean;
  has_builder boolean;
BEGIN
  SELECT * INTO c FROM public.contracts WHERE id = NEW.contract_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM public.contract_signatures
    WHERE contract_id = c.id AND role = 'founder' AND signed_by = c.founder_id)
    INTO has_founder;
  SELECT EXISTS (SELECT 1 FROM public.contract_signatures
    WHERE contract_id = c.id AND role = 'builder' AND signed_by = c.builder_id)
    INTO has_builder;
  IF c.status IN ('contract_drafted', 'sent_for_signing', 'partially_signed') THEN
    IF has_founder AND has_builder AND c.escrow_funded THEN
      UPDATE public.contracts SET status = 'contract_active', updated_at = now() WHERE id = c.id;
    ELSIF has_founder OR has_builder THEN
      UPDATE public.contracts SET status = 'partially_signed', updated_at = now() WHERE id = c.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Direct client updates cannot manufacture an escrow balance or rewrite the
-- parties/terms that were signed. SECURITY DEFINER workflow functions still
-- perform their own validated updates as the database owner.
CREATE OR REPLACE FUNCTION public.guard_contract_escrow_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  old_fields jsonb := to_jsonb(OLD);
  new_fields jsonb := to_jsonb(NEW);
  field_name text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM NEW.founder_id
      OR NEW.status <> 'contract_drafted' OR coalesce(NEW.escrow_funded, false)
      OR NEW.escrow_balance IS DISTINCT FROM 0::numeric
      OR NEW.escrow_funded_at IS NOT NULL OR NEW.escrow_transaction_ref IS NOT NULL
      OR NEW.escrow_screenshot_url IS NOT NULL
      OR coalesce(NEW.escrow_provider, 'manual') <> 'manual' THEN
      RAISE EXCEPTION 'New contracts must be unfunded drafts created by their founder';
    END IF;
    RETURN NEW;
  END IF;
  FOREACH field_name IN ARRAY ARRAY['id', 'founder_id', 'builder_id', 'project_id', 'offer_id',
    'escrow_balance', 'escrow_funded', 'escrow_funded_at',
    'escrow_provider', 'escrow_transaction_ref', 'escrow_screenshot_url'] LOOP
    IF old_fields -> field_name IS DISTINCT FROM new_fields -> field_name THEN
      RAISE EXCEPTION 'Contract parties and escrow fields must be changed through the escrow workflow';
    END IF;
  END LOOP;
  IF OLD.escrow_amount IS DISTINCT FROM NEW.escrow_amount AND NOT coalesce((
    auth.uid() IS NOT DISTINCT FROM OLD.founder_id AND OLD.status = 'contract_drafted'
    AND NOT coalesce(OLD.escrow_funded, false)
    AND NOT EXISTS (SELECT 1 FROM public.contract_signatures WHERE contract_id = OLD.id)
    AND NEW.escrow_amount > 0
    AND NEW.escrow_amount = (SELECT sum(amount) FROM public.contract_milestones
      WHERE contract_id = OLD.id AND status <> 'cancelled')
  ), false) THEN
    RAISE EXCEPTION 'Draft escrow amount must equal the active milestone total';
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
    auth.uid() IS NOT DISTINCT FROM OLD.founder_id AND OLD.status = 'contract_drafted' AND NEW.status = 'sent_for_signing'
  ) THEN
    RAISE EXCEPTION 'Contract status must be changed through the contract workflow';
  END IF;
  IF OLD.status <> 'contract_drafted' OR OLD.escrow_funded OR EXISTS (
    SELECT 1 FROM public.contract_signatures WHERE contract_id = OLD.id
  ) THEN
    FOREACH field_name IN ARRAY ARRAY['terms', 'currency', 'start_date', 'end_date',
      'ip_assignment', 'nda_included', 'non_compete', 'milestones', 'document_url'] LOOP
      IF old_fields -> field_name IS DISTINCT FROM new_fields -> field_name THEN
        RAISE EXCEPTION 'Signed contract terms cannot be changed';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_contract_escrow_fields ON public.contracts;
CREATE TRIGGER guard_contract_escrow_fields BEFORE INSERT OR UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.guard_contract_escrow_fields();

CREATE OR REPLACE FUNCTION public.guard_milestone_escrow_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  c RECORD;
  locked_terms boolean;
  field_name text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  SELECT * INTO c FROM public.contracts
    WHERE id = CASE WHEN TG_OP = 'INSERT' THEN NEW.contract_id ELSE OLD.contract_id END FOR UPDATE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  locked_terms := c.status <> 'contract_drafted' OR c.escrow_funded OR EXISTS (
    SELECT 1 FROM public.contract_signatures WHERE contract_id = c.id
  );
  IF TG_OP IN ('INSERT', 'DELETE') THEN
    IF locked_terms THEN RAISE EXCEPTION 'Signed contract milestones cannot be added or removed'; END IF;
    IF auth.uid() IS DISTINCT FROM c.founder_id THEN RAISE EXCEPTION 'Only the founder can edit milestones'; END IF;
    IF TG_OP = 'INSERT' AND NEW.status <> 'in_progress' THEN
      RAISE EXCEPTION 'New milestones must start in progress';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF OLD.contract_id IS DISTINCT FROM NEW.contract_id THEN
    RAISE EXCEPTION 'Milestones cannot be moved between contracts';
  END IF;
  IF OLD.id IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'Milestone identity cannot be changed'; END IF;
  FOREACH field_name IN ARRAY ARRAY['amount', 'currency', 'title', 'description', 'due_date', 'order_index'] LOOP
    IF to_jsonb(OLD) -> field_name IS DISTINCT FROM to_jsonb(NEW) -> field_name THEN
      IF locked_terms THEN RAISE EXCEPTION 'Signed milestone terms cannot be changed'; END IF;
      IF auth.uid() IS DISTINCT FROM c.founder_id THEN RAISE EXCEPTION 'Only the founder can edit milestone terms'; END IF;
    END IF;
  END LOOP;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'cancelled' AND NOT locked_terms AND auth.uid() = c.founder_id THEN
      RETURN NEW;
    END IF;
    IF c.status NOT IN ('contract_active', 'active') THEN RAISE EXCEPTION 'Contract must be active for milestone work'; END IF;
    IF NOT (
      (auth.uid() = c.builder_id AND OLD.status IN ('in_progress', 'revision_requested') AND NEW.status = 'submitted')
      OR (auth.uid() = c.founder_id AND OLD.status = 'submitted' AND NEW.status IN ('approved', 'revision_requested'))
    ) THEN
      RAISE EXCEPTION 'Milestone status must be changed through the appropriate workflow';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_milestone_escrow_fields ON public.contract_milestones;
CREATE TRIGGER guard_milestone_escrow_fields BEFORE INSERT OR UPDATE OR DELETE ON public.contract_milestones
FOR EACH ROW EXECUTE FUNCTION public.guard_milestone_escrow_fields();

-- Clients may declare a genuine direct payment, but generated escrow records
-- and confirmed financial history are written only by the workflow functions.
CREATE OR REPLACE FUNCTION public.guard_payment_record_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  c RECORD;
  m RECORD;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Payment records must be changed through the payment workflow'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NEW.payment_method IS NULL OR NEW.payment_method NOT IN ('upi', 'neft', 'imps', 'bank_transfer', 'bank')
    OR NEW.status IS DISTINCT FROM 'declared' OR NEW.confirmed_amount IS NOT NULL OR NEW.confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Clients can only declare direct payments';
  END IF;
  SELECT * INTO c FROM public.contracts WHERE id = NEW.contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  SELECT * INTO m FROM public.contract_milestones WHERE id = NEW.milestone_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  IF auth.uid() IS DISTINCT FROM c.founder_id OR NEW.startup_id IS DISTINCT FROM c.founder_id
    OR NEW.builder_id IS DISTINCT FROM c.builder_id OR m.contract_id IS DISTINCT FROM c.id THEN
    RAISE EXCEPTION 'Payment must belong to the founder, builder and milestone on this contract';
  END IF;
  IF c.status NOT IN ('contract_active', 'active') OR coalesce(c.escrow_funded, false) OR m.status <> 'approved' THEN
    RAISE EXCEPTION 'Direct payments require an approved milestone on an active contract without escrow';
  END IF;
  IF NEW.currency IS DISTINCT FROM c.currency OR m.currency IS DISTINCT FROM c.currency THEN
    RAISE EXCEPTION 'Payment currency must match the contract';
  END IF;
  IF NEW.declared_amount IS NULL OR NEW.declared_amount::text IN ('NaN', 'Infinity', '-Infinity')
    OR NEW.declared_amount <= 0 OR NEW.declared_amount <> round(NEW.declared_amount, 2) THEN
    RAISE EXCEPTION 'Payment amount must be a finite positive currency amount';
  END IF;
  IF NEW.declared_amount IS DISTINCT FROM m.amount THEN
    RAISE EXCEPTION 'Declared payment amount must equal the approved milestone amount';
  END IF;
  IF NULLIF(btrim(NEW.transaction_ref), '') IS NULL THEN RAISE EXCEPTION 'Transaction reference required'; END IF;
  IF EXISTS (SELECT 1 FROM public.payment_records WHERE milestone_id = m.id)
    OR EXISTS (SELECT 1 FROM public.escrow_ledger WHERE milestone_id = m.id AND entry_type IN ('released', 'refunded')) THEN
    RAISE EXCEPTION 'Milestone already has a payment or escrow movement';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_payment_record_workflow ON public.payment_records;
CREATE TRIGGER guard_payment_record_workflow BEFORE INSERT OR UPDATE OR DELETE ON public.payment_records
FOR EACH ROW EXECUTE FUNCTION public.guard_payment_record_workflow();

CREATE OR REPLACE FUNCTION public.fund_escrow(
  _contract_id uuid, _amount numeric, _transaction_ref text, _screenshot_url text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD;
  required_amount numeric;
  ledger_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO c FROM public.contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF auth.uid() IS DISTINCT FROM c.founder_id THEN RAISE EXCEPTION 'Only the founder can fund escrow'; END IF;
  IF c.status NOT IN ('contract_drafted', 'sent_for_signing', 'partially_signed') THEN
    RAISE EXCEPTION 'Contract is not awaiting escrow funding';
  END IF;
  IF c.escrow_funded OR c.escrow_balance <> 0 OR EXISTS (
    SELECT 1 FROM public.escrow_ledger WHERE contract_id = c.id
  ) OR EXISTS (
    SELECT 1 FROM public.payment_records WHERE contract_id = c.id
  ) THEN RAISE EXCEPTION 'Escrow already funded or has existing transactions'; END IF;
  IF _amount IS NULL OR _amount::text IN ('NaN', 'Infinity', '-Infinity') OR _amount <= 0 THEN
    RAISE EXCEPTION 'Escrow amount must be a finite positive number';
  END IF;
  IF NULLIF(btrim(_transaction_ref), '') IS NULL THEN RAISE EXCEPTION 'Transaction reference required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contract_signatures
      WHERE contract_id = c.id AND role = 'founder' AND signed_by = c.founder_id)
    OR NOT EXISTS (SELECT 1 FROM public.contract_signatures
      WHERE contract_id = c.id AND role = 'builder' AND signed_by = c.builder_id) THEN
    RAISE EXCEPTION 'Both parties must sign before escrow can be funded';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE user_id = c.builder_id) THEN
    RAISE EXCEPTION 'Builder must add payment details before escrow can be funded';
  END IF;
  PERFORM id FROM public.contract_milestones WHERE contract_id = c.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.contract_milestones WHERE contract_id = c.id AND status <> 'cancelled'
    AND (amount IS NULL OR amount::text IN ('NaN', 'Infinity', '-Infinity') OR amount <= 0
      OR amount <> round(amount, 2) OR currency IS DISTINCT FROM c.currency)) THEN
    RAISE EXCEPTION 'Active milestones must have positive amounts in the contract currency with at most two decimal places';
  END IF;
  SELECT sum(amount) INTO required_amount FROM public.contract_milestones
    WHERE contract_id = c.id AND status <> 'cancelled';
  IF required_amount IS NULL OR required_amount <= 0 THEN RAISE EXCEPTION 'Add payable milestones before funding escrow'; END IF;
  IF _amount <> required_amount THEN
    RAISE EXCEPTION 'Escrow deposit (%) must equal the active milestone total (%)', _amount, required_amount;
  END IF;
  UPDATE public.contracts SET escrow_amount = required_amount, escrow_funded = true,
    escrow_balance = _amount, escrow_funded_at = now(), escrow_transaction_ref = btrim(_transaction_ref),
    escrow_screenshot_url = NULLIF(btrim(_screenshot_url), ''), status = 'contract_active', updated_at = now()
    WHERE id = c.id;
  INSERT INTO public.escrow_ledger (contract_id, entry_type, amount, balance_after, notes, created_by)
    VALUES (c.id, 'funded', _amount, _amount, btrim(_transaction_ref), auth.uid()) RETURNING id INTO ledger_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (c.builder_id, 'escrow_funded', 'Escrow deposit recorded',
      'The founder recorded a manual escrow deposit. The signed contract is now active.', '/contracts/' || c.id);
  RETURN ledger_id;
END;
$$;

-- Internal helper shared by founder approval and admin dispute resolution.
-- Lock the contract before reading the fresh, locked milestone so a repeated
-- request cannot use an approved status read before an earlier release commits.
CREATE OR REPLACE FUNCTION public.record_escrow_release(
  _contract_id uuid, _milestone_id uuid, _admin_resolution boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD;
  m RECORD;
  rate numeric;
  commission numeric;
  ledger_id uuid;
  pr_id uuid;
  inv_no text;
  balance_after numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO c FROM public.contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  SELECT * INTO m FROM public.contract_milestones WHERE id = _milestone_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  IF m.contract_id IS DISTINCT FROM c.id THEN RAISE EXCEPTION 'Milestone does not belong to this contract'; END IF;
  IF _admin_resolution THEN
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
      RAISE EXCEPTION 'Admin only';
    END IF;
    IF m.status <> 'dispute' OR NOT EXISTS (SELECT 1 FROM public.disputes
      WHERE contract_id = c.id AND milestone_id = m.id AND status IN ('open', 'under_review', 'mediation')) THEN
      RAISE EXCEPTION 'Milestone must have an open dispute';
    END IF;
  ELSE
    IF auth.uid() IS DISTINCT FROM c.founder_id THEN RAISE EXCEPTION 'Only the founder can release escrow'; END IF;
    IF m.status NOT IN ('submitted', 'approved') THEN
      RAISE EXCEPTION 'Milestone must be submitted or approved before escrow can be released (current status: %)', m.status;
    END IF;
  END IF;
  IF c.status NOT IN ('contract_active', 'active') OR NOT coalesce(c.escrow_funded, false) THEN
    RAISE EXCEPTION 'Contract must be active with funded escrow';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contract_signatures
      WHERE contract_id = c.id AND role = 'founder' AND signed_by = c.founder_id)
    OR NOT EXISTS (SELECT 1 FROM public.contract_signatures
      WHERE contract_id = c.id AND role = 'builder' AND signed_by = c.builder_id) THEN
    RAISE EXCEPTION 'Both contract parties must have signed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE user_id = c.builder_id) THEN
    RAISE EXCEPTION 'Builder must add payment details before escrow can be released';
  END IF;
  IF m.amount IS NULL OR m.amount::text IN ('NaN', 'Infinity', '-Infinity') OR m.amount <= 0
    OR m.amount <> round(m.amount, 2) THEN RAISE EXCEPTION 'Milestone amount must be a finite positive currency amount'; END IF;
  IF m.currency IS DISTINCT FROM c.currency THEN RAISE EXCEPTION 'Milestone currency must match the contract'; END IF;
  IF EXISTS (SELECT 1 FROM public.escrow_ledger WHERE milestone_id = m.id AND entry_type IN ('released', 'refunded'))
    OR EXISTS (SELECT 1 FROM public.payment_records WHERE milestone_id = m.id) THEN
    RAISE EXCEPTION 'Milestone already has a payment or escrow movement';
  END IF;
  IF c.escrow_balance IS NULL OR c.escrow_balance::text IN ('NaN', 'Infinity', '-Infinity')
    OR c.escrow_balance < m.amount THEN RAISE EXCEPTION 'Insufficient escrow balance'; END IF;
  SELECT value::numeric INTO rate FROM public.platform_settings WHERE key = 'commission_rate';
  rate := coalesce(rate, 0.15);
  IF rate::text IN ('NaN', 'Infinity', '-Infinity') OR rate < 0 OR rate > 1 THEN
    RAISE EXCEPTION 'Invalid platform commission rate';
  END IF;
  commission := round(m.amount * rate, 2);
  UPDATE public.contracts SET escrow_balance = escrow_balance - m.amount, updated_at = now()
    WHERE id = c.id RETURNING escrow_balance INTO balance_after;
  INSERT INTO public.escrow_ledger (contract_id, milestone_id, entry_type, amount, balance_after, notes, created_by)
    VALUES (c.id, m.id, 'released', m.amount, balance_after,
      CASE WHEN _admin_resolution THEN 'Admin dispute resolution: manual release recorded. ' ELSE 'Manual release recorded. ' END
        || 'Milestone: ' || m.title, auth.uid()) RETURNING id INTO ledger_id;
  INSERT INTO public.payment_records (milestone_id, contract_id, startup_id, builder_id,
    declared_amount, confirmed_amount, payment_method, transaction_ref, status, confirmed_at, declared_at, currency)
    VALUES (m.id, c.id, c.founder_id, c.builder_id, m.amount, m.amount, 'escrow',
      'ESCROW-' || m.id, 'confirmed', now(), now(), c.currency) RETURNING id INTO pr_id;
  inv_no := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.commission_invoice_seq')::text, 4, '0');
  INSERT INTO public.commission_invoices (payment_record_id, invoice_number, base_amount, commission_rate,
    commission_amount, due_date, status, currency)
    VALUES (pr_id, inv_no, m.amount, rate, commission, CURRENT_DATE + 7, 'generated', c.currency);
  UPDATE public.contract_milestones SET status = 'escrow_released', updated_at = now() WHERE id = m.id;
  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (c.builder_id, 'escrow_released', 'Escrow release recorded',
      'A manual escrow release of ' || c.currency || ' ' || m.amount || ' was recorded for "' || m.title
        || '". Check with the founder or platform to confirm the transfer.', '/workspace/' || c.id),
    (c.founder_id, 'commission_invoice', 'Commission invoice ' || inv_no,
      'Separate platform fee of ' || c.currency || ' ' || commission || ' due in 7 days. The builder payment is the full milestone amount.',
      '/workspace/' || c.id);
  RETURN ledger_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_escrow_release(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.release_escrow_for_milestone(_milestone_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  contract_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT m.contract_id INTO contract_id FROM public.contract_milestones m WHERE m.id = _milestone_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  RETURN public.record_escrow_release(contract_id, _milestone_id, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_escrow(_contract_id uuid, _milestone_id uuid, _direction text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD;
  m RECORD;
  balance_after numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF _direction IS NULL OR _direction NOT IN ('release_to_builder', 'refund_to_founder') THEN
    RAISE EXCEPTION 'direction must be release_to_builder or refund_to_founder';
  END IF;
  SELECT * INTO c FROM public.contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF _direction = 'release_to_builder' THEN
    PERFORM public.record_escrow_release(c.id, _milestone_id, true);
  ELSE
    SELECT * INTO m FROM public.contract_milestones WHERE id = _milestone_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
    IF m.contract_id IS DISTINCT FROM c.id THEN RAISE EXCEPTION 'Milestone does not belong to this contract'; END IF;
    IF c.status NOT IN ('contract_active', 'active') OR NOT coalesce(c.escrow_funded, false) THEN
      RAISE EXCEPTION 'Contract must be active with funded escrow';
    END IF;
    IF m.status <> 'dispute' OR NOT EXISTS (SELECT 1 FROM public.disputes
      WHERE contract_id = c.id AND milestone_id = m.id AND status IN ('open', 'under_review', 'mediation')) THEN
      RAISE EXCEPTION 'Milestone must have an open dispute';
    END IF;
    IF EXISTS (SELECT 1 FROM public.escrow_ledger WHERE milestone_id = m.id AND entry_type IN ('released', 'refunded'))
      OR EXISTS (SELECT 1 FROM public.payment_records WHERE milestone_id = m.id) THEN
      RAISE EXCEPTION 'Milestone already has a payment or escrow movement';
    END IF;
    IF m.amount IS NULL OR m.amount::text IN ('NaN', 'Infinity', '-Infinity') OR m.amount <= 0
      OR m.amount <> round(m.amount, 2) THEN RAISE EXCEPTION 'Invalid milestone amount'; END IF;
    IF c.escrow_balance IS NULL OR c.escrow_balance::text IN ('NaN', 'Infinity', '-Infinity')
      OR c.escrow_balance < m.amount THEN RAISE EXCEPTION 'Insufficient escrow balance for refund'; END IF;
    UPDATE public.contracts SET escrow_balance = escrow_balance - m.amount, updated_at = now()
      WHERE id = c.id RETURNING escrow_balance INTO balance_after;
    INSERT INTO public.escrow_ledger (contract_id, milestone_id, entry_type, amount, balance_after, notes, created_by)
      VALUES (c.id, m.id, 'refunded', m.amount, balance_after, 'Admin dispute resolution: manual refund recorded', auth.uid());
    UPDATE public.contract_milestones SET status = 'cancelled', updated_at = now() WHERE id = m.id;
  END IF;
  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
    VALUES (auth.uid(), CASE WHEN public.has_role(auth.uid(), 'super_admin') THEN 'super_admin' ELSE 'admin' END,
      'admin_resolve_escrow', 'contracts', c.id,
      jsonb_build_object('direction', _direction, 'milestone_id', _milestone_id, 'balance_before', c.escrow_balance));
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_dispute(_dispute_id uuid, _direction text, _resolution text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d RECORD;
  new_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT * INTO d FROM public.disputes WHERE id = _dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;
  IF d.status NOT IN ('open', 'under_review', 'mediation') THEN RAISE EXCEPTION 'Dispute already resolved'; END IF;
  IF _direction IS NULL OR _direction NOT IN ('release_to_builder', 'refund_to_founder', 'close_no_action') THEN
    RAISE EXCEPTION 'direction must be release_to_builder, refund_to_founder, or close_no_action';
  END IF;
  IF _direction IN ('release_to_builder', 'refund_to_founder') THEN
    IF d.milestone_id IS NULL THEN RAISE EXCEPTION 'Dispute has no milestone; cannot move escrow'; END IF;
    PERFORM public.admin_resolve_escrow(d.contract_id, d.milestone_id, _direction);
  END IF;
  new_status := CASE WHEN _direction = 'release_to_builder' THEN 'resolved_builder'
    WHEN _direction = 'refund_to_founder' THEN 'resolved_founder' ELSE 'closed' END;
  UPDATE public.disputes SET status = new_status, resolution = coalesce(_resolution, resolution),
    resolved_at = now(), updated_at = now() WHERE id = d.id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT party_id, 'dispute_resolved', 'Dispute resolved', coalesce(_resolution, 'Admin resolved the dispute.'),
      '/workspace/' || c.id FROM public.contracts c
      CROSS JOIN LATERAL (VALUES (c.founder_id), (c.builder_id)) AS parties(party_id) WHERE c.id = d.contract_id;
  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
    VALUES (auth.uid(), CASE WHEN public.has_role(auth.uid(), 'super_admin') THEN 'super_admin' ELSE 'admin' END,
      'resolve_dispute', 'disputes', d.id, jsonb_build_object('direction', _direction, 'resolution', _resolution));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_contract_from_offer(_offer_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o RECORD;
  new_contract_id uuid;
  num_milestones int;
  total_amount numeric;
  per_amount numeric;
  milestone_amount numeric;
  i int;
  start_d date;
  hires_count int;
  cap int;
  lock_proj boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO o FROM public.offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF auth.uid() IS DISTINCT FROM o.builder_id THEN RAISE EXCEPTION 'Only the builder can accept the offer'; END IF;
  SELECT id INTO new_contract_id FROM public.contracts WHERE offer_id = o.id LIMIT 1;
  IF new_contract_id IS NOT NULL THEN RETURN new_contract_id; END IF;
  IF o.compensation IS NULL OR o.compensation::text IN ('NaN', 'Infinity', '-Infinity') OR o.compensation <= 0 THEN
    RAISE EXCEPTION 'Offer compensation must be a finite positive amount';
  END IF;
  total_amount := round(o.compensation, 2);
  num_milestones := CASE WHEN o.duration ILIKE '12%' THEN 12 WHEN o.duration ILIKE '6%' THEN 6 ELSE 3 END;
  per_amount := trunc(total_amount / num_milestones, 2);
  IF per_amount <= 0 THEN RAISE EXCEPTION 'Offer amount is too small to create payable milestones'; END IF;
  UPDATE public.offers SET status = 'offer_accepted', updated_at = now() WHERE id = o.id;
  start_d := coalesce(o.start_date, CURRENT_DATE);
  INSERT INTO public.contracts (project_id, founder_id, builder_id, offer_id,
    escrow_amount, status, start_date, ip_assignment, nda_included, currency)
    VALUES (o.project_id, o.founder_id, o.builder_id, o.id, total_amount,
      'contract_drafted', start_d, true, false, o.currency) RETURNING id INTO new_contract_id;
  FOR i IN 1..num_milestones LOOP
    milestone_amount := CASE WHEN i = num_milestones THEN total_amount - per_amount * (num_milestones - 1) ELSE per_amount END;
    INSERT INTO public.contract_milestones (contract_id, title, description, amount, due_date, order_index, status, currency)
      VALUES (new_contract_id, 'Milestone ' || i, 'Auto-generated milestone ' || i || ' of ' || num_milestones,
        milestone_amount, (start_d + i * 30)::date, i - 1, 'in_progress', o.currency);
  END LOOP;
  IF o.submission_id IS NOT NULL THEN
    UPDATE public.submissions SET status = 'hired', updated_at = now() WHERE id = o.submission_id;
  END IF;
  SELECT count(*) INTO hires_count FROM public.contracts WHERE project_id = o.project_id;
  SELECT max_hires INTO cap FROM public.projects WHERE id = o.project_id;
  lock_proj := cap IS NOT NULL AND hires_count >= cap;
  UPDATE public.projects SET hire_locked = lock_proj,
    status = CASE WHEN lock_proj THEN 'hiring_in_progress' ELSE 'reviewing_submissions' END,
    updated_at = now() WHERE id = o.project_id;
  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (o.founder_id, 'contract_drafted', 'Contract drafted', 'Contract created from accepted offer. Review milestones and sign.', '/contracts/' || new_contract_id),
    (o.builder_id, 'contract_drafted', 'Your contract has been drafted', 'Open the contract workspace to review terms and milestones.', '/contracts/' || new_contract_id);
  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
    VALUES (auth.uid(), NULL, 'contract_created', 'contract', new_contract_id,
      jsonb_build_object('offer_id', o.id, 'project_id', o.project_id, 'builder_id', o.builder_id, 'founder_id', o.founder_id));
  RETURN new_contract_id;
END;
$$;

-- The companion direct-payment path shares the same separate commission
-- billing model and must retain the currency on its generated invoice.
CREATE OR REPLACE FUNCTION public.confirm_payment_record(_id uuid, _confirmed_amount numeric, _screenshot text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pr RECORD;
  inv_id uuid;
  inv_no text;
  commission numeric;
  rate numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO pr FROM public.payment_records WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment record not found'; END IF;
  IF auth.uid() IS DISTINCT FROM pr.builder_id THEN RAISE EXCEPTION 'Only the builder can confirm'; END IF;
  IF pr.payment_method = 'escrow' THEN RAISE EXCEPTION 'Escrow payments are auto-confirmed and cannot be re-confirmed'; END IF;
  IF pr.status <> 'declared' THEN RAISE EXCEPTION 'Payment record is not awaiting confirmation (status: %)', pr.status; END IF;
  IF _confirmed_amount IS NULL OR _confirmed_amount::text IN ('NaN', 'Infinity', '-Infinity') OR _confirmed_amount < 0 THEN
    RAISE EXCEPTION 'Confirmed amount must be a finite non-negative number';
  END IF;
  IF pr.declared_amount::text IN ('NaN', 'Infinity', '-Infinity') OR pr.declared_amount <= 0 THEN
    RAISE EXCEPTION 'Declared payment amount must be a finite positive number';
  END IF;
  SELECT value::numeric INTO rate FROM public.platform_settings WHERE key = 'commission_rate';
  rate := coalesce(rate, 0.15);
  IF rate::text IN ('NaN', 'Infinity', '-Infinity') OR rate < 0 OR rate > 1 THEN RAISE EXCEPTION 'Invalid platform commission rate'; END IF;
  IF _confirmed_amount = pr.declared_amount THEN
    UPDATE public.payment_records SET confirmed_amount = _confirmed_amount,
      screenshot_url = coalesce(_screenshot, screenshot_url), status = 'confirmed', confirmed_at = now() WHERE id = pr.id;
    commission := round(pr.declared_amount * rate, 2);
    inv_no := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.commission_invoice_seq')::text, 4, '0');
    INSERT INTO public.commission_invoices (payment_record_id, invoice_number, base_amount, commission_rate,
      commission_amount, due_date, status, currency)
      VALUES (pr.id, inv_no, pr.declared_amount, rate, commission, CURRENT_DATE + 7, 'generated', pr.currency)
      RETURNING id INTO inv_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (pr.startup_id, 'commission_invoice', 'Commission invoice ' || inv_no,
        'Separate platform fee of ' || pr.currency || ' ' || commission || ' due in 7 days.', '/workspace/' || pr.contract_id);
    RETURN inv_id;
  END IF;
  UPDATE public.payment_records SET confirmed_amount = _confirmed_amount,
    screenshot_url = coalesce(_screenshot, screenshot_url), status = 'disputed', confirmed_at = now() WHERE id = pr.id;
  INSERT INTO public.disputes (contract_id, milestone_id, raised_by, reason, status)
    VALUES (pr.contract_id, pr.milestone_id, auth.uid(),
      'Payment mismatch: declared ' || pr.declared_amount || ' vs confirmed ' || _confirmed_amount, 'open');
  UPDATE public.contract_milestones SET status = 'dispute' WHERE id = pr.milestone_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (pr.startup_id, 'payment_dispute', 'Payment amount disputed',
      'Builder confirmed a different amount. Admin notified.', '/workspace/' || pr.contract_id);
  INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT ur.user_id, 'payment_dispute_admin', 'New payment dispute',
      'A payment dispute was auto-raised on contract ' || pr.contract_id, '/admin/disputes'
      FROM public.user_roles ur WHERE ur.role IN ('admin', 'super_admin');
  RETURN NULL;
END;
$$;

-- A final refunded milestone is terminal too. Draft milestone edits must not
-- complete a contract, and an entirely refunded contract is cancelled.
CREATE OR REPLACE FUNCTION public.tg_contract_auto_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD;
  milestone_count int;
  remaining int;
  settled_count int;
  terminal_status text;
  notice_title text;
  notice_body text;
BEGIN
  SELECT * INTO c FROM public.contracts WHERE id = NEW.contract_id FOR UPDATE;
  IF NOT FOUND OR c.status NOT IN ('contract_active', 'active') THEN RETURN NEW; END IF;
  SELECT count(*), count(*) FILTER (WHERE status NOT IN ('fully_settled', 'cancelled')),
    count(*) FILTER (WHERE status = 'fully_settled')
    INTO milestone_count, remaining, settled_count
    FROM public.contract_milestones WHERE contract_id = c.id;
  IF milestone_count = 0 OR remaining <> 0 THEN RETURN NEW; END IF;
  terminal_status := CASE WHEN settled_count > 0 THEN 'contract_completed' ELSE 'cancelled' END;
  notice_title := CASE WHEN settled_count > 0 THEN 'Contract completed' ELSE 'Contract cancelled' END;
  notice_body := CASE WHEN settled_count > 0 THEN 'All milestones are fully settled or cancelled. The contract is now complete.'
    ELSE 'All milestones were cancelled. Any manual escrow refunds are recorded in the ledger.' END;
  UPDATE public.contracts SET status = terminal_status, updated_at = now() WHERE id = c.id;
  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (c.founder_id, terminal_status, notice_title, notice_body, '/contracts/' || c.id),
    (c.builder_id, terminal_status, notice_title, notice_body, '/contracts/' || c.id);
  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
    VALUES (NULL, 'system', terminal_status, 'contract', c.id, '{}'::jsonb);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS contract_auto_complete ON public.contract_milestones;
CREATE TRIGGER contract_auto_complete AFTER UPDATE OF status ON public.contract_milestones
FOR EACH ROW WHEN (NEW.status IN ('fully_settled', 'cancelled') AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.tg_contract_auto_complete();

-- Repair only untouched, unsigned and unfunded generated drafts. Signed or
-- funded money/history is deliberately left for explicit reconciliation.
DO $$
DECLARE
  c RECORD;
  expected_count int;
  expected_amount numeric;
  per_amount numeric;
BEGIN
  FOR c IN SELECT contracts.*, o.compensation, o.duration, o.currency AS offer_currency
    FROM public.contracts contracts JOIN public.offers o ON o.id = contracts.offer_id
    WHERE contracts.status = 'contract_drafted' AND NOT coalesce(contracts.escrow_funded, false)
      AND contracts.escrow_balance = 0 AND contracts.escrow_amount = o.compensation
      AND NOT EXISTS (SELECT 1 FROM public.contract_signatures WHERE contract_id = contracts.id)
      AND NOT EXISTS (SELECT 1 FROM public.escrow_ledger WHERE contract_id = contracts.id)
      AND NOT EXISTS (SELECT 1 FROM public.payment_records WHERE contract_id = contracts.id)
      AND o.compensation > 0 AND o.compensation::text NOT IN ('NaN', 'Infinity', '-Infinity')
  LOOP
    expected_count := CASE WHEN c.duration ILIKE '12%' THEN 12 WHEN c.duration ILIKE '6%' THEN 6 ELSE 3 END;
    expected_amount := round(c.compensation, 2);
    per_amount := trunc(expected_amount / expected_count, 2);
    IF per_amount <= 0 THEN CONTINUE; END IF;
    IF (SELECT count(*) FROM public.contract_milestones WHERE contract_id = c.id) = expected_count
      AND (SELECT count(DISTINCT order_index) FROM public.contract_milestones WHERE contract_id = c.id) = expected_count
      AND NOT EXISTS (SELECT 1 FROM public.contract_milestones m WHERE m.contract_id = c.id AND (
        m.status <> 'in_progress' OR m.order_index < 0 OR m.order_index >= expected_count
        OR m.title <> 'Milestone ' || (m.order_index + 1)
        OR m.description IS DISTINCT FROM 'Auto-generated milestone ' || (m.order_index + 1) || ' of ' || expected_count
        OR m.amount <> round(c.compensation / expected_count, 2)
        OR m.due_date IS DISTINCT FROM (c.start_date + (m.order_index + 1) * 30)::date)) THEN
      UPDATE public.contract_milestones SET amount = CASE WHEN order_index = expected_count - 1
          THEN expected_amount - per_amount * (expected_count - 1) ELSE per_amount END,
        currency = c.offer_currency WHERE contract_id = c.id;
      UPDATE public.contracts SET escrow_amount = expected_amount, currency = c.offer_currency WHERE id = c.id;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fund_escrow(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.release_escrow_for_milestone(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_escrow(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_contract_from_offer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_payment_record(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_contract_on_signature() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_contract_auto_complete() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_contract_escrow_fields() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_milestone_escrow_fields() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_payment_record_workflow() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_escrow(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_escrow_for_milestone(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_escrow(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_contract_from_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment_record(uuid, numeric, text) TO authenticated;
