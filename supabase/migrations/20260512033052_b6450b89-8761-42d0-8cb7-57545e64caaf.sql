
ALTER TABLE public.builder_profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS work_preference text,
  ADD COLUMN IF NOT EXISTS banner_image text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_projects integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_time_hours integer,
  ADD COLUMN IF NOT EXISTS featured_projects jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;

ALTER TABLE public.startup_profiles
  ADD COLUMN IF NOT EXISTS company_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_image text,
  ADD COLUMN IF NOT EXISTS mission text,
  ADD COLUMN IF NOT EXISTS hiring_status text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_projects integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.saved_builders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id uuid NOT NULL,
  builder_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (founder_id, builder_id)
);
ALTER TABLE public.saved_builders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_builders_select_own" ON public.saved_builders FOR SELECT TO authenticated USING (founder_id = auth.uid());
CREATE POLICY "saved_builders_insert_own" ON public.saved_builders FOR INSERT TO authenticated WITH CHECK (founder_id = auth.uid());
CREATE POLICY "saved_builders_delete_own" ON public.saved_builders FOR DELETE TO authenticated USING (founder_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.followed_startups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id uuid NOT NULL,
  startup_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (builder_id, startup_id)
);
ALTER TABLE public.followed_startups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followed_startups_select_own" ON public.followed_startups FOR SELECT TO authenticated USING (builder_id = auth.uid());
CREATE POLICY "followed_startups_insert_own" ON public.followed_startups FOR INSERT TO authenticated WITH CHECK (builder_id = auth.uid());
CREATE POLICY "followed_startups_delete_own" ON public.followed_startups FOR DELETE TO authenticated USING (builder_id = auth.uid());
