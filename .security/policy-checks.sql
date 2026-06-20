-- .security/policy-checks.sql
-- Automated assertions that the 4 RLS/grant remediations are intact.
-- Each assertion RAISEs EXCEPTION on failure so psql exits non-zero in CI.
-- Read-only: no data is inserted or mutated.
--
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f .security/policy-checks.sql
-- or via the wrapper:
--   bun run check:policies

\set ON_ERROR_STOP on
\timing off

DO $$
DECLARE
  bad int;
  rec record;
BEGIN
  RAISE NOTICE '── 2.1 builder_profiles.phone column grants ──';

  SELECT count(*) INTO bad
  FROM information_schema.column_privileges
  WHERE table_schema='public'
    AND table_name='builder_profiles'
    AND column_name='phone'
    AND grantee IN ('anon','authenticated');
  IF bad > 0 THEN
    RAISE EXCEPTION 'FAIL 2.1a: anon/authenticated still has column privilege on builder_profiles.phone (% rows)', bad;
  END IF;
  RAISE NOTICE '  OK  no anon/authenticated grants on phone';

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_my_builder_phone' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'FAIL 2.1b: get_my_builder_phone() missing or not SECURITY DEFINER';
  END IF;
  RAISE NOTICE '  OK  get_my_builder_phone() exists and is SECURITY DEFINER';

  IF NOT has_function_privilege('authenticated','public.get_my_builder_phone()','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL 2.1c: authenticated lacks EXECUTE on get_my_builder_phone()';
  END IF;
  RAISE NOTICE '  OK  authenticated can EXECUTE get_my_builder_phone()';

  RAISE NOTICE '── 2.2 commission_invoices admin INSERT/DELETE policies ──';
  FOR rec IN
    SELECT unnest(ARRAY['ci_insert_admin','ci_delete_admin']) AS pol
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policy
                   WHERE polrelid='public.commission_invoices'::regclass
                     AND polname=rec.pol) THEN
      RAISE EXCEPTION 'FAIL 2.2: policy % missing on commission_invoices', rec.pol;
    END IF;
  END LOOP;
  RAISE NOTICE '  OK  ci_insert_admin + ci_delete_admin present';

  RAISE NOTICE '── 2.3 escrow_ledger admin INSERT/UPDATE/DELETE policies ──';
  FOR rec IN
    SELECT unnest(ARRAY['el_insert_admin','el_update_admin','el_delete_admin']) AS pol
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policy
                   WHERE polrelid='public.escrow_ledger'::regclass
                     AND polname=rec.pol) THEN
      RAISE EXCEPTION 'FAIL 2.3: policy % missing on escrow_ledger', rec.pol;
    END IF;
  END LOOP;
  RAISE NOTICE '  OK  el_insert_admin + el_update_admin + el_delete_admin present';

  RAISE NOTICE '── 2.4 payments admin DELETE policy ──';
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.payments'::regclass
                   AND polname='pay_delete_admin'
                   AND polcmd='d') THEN
    RAISE EXCEPTION 'FAIL 2.4: pay_delete_admin policy missing on payments';
  END IF;
  RAISE NOTICE '  OK  pay_delete_admin present';

  RAISE NOTICE '── RLS enabled on all four tables ──';
  FOR rec IN
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname IN ('builder_profiles','commission_invoices','escrow_ledger','payments')
  LOOP
    IF NOT rec.relrowsecurity THEN
      RAISE EXCEPTION 'FAIL: RLS disabled on public.%', rec.relname;
    END IF;
    RAISE NOTICE '  OK  RLS enabled on %', rec.relname;
  END LOOP;

  RAISE NOTICE '✓ All policy checks passed';
END $$;
