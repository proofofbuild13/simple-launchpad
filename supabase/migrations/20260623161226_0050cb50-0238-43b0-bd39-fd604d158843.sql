
-- ============================================================
-- Trigger A: auto-complete contract when all milestones settled
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_contract_auto_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_id uuid;
  remaining int;
  cur_status text;
  c RECORD;
BEGIN
  c_id := NEW.contract_id;

  SELECT status INTO cur_status FROM public.contracts WHERE id = c_id;
  IF cur_status IS NULL OR cur_status = 'contract_completed' OR cur_status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO remaining
  FROM public.contract_milestones
  WHERE contract_id = c_id
    AND status NOT IN ('fully_settled','cancelled');

  IF remaining = 0 THEN
    SELECT * INTO c FROM public.contracts WHERE id = c_id;
    UPDATE public.contracts
       SET status = 'contract_completed', updated_at = now()
     WHERE id = c_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES
      (c.founder_id, 'contract_completed', 'Contract completed',
       'All milestones are fully settled. The contract is now marked complete.',
       '/contracts/' || c_id),
      (c.builder_id, 'contract_completed', 'Contract completed',
       'All milestones are fully settled. The contract is now marked complete.',
       '/contracts/' || c_id);

    INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
    VALUES (NULL, 'system', 'contract_completed', 'contract', c_id, '{}'::jsonb);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_auto_complete ON public.contract_milestones;
CREATE TRIGGER contract_auto_complete
AFTER UPDATE OF status ON public.contract_milestones
FOR EACH ROW
WHEN (NEW.status = 'fully_settled' AND OLD.status IS DISTINCT FROM 'fully_settled')
EXECUTE FUNCTION public.tg_contract_auto_complete();

-- ============================================================
-- Trigger B: activate / advance status on signature insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_contract_on_signature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  has_founder boolean;
  has_builder boolean;
BEGIN
  SELECT * INTO c FROM public.contracts WHERE id = NEW.contract_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT EXISTS(SELECT 1 FROM public.contract_signatures
                WHERE contract_id = c.id AND role = 'founder') INTO has_founder;
  SELECT EXISTS(SELECT 1 FROM public.contract_signatures
                WHERE contract_id = c.id AND role = 'builder') INTO has_builder;

  IF has_founder AND has_builder THEN
    IF c.escrow_funded AND c.status IN ('sent_for_signing','partially_signed','contract_drafted') THEN
      UPDATE public.contracts SET status = 'contract_active', updated_at = now() WHERE id = c.id;
    ELSIF c.status IN ('sent_for_signing','contract_drafted') THEN
      UPDATE public.contracts SET status = 'partially_signed', updated_at = now() WHERE id = c.id;
    END IF;
  ELSIF c.status = 'sent_for_signing' THEN
    UPDATE public.contracts SET status = 'partially_signed', updated_at = now() WHERE id = c.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_on_signature ON public.contract_signatures;
CREATE TRIGGER contract_on_signature
AFTER INSERT ON public.contract_signatures
FOR EACH ROW EXECUTE FUNCTION public.tg_contract_on_signature();

-- ============================================================
-- Guard fund_escrow: require at least one signature before funding
-- ============================================================
CREATE OR REPLACE FUNCTION public.fund_escrow(_contract_id uuid, _amount numeric, _transaction_ref text, _screenshot_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
  ledger_id uuid;
  sig_count int;
BEGIN
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

  SELECT count(*) INTO sig_count FROM public.contract_signatures WHERE contract_id = _contract_id;
  IF sig_count = 0 THEN
    RAISE EXCEPTION 'Cannot fund escrow before the contract has been signed';
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

-- ============================================================
-- Admin SELECT override on contracts
-- ============================================================
DROP POLICY IF EXISTS contracts_admin_select ON public.contracts;
CREATE POLICY contracts_admin_select ON public.contracts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- ============================================================
-- Explicit grants
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_payments TO authenticated;
GRANT ALL ON public.commission_payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO authenticated;
GRANT ALL ON public.payment_records TO service_role;

-- ============================================================
-- Drop unreachable policy
-- ============================================================
DROP POLICY IF EXISTS el_insert_admin ON public.escrow_ledger;
