
# Founder agent — fix the flow

The skeleton is in place but the flow has real gaps. Below is what is broken and the smallest set of changes to make it a coherent end-to-end pipeline.

## Issues in the current flow

1. **Submission → evaluation loop never closes.** The chat tells the founder "I'll watch for submissions and auto-evaluate each one," but nothing in the agent ever calls `evaluate-submission`. The realtime channel only subscribes to `ai_submission_evaluations`, which by definition exists only *after* something else evaluates. Result: submissions arrive, nothing happens, stats stay at "—".
2. **Realtime spam loop.** The eval channel listens to `event: "*"` and fires `fetch_shortlist` on every insert/update. `fetch_shortlist` then writes a new assistant message into `agent_messages`, which the messages-channel reloads. Five evaluations land = five near-identical "**N submissions evaluated**" cards stacked in chat.
3. **Stale approval buttons on reload.** `awaiting_approval` is persisted on each `project_preview` / `builders` message. After the founder posts/invites, every old card in history still shows live "Post this project" / "Invite all" buttons, because the flag isn't reconciled against `thread.stats.awaiting`.
4. **Stage numbering drift.** `approve_post` sets `current_stage: 3` (Match) when builders are found, but jumps to `4` when none are found — skipping Match entirely. `send_invites` then sets `5` (Evaluate), so the Invite step (stage 4) is never the "active" pill.
5. **Stats are wrong.** `stats.submissions` is overwritten with the count of evaluated rows, not actual submissions. `matched_builders` (full builder rows) is stored inside `agent_threads.stats` jsonb — bloats the row and gets shipped on every realtime update.
6. **Post-post chat is dumb.** Once a project is posted, plain `callAI` runs with no context and no tools. Asking "show me the shortlist" or "invite more builders" does nothing useful — those intents have to be triggered by the hardcoded card buttons only.
7. **Optimistic message + server insert = brief duplicate** of the user message after the server roundtrip refresh.
8. **No "broaden search" handler** even though the reply offers it when no matches are found.

## Fix plan

### Backend (`supabase/functions/founder-agent/index.ts`)

- **Close the eval loop.** Add a new internal step inside the existing realtime path: when a `submissions` row is inserted for `thread.project_id`, the client invokes a new intent `evaluate_new_submission` with the `submission_id`. The function calls the existing `evaluate-submission` edge function (service-role fetch) and, only on success, appends **one** synthetic assistant message: `"Evaluated **{builder_name}** — {score}/100 ({grade})"`. No `fetch_shortlist` cascade.
- **Add intents:**
  - `evaluate_new_submission { submission_id }` — runs evaluate-submission, appends one chat line.
  - `broaden_match` — re-runs the skills query with `.overlaps` removed (any available builder ranked by rating + recent activity), top 10. Returns a fresh `builders` part with a new `awaiting_approval: true`.
  - `refresh_stats` — recomputes counts from `submissions` + `ai_submission_evaluations` for the project and writes to `stats` *without* appending a chat message. Used by realtime.
- **Fix stage numbers.** Always: `approve_post` → 3 (Match). `send_invites` → 4 (Invite) then immediately 5 (Evaluate) once invites are written. `fetch_shortlist` → 6 only when shortlist length ≥ 1.
- **Stop bloating `stats`.** Drop `matched_builders` from `agent_threads.stats`. Keep matched builders only inside the `parts` of the assistant message that rendered them. `send_invites` reads them from `body.builder_ids` (sent by client from the message part), not from stats.
- **Single source of truth for "awaiting":** the function clears `stats.awaiting` as soon as the corresponding action runs, and the client uses `stats.awaiting` (not the persisted `awaiting_approval` flag on the message) to decide whether to render action buttons.
- **Post-post chat tools.** When `thread.project_id` is set and the user message matches simple intents ("shortlist"/"top picks", "invite more", "status"), route to `fetch_shortlist` / `broaden_match` / a status reply that summarises `stats`. Everything else falls back to a short conversational reply scoped to the active project.

### Frontend (`src/pages/agent/FounderAgent.tsx`)

- **Replace the eval-channel realtime handler.** Subscribe to `submissions` for `project_id=eq.{pid}` instead. On each `INSERT`, call `invokeAgent("evaluate_new_submission", { submission_id })`. Also subscribe to `ai_submission_evaluations` but only call `invokeAgent("refresh_stats")` (no chat append) and debounce to one call / 2s.
- **Render approval buttons from live state.** `ProjectPreview` and `BuildersList` only show buttons when `thread.stats.awaiting === "post_project"` / `"send_invites"` *and* the part is the latest one of its type in the transcript. Past cards become read-only summaries.
- **Drop the optimistic user-message duplicate.** Remove the client-side optimistic insert; rely on the server insert + realtime push (typing indicator already covers latency).
- **Add quick actions** under the latest assistant message when `project_id` is set: "Show shortlist", "Broaden match", "Invite more" buttons that map to the new intents.
- **Stage rail polish.** Use `current_stage` from `thread` directly; show the Invite step as a real active state during the `send_invites` request.

### No DB / RLS changes
All work fits within the existing `agent_threads`, `agent_messages`, `projects`, `submissions`, `ai_submission_evaluations`, `project_invitations`, `notifications` tables and policies.

### Verification
- Post a brief → preview card → Post → matched builders card with active buttons.
- Reload page mid-flow → old cards render without action buttons; only the latest awaiting card is live.
- Have a builder submit (or insert a row directly) → exactly one new "Evaluated …" assistant line appears, stats increment once, no duplicate cards.
- Ask "show shortlist" in chat after posting → ranked cards appear without needing the realtime trigger.
- Reset → new thread, empty transcript, stage rail back to "Ready".
