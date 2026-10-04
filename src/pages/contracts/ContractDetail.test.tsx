import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { insertMock, rpcMock, toastError, toastSuccess, escrowProps } = vi.hoisted(() => ({
  insertMock: vi.fn(), rpcMock: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn(), escrowProps: vi.fn(),
}));

const contract = {
  id: "contract-1", project_id: "project-1", founder_id: "founder-1", builder_id: "builder-1",
  status: "sent_for_signing", escrow_funded: false, escrow_balance: 0, currency: "INR",
  projects: { title: "Build a dashboard" },
};
let signatures: { role: string; signed_by: string }[] = [];

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "founder-1" } }) }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }));
vi.mock("@/components/workflow/WorkflowStatusTracker", () => ({ WorkflowStatusTracker: () => null }));
vi.mock("@/components/payments/FundEscrowModal", () => ({ FundEscrowModal: () => null }));
vi.mock("@/components/payments/EscrowStatusCard", () => ({
  EscrowStatusCard: (props: unknown) => { escrowProps(props); return null; },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
    from: (table: string) => {
      const rows = table === "contracts" ? [contract]
        : table === "contract_signatures" ? signatures
        : table === "contract_milestones" ? [{ id: "milestone-1", title: "Delivery", amount: 100.01, status: "in_progress" }]
        : table === "startup_profiles" ? [{ company_name: "Startup" }]
        : table === "builder_profiles" ? [{ full_name: "Builder" }] : [];
      const query: any = {
        select: () => query, eq: () => query, order: () => query,
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        insert: insertMock,
        then: (resolve: any) => resolve({ data: rows, error: null }),
      };
      return query;
    },
  },
}));

import ContractDetail from "./ContractDetail";

function showContract() {
  return render(<MemoryRouter initialEntries={["/contracts/contract-1"]}>
    <Routes><Route path="/contracts/:id" element={<ContractDetail />} /></Routes>
  </MemoryRouter>);
}

describe("Contract signing and escrow eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contract.status = "sent_for_signing";
    signatures = [];
    insertMock.mockResolvedValue({ error: null });
    rpcMock.mockResolvedValue({ error: null });
  });
  afterEach(cleanup);

  it("reports a rejected signature without announcing success or notifying the builder", async () => {
    insertMock.mockResolvedValue({ error: { message: "Signature rejected" } });
    showContract();
    fireEvent.click(await screen.findByRole("button", { name: /sign contract/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Could not sign contract: Signature rejected"));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("keeps funding unavailable while the contract is unsigned", async () => {
    contract.status = "contract_drafted";
    showContract();
    await screen.findByRole("button", { name: /send for signing/i });
    expect(escrowProps.mock.lastCall?.[0]).toMatchObject({ canFund: false, currency: "INR" });
    expect(screen.queryByRole("button", { name: /fund escrow/i })).toBeNull();
  });

  it("enables funding only with signatures from the two actual contract parties", async () => {
    contract.status = "partially_signed";
    signatures = [{ role: "founder", signed_by: "founder-1" }, { role: "builder", signed_by: "builder-1" }];
    showContract();
    await screen.findByRole("button", { name: /fund escrow/i });
    expect(escrowProps.mock.lastCall?.[0]).toMatchObject({ canFund: true, totalAmount: 100.01 });
  });

  it("does not count a founder signature claiming the builder role", async () => {
    contract.status = "partially_signed";
    signatures = [{ role: "founder", signed_by: "founder-1" }, { role: "builder", signed_by: "founder-1" }];
    showContract();
    await screen.findByText("partially signed");
    await waitFor(() => expect(escrowProps.mock.lastCall?.[0]).toMatchObject({ canFund: false }));
    expect(screen.queryByRole("button", { name: /fund escrow/i })).toBeNull();
  });
});
