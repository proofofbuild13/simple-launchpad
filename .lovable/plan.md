## Escrow Payment System: Audit Findings & Remediation Plan

Below is a deep audit of the end-to-end escrow flow (DB functions, RLS, UI components). I found 22 issues across 3 severity tiers. This plan groups them into one DB migration + frontend fixes so the system is safe before any real money moves.

### End-to-end flow (verified working)

```
Offer accepted → create_contract_from_offer → contracts(drafted) + milestones
   ↓ both parties sign → contract_signatures
   ↓ founder funds → fund_escrow → contract_active + ledger(funded)
   ↓ builder submits milestone → status=submitted
   ↓ founder approves+releases → release_escrow_for_milestone
        → ledger(released), payment_record(confirmed), commission_invoice(generated)
        → milestone=escrow_released
   ↓ startup pays platform commission → commission_payments(submitted)
   ↓ admin verifies → verify_commission_payment
        → invoice=paid, PR=settled, milestone=fully_settled ✓
   (Dispute branch at any step → admin_resolve_escrow)
```

### Critical issues to fix (🔴)

1. **Race condition / negative escrow balance** — `release_escrow_for_milestone` reads `escrow_balance` then updates; two concurrent releases can both pass the check. Add `SELECT … FOR UPDATE` on the contracts row + a `CHECK (escrow_balance >= 0)` constraint.
2. **Founders can forge ledger entries** — `el_insert_system` RLS lets founders/admins INSERT directly into `escrow_ledger`. Drop the policy; only SECURITY DEFINER functions should write.
3. **Under-funding accepted** — `fund_escrow` allows any positive amount. Reject `_amount < escrow_amount`.
4. **Admin refund zeroes whole balance** — `admin_resolve_escrow.refund_to_founder` wipes `escrow_balance` even when only one milestone is disputed. Deduct only the milestone amount.
5. **Hardcoded 0.15 in `confirm_payment_record`** — manual flow ignores `platform_settings.commission_rate`. Read from settings (escrow path already does).
6. **Escrow releasable on unreviewed `submitted` milestone** — tighten guard back to `m.status = 'approved'` only.
7. **Founder can self-accept own offer in `create_contract_from_offer`** — restrict to builder only.
8. **Duplicate commission payments per invoice** — add partial unique index on `commission_payments(invoice_id) WHERE status <> 'rejected'`.
9. **Escrow PR can be "re-confirmed" by builder** — guard `confirm_payment_record` to reject `payment_method = 'escrow'`.

### High-priority issues (🟠)

10. **Non-atomic dispute creation** in `Workspace.tsx` — wrap into a new `raise_dispute(milestone_id, reason)` SECURITY DEFINER RPC that inserts dispute + updates milestone + notifies admins.
11. **`AdminDisputeDetail` bypasses `admin_resolve_escrow`** — wire the resolve UI to call the RPC (release-to-builder / refund-to-founder) along with the disputes UPDATE.
12. **`RecordPaymentModal` silently empty** — founder query of `payment_methods` returns nothing due to RLS. Switch to existing `get_builder_default_payment` RPC.
13. **Hardcoded 15% in Workspace UI** — fetch rate from `platform_settings`.
14. **No admin notification on dispute** — `raise_dispute` RPC + `confirm_payment_record` mismatch path should notify all admin/super_admin users.

### Medium issues (🟡)

15. Explicit `GRANT USAGE ON SEQUENCE commission_invoice_seq` to roles used by RPCs.
16. Replace placeholder payee credentials in `src/config/platformPayee.ts` with values pulled from `platform_settings` (or document clearly they're placeholders and gate the modal in non-prod).
17. Cron/edge function (out of scope here) to transition `generated → overdue` invoices. Recommend adding later.

### What I'll ship in build mode

**One DB migration** containing:
- `ALTER TABLE contracts ADD CONSTRAINT escrow_balance_nonneg CHECK (escrow_balance >= 0)`
- Rewrite `release_escrow_for_milestone`: `SELECT … FOR UPDATE` on contract; require `m.status='approved'`; reject `payment_method='escrow'` already PR'd; minor comments
- Rewrite `fund_escrow`: enforce `_amount >= c.escrow_amount`
- Rewrite `admin_resolve_escrow.refund_to_founder`: deduct only milestone amount; insert ledger; require milestone amount > 0
- Rewrite `confirm_payment_record`: read `commission_rate` from `platform_settings`; reject escrow-method PRs
- Rewrite `create_contract_from_offer`: only builder can call
- Drop policy `el_insert_system`; revoke INSERT on `escrow_ledger` from authenticated
- New `raise_dispute(milestone_id, reason)` SECURITY DEFINER RPC (atomic insert + milestone update + admin notifications)
- New `resolve_dispute(dispute_id, resolution, direction, milestone_id)` SECURITY DEFINER RPC that calls escrow resolution logic and updates the dispute row in one transaction
- `CREATE UNIQUE INDEX commission_payments_one_active_per_invoice ON commission_payments(invoice_id) WHERE status <> 'rejected'`
- `GRANT USAGE ON SEQUENCE commission_invoice_seq TO authenticated, service_role`

**Frontend edits**:
- `src/pages/workspace/Workspace.tsx`
  - Replace direct disputes `INSERT` + milestone `UPDATE` with `raise_dispute` RPC
  - Replace hardcoded `* 0.15` with `commission_rate` fetched once from `platform_settings`
- `src/components/payments/RecordPaymentModal.tsx`
  - Replace `from("payment_methods")` query with `rpc("get_builder_default_payment", { _builder_id })`
- `src/pages/admin/AdminDisputeDetail.tsx`
  - Replace direct disputes `UPDATE` with new `resolve_dispute` RPC (taking direction + milestone_id)
- (Optional, document only) Flag `src/config/platformPayee.ts` placeholder so the user knows to update before going live.

### What this plan does NOT cover (recommend follow-ups)

- Overdue-invoice automation (needs pg_cron or scheduled edge function).
- Replacing manual UPI escrow with a real PSP / Razorpay Route / Stripe Connect.
- Refactor of placeholder UPI/bank credentials into `platform_settings`-driven config.

Once you approve, I'll switch to build mode and ship the migration + frontend changes in one pass.