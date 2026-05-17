
-- Allow authenticated users to insert notifications for the OTHER party in an offer/contract they belong to,
-- and for themselves (system-style alerts triggered from the client).
CREATE POLICY "notif_insert_workflow"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.offers o
    WHERE (o.founder_id = auth.uid() OR o.builder_id = auth.uid())
      AND (o.founder_id = notifications.user_id OR o.builder_id = notifications.user_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
      AND (c.founder_id = notifications.user_id OR c.builder_id = notifications.user_id)
  )
);

-- Add hire_locked flag on projects so further hiring is blocked once a contract starts.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS hire_locked boolean NOT NULL DEFAULT false;

-- Atomic RPC: build a contract from an accepted offer, generate milestones, mark submission hired, lock project.
CREATE OR REPLACE FUNCTION public.create_contract_from_offer(_offer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Only the builder on the offer may trigger this
  IF auth.uid() <> o.builder_id THEN
    RAISE EXCEPTION 'Only the offer recipient can accept';
  END IF;

  -- If a contract already exists for this offer, return it (idempotent)
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

  -- Auto-generate milestones based on duration text
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

  -- Mark submission as hired and lock further hiring on the project
  IF o.submission_id IS NOT NULL THEN
    UPDATE public.submissions SET status = 'hired', updated_at = now() WHERE id = o.submission_id;
  END IF;
  UPDATE public.projects SET hire_locked = true, status = 'in_progress', updated_at = now() WHERE id = o.project_id;

  -- Notify founder
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    o.founder_id, 'contract_drafted', 'Contract drafted',
    'Builder accepted your offer. Review milestones and send for signing.',
    '/contracts/' || new_contract_id
  );
  -- Notify builder
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    o.builder_id, 'contract_drafted', 'Your contract has been drafted',
    'Open the contract workspace to review terms and milestones.',
    '/contracts/' || new_contract_id
  );

  RETURN new_contract_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_contract_from_offer(uuid) TO authenticated;
