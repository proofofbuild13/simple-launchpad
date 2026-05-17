
## Goal

Disconnect from Lovable Cloud's Supabase and wire the app to your own Supabase project `nvnvyzxzjezlgzgpniyt` (URL `https://nvnvyzxzjezlgzgpniyt.supabase.co`) via the Supabase connector.

## Steps

1. **Link the Supabase connector**
   - Call the Supabase connector flow so your project credentials (URL + publishable/anon key, and service role for server use) are available as environment variables to the app.
   - You'll pick the connection that points to project `nvnvyzxzjezlgzgpniyt`.

2. **Update `.env`** to your project (already correct values present — verify):
   - `VITE_SUPABASE_PROJECT_ID="nvnvyzxzjezlgzgpniyt"`
   - `VITE_SUPABASE_URL="https://nvnvyzxzjezlgzgpniyt.supabase.co"`
   - `VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_G2KqczM9cav-LGu6jClMlg_YGYksP6X"`

3. **Update `supabase/config.toml`**
   - Change `project_id` from `uexpsycmvlnpkvvommue` → `nvnvyzxzjezlgzgpniyt` so the Supabase CLI targets your project.

4. **Keep `src/integrations/supabase/client.ts` as-is**
   - It already reads from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, so once `.env` points at your project, the client connects to it. No code change needed.

5. **Apply database schema to your Supabase project**
   - The existing migrations in `supabase/migrations/` were authored against the Lovable Cloud project. They need to be run against `nvnvyzxzjezlgzgpniyt` so tables (`user_roles`, `startup_profiles`, RPCs `has_role`, `bootstrap_admin`, `get_or_create_direct_conversation`, `log_audit`, etc.) exist.
   - You'll need to run `supabase db push` (or apply the SQL via the Supabase dashboard SQL editor) against your project. I cannot push migrations to an external Supabase project from here — that requires your Supabase access token locally, or you paste the SQL into the dashboard.

6. **Regenerate `src/integrations/supabase/types.ts`** (optional but recommended)
   - Once tables are in your project, regenerate types with `supabase gen types typescript --project-id nvnvyzxzjezlgzgpniyt` so the typed client matches your schema.

## What I'll do vs. what you'll do

**I will:**
- Trigger the Supabase connector link flow.
- Edit `supabase/config.toml` to your project_id.
- Verify `.env` and `client.ts` are correct.

**You will:**
- Pick / authorize the Supabase connection in the popup.
- Run `supabase db push` locally against `nvnvyzxzjezlgzgpniyt` OR paste the migration SQL into your Supabase dashboard's SQL editor to create the schema.

## Open question

Do you want me to also delete the existing migration files (since they were generated for the old project) and consolidate them into one fresh migration, or leave them as-is so you can replay them on your project?
