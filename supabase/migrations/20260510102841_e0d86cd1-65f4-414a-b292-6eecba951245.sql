
-- Extend submissions: allow under_review
-- (status is text, no constraint change needed)

-- Extend offers
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS rate_type text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_terms text;

-- Extend contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS ip_assignment boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS nda_included boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS non_compete boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS escrow_funded boolean DEFAULT false;

-- submission_reviews
CREATE TABLE IF NOT EXISTS public.submission_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  problem_fit int CHECK (problem_fit BETWEEN 1 AND 5),
  execution int CHECK (execution BETWEEN 1 AND 5),
  ux int CHECK (ux BETWEEN 1 AND 5),
  feasibility int CHECK (feasibility BETWEEN 1 AND 5),
  innovation int CHECK (innovation BETWEEN 1 AND 5),
  score numeric,
  notes text,
  decision text NOT NULL DEFAULT 'pending',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.submission_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY sr_select_parties ON public.submission_reviews FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.builder_id = auth.uid()
  ));
CREATE POLICY sr_insert_reviewer ON public.submission_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY sr_update_reviewer ON public.submission_reviews FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid());

-- interviews
CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid,
  project_id uuid NOT NULL,
  founder_id uuid NOT NULL,
  builder_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'video',
  scheduled_at timestamptz,
  meeting_url text,
  context_message text,
  status text NOT NULL DEFAULT 'invited',
  founder_notes text,
  outcome text,
  reschedule_count int NOT NULL DEFAULT 0,
  builder_responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY iv_select_parties ON public.interviews FOR SELECT TO authenticated
  USING (founder_id = auth.uid() OR builder_id = auth.uid());
CREATE POLICY iv_insert_founder ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (founder_id = auth.uid());
CREATE POLICY iv_update_parties ON public.interviews FOR UPDATE TO authenticated
  USING (founder_id = auth.uid() OR builder_id = auth.uid());
CREATE TRIGGER interviews_touch BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- offer_negotiations
CREATE TABLE IF NOT EXISTS public.offer_negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL,
  proposed_by uuid NOT NULL,
  counter_rate numeric,
  counter_terms text,
  message text,
  round int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.offer_negotiations ENABLE ROW LEVEL SECURITY;
CREATE POLICY on_select_parties ON public.offer_negotiations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = offer_id AND (o.founder_id = auth.uid() OR o.builder_id = auth.uid())
  ));
CREATE POLICY on_insert_parties ON public.offer_negotiations FOR INSERT TO authenticated
  WITH CHECK (proposed_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = offer_id AND (o.founder_id = auth.uid() OR o.builder_id = auth.uid())
  ));

-- contract_signatures
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  signed_by uuid NOT NULL,
  role text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text
);
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY cs_select_parties ON public.contract_signatures FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_id AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
  ));
CREATE POLICY cs_insert_self ON public.contract_signatures FOR INSERT TO authenticated
  WITH CHECK (signed_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_id AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
  ));

-- milestones (structured)
CREATE TABLE IF NOT EXISTS public.contract_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  due_date date,
  amount numeric NOT NULL DEFAULT 0,
  order_index int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY cm_select_parties ON public.contract_milestones FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_id AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
  ));
CREATE POLICY cm_insert_founder ON public.contract_milestones FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_id AND c.founder_id = auth.uid()
  ));
CREATE POLICY cm_update_parties ON public.contract_milestones FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_id AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
  ));
CREATE TRIGGER cm_touch BEFORE UPDATE ON public.contract_milestones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- deliverables
CREATE TABLE IF NOT EXISTS public.deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL,
  submitted_by uuid NOT NULL,
  file_urls text[] DEFAULT '{}',
  demo_url text,
  write_up text,
  revision_number int NOT NULL DEFAULT 1,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY dl_select_parties ON public.deliverables FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contract_milestones m JOIN public.contracts c ON c.id = m.contract_id
    WHERE m.id = milestone_id AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
  ));
CREATE POLICY dl_insert_builder ON public.deliverables FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.contract_milestones m JOIN public.contracts c ON c.id = m.contract_id
    WHERE m.id = milestone_id AND c.builder_id = auth.uid()
  ));

-- payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_provider_id text,
  status text NOT NULL DEFAULT 'pending',
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_select_parties ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contract_milestones m JOIN public.contracts c ON c.id = m.contract_id
    WHERE m.id = milestone_id AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
  ));
CREATE POLICY pay_insert_founder ON public.payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contract_milestones m JOIN public.contracts c ON c.id = m.contract_id
    WHERE m.id = milestone_id AND c.founder_id = auth.uid()
  ));
CREATE POLICY pay_update_founder ON public.payments FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contract_milestones m JOIN public.contracts c ON c.id = m.contract_id
    WHERE m.id = milestone_id AND c.founder_id = auth.uid()
  ));

-- disputes
CREATE TABLE IF NOT EXISTS public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  milestone_id uuid,
  raised_by uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY disp_select ON public.disputes FOR SELECT TO authenticated
  USING (
    raised_by = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_id AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
    )
  );
CREATE POLICY disp_insert_parties ON public.disputes FOR INSERT TO authenticated
  WITH CHECK (raised_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_id AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
  ));
CREATE POLICY disp_update_admin ON public.disputes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
CREATE TRIGGER disp_touch BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- reviews (post-contract ratings)
CREATE TABLE IF NOT EXISTS public.contract_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL,
  reviewee_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reviewer_id, contract_id)
);
ALTER TABLE public.contract_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY cr_select_all ON public.contract_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY cr_insert_self ON public.contract_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_id AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subreviews_sub ON public.submission_reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_interviews_project ON public.interviews(project_id);
CREATE INDEX IF NOT EXISTS idx_neg_offer ON public.offer_negotiations(offer_id);
CREATE INDEX IF NOT EXISTS idx_milestones_contract ON public.contract_milestones(contract_id);
CREATE INDEX IF NOT EXISTS idx_deliv_milestone ON public.deliverables(milestone_id);
CREATE INDEX IF NOT EXISTS idx_pay_milestone ON public.payments(milestone_id);
CREATE INDEX IF NOT EXISTS idx_disp_contract ON public.disputes(contract_id);
