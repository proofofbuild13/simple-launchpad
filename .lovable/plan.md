
## Milestone-Based Escrow System

Implements escrow ledger, fund/release RPCs, and UI for funding escrow and auto-releasing per-milestone payments. Manual payment path stays intact for legacy/non-escrow contracts.

### 1. Database migration (`supabase/migrations/…_escrow_system.sql`)
- New table `public.escrow_ledger` with RLS (parties + admin read; founder/admin insert) and indexes.
- `public.platform_settings` table seeded with `commission_rate = 0.15` (admin-write, authenticated-read).
- Add columns to `contracts`: `escrow_balance`, `escrow_provider`, `escrow_funded_at`, `escrow_transaction_ref`.
- RPCs (SECURITY DEFINER, EXECUTE granted to `authenticated`):
  - `fund_escrow(_contract_id, _amount, _transaction_ref, _screenshot_url)` — founder-only, writes ledger `funded` entry, sets contract active if both signed.
  - `release_escrow_for_milestone(_milestone_id)` — founder-only, requires `approved` status, decrements balance, writes ledger `released` entry, creates `payment_records` row (`escrow` method, confirmed), creates `commission_invoices` row using `platform_settings.commission_rate`, sets milestone `escrow_released`, notifies both parties.
  - `get_escrow_summary(_contract_id)` — totals + counts.
- Includes GRANTs on new public tables per project convention.

### 2. New file `src/components/payments/FundEscrowModal.tsx`
Dialog showing milestone total, commission note (billed per-milestone), platform payee details from `PLATFORM_PAYEE`, reference `ESCROW-{contract.id.slice(0,8).toUpperCase()}`. Inputs: transaction ref (required, mono), optional screenshot upload to `payment-proofs` bucket. Calls `fund_escrow` RPC; success toast + `onDone()`.

### 3. New file `src/components/payments/EscrowStatusCard.tsx`
- Unfunded: amber warning, amount needed, founder gets "Fund escrow" button, builder gets waiting message.
- Funded: three stat boxes (Held / Released / Progress %), emerald progress bar, last 10 ledger entries with typed badges and signed amounts, summary line using `get_escrow_summary` for `released_count / milestone_count`.

### 4. Update `src/pages/contracts/ContractDetail.tsx`
- Add imports + `fundEscrowOpen` state.
- Remove old `fundEscrow` function and the old Escrow card; replace sidebar with `<EscrowStatusCard …/>`.
- Timeline → 7 steps including "Escrow funded"; rename CardTitle to "Contract progress".
- Add amber CTA banner under timeline when both signed, unfunded, founder.
- `sign()` no longer flips to `contract_active`; always `partially_signed`. Activation happens inside `fund_escrow`.
- Signatures card: builder sees "Waiting for founder to fund escrow…" when both signed & unfunded.
- Mount `<FundEscrowModal …/>` at bottom.
- Swap `$` → `₹` in milestone displays.

### 5. Update `src/pages/workspace/Workspace.tsx`
- New `approve(m)` logic: update milestone to `approved`, then branch on `contract.escrow_funded`:
  - funded → `release_escrow_for_milestone`, toast escrow released.
  - not funded → existing RecordPaymentModal flow.
- Approve button label switches to "Approve & release escrow" when funded; small helper text with ShieldCheck note.
- Payments section: include `awaiting_release` and `escrow_released` in the visible-status filter.
- For `escrow_released`/`fully_settled` with escrow funded, show emerald summary box (gross / -15% commission / builder net) above PaymentTimeline.
- New badges: `escrow_released` (emerald + ShieldCheck) and `awaiting_release` (amber "Releasing…").

### 6. Verification
- `tsc --noEmit` clean across the 4 files.
- RPC argument names match exactly.
- Old escrow code removed (no dead `fundEscrow`).
- Manual payment path unchanged for `escrow_funded=false`.

### Assumptions
- `commission_invoice_seq` sequence already exists (used by current confirm flow).
- `payment_records.payment_method` accepts `'escrow'` string (text column).
- `PLATFORM_PAYEE` / `COMMISSION_RATE` exports in `src/config/platformPayee.ts` are reused as-is.
- Hardcoded `0.15` in Workspace summary box is display-only (per spec §6.5); authoritative rate stays in `platform_settings`.

### Execution order
1. Run migration (await approval).
2. After types regenerate: create `FundEscrowModal.tsx` and `EscrowStatusCard.tsx`.
3. Patch `ContractDetail.tsx` and `Workspace.tsx`.
4. Type-check via build signal; fix any drift.
