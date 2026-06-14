
CREATE OR REPLACE FUNCTION public.get_project_submission_counts(_ids uuid[])
RETURNS TABLE(project_id uuid, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.project_id, count(*)::bigint
  FROM public.submissions s
  WHERE s.project_id = ANY(_ids)
  GROUP BY s.project_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_project_submission_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_submission_counts(uuid[]) TO authenticated;
