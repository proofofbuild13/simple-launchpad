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
    INSERT INTO public.notifications (user_id, type, title, link)
    VALUES (OLD.builder_id, 'challenge', 'Challenge application ' || NEW.status, '/challenges/' || NEW.challenge_id);
  ELSE
    IF NOT (OLD.status='approved' AND NEW.status='submitted' AND coalesce(NEW.submission_url,'') <> '') THEN
      RAISE EXCEPTION 'Builders can only submit after approval';
    END IF;
    NEW.submitted_at := now();
    NEW.feedback := OLD.feedback;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_challenge_application() FROM PUBLIC, anon, authenticated;