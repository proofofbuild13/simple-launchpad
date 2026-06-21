# Platform Audit — Findings & Fix Plan

Scans run: `security--run_security_scan`, `supabase--linter`, `security--get_scan_results`. Console/runtime logs: clean. Findings group into 6 buckets — all fixable in one migration plus 1 dashboard task you'll do yourself.

## Findings

### 1. PII exposure — `builder_profiles.phone` (ERROR)
Policy `bp_select_all` uses `USING (true)`, so any signed-in user can `SELECT phone` from any builder. A prior migration revoked the column grant, but the broad SELECT policy + table-level grant still allow it. Confirmed via `connector_security_scan` history + current `supabase_lov` scan.

### 2. Missing admin visibility — `payments` (WARN)
`pay_select_parties` only allows founder/builder. No admin SELECT, unlike `payment_records` / `escrow_ledger`. Blocks dispute resolution.

### 3. Over-broad read — `platform_settings` (WARN)
`ps_select_all` returns every settings row (including `commission_rate` and any future internal flags) to every authenticated user.

### 4. Realtime authorization missing (WARN)
No RLS on `realtime.messages` → any signed-in user can subscribe to any channel topic (notifications, conversations, AI evals).

### 5. SECURITY DEFINER functions executable by `authenticated` (34 WARN)
Lint flags every `SECURITY DEFINER` callable by signed-in users. Many are **internal-only** (triggers + helpers) and should have `EXECUTE` revoked from `public`/`authenticated`. The rest are legitimate user RPCs (fund_escrow, raise_dispute, etc.) and stay callable — but we'll re-grant explicitly so intent is clear.

Internal-only (revoke EXECUTE):
`on_new_message`, `touch_updated_at`, `handle_new_user`, `enforce_single_default_pm`, `notify_payment_method_change`, `handle_employment_offer_accepted`, `log_audit`, `is_conversation_participant` (used by RLS only), `mask_account`, `get_user_role`, `user_has_any_role`, `any_admin_exists`, `has_role` (RLS-only), `admin_*` family (called via SECURITY DEFINER from edge fns / specific UI — keep but explicit grants).

### 6. Dashboard-only — Leaked Password Protection disabled (WARN)
Cannot be fixed via SQL. Requires toggle in Supabase Auth dashboard.

## Fixes (one consolidated migration)

```text
1. builder_profiles
   - DROP POLICY bp_select_all
   - CREATE POLICY bp_select_public_fields  (USING true) — used together with
     column-level REVOKE on phone (already in place) so the column is invisible
     to anon/authenticated even though rows are returned
   - Re-assert REVOKE SELECT(phone) FROM anon, authenticated
   - Keep get_my_builder_phone() / set_my_builder_phone() for owner access
   - Keep admin_get_user_full() (already strips phone except for admins)

2. payments
   - CREATE POLICY pay_select_admin FOR SELECT
     USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))

3. platform_settings
   - DROP POLICY ps_select_all
   - CREATE POLICY ps_select_admin (admin/super_admin full read)
   - CREATE POLICY ps_select_public_keys
     USING (key IN ('commission_rate'))  -- only keys the app actually needs client-side
   (commission_rate is already used by client display; everything else stays admin-only)

4. realtime.messages
   - ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY
   - Policies scoping topic to user resources:
       * topic = 'user:' || auth.uid()                       (personal notifications)
       * topic LIKE 'conversation:%' AND is_conversation_participant(uuid, auth.uid())
       * admins: full access via has_role()

5. SECURITY DEFINER hardening
   - REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated on every internal/trigger
     function listed above
   - GRANT EXECUTE on user-callable RPCs explicitly to authenticated:
     fund_escrow, release_escrow_for_milestone, raise_dispute,
     confirm_payment_record, create_contract_from_offer,
     get_or_create_direct_conversation, get_builder_default_payment,
     builder_payment_status, get_escrow_summary, get_my_builder_phone,
     set_my_builder_phone, send_notification, bootstrap_admin,
     can_delete_project
   - GRANT EXECUTE on admin RPCs to authenticated (they self-gate via has_role):
     admin_adjust_commission_invoice, verify_commission_payment,
     admin_resolve_escrow, admin_update_user_profile, admin_delete_user,
     admin_set_user_status, admin_set_user_role, admin_get_user_full
```

## Dashboard task for you
Enable **Leaked Password Protection** in Supabase → Auth → Providers → Email → "Password strength & leaked password protection". Cannot be done from SQL.

## Out of scope (no issues found)
- Runtime errors: none recorded
- Console errors: none
- `connector_security_scan` (Wiz): 0 findings
- Edge functions `admin-create-user` / `admin-delete-user`: gated correctly (admin/super_admin role checks present)
- Auth context, ProtectedRoute, AdminGuard: correct role checks

## Verification after migration
- Re-run `supabase--linter` → expect only "Leaked Password Protection" remaining
- Re-run `security--run_security_scan` → expect 0 errors, 0 warns
- Existing `.security/policy-checks.sql` still passes
- Smoke test: builder reads own phone via RPC, non-owner builder cannot, admin sees phone via `admin_get_user_full`, founder funds escrow, admin lists payments
