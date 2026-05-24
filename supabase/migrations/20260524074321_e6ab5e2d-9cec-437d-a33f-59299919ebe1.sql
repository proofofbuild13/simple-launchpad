-- Resume applications table
CREATE TABLE public.resume_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  builder_id UUID NOT NULL,
  resume_url TEXT NOT NULL,
  file_name TEXT,
  extracted_text TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.resume_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY ra_insert_builder ON public.resume_applications
  FOR INSERT TO authenticated
  WITH CHECK (builder_id = auth.uid());

CREATE POLICY ra_select_parties ON public.resume_applications
  FOR SELECT TO authenticated
  USING (
    builder_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = resume_applications.project_id AND p.founder_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY ra_update_builder ON public.resume_applications
  FOR UPDATE TO authenticated
  USING (builder_id = auth.uid());

CREATE TRIGGER trg_resume_applications_updated_at
  BEFORE UPDATE ON public.resume_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_resume_applications_project ON public.resume_applications(project_id);
CREATE INDEX idx_resume_applications_builder ON public.resume_applications(builder_id);

-- Storage bucket for resumes (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Builders upload/read their own resumes (folder = their user id)
CREATE POLICY "Builders upload own resumes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Builders read own resumes"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.resume_applications ra
        JOIN public.projects p ON p.id = ra.project_id
        WHERE ra.resume_url LIKE '%' || storage.objects.name || '%'
          AND p.founder_id = auth.uid()
      )
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "Builders update own resumes"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Builders delete own resumes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);