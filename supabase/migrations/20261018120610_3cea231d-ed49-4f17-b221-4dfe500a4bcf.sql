REVOKE EXECUTE ON FUNCTION public.is_challenge_creator(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.challenge_application_count(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_challenge_application() FROM PUBLIC, anon, authenticated;