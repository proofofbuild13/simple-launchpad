-- Add missing foreign keys to the interviews table
ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD CONSTRAINT interviews_founder_id_fkey
  FOREIGN KEY (founder_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT interviews_builder_id_fkey
  FOREIGN KEY (builder_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT interviews_submission_id_fkey
  FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE SET NULL;
