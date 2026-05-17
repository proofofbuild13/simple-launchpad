
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'startup', 'builder');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User Roles (separate table to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role checker
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Startup profiles
CREATE TABLE public.startup_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  founder_name TEXT,
  website TEXT,
  industry TEXT,
  stage TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.startup_profiles ENABLE ROW LEVEL SECURITY;

-- Builder profiles
CREATE TABLE public.builder_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  skills TEXT[] DEFAULT '{}',
  github TEXT,
  portfolio TEXT,
  linkedin TEXT,
  experience_level TEXT,
  bio TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.builder_profiles ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  short_description TEXT,
  description TEXT,
  requirements TEXT,
  deliverables TEXT,
  budget NUMERIC,
  timeline TEXT,
  contract_type TEXT,
  difficulty TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  nda_required BOOLEAN DEFAULT false,
  ip_agreement BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft',
  tags TEXT[] DEFAULT '{}',
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Submissions
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  builder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  demo_url TEXT,
  live_url TEXT,
  github_url TEXT,
  video_url TEXT,
  tech_stack TEXT[] DEFAULT '{}',
  notes TEXT,
  score NUMERIC,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Offers
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  founder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  builder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_type TEXT,
  duration TEXT,
  compensation NUMERIC,
  milestones JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Contracts
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  founder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  builder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms TEXT,
  escrow_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  milestones JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_profiles_u BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_startup_u BEFORE UPDATE ON public.startup_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_builder_u BEFORE UPDATE ON public.builder_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_projects_u BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_submissions_u BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_offers_u BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_contracts_u BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============== RLS POLICIES ==============

-- Profiles: anyone authenticated can view, only owner updates
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles: user can view own roles, admins can view all; only admins can write
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_insert_self_once" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND role IN ('startup','builder'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- startup_profiles
CREATE POLICY "sp_select_all" ON public.startup_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "sp_insert_own" ON public.startup_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "sp_update_own" ON public.startup_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- builder_profiles
CREATE POLICY "bp_select_all" ON public.builder_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "bp_insert_own" ON public.builder_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "bp_update_own" ON public.builder_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- projects
CREATE POLICY "projects_select_public_or_own" ON public.projects FOR SELECT TO authenticated USING (visibility = 'public' OR founder_id = auth.uid());
CREATE POLICY "projects_insert_founder" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = founder_id AND public.has_role(auth.uid(), 'startup'));
CREATE POLICY "projects_update_own" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = founder_id);
CREATE POLICY "projects_delete_own" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = founder_id);

-- submissions
CREATE POLICY "subs_select_visible" ON public.submissions FOR SELECT TO authenticated USING (
  builder_id = auth.uid() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.founder_id = auth.uid())
);
CREATE POLICY "subs_insert_builder" ON public.submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = builder_id AND public.has_role(auth.uid(), 'builder'));
CREATE POLICY "subs_update_builder_or_founder" ON public.submissions FOR UPDATE TO authenticated USING (
  builder_id = auth.uid() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.founder_id = auth.uid())
);

-- offers
CREATE POLICY "offers_select_parties" ON public.offers FOR SELECT TO authenticated USING (founder_id = auth.uid() OR builder_id = auth.uid());
CREATE POLICY "offers_insert_founder" ON public.offers FOR INSERT TO authenticated WITH CHECK (auth.uid() = founder_id);
CREATE POLICY "offers_update_parties" ON public.offers FOR UPDATE TO authenticated USING (founder_id = auth.uid() OR builder_id = auth.uid());

-- contracts
CREATE POLICY "contracts_select_parties" ON public.contracts FOR SELECT TO authenticated USING (founder_id = auth.uid() OR builder_id = auth.uid());
CREATE POLICY "contracts_insert_founder" ON public.contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() = founder_id);
CREATE POLICY "contracts_update_parties" ON public.contracts FOR UPDATE TO authenticated USING (founder_id = auth.uid() OR builder_id = auth.uid());

-- messages
CREATE POLICY "msgs_select_parties" ON public.messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "msgs_insert_sender" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "msgs_update_recipient" ON public.messages FOR UPDATE TO authenticated USING (recipient_id = auth.uid());

-- notifications
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
