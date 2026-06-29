
CREATE TABLE public.agent_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  current_stage int NOT NULL DEFAULT 0,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_threads_founder_idx ON public.agent_threads(founder_id, status, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_threads TO authenticated;
GRANT ALL ON public.agent_threads TO service_role;

ALTER TABLE public.agent_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage own threads" ON public.agent_threads
  FOR ALL USING (auth.uid() = founder_id) WITH CHECK (auth.uid() = founder_id);
CREATE POLICY "Admins view all threads" ON public.agent_threads
  FOR SELECT USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_agent_threads_updated BEFORE UPDATE ON public.agent_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.agent_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content text,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_messages_thread_idx ON public.agent_messages(thread_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_messages TO authenticated;
GRANT ALL ON public.agent_messages TO service_role;

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage messages in own threads" ON public.agent_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.agent_threads t WHERE t.id = thread_id AND t.founder_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.agent_threads t WHERE t.id = thread_id AND t.founder_id = auth.uid())
  );
CREATE POLICY "Admins view all agent messages" ON public.agent_messages
  FOR SELECT USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_messages;
