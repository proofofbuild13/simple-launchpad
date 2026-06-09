# Fix: Builder payment-details check runs too late

## Problem
Today the system only discovers that the builder has no payment method **after** the founder clicks "Approve milestone" — the `RecordPaymentModal` opens, queries `payment_methods`, then disables the submit button with an inline "Remind Builder" link. By that point:

- The milestone is already flipped to `approved` (manual path), so the founder is stuck mid-flow.
- For escrow contracts there is no check at all — `release_escrow_for_milestone` runs and funds are released without the builder ever being prompted to add UPI/bank details.
- The builder only learns details are missing if the founder manually clicks "Remind Builder" inside the modal.

## Fix (frontend + one helper RPC)

### 1. New SECURITY DEFINER RPC `builder_payment_status(_builder_id uuid)`
Returns `{ has_method: boolean, is_verified: boolean }`. Authorized for any counterparty on an active contract or admin (same gate as `get_builder_default_payment`). This lets the founder check without reading the `payment_methods` table directly.

### 2. New helper `src/lib/builderPaymentCheck.ts`
`ensureBuilderPaymentReady(contract)` →
- Calls `builder_payment_status`.
- If `has_method === false`: calls `send_notification` to the builder (`type: 'payment_method_missing'`, link `/settings?tab=payments`), shows founder a toast "Builder hasn't added payment details — we've notified them", returns `false`.
- Otherwise returns `true`.

Idempotency: only sends one notification per 24h by checking the most recent matching `notifications` row client-side before insert.

### 3. `src/pages/workspace/Workspace.tsx` — gate `approve(m)`
At the top of `approve`, before either branch:
```ts
const ready = await ensureBuilderPaymentReady(contract);
if (!ready) { setActive(null); return; }
```
This blocks both the escrow release path and the manual `RecordPaymentModal` path until the builder has a payment method on file.

### 4. `src/components/payments/FundEscrowModal.tsx` — same gate
Run `ensureBuilderPaymentReady` before allowing the founder to fund escrow, so money never enters escrow for a builder who can't be paid out.

### 5. `RecordPaymentModal` — keep existing "Remind Builder" UI as a fallback
No behavior change; it stays as a safety net if state drifts between the pre-check and modal open.

## Files touched
- `supabase/migrations/<new>.sql` — `builder_payment_status` RPC + grant to `authenticated`.
- `src/lib/builderPaymentCheck.ts` — new helper.
- `src/pages/workspace/Workspace.tsx` — call helper in `approve`.
- `src/components/payments/FundEscrowModal.tsx` — call helper before funding.

No changes to `release_escrow_for_milestone`, no schema changes, no edits to the working escrow ledger logic.
