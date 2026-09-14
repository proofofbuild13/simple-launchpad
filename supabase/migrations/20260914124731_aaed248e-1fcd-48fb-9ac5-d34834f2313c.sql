
CREATE TABLE public.engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id, action)
);

GRANT SELECT, INSERT, DELETE ON public.engagements TO authenticated;
GRANT SELECT ON public.engagements TO anon;
GRANT ALL ON public.engagements TO service_role;

ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "engagements_select_all" ON public.engagements
  FOR SELECT USING (true);
CREATE POLICY "engagements_insert_own" ON public.engagements
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "engagements_delete_own" ON public.engagements
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_engagements_entity ON public.engagements (entity_type, entity_id, action);
CREATE INDEX idx_engagements_user ON public.engagements (user_id);

CREATE TABLE public.collective_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collective_comments TO authenticated;
GRANT SELECT ON public.collective_comments TO anon;
GRANT ALL ON public.collective_comments TO service_role;

ALTER TABLE public.collective_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_select_all" ON public.collective_comments
  FOR SELECT USING (true);
CREATE POLICY "cc_insert_own" ON public.collective_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "cc_update_own" ON public.collective_comments
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "cc_delete_own" ON public.collective_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_cc_entity ON public.collective_comments (entity_type, entity_id, created_at);

CREATE TRIGGER collective_comments_touch
  BEFORE UPDATE ON public.collective_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
