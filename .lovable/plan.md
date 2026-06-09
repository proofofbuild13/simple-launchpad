## Escrow bug fixes

### 1. New migration `supabase/migrations/20260609_fix_escrow_rpc.sql`
- Ensure `commission_invoice_seq` exists.
- Replace `release_escrow_for_milestone(uuid)`:
  - Move `pr_id` (and all vars) into the top-level `DECLARE` (fixes hard PL/pgSQL crash).
  - Accept milestone status `submitted` OR `approved`; RPC becomes the single authority for status transitions.
  - Guard `m.amount > 0`.
  - Atomically: set milestone → `approved`, deduct escrow balance, write ledger, insert confirmed `payment_records`, generate `commission_invoices` row, set milestone → `escrow_released`, notify builder + founder.
- Replace `fund_escrow(...)` to add `_amount > 0` guard (rest unchanged).
- Add new `admin_resolve_escrow(_contract_id, _milestone_id, _direction)` RPC for dispute resolution (`release_to_builder` | `refund_to_founder`), writing ledger + audit log.
- `GRANT EXECUTE` on all three functions to `authenticated`.

### 2. `src/pages/workspace/Workspace.tsx` — rewrite `approve(m)`
- Escrow path: call `release_escrow_for_milestone` directly (no pre-update). On error, toast and return. On success, toast + `load()`.
- Manual path: keep current flow (update status to `approved`, notify, open `RecordPaymentModal`).
- Always `setActive(null)` + `load()` at end.

### 3. `src/pages/workspace/Workspace.tsx` — kanban columns
- Insert `["escrow_released", "Paid"]` between `approved` and `fully_settled` in `COLUMNS`.
- Add the missing `escrow_released` (and any other referenced) entry to `STATUS_COLOR` per the spec continuation.

### Notes / assumptions
- The user's message was cut off mid-`STATUS_COLOR` instruction. I'll add `escrow_released: "bg-emerald-500/15 text-emerald-700"` (matches the existing emerald usage in `EscrowStatusCard`) and leave all other status colors untouched. If you intended a specific color, tell me before I implement.
- No other files touched. `ContractDetail.tsx`, `FundEscrowModal.tsx`, `EscrowStatusCard.tsx` unchanged.
- Migration is idempotent (`CREATE OR REPLACE`, `CREATE SEQUENCE IF NOT EXISTS`).

### Verification
- Migration runs cleanly.
- Approve on an escrow-funded contract: milestone moves Submitted → Paid column, ledger updates, builder gets confirmed payment record, commission invoice generated.
- Approve on legacy non-escrow contract: unchanged — opens RecordPaymentModal.
