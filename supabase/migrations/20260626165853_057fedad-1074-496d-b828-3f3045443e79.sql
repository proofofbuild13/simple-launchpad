-- Drop old constraint first so we can migrate values
ALTER TABLE public.ai_submission_evaluations
  DROP CONSTRAINT IF EXISTS ai_submission_evaluations_recommendation_check;

UPDATE public.ai_submission_evaluations
SET recommendation = CASE recommendation
  WHEN 'shortlist' THEN 'fundable'
  WHEN 'review_manually' THEN 'iterate'
  ELSE recommendation
END
WHERE recommendation IN ('shortlist','review_manually');

ALTER TABLE public.ai_submission_evaluations
  ADD CONSTRAINT ai_submission_evaluations_recommendation_check
  CHECK (recommendation IS NULL OR recommendation IN ('fundable','iterate','pass'));

ALTER TABLE public.ai_submission_evaluations
  ADD COLUMN IF NOT EXISTS startup_grade text
  CHECK (startup_grade IS NULL OR startup_grade IN ('A','B','C','D','F'));

UPDATE public.submissions
SET ai_recommendation = CASE ai_recommendation
  WHEN 'shortlist' THEN 'fundable'
  WHEN 'review_manually' THEN 'iterate'
  ELSE ai_recommendation
END
WHERE ai_recommendation IN ('shortlist','review_manually');