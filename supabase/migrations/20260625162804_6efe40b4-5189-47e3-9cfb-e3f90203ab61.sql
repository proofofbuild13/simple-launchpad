
-- Revoke EXECUTE from PUBLIC/anon on SECURITY DEFINER trigger functions
REVOKE EXECUTE ON FUNCTION public.tg_contract_auto_complete() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_contract_on_signature() FROM PUBLIC, anon;

-- Add explicit deny-all UPDATE policy on storage.objects for message-attachments bucket
DROP POLICY IF EXISTS "message_attachments_no_update" ON storage.objects;
CREATE POLICY "message_attachments_no_update" ON storage.objects
  FOR UPDATE TO authenticated, anon
  USING (bucket_id <> 'message-attachments')
  WITH CHECK (bucket_id <> 'message-attachments');
