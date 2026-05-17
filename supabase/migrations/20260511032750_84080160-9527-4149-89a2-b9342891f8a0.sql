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
      new_contract_id,
      'Milestone ' || i,
      'Auto-generated milestone ' || i || ' of ' || num_milestones,
      per_amount,
      (start_d + (i * 30))::date,
      i - 1,
      'in_progress'
    );
  END LOOP;

  IF o.submission_id IS NOT NULL THEN
    UPDATE public.submissions SET status = 'hired', updated_at = now() WHERE id = o.submission_id;
  END IF;
  UPDATE public.projects SET hire_locked = true, status = 'in_progress', updated_at = now() WHERE id = o.project_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (o.founder_id, 'contract_drafted', 'Contract drafted',
    'Contract created from accepted offer. Review milestones and sign.',
    '/contracts/' || new_contract_id);
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (o.builder_id, 'contract_drafted', 'Your contract has been drafted',
    'Open the contract workspace to review terms and milestones.',
    '/contracts/' || new_contract_id);

  RETURN new_contract_id;
END;
$function$;