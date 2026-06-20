# Security Remediation Checklist

_Generated: 2026-06-20 — source: `.security/report.md`, `security-scan-report.md`, migration `20260620154914`_

Track each finding from every scanner until it's verified fixed in production. Check a box only when the remediation is **deployed AND re-scanned with zero regressions**.

Run SQL via the [SQL Editor](https://supabase.com/dashboard/project/nvnvyzxzjezlgzgpniyt/sql/new). For "as non-admin authenticated user" checks, sign in as a normal user in the app, copy their JWT from `localStorage` (`sb-<ref>-auth-token`), and in SQL Editor switch role with `SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claims" = '{"sub":"<user-uuid>","role":"authenticated"}';` before running the query.

---

## Legend
- [ ] Open / in-progress
- [x] Fully resolved (deployed + re-scanned clean)

---

## 1. `connector_security_scan` (Wiz)

Workspace-level scanner. Findings have no file/line references.

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| — | _none reported_ | — | [x] Clean |

### Verification
- [ ] Re-run Wiz scan after every schema-affecting migration
- [ ] Re-run Wiz scan after every new connector added to the workspace
- [ ] Add placeholder entry to `.security/findings.json` recording "no findings on <date>"
- [ ] `bun run check:security` exits 0 in CI

---

## 2. `supabase_lov` (Lovable RLS scanner)

Migration: `supabase/migrations/20260620154914_*.sql`

---

### 2.1 🔴 `builder_profiles.phone` readable by all authenticated users

**Fix applied:**
- Revoked `SELECT(phone)` from `anon` and `authenticated`
- Created `public.get_my_builder_phone()` SECURITY DEFINER; `EXECUTE` granted to `authenticated`
- Admin path: `public.admin_get_user_full()` (strips `phone` from `builder_profile.profile` and exposes it only inside the `identity` block to admins)

**Verification checklist**
- [ ] Migration deployed
- [ ] Column grant revoked
- [ ] Owner RPC returns own phone
- [ ] Non-owner cannot read `phone` via PostgREST or SQL
- [ ] Admin RPC returns phone for any user
- [ ] `src/pages/profile/Profile.tsx` + `src/lib/builderProfileFields.ts` still work end-to-end

**Sample queries**

```sql
-- a) Confirm column-level grant is revoked
SELECT grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema='public'
  AND table_name='builder_profiles'
  AND column_name='phone';
-- Expect: only postgres / service_role. No 'authenticated' or 'anon'.

-- b) As a non-owner authenticated user, this MUST fail with permission denied:
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"<some-other-user-uuid>","role":"authenticated"}';
SELECT phone FROM public.builder_profiles LIMIT 1;
-- Expect: ERROR: permission denied for column phone
RESET ROLE;

-- c) As the owner, RPC returns their phone:
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"<owner-uuid>","role":"authenticated"}';
SELECT public.get_my_builder_phone();
-- Expect: the owner's phone value (or NULL if unset)
RESET ROLE;

-- d) As an admin, admin_get_user_full returns identity.phone:
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"<admin-uuid>","role":"authenticated"}';
SELECT public.admin_get_user_full('<target-user-uuid>') -> 'identity' ->> 'phone';
RESET ROLE;
```

Client smoke test (browser console while signed in as a non-owner):
```ts
const { data, error } = await supabase
  .from('builder_profiles')
  .select('phone')
  .neq('id', (await supabase.auth.getUser()).data.user!.id)
  .limit(1);
console.assert(error, 'phone leak: expected permission error');
```

---

### 2.2 🟡 `commission_invoices` missing INSERT/DELETE policy

**Fix applied:** Added `ci_insert_admin`, `ci_delete_admin` — admin/super_admin only via `has_role()`.

**Verification checklist**
- [ ] Policies exist
- [ ] Non-admin cannot INSERT
- [ ] Non-admin cannot DELETE
- [ ] Admin can INSERT and DELETE

**Sample queries**

```sql
-- a) Confirm policies exist
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.commission_invoices'::regclass
  AND polname IN ('ci_insert_admin','ci_delete_admin');
-- Expect 2 rows: cmd 'a' (INSERT) and 'd' (DELETE)

-- b) Non-admin INSERT must fail
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"<non-admin-uuid>","role":"authenticated"}';
INSERT INTO public.commission_invoices (payment_record_id, invoice_number, base_amount, commission_rate, commission_amount, due_date, status)
VALUES (gen_random_uuid(), 'TEST-DENY', 100, 0.15, 15, CURRENT_DATE+7, 'generated');
-- Expect: ERROR: new row violates row-level security policy
RESET ROLE;

-- c) Non-admin DELETE must affect 0 rows (RLS filter)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"<non-admin-uuid>","role":"authenticated"}';
WITH d AS (DELETE FROM public.commission_invoices WHERE invoice_number='ANY' RETURNING 1)
SELECT count(*) FROM d;
-- Expect: 0
RESET ROLE;
```

---

### 2.3 🟡 `escrow_ledger` missing INSERT/UPDATE/DELETE policy

**Fix applied:** Added `el_insert_admin`, `el_update_admin`, `el_delete_admin` — admin/super_admin only. (Functions like `fund_escrow`, `release_escrow_for_milestone`, `admin_resolve_escrow` are SECURITY DEFINER and bypass these policies as intended.)

**Verification checklist**
- [ ] All three policies exist
- [ ] Non-admin cannot write directly
- [ ] `fund_escrow()` still works for the contract founder
- [ ] `release_escrow_for_milestone()` still works for the founder on an approved milestone

**Sample queries**

```sql
-- a) Confirm policies
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.escrow_ledger'::regclass
  AND polname LIKE 'el_%_admin';
-- Expect 3 rows: 'a','w','d'

-- b) Non-admin direct INSERT must fail
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"<non-admin-uuid>","role":"authenticated"}';
INSERT INTO public.escrow_ledger (contract_id, entry_type, amount, balance_after, created_by)
VALUES (gen_random_uuid(), 'funded', 1, 1, '<non-admin-uuid>');
-- Expect: ERROR: violates RLS
RESET ROLE;

-- c) Non-admin UPDATE/DELETE must affect 0 rows
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"<non-admin-uuid>","role":"authenticated"}';
WITH u AS (UPDATE public.escrow_ledger SET notes='x' WHERE false RETURNING 1) SELECT count(*) FROM u;
WITH d AS (DELETE FROM public.escrow_ledger WHERE false RETURNING 1) SELECT count(*) FROM d;
-- Expect: 0, 0
RESET ROLE;

-- d) SECURITY DEFINER path still works (run as the founder of a real contract)
SELECT public.fund_escrow('<contract-uuid>', 100, 'TEST-REF');
-- Expect: returns ledger row UUID, escrow_ledger row inserted
```

---

### 2.4 🟡 `payments` missing DELETE policy

**Fix applied:** Added `pay_delete_admin` — admin/super_admin only.

**Verification checklist**
- [ ] Policy exists
- [ ] Non-admin DELETE affects 0 rows
- [ ] Admin DELETE works

**Sample queries**

```sql
-- a) Policy present
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.payments'::regclass
  AND polname = 'pay_delete_admin';
-- Expect 1 row, polcmd='d'

-- b) Non-admin DELETE blocked
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"<non-admin-uuid>","role":"authenticated"}';
WITH d AS (DELETE FROM public.payments WHERE id = '<any-real-id>' RETURNING 1)
SELECT count(*) FROM d;
-- Expect: 0
RESET ROLE;
```

---

## 3. Cross-cutting verification

- [ ] `supabase--linter` returns no new findings
- [ ] `security--run_security_scan` returns clean
- [ ] App smoke test: builder edits own phone (Profile page) — works
- [ ] App smoke test: founder funds escrow — works (`escrow_ledger` row created via SECURITY DEFINER)
- [ ] App smoke test: founder releases milestone — works
- [ ] App smoke test: admin verifies a commission payment — works

```sql
-- One-shot snapshot of RLS coverage on the four affected tables
SELECT c.relname AS table,
       c.relrowsecurity AS rls_enabled,
       count(p.*) AS policy_count,
       array_agg(p.polname ORDER BY p.polname) AS policies
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relname IN ('builder_profiles','commission_invoices','escrow_ledger','payments')
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;
```

---

## Pre-deploy gate
- [ ] `.security/findings.json` has zero `open` entries
- [ ] All `ignored` entries carry a non-empty `reason`
- [ ] `bun run check:security` exits 0
- [ ] `bunx tsx scripts/generate-security-report.ts` regenerated `.security/report.md`
- [ ] Wiz placeholder entry present for current date

## Ongoing cadence
- [ ] Weekly: re-run all scanners and reconcile this checklist
- [ ] On every PR touching `supabase/migrations/**` or `public.*`: re-run `supabase_lov` + Wiz
- [ ] On every new connector: re-run Wiz before merging
