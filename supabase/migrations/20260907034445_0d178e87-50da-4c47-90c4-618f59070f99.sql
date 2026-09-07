-- Builder profile placeholders
ALTER TABLE public.builder_profiles
  ADD COLUMN IF NOT EXISTS wallet_address text,
  ADD COLUMN IF NOT EXISTS reputation_nft_id text;

-- Room posts
CREATE TABLE public.room_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id text NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  parent_id uuid REFERENCES public.room_posts(id) ON DELETE CASCADE,
  content text NOT NULL,
  converted_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_posts TO authenticated;
GRANT ALL ON public.room_posts TO service_role;
ALTER TABLE public.room_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_select_auth ON public.room_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_insert_self ON public.room_posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY rp_update_self ON public.room_posts FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY rp_delete_self ON public.room_posts FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX room_posts_room_created_idx ON public.room_posts(room_id, created_at DESC);
CREATE TRIGGER room_posts_touch BEFORE UPDATE ON public.room_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Community challenges
CREATE TABLE public.community_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text,
  start_date date NOT NULL DEFAULT current_date,
  end_date date NOT NULL DEFAULT (current_date + 7),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_challenges TO authenticated;
GRANT ALL ON public.community_challenges TO service_role;
ALTER TABLE public.community_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY cc_select_auth ON public.community_challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY cc_admin_write ON public.community_challenges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER community_challenges_touch BEFORE UPDATE ON public.community_challenges FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Community submissions
CREATE TABLE public.community_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES public.community_challenges(id) ON DELETE CASCADE,
  builder_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, builder_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_submissions TO authenticated;
GRANT ALL ON public.community_submissions TO service_role;
ALTER TABLE public.community_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cs_select_auth ON public.community_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY cs_insert_self ON public.community_submissions FOR INSERT TO authenticated WITH CHECK (builder_id = auth.uid());
CREATE POLICY cs_update_self ON public.community_submissions FOR UPDATE TO authenticated USING (builder_id = auth.uid()) WITH CHECK (builder_id = auth.uid());
CREATE POLICY cs_delete_self ON public.community_submissions FOR DELETE TO authenticated USING (builder_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Deal flow (schema for next pass)
CREATE TABLE public.deal_flow_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  founder_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content text NOT NULL,
  raise_stage text,
  seeking_type text NOT NULL DEFAULT 'cash',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_flow_posts TO authenticated;
GRANT ALL ON public.deal_flow_posts TO service_role;
ALTER TABLE public.deal_flow_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY dfp_select_auth ON public.deal_flow_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY dfp_insert_self ON public.deal_flow_posts FOR INSERT TO authenticated WITH CHECK (founder_id = auth.uid());
CREATE POLICY dfp_update_self ON public.deal_flow_posts FOR UPDATE TO authenticated USING (founder_id = auth.uid()) WITH CHECK (founder_id = auth.uid());
CREATE POLICY dfp_delete_self ON public.deal_flow_posts FOR DELETE TO authenticated USING (founder_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER deal_flow_posts_touch BEFORE UPDATE ON public.deal_flow_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.deal_flow_interest (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.deal_flow_posts(id) ON DELETE CASCADE,
  builder_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, builder_id)
);
GRANT SELECT, INSERT, DELETE ON public.deal_flow_interest TO authenticated;
GRANT ALL ON public.deal_flow_interest TO service_role;
ALTER TABLE public.deal_flow_interest ENABLE ROW LEVEL SECURITY;
CREATE POLICY dfi_select_involved ON public.deal_flow_interest FOR SELECT TO authenticated USING (
  builder_id = auth.uid() OR EXISTS (SELECT 1 FROM public.deal_flow_posts p WHERE p.id = post_id AND p.founder_id = auth.uid())
);
CREATE POLICY dfi_insert_self ON public.deal_flow_interest FOR INSERT TO authenticated WITH CHECK (builder_id = auth.uid());
CREATE POLICY dfi_delete_self ON public.deal_flow_interest FOR DELETE TO authenticated USING (builder_id = auth.uid());

-- Proof feed reader
CREATE OR REPLACE FUNCTION public.get_proof_feed(_category text DEFAULT NULL, _limit integer DEFAULT 30)
RETURNS TABLE (
  submission_id uuid,
  submission_title text,
  summary text,
  created_at timestamptz,
  builder_id uuid,
  builder_name text,
  builder_avatar text,
  project_id uuid,
  project_title text,
  category text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id,
         s.title,
         left(coalesce(s.description, ''), 180),
         s.created_at,
         s.builder_id,
         coalesce(bp.full_name, 'Builder'),
         bp.avatar_url,
         p.id,
         p.title,
         p.category
  FROM public.submissions s
  JOIN public.projects p ON p.id = s.project_id
  LEFT JOIN public.builder_profiles bp ON bp.id = s.builder_id
  WHERE s.status IN ('completed','accepted','approved')
    AND (_category IS NULL OR lower(p.category) = lower(_category))
  ORDER BY s.created_at DESC
  LIMIT least(coalesce(_limit, 30), 100);
$$;
REVOKE ALL ON FUNCTION public.get_proof_feed(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_proof_feed(text, integer) TO authenticated;