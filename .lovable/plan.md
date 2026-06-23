# Plan: Fix contract lifecycle gaps

Address every issue from the audit report. One DB migration + small frontend edits.

## 1. DB migration (single file)

**Trigger A — auto-complete contracts**
- `AFTER UPDATE OF status ON contract_milestones`
- When all non-cancelled milestones for a contract are `fully_settled`, set `contracts.status = 'contract_completed'`, write a notification to both parties, and audit-log it.

**Trigger B — activate on second signature**
- `AFTER INSERT ON contract_signatures`
- If both founder + builder signatures now exist AND `escrow_funded = true` AND status is in (`sent_for_signing`, `partially_signed`), set `contracts.status = 'contract_active'`.
- Also: if both signatures exist and status is `sent_for_signing`, bump to `partially_signed` (covers the "both signed but escrow pending" state cleanly).

**Guard `fund_escrow`**
- Reject the call when neither signature exists yet (prevents money being locked on an unsigned contract). Allow funding when at least one party has signed.

**Admin RLS override on `contracts`**
- Add `SELECT` policy: `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')`.

**Explicit GRANTs**
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_payments TO authenticated;`
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO authenticated;`
- `GRANT ALL` on both to `service_role`.

**Drop unreachable policy**
- Drop `el_insert_admin` on `escrow_ledger` (privilege REVOKEd at table level, policy is dead).

## 2. Frontend tweaks

**`src/pages/contracts/ContractDetail.tsx`**
- In `sign()`: after inserting the signature, re-query signatures. If both exist, do not write `partially_signed` (the new trigger handles it). Just refresh.

**`src/pages/workspace/Workspace.tsx`**
- Add `awaiting_release` to the `COLUMNS` kanban definition so milestones in that state are visible.

**`src/components/workflow/WorkflowStatusTracker.tsx`**
- Tighten `payment_pending` mapping: exclude `confirmed` payments whose commission invoice is already `paid` (treat as `fully_settled` path).

## 3. Verification

- Run the existing `WorkflowStatusTracker.lifecycle.test.tsx` — should still pass.
- Add 2 new lifecycle assertions:
  - All milestones `fully_settled` → contract auto-transitions to `contract_completed`.
  - Builder signs *after* escrow funded → contract becomes `contract_active`.
- Build check.

## Out of scope
- No changes to commission rates, dispute resolution UX, or notification copy beyond the new completion notification.
