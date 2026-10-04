# Escrow workflow repair

The normal startup approval failed because `Workspace` called `release_escrow_for_milestone` with a `submitted` milestone, while the database function required `approved`. The corrected function approves and records the release in one transaction. A failure leaves the original milestone and all financial records unchanged, so the startup can retry.

## Corrected flow

1. The builder accepts the offer. Contract and milestones keep the offer currency. Milestone amounts add up to the full compensation: 100 split into three milestones is 33.33 + 33.33 + 33.34.
2. The startup reviews the draft and sends it for signing. Contract terms and milestone finances freeze at this point. Each party can sign only their own role; rejected signatures are reported as errors.
3. After both parties sign and the builder supplies payment details, the startup records the exact active milestone total as the escrow deposit. The database validates the amount, signatures, currency and reference, and stores the optional proof path.
4. On an active contract, the builder submits a deliverable. Startup approval records the release, debit, ledger entry, full builder payment, and separate platform fee invoice together. Contract and milestone locks prevent stale status reads and duplicate releases.
5. The startup submits the platform fee separately. Its invoice currency and amount are authoritative. Rejected fee submissions can be retried. Admin verification settles the milestone.
6. Admin dispute releases use the same payment and invoice accounting. Refunds affect only the relevant milestone, cannot be replayed, and display separately from releases. The last settled or refunded milestone finishes the contract lifecycle.

Previously approved milestones also have a release action. Direct client writes cannot manufacture escrow balances, bypass the signed terms, or forge the financial state written by the escrow functions.

## Rollout and existing records

Apply `supabase/migrations/20261003120000_fix_escrow_workflow.sql` through the project's Supabase migration process before deploying the updated client. This workspace change has not been applied to the hosted database.

The migration repairs rounding and currency only for untouched, unsigned, unfunded generated drafts. Signed contracts, funded balances, customized milestones and historical payment records are preserved. Previously duplicated releases, currency errors, or mismatched signed budgets need explicit reconciliation against the actual transfer records.

This application records manual deposits, releases and refunds. These functions do not initiate or verify bank transfers. The configured payee details in `src/config/platformPayee.ts` still need operator verification; automatic collection and payout require a connected payment provider. The existing `close_no_action` dispute option preserves the disputed milestone state and requires separate reconciliation if work should resume.

## Validation

All 42 frontend tests and 35 database regression tests pass, along with the application type check and production build. Running the submitted-milestone regression against the previous database functions reproduces the original error: `Milestone must be approved before escrow can be released (current status: submitted)`.

- `npm test` checks the frontend, including atomic approval requests, retries, duplicate-click prevention, funding eligibility, receipt initialization, currency amounts, and refund displays.
- `npx tsc --noEmit -p tsconfig.app.json` checks application types.
- `npx vite build` builds the production client without regenerating the sitemap.
- `supabase/tests/escrow.test.mjs` runs the actual migration in an isolated PostgreSQL WASM runtime. Installation and execution instructions are at the top of that file. It checks affected row policies, authentication, exact funding, release rollback, repeat requests, commission accounting, dispute resolution, and preservation of existing records.

The isolated database tests use one connection; simultaneous transactions should also be exercised in staging PostgreSQL. Strict ESLint reports explicit `any` types and hook dependency warnings in the affected application and test code; a general typing/lint cleanup is outside this repair.
