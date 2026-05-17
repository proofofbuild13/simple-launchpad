
# Core Ecosystem Expansion — Implementation Plan

This is a large scope. I'll deliver it in 5 connected feature areas, all wired to existing tables (`contracts`, `payment_records`, `notifications`, etc.) so nothing becomes an island.

---

## Feature 1 — Advanced Profile System

### New DB tables (migration)
- `educations` — user_id, institution, degree, specialization, start_year, end_year, grade, achievements
- `experiences` — user_id, company_name, role, employment_type, start_date, end_date, description, achievements, is_current
- `payment_methods` — user_id, method_type (`upi` | `bank`), upi_id, bank_name, account_number (last4 stored + full encrypted-at-rest via masked select view), ifsc, account_holder, is_default, verified
- `certifications` — user_id, name, issuer, issue_date, credential_url
- Extend `builder_profiles`: phone, banner_image (already present)

RLS: owner-only write; public read for educations/experiences/certifications; payment_methods read = owner + counter-party of an active contract (via `has_role` style helper `can_view_payment_method(_owner, _viewer)`).

### Pages
- `/settings/profile` — tabbed editor (Personal, Education, Experience, Skills & Portfolio, Payment Methods)
- Extend existing `ProfileEdit.tsx` → split into modular tab sections under `src/pages/settings/profile/`:
  - `PersonalTab.tsx`, `EducationTab.tsx`, `ExperienceTab.tsx`, `SkillsTab.tsx`, `PaymentMethodsTab.tsx`

### Payment sync with contracts
- In `ContractDetail.tsx` and `Workspace.tsx`: query builder's default `payment_methods` row, show masked details in "Payment Instructions" card visible only to the contract's founder.
- `RecordPaymentModal.tsx`: pre-fill builder's preferred method.
- Trigger: when builder updates default payment method → insert notifications for all founders with `contracts.status IN ('contract_signed','active')` for that builder.

---

## Feature 2 — Project Edit/Delete/Archive

### DB
- Add `projects.status` value `archived` (text column already free-form, no enum change).
- Add `projects.archived_at` timestamp.

### UI — `MyProjects.tsx`
- Per-card dropdown: Edit, Archive, Reopen, Close Submissions, Delete.
- `EditProjectModal` (or reuse `PostProject` in edit mode at `/projects/:id/edit`).
- Delete guard (RPC `can_delete_project(_id)`): blocks if contracts/payments/disputes exist; warns if submissions exist → suggest Archive.
- `BrowseProjects.tsx`: exclude `archived` from `OPEN_STATUSES`.

---

## Feature 3 — Saved Projects

### DB
- `saved_projects` (user_id, project_id, saved_at, unique pair). RLS: owner only.

### UI
- Save/Unsave heart button in `BrowseProjects.tsx` cards + `ProjectDetail.tsx`.
- New page `/saved-projects` listing saved projects with status, deadline, startup info, builder's submission status.
- Sidebar link for builders.

---

## Feature 4 — Public Profile Pages

Routes exist (`/builders/:id`, `/startups/:id`) but content is thin. Expand:

### `BuilderProfile.tsx`
- Hero banner + avatar + title + location
- Tabs/sections: About, Experience, Education, Skills, Portfolio, Reviews, Stats, Active Contracts (count only), Completed Work
- Payment-verified badge (true if any `payment_methods.verified`)
- "Message Builder" CTA → opens/creates conversation

### `StartupProfile.tsx`
- Hero banner + logo + mission
- Sections: About, Founder, Active Projects (public), Hiring Status, Stats, Reviews, Open Contracts (count)
- "Message Startup" CTA

---

## Feature 5 — Complete Messaging System

### DB (new)
- `conversations` — id, type (`direct` | `group` | `project` | `contract`), context_type, context_id, created_at, last_message_at
- `conversation_participants` — conversation_id, user_id, joined_at, archived, blocked, last_read_at
- `messages` — id, conversation_id, sender_id, message_type (`text`|`file`|`image`|`project_reference`|`contract_reference`), content, attachment_url, metadata jsonb, created_at
- RLS: only participants can read/write; archive/block flags per participant.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE messages, conversations, conversation_participants;`
- Helper RPC: `get_or_create_direct_conversation(_other_user uuid)` returns conversation_id.
- Storage bucket `message-attachments` (private; signed URLs).

### UI — rewrite `/messages`
- Two-pane layout: left = conversation list (search, unread badges, last message preview, presence dot), right = chat window.
- Chat window: message bubbles, timestamps, typing indicator (Realtime broadcast channel), file/image upload, reference cards rendering (project/contract chips that link).
- Composer: text + attach (file/image) + "Attach reference" (project/contract picker).
- Per-conversation actions: archive, block, report.

### Entry points (CTAs added across app)
- Builder/Startup profile pages
- `ProjectDetail.tsx` (Message Startup)
- `SubmissionReview.tsx` (Message Builder)
- `OfferDetail.tsx`, `ContractDetail.tsx`, `Workspace.tsx`

### Presence & typing
- Supabase Realtime presence channel per user (`presence:user:{id}`).
- Typing: ephemeral broadcast on conversation channel.

### Notifications
- New message → row in `notifications` (throttled: only if recipient not currently viewing that conversation).
- Also notify on: project saved (to founder), payment-detail updated (to active-contract founders), project edited (to builders with submissions), project archived (to builders with submissions).

---

## Technical Notes

```text
Migration order:
1) profile tables (educations, experiences, payment_methods, certifications)
2) projects.archived_at + can_delete_project RPC
3) saved_projects
4) conversations / participants / messages + RPCs + realtime publication + storage bucket policies
```

- All sensitive payment fields stored as-is in DB (MVP) but **only last 4 of account number returned via a SECURITY DEFINER view `payment_methods_masked`** for cross-user reads. Full row only via owner RLS.
- All write paths log to `admin_audit_logs` via `log_audit()` for: payment_method change, project archive/delete, message-block, message-report.
- Sidebar (`AppSidebar.tsx`) gains: Settings → Profile, Saved Projects (builder), Messages badge with unread count.
- Type regeneration handled automatically after migration.

---

## Suggested execution order (one turn each)

1. **Migration 1** — profile tables + RLS + RPCs
2. **Migration 2** — projects archive + saved_projects + messaging tables + storage bucket + realtime
3. **Code: Profile settings** (`/settings/profile` with all tabs) + payment sync into contract/workspace
4. **Code: Project actions** (edit/archive/delete/reopen) on `MyProjects` + edit page
5. **Code: Saved projects** (button + `/saved-projects` page + sidebar)
6. **Code: Public profile pages** (expanded Builder & Startup profiles + Message CTAs)
7. **Code: Messaging system** (rewrite `/messages`, conversation hooks, realtime, presence, reference cards, entry CTAs)

Each step compiles and ships independently so the platform stays usable throughout.

---

Approve to proceed, or tell me to trim scope (e.g., defer presence/typing, skip certifications, single big migration vs. two).
