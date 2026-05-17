-- Add missing foreign keys on saved_projects so that
-- Supabase PostgREST can resolve the "projects(*)" join
-- and referential integrity is enforced.

ALTER TABLE public.saved_projects
  ADD CONSTRAINT saved_projects_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.saved_projects
  ADD CONSTRAINT saved_projects_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
