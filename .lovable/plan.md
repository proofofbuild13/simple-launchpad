
# Founder Agent — conversational project posting

A chat-based agent on the startup side that takes a plain-English brief and runs the whole pipeline end-to-end with real platform actions: drafts a project, posts it, matches real builders from the database, sends real invitations, and surfaces real AI evaluations as submissions come in.

Per your choices:
- **One conversation** per founder (resets when they start a new project), persisted in **Supabase** so it survives reloads/devices.
- **Real end-to-end actions** — every step inserts into the actual tables and the founder must approve each destructive step (post, invite, offer) before it runs.

## User flow

```text
Founder types: "Need a React Native dev for a delivery-tracking app, 6 weeks"
   │
   ▼
[Stage 1 — Parse]      Agent extracts {title, category, skills, duration, difficulty}
[Stage 2 — Draft]      Agent calls generate-project-brief → shows preview card
                       Founder clicks "Post" (or "Adjust")
   │
   ▼
[Stage 3 — Match]      Tool queries builder_profiles by skills overlap + availability
                       → 5–10 ranked candidates shown as chips
                       Founder picks "Invite all" / "Top N"
   │
   ▼
[Stage 4 — Invite]     Tool inserts project_invitations rows + notifications
   │
   ▼
[Stage 5 — Evaluate]   Realtime subscription to submissions for this project
                       Each new submission auto-fires evaluate-submission
                       Agent posts a chat update per evaluation
   │
   ▼
[Stage 6 — Shortlist]  Sorted by ai_score, top 3 rendered as ranked cards
                       Buttons: "Send offers" / "Open submission" / "Start new project"
```

## UI

New page `/agent` (founder-only, added to AppSidebar as **"Agent"** with a custom logo, not Sparkles).

Layout matches the uploaded mock:
- Left: chat transcript + composer (AI Elements: `Conversation`, `Message`, `MessageResponse`, `PromptInput`, `Shimmer`).
- Right rail (260px): 6-step stage tracker + live stats (matched / invited / submissions / shortlisted).
- Embedded action cards in assistant messages: project preview, builder chips, ranked shortlist rows.

Replaces the "Post a project" CTA on `StartupDashboard` with a primary "Open agent" button (the multi-step `/projects/new` form stays available as "Use classic form").

## Backend

### New tables (one migration, with GRANTs + RLS)

- `agent_threads` — `id, founder_id, status, project_id (nullable), current_stage, stats jsonb, created_at, updated_at`. One active row per founder; new sessions archive the prior one.
- `agent_messages` — `id, thread_id, role ('user'|'assistant'|'tool'), parts jsonb (AI SDK UIMessage parts), created_at`.

RLS: founder owns their threads/messages; service_role full access for the edge function.

### New edge function `founder-agent` (verify_jwt = true)

AI SDK streaming chat (`streamText` + `toUIMessageStreamResponse`) using `google/gemini-3-flash-preview` via the Lovable AI Gateway. System prompt frames it as the ProofBuild founder agent. Tools (Zod-typed, `stopWhen: stepCountIs(50)`):

| Tool | Action | Approval |
|---|---|---|
| `parse_brief` | Pure LLM extraction; no DB | none |
| `draft_project` | Internal call to existing `generate-project-brief` | none |
| `post_project` | Insert into `projects` (founder_id = caller) | **needsApproval** |
| `match_builders` | Query `builder_profiles` filtered by skills (array overlap), `available = true`, ranked by overlap count + experience_level | none |
| `send_invitations` | Insert `project_invitations` rows + `notifications` via `send_notification` RPC | **needsApproval** |
| `get_evaluations` | Read `ai_submission_evaluations` joined to `submissions` for the active project | none |

Auth: function reads JWT to scope every write to the caller; service_role used only for inserts the user can't do directly (e.g., bulk notifications via the existing RPC, which already checks permissions).

### Persistence

- On each `sendMessage`, client passes `threadId` (from the founder's single active thread, auto-created on first load).
- `toUIMessageStreamResponse({ originalMessages, onFinish })` — `onFinish` persists the completed assistant `UIMessage` to `agent_messages`; user message persisted on request entry. Both use DB-generated UUIDs (AI SDK `msg_...` strings stored in a separate `client_id text` column).
- `stats` and `current_stage` on `agent_threads` updated as tool calls succeed, surfaced to the right rail.

### Realtime

Subscribe to `ai_submission_evaluations` rows where `project_id = thread.project_id` inside `useEffect` (cleanup with `removeChannel`). Each new row appends a synthetic assistant tool-result message in the UI ("Builder X evaluated — 82/100, B grade"). When count reaches threshold or founder asks "show shortlist", the agent calls `get_evaluations` and renders ranked cards.

## Frontend pieces

- `src/pages/agent/FounderAgent.tsx` — main route, AI Elements composition, stage rail, stats grid.
- `src/components/agent/StageRail.tsx`, `StatsGrid.tsx`, `ProjectPreviewCard.tsx`, `BuilderChip.tsx`, `ShortlistCard.tsx` — small presentational components matching the mock's visual language (purple `#7F77DD` accent kept as a CSS variable in `index.css`, not hardcoded in components).
- `src/lib/agentThread.ts` — `getOrCreateActiveThread()`, `archiveAndStartNew()`, `loadMessages(threadId)`.
- Install AI Elements: `bun x ai-elements@latest add conversation message prompt-input shimmer tool`.
- Custom agent logo: small generated PNG (rounded square with circular mark), imported as ES6 asset — not Sparkles.

Route added in `src/App.tsx` behind `<ProtectedRoute roles={["startup"]}>`. Sidebar link only shown for startup role.

## Out of scope
- No changes to existing `PostProject` form, `evaluate-submission` function, or the submission/contract pipeline.
- Threaded history with sidebar (you chose "one conversation"). If you later want history, we add a thread list + `/agent/:threadId` route.
- Offers/contracts from inside the agent — the "Send offers" button links to the existing offer flow.

## Verification
- Type-check + build pass.
- Send a brief → see project row in `projects`, invitations in `project_invitations`, evaluations appear in chat as builders submit.
- Reload mid-conversation → messages and stage restore from `agent_messages`/`agent_threads`.
- Realtime channel cleaned up on unmount (no duplicate subscriptions in StrictMode).
