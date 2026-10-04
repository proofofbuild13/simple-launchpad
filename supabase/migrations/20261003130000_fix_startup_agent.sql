-- Explicit startup-agent actions are committed atomically, using only service RPCs.
-- The existing application uses this engagement enum, but older schema migrations
-- omitted its definition. Keep clean installs and existing deployments consistent.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'engagement_type') THEN
    CREATE TYPE public.engagement_type AS ENUM ('project_hire', 'hire_to_build');
  END IF;
END $$;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS engagement_type public.engagement_type NOT NULL DEFAULT 'project_hire';

-- Merge only the fields an action owns. An evaluation refresh cannot replace a
-- draft or restore an invitation confirmation cleared by another request.
CREATE OR REPLACE FUNCTION public.update_agent_thread(
  _thread_id uuid, _founder_id uuid, _stats_patch jsonb DEFAULT '{}'::jsonb,
  _stage integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.agent_threads%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.agent_threads
  WHERE id = _thread_id AND founder_id = _founder_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_role(_founder_id, 'startup') THEN
    RAISE EXCEPTION 'Startup conversation not found';
  END IF;
  IF t.status <> 'active' THEN RAISE EXCEPTION 'Conversation is archived'; END IF;
  IF _stats_patch IS NULL OR jsonb_typeof(_stats_patch) <> 'object'
     OR (_stage IS NOT NULL AND (_stage < 0 OR _stage > 6)) THEN
    RAISE EXCEPTION 'Invalid conversation update';
  END IF;
  IF t.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = t.project_id AND p.founder_id = _founder_id
  ) THEN RAISE EXCEPTION 'Owned project not found'; END IF;
  UPDATE public.agent_threads SET stats = t.stats || _stats_patch,
    current_stage = greatest(t.current_stage, COALESCE(_stage, t.current_stage)), updated_at = now()
  WHERE id = t.id RETURNING * INTO t;
  RETURN to_jsonb(t);
END;
$$;

