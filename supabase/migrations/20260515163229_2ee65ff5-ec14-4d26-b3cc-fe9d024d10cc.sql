
-- 1) max_hires on projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS max_hires integer DEFAULT 1;

-- 2) Replace create_contract_from_offer: respect max_hires + audit log
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

  IF auth.uid() <> o.builder_id AND auth.uid() <> o.founder_id THEN
    RAISE EXCEPTION 'Not authorized';
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

  -- Multi-hire awareness
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

  -- Audit log
  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(), NULL, 'contract_created', 'contract', new_contract_id,
    jsonb_build_object('offer_id', o.id, 'project_id', o.project_id, 'builder_id', o.builder_id, 'founder_id', o.founder_id));

  RETURN new_contract_id;
END;
$function$;

-- 3) Replace verify_commission_payment: settle status + audit log
CREATE OR REPLACE FUNCTION public.verify_commission_payment(_payment_id uuid, _approve boolean, _notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cp RECORD;
  ci RECORD;
  pr RECORD;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO cp FROM public.commission_payments WHERE id = _payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  SELECT * INTO ci FROM public.commission_invoices WHERE id = cp.invoice_id;
  SELECT * INTO pr FROM public.payment_records WHERE id = ci.payment_record_id;

  IF _approve THEN
    UPDATE public.commission_payments SET status='admin_verified', verified_at=now(), verified_by=auth.uid(), admin_notes=_notes WHERE id=_payment_id;
    UPDATE public.commission_invoices SET status='paid' WHERE id=cp.invoice_id;
    UPDATE public.payment_records SET status='settled' WHERE id=pr.id;
    UPDATE public.contract_milestones SET status='fully_settled' WHERE id=pr.milestone_id;

    INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
      (pr.startup_id,'commission_verified','Commission verified','Milestone fully settled.','/workspace/'||pr.contract_id),
      (pr.builder_id,'commission_verified','Milestone fully settled','Platform commission verified by admin.','/workspace/'||pr.contract_id);

    INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'admin', 'commission_verified', 'commission_payment', _payment_id,
      jsonb_build_object('invoice_id', cp.invoice_id, 'milestone_id', pr.milestone_id, 'amount', cp.amount));
  ELSE
    UPDATE public.commission_payments SET status='rejected', verified_at=now(), verified_by=auth.uid(), admin_notes=_notes WHERE id=_payment_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (cp.startup_id,'commission_rejected','Commission payment rejected', COALESCE(_notes,'Please resubmit.'),'/workspace/'||pr.contract_id);

    INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'admin', 'commission_rejected', 'commission_payment', _payment_id,
      jsonb_build_object('invoice_id', cp.invoice_id, 'notes', _notes));
  END IF;
END;
$function$;
