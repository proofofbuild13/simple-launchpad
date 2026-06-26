# Rework AI evaluator → Startup Viability Agent

Repurpose the existing `evaluate-submission` agent. It currently scores builder submissions on 5 technical dimensions (problem fit, execution, UX, feasibility, innovation). We'll **replace** those with business/startup-viability dimensions, keep the same pipeline (DB webhook → edge function → `ai_submission_evaluations` table → realtime UI card), and update the founder-facing card to display the new grade.

## New scoring rubric (replaces the 5 technical scores)

Each scored 0–20, total 0–100:

1. **Market size & demand** — TAM/SAM signal, urgency of the pain, clarity of the target customer.
2. **Business model & monetization** — revenue model, pricing logic, unit-economics signal, willingness-to-pay.
3. **Moat & differentiation** — defensibility vs incumbents/copycats, originality of approach.
4. **GTM & traction potential** — distribution plan, first-100-users feasibility, channel fit.
5. **Investability** — pre-seed/seed readiness, founder/builder execution signal, overall startup grade.

Plus:
- `summary_verdict` — 1–2 sentence investor-style verdict.
- `strengths` (2–4) and `gaps` (2–4) — reframed as market/business risks and edges, not engineering.
- `recommendation` enum: **`fundable`** | **`iterate`** | **`pass`** (replaces `shortlist` / `review_manually` / `pass`).
- `startup_grade` — A / B / C / D / F derived from total score.

## Changes

### 1. Database (migration)
- Add `recommendation` enum value `'fundable'` and `'iterate'` (keep `'pass'`); existing rows with old values get mapped via update statement.
  - Simpler: change `recommendation` column from enum to `text` with CHECK constraint for the 3 new values, migrating old data (`shortlist`→`fundable`, `review_manually`→`iterate`, `pass`→`pass`).
- Add `startup_grade text` column (A–F) to `ai_submission_evaluations`.
- Bump prompt version (handled in code, not SQL).
- No new tables, no new RLS — reuses existing table grants/policies.

### 2. Edge function `supabase/functions/evaluate-submission/index.ts`
- `PROMPT_VERSION` → `2` (forces re-evaluation of existing rows on next trigger).
- Rewrite `system` prompt as a startup/VC analyst persona scoring the 5 new dimensions; instruct it to read the submission as a *startup pitch* (problem, who pays, why now, why this team) rather than as a code review. Project context (category, description, requirements) still passed in.
- Update `schema` keys to keep the same column names (`score_problem_fit`, `score_execution`, `score_ux`, `score_feasibility`, `score_innovation`) **but** redefine their meaning in the prompt as the 5 business dimensions — avoids a DB rename. (Alternative: add 5 new columns. Going with reuse to keep scope tight; labels in UI carry the new meaning.)
- Add `startup_grade` to the JSON schema and persist it.
- Update `recommendation` enum values in the JSON schema to `fundable | iterate | pass`.
- Threshold guidance in the prompt: ≥80 fundable+A, 65–79 iterate+B, 50–64 iterate+C, 35–49 pass+D, <35 pass+F.

### 3. UI `src/components/submissions/AIEvaluationCard.tsx`
- Rename header to "Startup viability evaluation".
- Update `CRITERIA` labels to: Market & demand, Business model, Moat & differentiation, GTM & traction, Investability.
- Update `RecommendationBadge` for the 3 new values (`fundable` green, `iterate` amber, `pass` red).
- Show `startup_grade` as a large letter badge next to the `/100` total.
- Tweak strengths/gaps headers to "Edges" / "Risks".

### 4. Library
- `src/lib/aiEvaluation.ts` unchanged (same edge function).
- `Evaluation` type in `AIEvaluationCard.tsx` updated for new `recommendation` literals and `startup_grade`.

## Out of scope
- No new agent for grading project briefs (founder side) — that was the "Both" option and is not chosen.
- No changes to commission, contracts, escrow, or any other flows.
- No model change; stays on `google/gemini-3-flash-preview` via Lovable AI Gateway.
- Landing page copy stays as-is (the platform-overview Trust/Hero sections already say "AI-scored submissions" which still holds).

## Verification
- Type-check passes.
- Manually trigger a re-evaluation on an existing submission via the "Re-run" button → new row has `prompt_version=2`, `startup_grade` populated, recommendation is one of the 3 new values.
- Card renders all 5 new dimension labels, grade badge, and color-correct recommendation badge.
