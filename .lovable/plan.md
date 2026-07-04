## Goal
Show the founder's Agent chat history inside the sidebar, under the "Agent" nav item, so past conversations can be reopened. Only applies to startups (the Agent is a founder-only feature).

## Changes

### 1. Route: support multiple threads by URL
- Add route `/agent/:threadId` alongside existing `/agent` in `src/App.tsx`.
- `/agent` (no id) picks the most recent active thread or creates one, then navigates to `/agent/:threadId`.
- `FounderAgent.tsx` reads `threadId` from `useParams` and loads that thread + its messages. Remount is keyed on `threadId` so state doesn't bleed between threads.

### 2. Sidebar: Agent history section
- New component `src/components/layout/AgentHistoryList.tsx`.
- Fetches `agent_threads` for the current user (`founder_id = user.id`, ordered by `updated_at desc`, limit ~20).
- Subscribes to realtime `INSERT`/`UPDATE` on `agent_threads` for that founder so new chats appear immediately.
- Renders under the "Agent" `SidebarMenuItem` as a nested `SidebarMenuSub` list. Each row:
  - Links to `/agent/:threadId`
  - Label = derived title (first user message preview, fallback "New chat")
  - Active state highlighted when route matches
- Includes a "+ New chat" button at the top that creates a fresh `agent_threads` row and navigates to it.
- Hidden when the sidebar is collapsed to icon-only mode.

### 3. Wire into `AppSidebar.tsx`
- Only for `role === "startup"`.
- Render `<AgentHistoryList />` inside the Agent menu item (below it in the same group), so it behaves like a sub-navigation for that section.

### 4. Derive chat title
- Small helper: query the first `agent_messages.role='user'` row per thread (or fetch alongside threads with a lightweight join) and truncate to ~40 chars. Fallback: `"New chat · <date>"`.

## Not changing
- DB schema (no new columns), RLS, edge functions, business logic.
- Builder sidebar (Agent history is founder-only).
- Existing single-thread reset flow keeps working; "Restart walkthrough" still resets the current thread.

## Technical notes
- `SidebarMenuSub` / `SidebarMenuSubItem` / `SidebarMenuSubButton` from `@/components/ui/sidebar` for nested links.
- New chat action: `insert into agent_threads { founder_id, status: 'active', current_stage: 0, stats: {} }` then `navigate('/agent/' + newId)`.
- `FounderAgent.tsx` thread bootstrap becomes: if `:threadId` in URL, load it; else pick latest active or create, then `navigate` to canonical URL.
