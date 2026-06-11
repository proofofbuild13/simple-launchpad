# Admin Quick Wins

Targeted upgrades to existing admin pages — no new sections, no route changes. Every state-changing action goes through a SECURITY DEFINER RPC with admin-role check and writes to `admin_audit_logs`.

## 1. User management (AdminUsers + AdminUserDetail)

**a. Suspension/flag reason + notify user**
- Replace the bare flag/suspend/ban icon buttons with a small dialog: required reason text + checkbox "notify user".
- New RPC `admin_set_user_status(_user_id, _status, _reason, _notify)` — upserts `user_status` (sets `reason`, `flagged_by=auth.uid()`), inserts a `notifications` row when `_notify`, audits the action.

**b. Role change**
- In `AdminUserDetail`, add a Role card with a Select (`startup`, `builder`, `admin`, `super_admin`) + Save.
- New RPC `admin_set_user_role(_user_id, _role)` — super_admin only for admin/super_admin assignments; upserts `user_roles`, audits.

**c. Force email verification / send password reset**
- `AdminUserDetail` gets two buttons that call existing Supabase admin endpoints via a new edge function `admin-user-actions` (uses `SUPABASE_SERVICE_ROLE_KEY`): `mark_email_verified` and `send_password_reset`. Audited.

**d. Bulk CSV export**
- "Export users" button on `AdminUsers` → client-side CSV of the currently filtered rows (id, name, role, status, joined).

## 2. Financial controls (AdminCommissions + new actions on AdminDisputeDetail)

**a. Waive / adjust commission invoice**
- In `AdminCommissions`, add a second card "All invoices" with status filter. Each row has "Waive" and "Mark paid" actions.
- New RPC `admin_adjust_commission_invoice(_invoice_id, _action, _notes)` — `action ∈ ('waive','mark_paid','reopen')`; updates `commission_invoices.status`, propagates to `payment_records` if needed, audits.

**b. Manual escrow refund/release**
- Already have `admin_resolve_escrow`. Surface it on the dispute detail page with a confirmation dialog and notes field. (Currently only used from contract pages — make it discoverable on `AdminDisputes`.)

**c. Revenue export**
- "Export revenue CSV" on `AdminCommissions` — paid invoices for selectable date range (last 7/30/90d/all).

## 3. Platform settings + analytics (new tab on AdminDashboard)

**a. Editable platform settings**
- Add a settings card to `AdminDashboard` (or a small `<Tabs>` next to the activity feed): inputs for `commission_rate` (0.15 default), `placement_fee_percent` (8.33), `escrow_release_grace_days`.
- Reads/writes `public.platform_settings` (super_admin only via RLS already in place). Values are picked up by existing functions like `release_escrow_for_milestone` that already read from `platform_settings`.

**b. KPI trend mini-charts**
- Add a "30-day GMV & revenue" chart using recharts (already in `src/components/ui/chart.tsx`). Two lines: daily declared payments vs daily commission paid. Aggregates client-side from existing tables — no schema change.

## Technical details

**New migration** (one file):
- `admin_set_user_status(uuid, text, text, boolean)` RPC
- `admin_set_user_role(uuid, app_role)` RPC, super_admin guard for admin roles
- `admin_adjust_commission_invoice(uuid, text, text)` RPC
- Seed `platform_settings` with `commission_rate=0.15`, `placement_fee_percent=8.33`, `escrow_release_grace_days=7` (`ON CONFLICT DO NOTHING`).
- All RPCs: `SECURITY DEFINER`, `SET search_path=public`, check `has_role(auth.uid(),'admin'|'super_admin')`, write `admin_audit_logs`. Revoke EXECUTE from anon/PUBLIC, grant to authenticated.

**New edge function** `admin-user-actions`:
- Verifies caller JWT, looks up role in `user_roles`, rejects non-admins.
- Switch on `action`: `mark_email_verified` uses `supabaseAdmin.auth.admin.updateUserById`; `send_password_reset` uses `supabaseAdmin.auth.admin.generateLink({type:'recovery'})`.
- Writes audit row.

**Frontend files changed:**
- `src/pages/admin/AdminUsers.tsx` — reason dialog, CSV export
- `src/pages/admin/AdminUserDetail.tsx` — role editor, account actions
- `src/pages/dashboard/AdminCommissions.tsx` — invoice list, waive/mark paid, CSV export
- `src/pages/dashboard/AdminDisputes.tsx` — surface admin escrow resolution
- `src/pages/admin/AdminDashboard.tsx` — settings card + 30-day trend chart
- New helper `src/components/admin/UserStatusDialog.tsx`

## Out of scope (call out for follow-up if you want them later)
- Impersonation/login-as
- Bulk dispute triage queue
- Content/message moderation tools
- Cohort & funnel analytics
- Feature flags system
