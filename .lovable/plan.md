# Admin user management: fix roles + full detail view

## Part 1 — Fix missing roles on /admin/users

**Root cause:** `user_roles` RLS policy `roles_select_own` only allows the row owner or `has_role(auth.uid(),'admin')` to read. A logged-in **super_admin** does NOT satisfy `has_role(...,'admin')`, so `select user_id, role from user_roles` returns only their own row — every other user shows `—` and the role filter (startup/builder) returns nothing.

**Fix (migration):**
- Drop and recreate `roles_select_own` to also allow `super_admin`:
  `using (auth.uid() = user_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))`
- Same audit for `roles_admin_all` (writes) — extend to `super_admin` so the existing admin tools keep working under either admin tier.

No frontend change needed for the list; rows will populate once the policy is fixed.

## Part 2 — Full user detail page for builders & startups

Today `AdminUserDetail.tsx` shows a thin view (profile name, role, status, a few contract/dispute/payment ids, last 25 audit rows). We will upgrade it into a single **360° admin profile** that works for both builders and startups, plus add edit + delete.

### A. Backend: one RPC that returns everything

New SECURITY DEFINER RPC `admin_get_user_full(_user_id uuid) returns jsonb`, admin/super_admin only. It aggregates:

- **Identity:** `profiles` + `auth.users` (email, last_sign_in_at, created_at, email_confirmed_at, banned_until) — auth.users is reachable only from a definer function, which is why we centralize here.
- **Role & status:** `user_roles`, `user_status`.
- **Builder side** (if role = builder): `builder_profiles` (excluding raw phone — use mask), `experiences`, `educations`, `certifications`, `payment_methods` (masked via `mask_account`), `saved_projects`, `submissions`.
- **Startup side** (if role = startup): `startup_profiles`, `projects` (count + recent), `project_invitations`, `followed_startups` (followers).
- **Shared activity:** `offers` (sent/received), `contracts`, `contract_milestones` (via contracts), `payment_records`, `commission_invoices`, `commission_payments`, `placement_fees`, `disputes`, `interviews`, `messages_v2` count, `notifications` count, `admin_audit_logs` where `actor_id = _user_id` AND where `entity_id = _user_id`.

Returned as a single JSON blob with sections so the page can render without N round-trips.

### B. Backend: edit + delete RPCs

- `admin_update_user_profile(_user_id, _patch jsonb)` — admin/super_admin. Whitelisted columns on `profiles` (`full_name`, `avatar_url`) and on `builder_profiles` / `startup_profiles` (bio, location, title, links, etc.). Writes an `admin_audit_logs` row with the diff.
- `admin_delete_user(_user_id)` — **super_admin only**. Refuses if the user has active contracts (`status not in ('cancelled','completed')`), unsettled `payment_records`, open `disputes`, or unpaid `commission_invoices` — returns a structured `{ blocked: true, reasons: [...] }` so the UI can explain. On success: deletes domain rows (profiles, builder/startup_profiles, user_roles, user_status, saved_*, payment_methods, followed_startups) and then calls an **edge function** `admin-delete-user` (service role) to remove the `auth.users` record. Audit-logged.
- Edge function `admin-delete-user` (`verify_jwt = true`): validates caller is super_admin via JWT → calls `admin_delete_user` RPC → then `auth.admin.deleteUser`.

### C. Frontend

- **`/admin/users` list** — once Part 1 lands, role chips render. Add small "View" CTA already present; no other change.
- **`/admin/users/:id`** — rewrite `AdminUserDetail.tsx` with tabbed layout:
  1. **Overview** — avatar, full_name, email, role, status, joined, last sign-in, email confirmation state, status reason.
  2. **Profile** — builder_profile or startup_profile fields. Inline "Edit" dialog (super_admin + admin) that PATCHes via `admin_update_user_profile`.
  3. **Activity** — contracts, milestones, offers, interviews, submissions, projects (startup), invitations, follows — paginated tables with deep links.
  4. **Payments** — payment_records, commission_invoices, commission_payments, placement_fees, escrow ledger entries the user is party to, masked payment_methods.
  5. **Disputes & moderation** — disputes raised by / against, current user_status, existing flag/suspend/ban controls (already in page).
  6. **Audit trail** — both actor-side and entity-side entries, full pagination, CSV export.
- **Header actions:** Edit profile, Change role (existing), Set status (existing), and **Delete user** (super_admin only, confirm dialog showing blockers if any).
- New route stays at the existing `/admin/users/:id` — no routing change.

## Technical notes

- All new RPCs: `SECURITY DEFINER`, `SET search_path = public`, `REVOKE EXECUTE FROM public`, `GRANT EXECUTE TO authenticated`, internal `has_role` check.
- Never expose raw `phone` or full `account_number` — reuse `mask_account` and skip `phone` (already the project convention).
- Delete is destructive: gated to super_admin, blockers enforced, audit-logged with full snapshot in `metadata`.
- After the migration runs, `src/integrations/supabase/types.ts` regenerates automatically; the new RPCs become typed before the UI changes are written.

## Files touched

- New migration: policy fix + 3 RPCs (`admin_get_user_full`, `admin_update_user_profile`, `admin_delete_user`).
- New edge function: `supabase/functions/admin-delete-user/index.ts` + entry in `supabase/config.toml`.
- Rewrite: `src/pages/admin/AdminUserDetail.tsx` (tabbed layout, edit dialog, delete button).
- Minor: `src/pages/admin/AdminUsers.tsx` — no logic change; relies on RLS fix.

## Open question

Should **delete user** be allowed for plain `admin`, or strictly `super_admin` only? Plan currently restricts to super_admin (safer default). Tell me if you want admins to delete too.
