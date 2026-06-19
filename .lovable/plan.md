## AI-Assisted Project Brief Generator

Adds a "Generate with AI" action on Step 2 (Problem) of `PostProject.tsx`. The founder enters a title + short description (already collected on Step 0/1); clicking the button fills `description`, `requirements`, and `deliverables` with editable AI-drafted text. Never auto-advances, never auto-submits.

### Deviations from your spec (intentional)

1. **Use Lovable AI Gateway (Gemini 3 Flash), not Anthropic directly.** This project already uses `LOVABLE_API_KEY` for the `evaluate-submission` function and follows the platform's standard pattern. Avoids asking you for an `ANTHROPIC_API_KEY` and a new billing relationship. If you specifically want Claude, say so and I'll swap it.
2. **Skip the `ai_generation_log` table for MVP.** You said "no new table needed for MVP" in your own brief, then included one for rate-limiting. I'll skip it to keep scope tight; if abuse appears we add it later. Lovable AI Gateway already enforces per-workspace rate limits and returns 429.
3. **Keep the "overwrite confirm" UX you proposed** (`userEditedBrief` flag + `window.confirm`).

### Edge function: `supabase/functions/generate-project-brief/index.ts`

- `verify_jwt = true` (founder-only; reject anon).
- Validates input with Zod: `title` (1–200), `short_description` (1–1000), optional `category`, `engagement_type`, `job_title`, `timeline`, `difficulty`.
- Calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with structured-output JSON schema for `{ description, requirements, deliverables }` — no fragile markdown stripping.
- Handles 429 (rate limit) and 402 (credits) explicitly and forwards a clean error message.
- CORS headers on every response.
- Registered in `supabase/config.toml`.

### Prompt

Same shape as your spec: second/third person, 3–5 sentence description, 4–7 requirement lines, 3–5 deliverable lines, no invented budgets/dates, engagement-type-aware (hire_to_build vs project_hire).

### Frontend: `src/pages/projects/PostProject.tsx`

- Add `generating`, `userEditedBrief` state; import `Sparkles` from `lucide-react`.
- Add `generateWithAI()` calling `supabase.functions.invoke("generate-project-brief", { body: {...} })`.
  - Pre-checks: title + short_description present.
  - If `userEditedBrief`, `window.confirm` before overwriting.
  - On success: merge into `description`/`requirements`/`deliverables`; toast.
  - On error: distinguish 429 (rate-limit message) from generic failure.
- In the Step 2 block:
  - Header row with title + "Generate with AI" button (disabled while generating; spinner inside).
  - Helper line below button: "AI draft — edit freely before publishing. Nothing is saved until you finish posting."
  - If `short_description` empty, show an inline hint pointing back to Step 1.
  - Textareas' `onChange` set `userEditedBrief = true`.

### Out of scope
- `ai_generation_log` table, admin usage dashboard, regeneration history, per-field regeneration, streaming UI, saving drafts server-side.

### Files touched
- new: `supabase/functions/generate-project-brief/index.ts`
- edit: `supabase/config.toml` (register function)
- edit: `src/pages/projects/PostProject.tsx` (button + handler + state)
