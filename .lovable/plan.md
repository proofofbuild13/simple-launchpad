## Analysis: bugs and logic gaps in Contracts / Workspace

After reading `ContractDetail.tsx`, `Contracts.tsx`, `Workspace.tsx`, `Workspaces.tsx`, `WorkflowStatusTracker.tsx`, `WorkflowStepper.tsx`, and `PaymentTimeline.tsx`, I found 6 real issues. Here's what's wrong and the fix for each.

---

### 1. Workspaces list shows contracts that aren't actually active
`src/pages/workspace/Workspaces.tsx` filters with
`.in("status", ["contract_active", "active", "partially_signed", "contract_completed"])`.
`partially_signed` means signatures are still missing or escrow isn't funded — the workspace shouldn't be openable yet (no milestones can advance).
**Fix:** drop `partially_signed`. Keep only `contract_active`, `active`, `contract_completed`.

### 2. Workspace header progress stepper is hardcoded
`src/pages/workspace/Workspace.tsx` line 182:
`<WorkflowStepper current={4} />` — always reads "Active Work" even after the contract is completed or if it's actually still drafting.
**Fix:** derive `current` from `contract.status` + milestone progress:
- `contract_drafted` → 3 (Contract)
- `sent_for_signing` / `partially_signed` → 3
- `contract_active` / `active` → 4
- `contract_completed` → 5 (add a "Completed" stage to `WorkflowStepper` or cap visually)

### 3. WorkflowStatusTracker uses a milestone status that does not exist
`WorkflowStatusTracker.tsx` `resolveStatus()` checks `data.status === "paid"` on `contract_milestones` (lines 126 and 162). The `contract_milestones.status` domain in this project is `in_progress | submitted | revision_requested | approved | fully_settled | dispute` — there is no `paid`. So "Payment pending" group is unreachable.
**Fix:** replace the `"paid"` check with: a milestone in `approved` that has a `payment_records` row whose status is `declared` / `confirmed` / `disputed` → `payment_pending`. Query `payment_records` joined on the contract's milestones when status is `contract_active`.

### 4. Approve / submit-deliverable / request-revision don't notify the other party
Everywhere else in the codebase (contract sign, fund escrow, commission verify) we insert into `public.notifications`. In `Workspace.tsx`:
- `submitDeliverable()` — no notification to founder
- `approve()` — no notification to builder
- `requestRevision()` — no notification to builder, and the revision reason is discarded (never stored anywhere)
- `openDispute()` — no notification to the counter-party / admins

**Fix:** add `supabase.from("notifications").insert({...})` after each action with link `/workspace/${contract.id}`. Persist `revReason` either onto the milestone (e.g. `latest_revision_note` column, or as the body of the notification) — at minimum include it in the notification body so the builder sees it.

### 5. Milestone gets stuck in the "Approved" Kanban column after payment is recorded
`approve()` sets milestone to `approved`. `RecordPaymentModal` (and downstream `confirm_payment_record` RPC) only flips the milestone to `fully_settled` when the admin verifies the commission. Between "founder recorded payment" and "admin verified commission", the milestone stays in `approved`, so the founder sees the "Record builder payment" button again and the Kanban column is misleading.
**Fix:** in the Workspace "Payment record card" branch, hide the `Record builder payment` CTA when `paymentRecords[active.id]` already exists (currently only the inline payment card hides it; the modal-trigger inside the active milestone detail at line 259 does not). Also display a clear "Awaiting builder confirmation / Awaiting admin verification" sub-state on the Kanban card when a `payment_records` row exists but milestone is still `approved`.

### 6. `ContractDetail.sign()` mislabels the fully-signed-but-unfunded state, and reads stale `escrow_funded`
When the second signer signs but escrow isn't funded yet, status becomes `"partially_signed"` — which is wrong (both parties signed). Also `c.escrow_funded` is read from React state and can be stale between `fundEscrow` and `sign`.
**Fix:**
- After signing, re-fetch the contract row, then decide: both signed + funded → `contract_active`; both signed + unfunded → keep a clearer label by reusing `sent_for_signing` semantics or add a UI-only label "Awaiting escrow"; only one signed → `partially_signed`.
- In `Contracts.tsx`, add a `STATUS_COLOR` entry for `sent_for_signing` and `contract_completed` so the badge isn't unstyled.

---

## Implementation order

```text
1. Workspaces.tsx          — remove partially_signed from active filter
2. Workspace.tsx           — dynamic WorkflowStepper current; notifications on
                             submit/approve/revision/dispute; hide duplicate
                             "Record payment" CTA when a record exists; show
                             awaiting-confirmation sub-state
3. WorkflowStatusTracker   — replace milestone "paid" check with payment_records
                             join; map declared/confirmed/disputed to
                             payment_pending
4. ContractDetail.tsx      — re-fetch contract before deciding final status in
                             sign(); add color entries
5. Contracts.tsx           — add missing STATUS_COLOR entries
```

No database migrations are needed — all fixes are frontend/logic. The notifications table, `payment_records`, and existing milestone status values already support everything above.

Confirm and I'll switch to build mode and apply the fixes.