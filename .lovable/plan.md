## Current state

The AI evaluation backend is fully built but unused:

- Table `ai_submission_evaluations` exists with 5 scores (problem_fit, execution, ux, feasibility, innovation, each 0–20), generated `total_score`, `summary_verdict`, `strengths[]`, `gaps[]`, `recommendation` (shortlist / review_manually / pass).
- RLS already permits the project's founder, the submission's builder, and admins to read evaluations.
- Edge function `evaluate-submission` is deployed and calls Lovable AI (Gemini 3 Flash) with a strict JSON schema, mirrors `ai_score` and `ai_recommendation` back onto `submissions`.
- The 8 existing submissions in the DB have **no evaluations yet** (`ai_score` and `eval_id` are all null).
- **No UI surfaces results anywhere** — `SubmissionReview.tsx`, `MySubmissions.tsx`, and the dashboards don't render any AI fields.

## What I'll build

### 1. Reusable component `AIEvaluationCard`
`src/components/submissions/AIEvaluationCard.tsx`

- Fetches the evaluation for a given `submission_id` (RLS filters automatically).
- States: loading, no-evaluation-yet (with a "Run AI evaluation" button when the viewer is founder/admin), evaluation-present.
- When present, renders:
  - Total score (e.g. `82 / 100`) with a colored badge based on recommendation.
  - Recommendation pill: Shortlist (green), Review manually (amber), Pass (red).
  - 5 sub-scores as small progress bars (0–20 each).
  - One-line `summary_verdict`.
  - Two columns: Strengths (check icons) and Gaps (alert icons).
  - Footer: model used, evaluated timestamp, prompt version, "Re-run evaluation" button (founder/admin only) that calls the edge function with `{ submission_id }`.
- Subscribes to realtime updates on `ai_submission_evaluations` for that submission so the card flips from "evaluating…" to results without a refresh.

### 2. Integrate the card into the existing flows
- `src/pages/submissions/SubmissionReview.tsx` — show the card prominently above the manual scoring form so founders see the AI verdict while reviewing.
- `src/pages/submissions/MySubmissions.tsx` — show a compact summary (total score + recommendation pill) on each submission row so builders can see their AI evaluation result.
- `src/pages/dashboard/StartupDashboard.tsx` — add a small "AI-recommended submissions" widget that lists the top 5 submissions across the founder's projects sorted by `ai_score` desc (only those with `recommendation = 'shortlist'`).

### 3. "Run AI evaluation" trigger
A small helper `src/lib/aiEvaluation.ts` that invokes the `evaluate-submission` edge function via `supabase.functions.invoke('evaluate-submission', { body: { submission_id } })`. The card uses this for first-time runs and re-runs. Toast feedback on success/failure.

### 4. Backfill existing submissions
Run the edge function once per existing submission (8 rows). I'll do this from the sandbox using a small Deno/Node script that calls `supabase.functions.invoke` with the service role key, then read the resulting rows back from `ai_submission_evaluations` and show you the per-submission scores and recommendations in the chat as a table.

This covers all 8 regardless of current status (the status gate only applies to webhook-triggered runs, not direct invokes).

## Out of scope (ask if you want any of this)
- A dedicated "/projects/:id/ai-leaderboard" page ranking all submissions for a project.
- Founder-facing prompt customization (per-project rubric weights).
- Email/notification when a new AI evaluation completes.
- Bulk re-run UI for admins.

## Technical notes
- No new tables or migrations are needed — schema and RLS are already in place.
- No new secrets are needed — `LOVABLE_API_KEY` and `EVALUATE_SUBMISSION_WEBHOOK_SECRET` already exist.
- Realtime is already enabled on `ai_submission_evaluations`.
- All color usage in the new card will use semantic tokens from `index.css` (no hardcoded colors).
