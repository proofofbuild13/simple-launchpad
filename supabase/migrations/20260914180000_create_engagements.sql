-- Polymorphic Engagements Table & Counters Migration
-- Date: 2026-09-14

-- 1. Create Enums for Entity Types and Actions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engagement_entity_type') THEN
    CREATE TYPE public.engagement_entity_type AS ENUM ('project', 'room_post', 'proof', 'challenge');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engagement_action') THEN
    CREATE TYPE public.engagement_action AS ENUM ('like', 'save');
  END IF;
END $$;

-- 2. Create polymorphic engagements table
CREATE TABLE IF NOT EXISTS public.engagements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type public.engagement_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  action public.engagement_action NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engagements_user_entity_action_unique UNIQUE (user_id, entity_type, entity_id, action)
);

-- 3. Grants and Row Level Security
GRANT SELECT, INSERT, DELETE ON public.engagements TO authenticated;
GRANT SELECT ON public.engagements TO anon;
GRANT ALL ON public.engagements TO service_role;

ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY engagements_select_all ON public.engagements
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY engagements_insert_self ON public.engagements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY engagements_delete_self ON public.engagements
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_engagements_entity ON public.engagements(entity_type, entity_id, action);
CREATE INDEX IF NOT EXISTS idx_engagements_user ON public.engagements(user_id, action);

-- 5. Add cached counter columns to source tables
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.room_posts
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.community_challenges
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_count integer NOT NULL DEFAULT 0;

-- 6. Trigger to automatically keep counter columns synchronized
CREATE OR REPLACE FUNCTION public.sync_engagement_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  delta integer;
  target_entity_type public.engagement_entity_type;
  target_entity_id uuid;
  target_action public.engagement_action;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := 1;
    target_entity_type := NEW.entity_type;
    target_entity_id := NEW.entity_id;
    target_action := NEW.action;
  ELSIF TG_OP = 'DELETE' THEN
    delta := -1;
    target_entity_type := OLD.entity_type;
    target_entity_id := OLD.entity_id;
    target_action := OLD.action;
  ELSE
    RETURN NULL;
  END IF;

  IF target_action = 'like' THEN
    IF target_entity_type = 'project' THEN
      UPDATE public.projects SET like_count = GREATEST(0, like_count + delta) WHERE id = target_entity_id;
    ELSIF target_entity_type = 'room_post' THEN
      UPDATE public.room_posts SET like_count = GREATEST(0, like_count + delta) WHERE id = target_entity_id;
    ELSIF target_entity_type = 'proof' THEN
      UPDATE public.submissions SET like_count = GREATEST(0, like_count + delta) WHERE id = target_entity_id;
    ELSIF target_entity_type = 'challenge' THEN
      UPDATE public.community_challenges SET like_count = GREATEST(0, like_count + delta) WHERE id = target_entity_id;
    END IF;
  ELSIF target_action = 'save' THEN
    IF target_entity_type = 'project' THEN
      UPDATE public.projects SET save_count = GREATEST(0, save_count + delta) WHERE id = target_entity_id;
    ELSIF target_entity_type = 'room_post' THEN
      UPDATE public.room_posts SET save_count = GREATEST(0, save_count + delta) WHERE id = target_entity_id;
    ELSIF target_entity_type = 'proof' THEN
      UPDATE public.submissions SET save_count = GREATEST(0, save_count + delta) WHERE id = target_entity_id;
    ELSIF target_entity_type = 'challenge' THEN
      UPDATE public.community_challenges SET save_count = GREATEST(0, save_count + delta) WHERE id = target_entity_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_engagement_counters ON public.engagements;
CREATE TRIGGER trigger_sync_engagement_counters
  AFTER INSERT OR DELETE ON public.engagements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_engagement_counters();

-- 7. Aggregate counts view
CREATE OR REPLACE VIEW public.engagement_aggregates AS
SELECT
  entity_type,
  entity_id,
  COUNT(*) FILTER (WHERE action = 'like') AS like_count,
  COUNT(*) FILTER (WHERE action = 'save') AS save_count
FROM public.engagements
GROUP BY entity_type, entity_id;
