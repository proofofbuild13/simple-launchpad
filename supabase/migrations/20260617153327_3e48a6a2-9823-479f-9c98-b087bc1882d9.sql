
CREATE TABLE public.ai_submission_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE REFERENCES public.submissions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  score_problem_fit int CHECK (score_problem_fit BETWEEN 0 AND 20),
  score_execution int CHECK (score_execution BETWEEN 0 AND 20),
  score_ux int CHECK (score_ux BETWEEN 0 AND 20),
  score_feasibility int CHECK (score_feasibility BETWEEN 0 AND 20),
  score_innovation int CHECK (score_innovation BETWEEN 0 AND 20),
  total_score int GENERATED ALWAYS AS (
    COALESCE(score_problem_fit,0) + COALESCE(score_execution,0) +
    COALESCE(score_ux,0) + COALESCE(score_feasibility,0) + COALESCE(score_innovation,0)
  ) STORED,
  summary_verdict text,
  strengths text[] DEFAULT '{}',
  gaps text[] DEFAULT '{}',
  recommendation text CHECK (recommendation IN ('shortlist','review_manually','pass')),
  error text,
  model_used text DEFAULT 'google/gemini-3-flash-preview',
  prompt_version int DEFAULT 1,
  evaluated_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_submission_evaluations TO authenticated;
GRANT ALL ON public.ai_submission_evaluations TO service_role;

ALTER TABLE public.ai_submission_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_eval_select ON public.ai_submission_evaluations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.projects p ON p.id = s.project_id
      WHERE s.id = ai_submission_evaluations.submission_id
        AND (p.founder_id = auth.uid() OR s.builder_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE INDEX idx_ai_eval_submission ON public.ai_submission_evaluations(submission_id);
CREATE INDEX idx_ai_eval_project ON public.ai_submission_evaluations(project_id);
CREATE INDEX idx_ai_eval_total ON public.ai_submission_evaluations(total_score DESC);

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS ai_score int,
  ADD COLUMN IF NOT EXISTS ai_recommendation text;

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_submission_evaluations;
