-- Startup Control Panel: aggregated stats function + cleanup policies

-- Single round-trip stats query for startup dashboard
CREATE OR REPLACE FUNCTION public.get_startup_stats(_founder_id uuid)
RETURNS TABLE (
  active_projects   bigint,
  total_submissions bigint,
  unique_builders   bigint,
  total_spend       numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH my_projects AS (
    SELECT id FROM public.projects
    WHERE founder_id = _founder_id AND status NOT IN ('archived','deleted')
  ),
  sub_stats AS (
    SELECT count(*) AS total_submissions, count(DISTINCT s.builder_id) AS unique_builders
    FROM public.submissions s WHERE s.project_id IN (SELECT id FROM my_projects)
  ),
  spend_stats AS (
    SELECT coalesce(sum(c.escrow_amount), 0) AS total_spend FROM public.contracts c
    WHERE c.founder_id = _founder_id AND c.status IN ('completed','fully_settled','payment_confirmed')
  )
  SELECT (SELECT count(*) FROM my_projects)::bigint, sub_stats.total_submissions::bigint,
         sub_stats.unique_builders::bigint, spend_stats.total_spend
  FROM sub_stats, spend_stats;
$$;

GRANT EXECUTE ON FUNCTION public.get_startup_stats(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_challenges' AND policyname = 'Startups can delete own challenges'
  ) THEN
    CREATE POLICY "Startups can delete own challenges" ON public.community_challenges
    FOR DELETE TO authenticated USING (created_by = auth.uid());
  END IF;
END;
$$;
