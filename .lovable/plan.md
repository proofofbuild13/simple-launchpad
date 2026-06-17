## AI submission evaluator — implementation plan

Build an AI agent that auto-evaluates every new submission against the project brief, stores a scored verdict, and surfaces it to founders (and partially to builders) in the review and leaderboard screens.

### 1. Database (migration)

New table `public.ai_submission_evaluations`:
- `submission_id` (FK → submissions, on delete cascade, unique)
- `project_id` (uuid)
- Five rubric ints `score_problem_fit / execution / ux / feasibility / innovation`, each `CHECK BETWEEN 0 AND 20`
- `total_score` generated column = sum of the five
- `summary_verdict` text, `strengths text[]`, `gaps text[]`
- `recommendation` text `CHECK IN ('shortlist','review_manually','pass')`
- `model_used`, `prompt_version`, `evaluated_at`, `created_at`, `error` (nullable, for failed runs)

Grants + RLS:
- `GRANT SELECT ON ... TO authenticated; GRANT ALL TO service_role;`
- SELECT policy: founder of the project OR builder of the submission OR admin/super_admin
- No INSERT/UPDATE policy (only edge function via service role writes)
- Indexes on `submission_id`, `project_id`, `total_score DESC`

`ALTER TABLE submissions ADD COLUMN ai_score int, ADD COLUMN ai_recommendation text;`

Enable Realtime on `ai_submission_evaluations` so the review screen receives the result live.

### 2. Edge function `evaluate-submission`

Located at `supabase/functions/evaluate-submission/index.ts`. Public (`verify_jwt = false`) so the Supabase Database Webhook can call it; it validates a shared `WEBHOOK_SECRET` header instead.

Flow:
1. Verify header `x-webhook-secret` matches `EVALUATE_SUBMISSION_WEBHOOK_SECRET`
2. Parse Supabase webhook payload `{ type, record }`; require `type === 'INSERT'` and `record.id`
3. Idempotency: skip if a row already exists for `submission_id`
4. Fetch submission with `projects(title, description, requirements, deliverables, category, tags, founder_id)`
5. Build the rubric prompt (problem fit / execution / UX / feasibility / innovation, each 0–20; penalties for missing demo; recommendation thresholds shortlist ≥65, pass <40)
6. Call **Lovable AI Gateway** at `https://ai.gateway.lovable.dev/v1/chat/completions` using `LOVABLE_API_KEY` in `Lovable-API-Key` header. Model: `google/gemini-3-flash-preview` (default for chat; cheap, fast, JSON-capable). Use `response_format: { type: "json_object" }` and a strict system prompt
7. Handle gateway errors: surface 429 (rate limit) and 402 (credits exhausted) explicitly, store an error row with `error` set and recommendation `review_manually`
8. Parse JSON; insert evaluation row; update `submissions.ai_score` and `submissions.ai_recommendation`
9. Insert notification to `project.founder_id` with the score + recommendation linking to the review page

### 3. Trigger wiring (Supabase Database Webhook)

You wire this manually in the dashboard (since you chose webhooks):
- Table `submissions`, event `INSERT`
- URL `https://nvnvyzxzjezlgzgpniyt.supabase.co/functions/v1/evaluate-submission`
- Header `x-webhook-secret: <value of EVALUATE_SUBMISSION_WEBHOOK_SECRET>`

I'll surface the URL + header value in chat after the function deploys and the secret is set. I'll also add an **admin "Re-run AI evaluation"** button in `SubmissionReview` (for founder/admin only) that invokes the function directly with the same secret header via an authenticated proxy route — fallback for failed/missed evaluations.

### 4. Secrets

- `LOVABLE_API_KEY` — auto-provisioned (call `lovable_api_key--create` if missing)
- `EVALUATE_SUBMISSION_WEBHOOK_SECRET` — random string, requested via `add_secret`

### 5. Frontend

**`src/components/submissions/AIEvaluationCard.tsx`** (new)
- Fetches the row from `ai_submission_evaluations` by `submission_id`
- Subscribes via Realtime (`postgres_changes` INSERT filtered by `submission_id`) inside `useEffect` with proper cleanup
- States: loading, pending (no row yet), error, ready
- Renders: total score (big), per-rubric `Progress` bars, recommendation badge with color (shortlist=emerald, review=amber, pass=muted), summary verdict, strengths (always), gaps (founder/admin only), advisory footer
- Uses only design-system tokens (no hardcoded `text-white` / hex)

**`src/pages/submissions/SubmissionReview.tsx`**
- Determine `isFounder` from already-loaded submission/project context
- Mount `<AIEvaluationCard submissionId={id} isFounder={isFounder} />` in the right sidebar above the manual scoring panel
- Add "Re-run AI evaluation" button for founder/admin that calls a small new function or the same evaluator with a force flag

**`src/pages/projects/Leaderboard.tsx`**
- Change ordering to `.order("ai_score", { ascending: false, nullsFirst: false }).order("created_at", { ascending: true })`
- Add an "AI Score" column showing `ai_score` (or "pending" badge when null) and a small recommendation pill

### 6. Out of scope (MVP)

- Scraping demo / GitHub URLs (the model gets only the metadata the builder provided)
- Backfill of historical submissions — handled later with a one-off admin script
- Multi-version prompt A/B — `prompt_version` column is in place but only v1 is used

### Technical notes

- All AI calls go through Lovable AI Gateway, never client-side
- The evaluator function is the only writer to `ai_submission_evaluations` (RLS enforces this)
- Notifications go through the existing `notifications` table (no schema change needed)
- The leaderboard ordering change is additive: rows with `ai_score IS NULL` fall to the bottom but remain visible
