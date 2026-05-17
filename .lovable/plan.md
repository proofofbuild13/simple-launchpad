
## Diagnosis

Looking at the live network traffic on your new Supabase project `nvnvyzxzjezlgzgpniyt`:

1. **Signup succeeds** (`POST /auth/v1/signup` → 200) — auth works.
2. **`POST /rest/v1/user_roles` → 401, `42501: new row violates row-level security policy`**
3. **`POST /rest/v1/builder_profiles` → 401, same RLS error**
4. **`POST /auth/v1/token` → 400, `email_not_confirmed`** — login is blocked because Supabase is set to require email confirmation.

Root cause: the new Supabase project is **empty**. None of the 13 migrations in `supabase/migrations/` (tables, RLS policies, `handle_new_user` trigger, `bootstrap_admin` RPC, etc.) have been applied to `nvnvyzxzjezlgzgpniyt`. The frontend code is fine — the database just has no schema, no policies, and no trigger to populate `user_roles` / `builder_profiles` / `startup_profiles` on signup.

Secondary issue: **Email confirmation is ON** in the new project's Auth settings, so even after the schema is applied, users can't sign in immediately after signup.

## Fix Plan

### Step 1 — Apply the existing schema to the new Supabase project
The 13 migration files in `supabase/migrations/` already contain everything needed (tables, RLS policies, triggers, RPCs). They just need to run against `nvnvyzxzjezlgzgpniyt`.

I'll bundle them into a single consolidated `init.sql` (in execution order) that you can paste into the **Supabase Dashboard → SQL Editor** of your project and run once. This creates:
- All tables (`user_roles`, `startup_profiles`, `builder_profiles`, projects, offers, contracts, payments, messaging, audit, etc.)
- The `app_role` enum and `has_role()` security-definer function
- RLS policies allowing authenticated users to insert their own `user_roles` row and their own profile rows (which is what's currently failing)
- The `handle_new_user` trigger and `bootstrap_admin` RPC
- Storage buckets if any

### Step 2 — Disable email confirmation (or make signup auto-confirm)
In **Supabase Dashboard → Authentication → Providers → Email**, turn OFF "Confirm email". This matches the current frontend flow which navigates straight to `/dashboard` after signup without waiting for an email click.

(Alternative: keep confirmation on and add a "check your inbox" screen — but the existing UX assumes immediate login, so disabling is the smaller change.)

### Step 3 — Configure Site URL & redirect URLs
In **Supabase Dashboard → Authentication → URL Configuration**, set:
- Site URL: `https://4ec37688-8c3e-4f3e-a1dd-7345b9b0bef1.lovableproject.com` (preview) and add the published URL
- Redirect allow-list: same origins + `http://localhost:5173`

### Step 4 — Regenerate `src/integrations/supabase/types.ts`
Once the schema is applied, types should match the new project. I'll regenerate them from `nvnvyzxzjezlgzgpniyt`.

### Step 5 — Verify
- Sign up a new builder → row appears in `auth.users`, `user_roles`, `builder_profiles` (no 401s).
- Sign in → 200, redirects to `/dashboard`.
- Admin first-time-setup → `bootstrap_admin` RPC grants `super_admin`.

## What you'll need to do manually
Supabase isn't in Lovable's connector list, so I can't run SQL against your project from here. After I generate the consolidated `init.sql`:
1. Open https://supabase.com/dashboard/project/nvnvyzxzjezlgzgpniyt/sql/new
2. Paste the SQL and click **Run**
3. Toggle off email confirmation in Auth → Providers → Email
4. Set Site URL / redirects in Auth → URL Configuration

Then signup and login will work.

## Question before I proceed
Do you want me to:
- **(A)** Generate one consolidated `supabase/init.sql` from the 13 existing migrations (easiest — single copy/paste), or
- **(B)** Keep the 13 migration files as-is so you can run `supabase db push` from the CLI against your project?
