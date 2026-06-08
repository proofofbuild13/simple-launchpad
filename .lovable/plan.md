
## Payment system audit — findings

### Backend (RPCs) — healthy
- `fund_escrow`, `release_escrow_for_milestone`, `get_escrow_summary` are correct: balance is decremented, ledger entry written, `payment_records` + `commission_invoices` rows created with the platform commission rate, both parties notified.
- RLS / GRANTs on `escrow_ledger` and `platform_settings` are in place.

### Frontend — real bugs in `src/pages/workspace/Workspace.tsx`

1. **Milestones disappear from the kanban after escrow release.** `COLUMNS` only lists `in_progress | submitted | revision_requested | approved | fully_settled`. When `release_escrow_for_milestone` flips the milestone to `escrow_released`, the card vanishes from the board (it only reappears once an admin verifies commission and bumps it to `fully_settled`). `STATUS_COLOR` is also missing entries for `escrow_released` and `awaiting_release`.

2. **`approve()` ordering race.** The function first does `UPDATE contract_milestones SET status='approved'`, then calls `release_escrow_for_milestone`. If the update succeeds but the RPC fails (insufficient balance, network), the milestone is stuck as `approved` while the founder sees a generic "release failed" toast and no retry path. The RPC already enforces `status='approved'` and is transactional — we should let the RPC own the state change.

3. **Currency mix-up.** Header reads `${totalPaid} / ${contract.escrow_amount}`, milestone cards show `${m.amount}`, payment record card shows `$pr.declared_amount`. The escrow side of the app (FundEscrowModal, EscrowStatusCard, ContractDetail) uses ₹. Every visible amount in Workspace should be ₹.

4. **`totalPaid` is wrong for escrow contracts.** It only sums milestones whose `payment_records.status === 'settled'`, which never happens on the escrow path until admin verification of commission. For escrow-funded contracts the header should sum milestones with status `escrow_released` or `fully_settled`.

5. **`PaymentTimeline` stage is wrong for escrow milestones.** `paymentStageIndex` is driven by `paymentRecord/invoice/commissionPayment` from the manual flow; on the escrow path the auto-created `payment_record` is already `confirmed`, so the timeline jumps mid-flow and never reads "released". Add a short-circuit: when `contract.escrow_funded` and milestone is `escrow_released`/`fully_settled`, force the timeline to its final stage (and hide the manual "Confirm receipt" / "Record payment" CTAs, which already don't apply).

6. **Manual "Record builder payment" button shows on escrow contracts.** Guard `isFounder && !pr && m.status === 'approved'` with `!contract.escrow_funded` so the founder never sees a manual record button on an escrow contract (the RPC already auto-creates the record).

### Frontend — small issues in `src/pages/contracts/ContractDetail.tsx`

7. **Dead ternary** at line 108: `otherSigned ? "partially_signed" : "partially_signed"`. Replace with the literal `"partially_signed"` to make intent obvious. (Behavior is already correct — activation happens inside `fund_escrow`.)

8. **`escrow_amount` vs. `sum(milestones.amount)` drift.** `FundEscrowModal` deposits the milestone total, not `contract.escrow_amount`. If the founder added/removed milestones after the offer, the deposited amount and `contract.escrow_amount` diverge silently. Display the milestone total (₹) as the authoritative figure in the EscrowStatusCard header instead of relying on `escrow_amount`.

## Plan — UI-only fixes (no schema changes)

### `src/pages/workspace/Workspace.tsx`
- Extend `COLUMNS` to 6 columns, inserting `["escrow_released", "Escrow released"]` between `approved` and `fully_settled`. Add matching `STATUS_COLOR` entries for `escrow_released` (emerald) and `awaiting_release` (amber).
- Rewrite `approve(m)`:
  - If `contract.escrow_funded`: call `release_escrow_for_milestone` directly. The RPC requires `status='approved'`, so first `UPDATE contract_milestones SET status='approved'` inside the same handler but only call `load()` after the RPC resolves; on RPC failure, roll the status back to `submitted` and surface the actual error.
  - If not funded: keep existing manual flow (set `approved` → open `RecordPaymentModal`).
- Replace every visible `$` in the Workspace tree with `₹` (header total, kanban card amount, payment-record card, commission-payment card).
- `totalPaid` calculation: when `contract.escrow_funded`, sum milestone amounts whose status ∈ `{escrow_released, fully_settled}`; otherwise keep the current settled-payment_records sum.
- Add `contract.escrow_funded` guard to the "Record builder payment" button so it only appears on non-escrow contracts.
- In the per-milestone Payment card, when `contract.escrow_funded && m.status ∈ {escrow_released, fully_settled}`, pass a forced final stage to `<PaymentTimeline current={...} />` and hide manual-flow CTAs.

### `src/pages/contracts/ContractDetail.tsx`
- Simplify the dead ternary on line 108 to `status: "partially_signed"`.
- In `EscrowStatusCard` invocation, keep `totalAmount={totalMilestones}` (already correct) — no change needed there, but verify the unfunded copy reads the milestone total, not `escrow_amount`.

### `src/components/payments/EscrowStatusCard.tsx`
- No structural changes; just confirm the "Amount required" line uses the `totalAmount` prop (it does) so it stays in sync with edited milestones.

### Verification
- Type-check passes for the 3 edited files.
- Manual smoke flow (funded contract): submit deliverable → founder approves → milestone moves to **Escrow released** column with emerald badge, ledger updates, builder gets payment record auto-confirmed, commission invoice generated, founder header total reflects released amount.
- Manual smoke flow (legacy non-escrow contract): unchanged — approve still opens `RecordPaymentModal`.

### Out of scope
- No DB migration. The existing RPCs already work; only the React UI needs to catch up to the `escrow_released` / `awaiting_release` statuses and the ₹ currency.
- No changes to admin commission verification.

