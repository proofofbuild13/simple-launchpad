CREATE TABLE public.agent_ui_state (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  walkthrough_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_ui_state TO authenticated;
GRANT ALL ON public.agent_ui_state TO service_role;

ALTER TABLE public.agent_ui_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agent ui state"
ON public.agent_ui_state
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER agent_ui_state_touch_updated_at
BEFORE UPDATE ON public.agent_ui_state
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();