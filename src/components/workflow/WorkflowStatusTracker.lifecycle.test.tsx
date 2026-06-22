/**
 * End-to-end lifecycle test for the contract workflow.
 *
 * Walks a single contract through every status transition the system
 * supports and asserts that WorkflowStatusTracker resolves the expected
 * stage at each step. The Supabase client is mocked with an in-memory
 * "database" so this exercises the real resolver in
 * WorkflowStatusTracker.resolveStatus().
 *
 * Transitions covered:
 *   contract_drafted     -> "Contract drafted"
 *   sent_for_signing     -> "For signing"
 *   partially_signed     -> "Partially signed"   (signatures present, escrow not funded)
 *   contract_active      -> "Active contract" / "Milestone work"
 *   milestone approved + payment declared -> "Payment pending"
 *   all milestones fully_settled          -> "Settled"
 *   contract_completed                    -> "Completed"
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

type Contract = {
  id: string;
  status: string;
  escrow_funded: boolean;
};
type Milestone = {
  id: string;
  contract_id: string;
  status: string;
};
type PaymentRecord = {
  milestone_id: string;
  status: string;
  created_at: string;
};

const db: {
  contracts: Contract[];
  contract_milestones: Milestone[];
  payment_records: PaymentRecord[];
} = {
  contracts: [],
  contract_milestones: [],
  payment_records: [],
};

function makeQuery(rows: any[]) {
  let filtered = [...rows];
  const api: any = {
    select: () => api,
    eq: (col: string, val: any) => {
      filtered = filtered.filter((r) => r[col] === val);
      return api;
    },
    in: (col: string, vals: any[]) => {
      filtered = filtered.filter((r) => vals.includes(r[col]));
      return api;
    },
    order: () => api,
    limit: () => api,
    maybeSingle: () =>
      Promise.resolve({ data: filtered[0] ?? null, error: null }),
    then: (resolve: any) => resolve({ data: filtered, error: null }),
  };
  return api;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: keyof typeof db) => makeQuery(db[table] ?? []),
  },
}));

import { WorkflowStatusTracker } from "./WorkflowStatusTracker";

const CONTRACT_ID = "contract-lifecycle-1";

function resetDb(status: string, escrow_funded = false) {
  db.contracts = [{ id: CONTRACT_ID, status, escrow_funded }];
  db.contract_milestones = [];
  db.payment_records = [];
}

async function assertStage(label: string) {
  render(
    <WorkflowStatusTracker contractId={CONTRACT_ID} compact={false} />
  );
  await waitFor(() => {
    expect(screen.getByText(label)).toBeTruthy();
  });
  cleanup();
}

describe("Contract lifecycle — status transitions", () => {
  beforeEach(() => {
    db.contracts = [];
    db.contract_milestones = [];
    db.payment_records = [];
  });

  it("1) contract_drafted resolves to 'Contract drafted'", async () => {
    resetDb("contract_drafted");
    await assertStage("Contract drafted");
  });

  it("2) sent_for_signing resolves to 'For signing'", async () => {
    resetDb("sent_for_signing");
    await assertStage("For signing");
  });

  it("3) partially_signed (escrow not yet funded) resolves to 'Partially signed'", async () => {
    resetDb("partially_signed", false);
    await assertStage("Partially signed");
  });

  it("4) contract_active with no milestone activity resolves to 'Milestone work'", async () => {
    resetDb("contract_active", true);
    db.contract_milestones = [
      { id: "m1", contract_id: CONTRACT_ID, status: "in_progress" },
      { id: "m2", contract_id: CONTRACT_ID, status: "in_progress" },
    ];
    await assertStage("Milestone work");
  });

  it("5) approved milestone + declared payment resolves to 'Payment pending'", async () => {
    resetDb("contract_active", true);
    db.contract_milestones = [
      { id: "m1", contract_id: CONTRACT_ID, status: "approved" },
      { id: "m2", contract_id: CONTRACT_ID, status: "in_progress" },
    ];
    db.payment_records = [
      { milestone_id: "m1", status: "declared", created_at: new Date().toISOString() },
    ];
    await assertStage("Payment pending");
  });

  it("6) all milestones fully_settled resolves to 'Settled'", async () => {
    resetDb("contract_active", true);
    db.contract_milestones = [
      { id: "m1", contract_id: CONTRACT_ID, status: "fully_settled" },
      { id: "m2", contract_id: CONTRACT_ID, status: "fully_settled" },
    ];
    await assertStage("Settled");
  });

  it("7) contract_completed resolves to 'Completed'", async () => {
    resetDb("contract_completed", true);
    await assertStage("Completed");
  });

  it("walks the whole lifecycle in order", async () => {
    const sequence: Array<[() => void, string]> = [
      [() => resetDb("contract_drafted"), "Contract drafted"],
      [() => resetDb("sent_for_signing"), "For signing"],
      [() => resetDb("partially_signed", false), "Partially signed"],
      [
        () => {
          resetDb("contract_active", true);
          db.contract_milestones = [
            { id: "m1", contract_id: CONTRACT_ID, status: "in_progress" },
          ];
        },
        "Milestone work",
      ],
      [
        () => {
          resetDb("contract_active", true);
          db.contract_milestones = [
            { id: "m1", contract_id: CONTRACT_ID, status: "approved" },
          ];
          db.payment_records = [
            { milestone_id: "m1", status: "declared", created_at: new Date().toISOString() },
          ];
        },
        "Payment pending",
      ],
      [
        () => {
          resetDb("contract_active", true);
          db.contract_milestones = [
            { id: "m1", contract_id: CONTRACT_ID, status: "fully_settled" },
          ];
        },
        "Settled",
      ],
      [() => resetDb("contract_completed", true), "Completed"],
    ];

    for (const [setup, label] of sequence) {
      setup();
      await assertStage(label);
    }
  });
});
