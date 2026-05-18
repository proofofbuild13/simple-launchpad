# Hire to Build — Second Engagement Model

Add a parallel full-time hiring flow alongside the existing Project Hire (contract + milestone) flow. Both coexist; `projects.engagement_type` switches behavior end-to-end.

## 1. Database (one migration)

New enum + columns + tables exactly per your SQL spec:

- `engagement_type` enum: `project_hire`, `hire_to_build`
- `projects`: add `engagement_type` (default `project_hire`), `job_title`, `seniority_level`, `location_type`, `office_location`, `ctc_min`, `ctc_max`, `ctc_confidential`, `probation_months`
- `employment_offers` table (FK → projects, submissions, auth.users)
- `placement_fees` table (FK → employment_offers)
- `builder_profiles`: add `open_to_full_time boolean default false`
- RLS: startup/builder see own offers; admin policies via `has_role('admin')`; insert policies (startup creates offers for own projects; builder updates own offer status to accepted/declined)
- Trigger: on `employment_offers.status = 'accepted'` → auto-create `placement_fees` row (fixed fee, e.g. 8.33% of annual CTC or flat amount — confirm in Q below) and set project status to `closed`
- Indexes per spec
- Note: FKs reference `auth.users(id)` (project standard), not a `users` table

## 2. Post Project — Step 3 (Engagement)

Refactor `PostProject.tsx` to add an engagement-type step matching the uploaded HTML reference:

- Two cards: **Project Hire** (blue/info) vs **Hire to Build** (green/success)
- If `project_hire` → existing fields (budget, deadline, milestones config)
- If `hire_to_build` → new fields: job_title, seniority_level (Junior/Mid/Senior/Lead), location_type (Remote/Hybrid/On-site), office_location (conditional), ctc_min/ctc_max + confidential toggle, probation_months (none/1/3/6), employment_type fixed to full-time

## 3. Browse Feed (`BrowseProjects.tsx`)

- Add `Engagement Type` filter (All / Project Hire / Hire to Build)
- Card badge: blue "Project Hire" vs green "Full-time Role"
- CTA label: "Submit Solution" vs "Apply for Role"
- Show CTC range (or "Competitive Salary") + location on hire_to_build cards instead of budget/deadline

## 4. Public Project Page (`PublicProject.tsx`)

Conditional layout per engagement type — hide budget/timeline blocks, show role/CTC/location/probation blocks for hire_to_build.

## 5. Submission Flow

Identical until shortlist. Add optional `resume_url` + `portfolio_url` fields on submissions when project is hire_to_build (reuse existing submission table; columns are nullable for project_hire).

## 6. Offer Divergence

Branch in offer creation UI:

- **Project Hire** → existing `MakeOffer.tsx` (contract + milestones) — unchanged
- **Hire to Build** → new `MakeJobOffer.tsx` page: job_title, annual CTC, joining_date, work_location, office_location, probation, reporting_manager (notes), offer_letter_url upload, expires_at (default +72h)

New routes:
- `/projects/:id/make-job-offer/:submissionId`
- `/job-offers/:id` (builder view: download letter, Accept / Decline, countdown)
- Builder accept → status `accepted`, trigger fires placement fee
- Builder decline → status `declined`

## 7. Dashboards

- **Builder Dashboard**: add "Job Offers" + "Placement History" sections
- **Startup Dashboard**: add "Active Hiring Roles" + "Placements Completed"
- **Admin**: add Placement Fees list (verify payment, mark paid, similar to commission invoices)

## 8. Builder Profile

- Settings toggle: "Open to Full-Time Roles"
- "Open to Full-Time" badge on `BuilderProfile.tsx` and marketplace cards when on

## 9. Notifications

Extend existing notification system: when new `hire_to_build` project posted, prioritize notify builders with `open_to_full_time = true`.

## 10. Types & Cleanup

- Regenerate `src/integrations/supabase/types.ts` after migration
- Add `src/lib/engagement.ts` helpers (badge variant, label, CTA copy)
- Sidebar: add "Job Offers" link (builders) and "Hiring" link (startups)

## Files (high-level)

```
supabase/migrations/<ts>_hire_to_build.sql           NEW
src/pages/projects/PostProject.tsx                   EDIT (engagement step)
src/pages/projects/BrowseProjects.tsx                EDIT (filter, badges, CTA)
src/pages/projects/PublicProject.tsx                 EDIT (conditional)
src/pages/projects/ProjectDetail.tsx                 EDIT (conditional)
src/pages/offers/MakeJobOffer.tsx                    NEW
src/pages/offers/JobOfferDetail.tsx                  NEW
src/pages/offers/JobOffers.tsx                       NEW (list)
src/pages/dashboard/StartupDashboard.tsx             EDIT
src/pages/dashboard/BuilderDashboard.tsx             EDIT
src/pages/dashboard/AdminPlacementFees.tsx           NEW
src/pages/settings/Settings.tsx                      EDIT (open_to_full_time)
src/pages/marketplace/BuilderProfile.tsx             EDIT (badge)
src/components/layout/AppSidebar.tsx                 EDIT
src/lib/engagement.ts                                NEW
src/App.tsx                                          EDIT (routes)
src/integrations/supabase/types.ts                   REGEN
```

## Open Questions

1. **Placement fee structure** — flat amount (e.g. ₹50,000) or % of annual CTC (e.g. 8.33% = one month)? Your spec lists both `fee_type` values; need the default.
2. **Resume/portfolio uploads** — required or optional on hire_to_build submissions?
3. **Should existing `MakeOffer` / `OfferDetail` / `Contracts` pages be hidden for hire_to_build projects** (they will, but confirming no shared use).

I'll proceed with sensible defaults (8.33% of annual CTC; resume optional; full hide) unless you say otherwise.