CREATE OR REPLACE FUNCTION public.post_agent_project(_thread_id uuid, _founder_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.agent_threads%ROWTYPE;
  draft jsonb;
  p public.projects%ROWTYPE;
  draft_budget numeric;
  draft_currency text;
BEGIN
  SELECT * INTO t FROM public.agent_threads
  WHERE id = _thread_id AND founder_id = _founder_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_role(_founder_id, 'startup') THEN
    RAISE EXCEPTION 'Startup conversation not found';
  END IF;
  IF t.status <> 'active' THEN RAISE EXCEPTION 'Conversation is archived'; END IF;
  IF t.project_id IS NOT NULL THEN
    SELECT * INTO p FROM public.projects WHERE id = t.project_id AND founder_id = _founder_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owned project not found'; END IF;
    RETURN jsonb_build_object('project_id', p.id, 'title', p.title, 'already_posted', true);
  END IF;
  draft := t.stats->'project_draft';
  IF draft IS NULL OR jsonb_typeof(draft) <> 'object'
     OR NULLIF(btrim(draft->>'title'), '') IS NULL
     OR NULLIF(btrim(draft->>'description'), '') IS NULL
     OR NULLIF(btrim(draft->>'requirements'), '') IS NULL
     OR NULLIF(btrim(draft->>'deliverables'), '') IS NULL
     OR jsonb_typeof(draft->'skills') IS DISTINCT FROM 'array'
     OR COALESCE(draft->>'difficulty', '') NOT IN ('junior', 'mid', 'senior')
     OR COALESCE(draft->>'category', '') NOT IN ('AI', 'SaaS', 'Mobile', 'Web', 'No-code', 'Marketing', 'Data') THEN
    RAISE EXCEPTION 'A valid reviewed project draft is required';
  END IF;
  draft_currency := COALESCE(NULLIF(upper(draft->>'currency'), ''), 'USD');
  IF draft_currency NOT IN ('USD', 'INR', 'EUR', 'GBP') THEN RAISE EXCEPTION 'Unsupported currency'; END IF;
  IF draft->'budget' IS NOT NULL AND jsonb_typeof(draft->'budget') <> 'null' THEN
    IF jsonb_typeof(draft->'budget') <> 'number' THEN RAISE EXCEPTION 'Invalid budget'; END IF;
    draft_budget := (draft->>'budget')::numeric;
    IF draft_budget < 0 OR draft_budget > 1000000000000 THEN RAISE EXCEPTION 'Invalid budget'; END IF;
  END IF;
  INSERT INTO public.projects (
    founder_id, title, category, short_description, description, requirements,
    deliverables, difficulty, timeline, tags, budget, currency, contract_type,
    engagement_type, visibility, status
  ) VALUES (
    _founder_id, btrim(draft->>'title'), draft->>'category', draft->>'short_description',
    draft->>'description', draft->>'requirements', draft->>'deliverables',
    draft->>'difficulty', NULLIF(draft->>'duration', ''),
    ARRAY(SELECT jsonb_array_elements_text(draft->'skills')),
    draft_budget, draft_currency, 'fixed', 'project_hire', 'public', 'open_for_submissions'
  ) RETURNING * INTO p;
  UPDATE public.agent_threads SET project_id = p.id, current_stage = 3,
    stats = t.stats || jsonb_build_object('project_draft', null, 'awaiting', null), updated_at = now()
  WHERE id = t.id;
  RETURN jsonb_build_object('project_id', p.id, 'title', p.title, 'already_posted', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_agent_builders(
  _thread_id uuid, _founder_id uuid, _builder_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.agent_threads%ROWTYPE;
  p public.projects%ROWTYPE;
  valid_ids uuid[];
  new_ids uuid[];
  invited_count integer;
  total_count integer;
BEGIN
  IF _builder_ids IS NULL OR cardinality(_builder_ids) < 1 OR cardinality(_builder_ids) > 10 THEN
    RAISE EXCEPTION 'Select between 1 and 10 builders';
  END IF;
  SELECT * INTO t FROM public.agent_threads
  WHERE id = _thread_id AND founder_id = _founder_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_role(_founder_id, 'startup') THEN
    RAISE EXCEPTION 'Startup conversation not found';
  END IF;
  IF t.status <> 'active' OR t.project_id IS NULL THEN RAISE EXCEPTION 'An active posted project is required'; END IF;
  -- Lock the project too: separate agent conversations must not duplicate invites.
  SELECT * INTO p FROM public.projects
  WHERE id = t.project_id AND founder_id = _founder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned project not found'; END IF;
  IF p.status NOT IN ('open', 'open_for_submissions', 'reviewing_submissions', 'hiring_in_progress') THEN
    RAISE EXCEPTION 'Project is not accepting builders';
  END IF;
  SELECT array_agg(b.id ORDER BY b.id) INTO valid_ids FROM public.builder_profiles b
  WHERE b.id = ANY(_builder_ids) AND b.id <> _founder_id AND b.available IS TRUE;
  IF COALESCE(cardinality(valid_ids), 0) = 0 THEN RAISE EXCEPTION 'No available builders selected'; END IF;
  SELECT array_agg(candidate.id ORDER BY candidate.id) INTO new_ids FROM unnest(valid_ids) candidate(id)
  WHERE NOT EXISTS (SELECT 1 FROM public.project_invitations i WHERE i.project_id = p.id AND i.builder_id = candidate.id);
  invited_count := COALESCE(cardinality(new_ids), 0);
  IF invited_count > 0 THEN
    INSERT INTO public.project_invitations(project_id, founder_id, builder_id, message, status)
    SELECT p.id, _founder_id, candidate.id,
      'You''re a strong match for "' || p.title || '". Take a look and submit your work.', 'sent'
    FROM unnest(new_ids) candidate(id);
    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT candidate.id, 'project_invitation', 'New project invitation',
      'A startup invited you to submit on "' || p.title || '".', '/projects/' || p.id::text
    FROM unnest(new_ids) candidate(id);
  END IF;
  SELECT count(DISTINCT builder_id) INTO total_count FROM public.project_invitations WHERE project_id = p.id;
  UPDATE public.agent_threads SET current_stage = greatest(t.current_stage, 5),
    stats = t.stats || jsonb_build_object('invited', total_count, 'awaiting', null), updated_at = now()
  WHERE id = t.id;
  RETURN jsonb_build_object('invited', invited_count, 'builder_ids', COALESCE(to_jsonb(new_ids), '[]'::jsonb),
    'invited_total', total_count, 'already_invited', cardinality(valid_ids) - invited_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_agent_thread(_thread_id uuid, _founder_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.agent_threads%ROWTYPE;
  replacement_id uuid;
BEGIN
  SELECT * INTO t FROM public.agent_threads
  WHERE id = _thread_id AND founder_id = _founder_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_role(_founder_id, 'startup') THEN
    RAISE EXCEPTION 'Startup conversation not found';
  END IF;
  IF t.status = 'archived' AND t.stats->>'reset_thread_id' IS NOT NULL THEN
    SELECT id INTO replacement_id FROM public.agent_threads
    WHERE id = (t.stats->>'reset_thread_id')::uuid AND founder_id = _founder_id;
    IF replacement_id IS NOT NULL THEN RETURN jsonb_build_object('thread_id', replacement_id); END IF;
  END IF;
  IF t.status NOT IN ('active', 'archived') THEN RAISE EXCEPTION 'Conversation is unavailable'; END IF;
  INSERT INTO public.agent_threads(founder_id, status, current_stage, stats)
    VALUES (_founder_id, 'active', 0, '{}'::jsonb) RETURNING id INTO replacement_id;
  UPDATE public.agent_threads SET status = 'archived',
    stats = t.stats || jsonb_build_object('reset_thread_id', replacement_id), updated_at = now()
  WHERE id = t.id;
  RETURN jsonb_build_object('thread_id', replacement_id);
END;
$$;

REVOKE ALL ON FUNCTION public.post_agent_project(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invite_agent_builders(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_agent_thread(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_agent_thread(uuid, uuid, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_agent_project(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.invite_agent_builders(uuid, uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_agent_thread(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_agent_thread(uuid, uuid, jsonb, integer) TO service_role;
