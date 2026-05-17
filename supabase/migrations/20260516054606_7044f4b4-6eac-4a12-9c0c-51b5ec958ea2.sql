
-- Projects: archive
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.can_delete_project(_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  has_contracts boolean;
  has_payments boolean;
  has_disputes boolean;
  has_submissions boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM contracts WHERE project_id = _project_id) INTO has_contracts;
  SELECT EXISTS(SELECT 1 FROM payment_records pr JOIN contracts c ON c.id = pr.contract_id WHERE c.project_id = _project_id) INTO has_payments;
  SELECT EXISTS(SELECT 1 FROM disputes d JOIN contracts c ON c.id = d.contract_id WHERE c.project_id = _project_id) INTO has_disputes;
  SELECT EXISTS(SELECT 1 FROM submissions WHERE project_id = _project_id) INTO has_submissions;
  RETURN jsonb_build_object(
    'can_delete', NOT (has_contracts OR has_payments OR has_disputes),
    'has_contracts', has_contracts,
    'has_payments', has_payments,
    'has_disputes', has_disputes,
    'has_submissions', has_submissions
  );
END; $$;

-- SAVED PROJECTS
CREATE TABLE public.saved_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);
ALTER TABLE public.saved_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY sp_select_own ON public.saved_projects FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY sp_insert_own ON public.saved_projects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY sp_delete_own ON public.saved_projects FOR DELETE TO authenticated USING (user_id = auth.uid());

-- CONVERSATIONS
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct',
  context_type text,
  context_id uuid,
  created_by uuid,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  archived boolean NOT NULL DEFAULT false,
  blocked boolean NOT NULL DEFAULT false,
  UNIQUE(conversation_id, user_id)
);
CREATE INDEX idx_cp_user ON public.conversation_participants(user_id);
CREATE INDEX idx_cp_conversation ON public.conversation_participants(conversation_id);

CREATE TABLE public.messages_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  content text,
  attachment_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_msgs_v2_conv ON public.messages_v2(conversation_id, created_at);

-- Helper to check membership without recursion
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.conversation_participants
                WHERE conversation_id = _conv AND user_id = _user);
$$;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conv_select_participant ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()));
CREATE POLICY conv_insert_self ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY conv_update_participant ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()));

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp_select_self_or_member ON public.conversation_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY cp_insert_self ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR EXISTS(
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid()
  ));
CREATE POLICY cp_update_self ON public.conversation_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.messages_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY msg2_select_member ON public.messages_v2 FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY msg2_insert_member ON public.messages_v2 FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages_v2;
ALTER TABLE public.messages_v2 REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- RPC: get or create direct conversation
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(_other_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _other_user = auth.uid() THEN RAISE EXCEPTION 'Cannot DM yourself'; END IF;

  SELECT c.id INTO cid
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND EXISTS(SELECT 1 FROM public.conversation_participants p WHERE p.conversation_id=c.id AND p.user_id=auth.uid())
    AND EXISTS(SELECT 1 FROM public.conversation_participants p WHERE p.conversation_id=c.id AND p.user_id=_other_user)
    AND (SELECT COUNT(*) FROM public.conversation_participants p WHERE p.conversation_id=c.id) = 2
  LIMIT 1;

  IF cid IS NOT NULL THEN RETURN cid; END IF;

  INSERT INTO public.conversations (type, created_by) VALUES ('direct', auth.uid()) RETURNING id INTO cid;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (cid, auth.uid()), (cid, _other_user);
  RETURN cid;
END; $$;

-- Trigger: bump last_message_at + notify
CREATE OR REPLACE FUNCTION public.on_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec record;
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  FOR rec IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id AND NOT blocked
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (rec.user_id, 'new_message', 'New message',
      COALESCE(LEFT(NEW.content, 80), '[attachment]'), '/messages?c=' || NEW.conversation_id);
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER msg2_on_new AFTER INSERT ON public.messages_v2
FOR EACH ROW EXECUTE FUNCTION public.on_new_message();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('message-attachments','message-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY ma_upload_own ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY ma_read_own ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY ma_delete_own ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
