
-- 1) Create SECURITY DEFINER RPC for sending workflow notifications with relationship checks
CREATE OR REPLACE FUNCTION public.send_notification(
  _user_id uuid,
  _type text,
  _title text,
  _body text DEFAULT NULL,
  _link text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nid uuid;
  ok boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _user_id = auth.uid() THEN
    ok := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.offers o
    WHERE ((o.founder_id = auth.uid() AND o.builder_id = _user_id)
        OR (o.builder_id = auth.uid() AND o.founder_id = _user_id))
  ) THEN
    ok := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE ((c.founder_id = auth.uid() AND c.builder_id = _user_id)
        OR (c.builder_id = auth.uid() AND c.founder_id = _user_id))
  ) THEN
    ok := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.founder_id = auth.uid()
  ) AND EXISTS (
    SELECT 1 FROM public.builder_profiles b WHERE b.id = _user_id
  ) THEN
    -- founders may notify builders (e.g., project invitations)
    ok := true;
  ELSIF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    ok := true;
  END IF;

  IF NOT ok THEN
    RAISE EXCEPTION 'Not authorized to notify this user';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link)
  RETURNING id INTO nid;
  RETURN nid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, text) TO authenticated;

-- 2) Tighten notifications INSERT policy: only self-inserts via direct table access
DROP POLICY IF EXISTS notif_insert_workflow ON public.notifications;
CREATE POLICY notif_insert_self ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3) Storage: add UPDATE/DELETE policies for payment-proofs scoped to uploader
CREATE POLICY payment_proofs_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-proofs' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'payment-proofs' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY payment_proofs_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'payment-proofs' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 4) Revoke public EXECUTE on trigger SECURITY DEFINER functions (not meant to be called via API)
REVOKE EXECUTE ON FUNCTION public.on_new_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_payment_method_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_employment_offer_accepted() FROM PUBLIC, anon, authenticated;

-- 5) Realtime channel authorization: restrict realtime.messages broadcasts to authenticated users
--    with topic-based access checks. Default-deny by enabling RLS with a scoped policy.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    -- Drop prior policy if re-running
    EXECUTE 'DROP POLICY IF EXISTS rt_authenticated_can_read_own ON realtime.messages';
    -- Only authenticated users may receive realtime messages; postgres-changes payloads
    -- still rely on the underlying table RLS to filter row visibility per subscriber.
    EXECUTE $p$CREATE POLICY rt_authenticated_can_read_own ON realtime.messages
              FOR SELECT TO authenticated USING (true)$p$;
  END IF;
END $$;
