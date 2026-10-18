CREATE TABLE public.challenge_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.community_challenges(id) ON DELETE CASCADE,
  builder_id uuid NOT NULL,
  pitch text NOT NULL,
  portfolio_url text,
  submission_url text,
  status text NOT NULL DEFAULT 'pending',
  feedback text,
  approved_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, builder_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_applications TO authenticated;
GRANT ALL ON public.challenge_applications TO service_role;
ALTER TABLE public.challenge_applications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_challenge_creator(_challenge uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_challenges WHERE id = _challenge AND created_by = _user)
$$;
GRANT EXECUTE ON FUNCTION public.is_challenge_creator(uuid, uuid) TO authenticated;

CREATE POLICY ca_select ON public.challenge_applications FOR SELECT TO authenticated
  USING (builder_id = auth.uid() OR public.is_challenge_creator(challenge_id, auth.uid())
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY ca_insert ON public.challenge_applications FOR INSERT TO authenticated
  WITH CHECK (builder_id = auth.uid() AND status = 'pending');
CREATE POLICY ca_update ON public.challenge_applications FOR UPDATE TO authenticated
  USING (builder_id = auth.uid() OR public.is_challenge_creator(challenge_id, auth.uid()))
  WITH CHECK (builder_id = auth.uid() OR public.is_challenge_creator(challenge_id, auth.uid()));
CREATE POLICY ca_delete ON public.challenge_applications FOR DELETE TO authenticated
  USING (builder_id = auth.uid() AND status = 'pending');

CREATE OR REPLACE FUNCTION public.guard_challenge_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_creator boolean := public.is_challenge_creator(NEW.challenge_id, auth.uid());
BEGIN
  NEW.updated_at := now();
  IF NEW.challenge_id <> OLD.challenge_id OR NEW.builder_id <> OLD.builder_id THEN
    RAISE EXCEPTION 'Cannot move application';
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF is_creator AND auth.uid() <> OLD.builder_id THEN
    IF NOT ((OLD.status='pending' AND NEW.status IN ('approved','rejected'))
         OR (OLD.status='submitted' AND NEW.status='reviewed')
         OR (OLD.status='reviewed' AND NEW.status='winner')) THEN
      RAISE EXCEPTION 'Invalid status change % -> %', OLD.status, NEW.status;
    END IF;
    IF NEW.status='approved' THEN NEW.approved_at := now(); END IF;
    IF NEW.status='reviewed' THEN NEW.reviewed_at := now(); END IF;
    PERFORM public.send_notification(OLD.builder_id, 'challenge', 'Challenge application ' || NEW.status, NULL, '/challenges/' || NEW.challenge_id);
  ELSE
    IF NOT (OLD.status='approved' AND NEW.status='submitted' AND coalesce(NEW.submission_url,'') <> '') THEN
      RAISE EXCEPTION 'Builders can only submit after approval';
    END IF;
    NEW.submitted_at := now();
    NEW.feedback := OLD.feedback;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_challenge_application BEFORE UPDATE ON public.challenge_applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_challenge_application();

CREATE OR REPLACE FUNCTION public.challenge_application_count(_challenge uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.challenge_applications WHERE challenge_id = _challenge
$$;
GRANT EXECUTE ON FUNCTION public.challenge_application_count(uuid) TO authenticated;