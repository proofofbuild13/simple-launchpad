
# Simplify platform IA — agent-first, fewer menus, guided single flow

Goal: cut the sidebar clutter for both roles, and replace scattered pages (Submissions / Interviews / Offers / Contracts / Workspaces / Payments) with one **Deal** timeline per engagement. No DB or business-logic changes — pure UI/routing consolidation plus a new unified view.

## New sidebar

**Founder (startup)**
```
Agent            /agent          ← default landing (replaces Dashboard)
Projects         /projects       ← list + Post is a button inside
Deals            /deals          ← unified: submissions→interview→offer→contract→work→payment
Builders         /marketplace    ← includes Saved
Inbox            /messages       ← messages + notifications tabs
```

**Builder**
```
Browse           /browse         ← includes Saved as a tab
Deals            /deals          ← unified pipeline (my submissions → contracts → earnings)
Profile          /profile
Inbox            /messages
```

**Admin** — unchanged (already tight).

Removed from nav (still reachable via deep links / buttons inside Deals):
- Submissions, Interviews, Offers, Job Offers, Contracts, Workspaces, Payments, Saved Builders/Projects, Post Project, classic Dashboard.

## New unified `/deals` page

One list, one detail view per engagement. The detail page is a vertical timeline that folds every existing page into collapsible sections:

```
[Submission] → [Interview] → [Offer] → [Contract] → [Workspace] → [Payment]
   summary       schedule      terms      sign/fund   milestones     escrow/receipts
```

Each section reads from its existing table and reuses existing components (`WorkflowStatusTracker`, `AIEvaluationCard`, `PaymentTimeline`, milestone cards, etc.) — just embedded instead of separate routes. Actions (accept offer, sign, fund, release) render inline on the current stage only.

List view (`/deals`):
- Founder: rows grouped by project, each row = one builder engagement with current stage pill.
- Builder: rows = my active engagements across projects.

## Founder Agent stays primary

- `/agent` becomes the founder landing (`/dashboard` redirects for `startup` role).
- Existing agent flow unchanged; walkthrough already covers brief→post→invites→evaluations.
- Add a small "View deals" link inside the agent header once a project is posted.

## Files

**New**
- `src/pages/deals/Deals.tsx` — list, role-aware query
- `src/pages/deals/DealDetail.tsx` — timeline shell embedding existing section components
- `src/components/deals/*` — thin wrappers per stage (SubmissionSection, InterviewSection, OfferSection, ContractSection, WorkspaceSection, PaymentSection) that import the existing page bodies/components

**Edit**
- `src/components/layout/AppSidebar.tsx` — new item lists above
- `src/App.tsx` — add `/deals` and `/deals/:id` routes, redirect `/dashboard`→`/agent` for startups, keep old routes mounted (deep links still work)
- `src/pages/dashboard/DashboardRouter.tsx` — route startups to `/agent`
- `src/pages/agent/FounderAgent.tsx` — add "View deals" link post-post
- Any list pages that link to `/submissions/:id`, `/contracts/:id`, etc. get an added link to the equivalent `/deals/:id` view (old routes still function)

**Untouched**
- All DB tables, RLS, edge functions, business logic, statuses, stage transitions.
- Old routes stay mounted as fallback for deep links / bookmarks.

## Verification
- Founder lands on `/agent`, sidebar has 5 items.
- `/deals` shows one row per engagement; opening it renders every lifecycle stage inline with the right action live on current stage only.
- Builder sidebar has 4 items; `/deals` shows their side of the same engagements.
- Old routes (`/submissions/:id`, `/contracts/:id`, etc.) still open — Deals is additive, not destructive.

## Out of scope
- No changes to statuses, RPCs, or payment logic.
- No visual redesign beyond the new list/timeline layout.
- Removing legacy routes entirely — deferred until Deals is proven.
