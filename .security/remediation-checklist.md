# Security Remediation Checklist

_Generated: 2026-06-20 — source: `.security/report.md`, `security-scan-report.md`_

Track each finding from every scanner until it's verified fixed in production. Check a box only when the remediation is **deployed AND re-scanned with zero regressions**.

---

## Legend
- [ ] Open / in-progress
- [x] Fully resolved (deployed + re-scanned clean)
- N/A — Not applicable (document reason)

---

## 1. `connector_security_scan` (Wiz)

Workspace-level scanner. Findings have no file/line references — they target the workspace/connector posture.

| # | Finding ID | Title | Severity | Status | Remediation | Verified |
|---|------------|-------|----------|--------|-------------|----------|
| — | _none reported_ | — | — | ✅ Clean | No findings as of last scan | [x] |

### Wiz re-scan gate
- [ ] Re-run Wiz scan after **every** schema-affecting migration
- [ ] Re-run Wiz scan after **every** new connector added to the workspace
- [ ] Add a placeholder entry to `.security/findings.json` recording "no findings reported on <date>" so `check-security-findings.ts` confirms the scanner was considered
- [ ] Confirm `bun run check:security` passes in CI before deploy

---

## 2. `supabase_lov` (Lovable RLS scanner)

Migration: `supabase/migrations/20260620154914_512a447e-1d42-4ee5-91c2-03ef1312c074.sql`

| # | Finding | Severity | File / Object | Remediation | Done |
|---|---------|----------|---------------|-------------|------|
| 2.1 | `builder_profiles.phone` readable by all authenticated users | 🔴 error | `public.builder_profiles.phone` | Revoked `SELECT(phone)` from `anon`/`authenticated`; added `get_my_builder_phone()` SECURITY DEFINER + `EXECUTE` to `authenticated`. Admin path via `admin_get_user_full`. | [x] |
| 2.2 | `commission_invoices` missing INSERT/DELETE policy | 🟡 warn | `public.commission_invoices` | Added `ci_insert_admin`, `ci_delete_admin` (admin-only via `has_role`). | [x] |
| 2.3 | `escrow_ledger` missing INSERT/UPDATE/DELETE policy | 🟡 warn | `public.escrow_ledger` | Added `el_insert_admin`, `el_update_admin`, `el_delete_admin` (admin-only). | [x] |
| 2.4 | `payments` missing DELETE policy | 🟡 warn | `public.payments` | Added `pay_delete_admin` (admin-only). | [x] |

### Verification
- [x] Migration applied
- [x] Post-migration scan returns 0 findings
- [ ] Client read paths verified (`src/pages/profile/Profile.tsx`, `src/lib/builderProfileFields.ts`) still function for owner & admin
- [ ] Smoke-test: non-owner authenticated user **cannot** read `builder_profiles.phone`
- [ ] Smoke-test: non-admin **cannot** INSERT/DELETE on `commission_invoices`, `escrow_ledger`, `payments`

---

## 3. `supabase` (built-in scanner)

| # | Finding | Status |
|---|---------|--------|
| — | _none reported_ | [x] Clean |

---

## 4. `agent_security`

| # | Finding | Status |
|---|---------|--------|
| — | _none reported_ | [x] Clean |

---

## Pre-deploy gate

- [ ] `.security/findings.json` has zero `open` entries
- [ ] All `ignored` entries carry a non-empty `reason`
- [ ] `bun run check:security` exits 0
- [ ] `bunx tsx scripts/generate-security-report.ts` regenerated `.security/report.md`
- [ ] Wiz placeholder entry present for current date

---

## Ongoing cadence

- [ ] Weekly: re-run all scanners and reconcile this checklist
- [ ] On every PR touching `supabase/migrations/**` or `public.*` tables: re-run `supabase_lov` + Wiz
- [ ] On every new connector: re-run Wiz before merging
