import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const ledger = [{ id: "refund-1", entry_type: "refunded", amount: 200, balance_after: 300, created_at: "2026-06-01" }];
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: (...args: any[]) => rpcMock(...args),
  from: () => {
    const api: any = { select: () => api, eq: () => api, order: () => api, limit: async () => ({ data: ledger, error: null }) };
    return api;
  },
} }));

import { EscrowStatusCard } from "./EscrowStatusCard";

const baseProps = { contractId: "contract-1", totalAmount: 1000, escrowFunded: true, escrowBalance: 300, isFounder: true, onFundClick: vi.fn(), currency: "INR" as const };

describe("EscrowStatusCard", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ data: [{ total_funded: 1000, total_released: 500, released_count: 1, milestone_count: 3 }], error: null });
  });

  it("shows ledger releases separately from refunds and formats refunds as debits", async () => {
    render(<EscrowStatusCard {...baseProps} />);
    expect(await screen.findByText("₹500.00")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("-₹200.00")).toBeTruthy();
    expect(screen.queryByText("₹700.00")).toBeNull();
  });

  it("refreshes its ledger and summary when the escrow balance changes", async () => {
    const view = render(<EscrowStatusCard {...baseProps} />);
    await screen.findByText("₹500.00");
    rpcMock.mockResolvedValue({ data: [{ total_funded: 1000, total_released: 700, released_count: 2, milestone_count: 3 }], error: null });
    view.rerender(<EscrowStatusCard {...baseProps} escrowBalance={100} />);
    expect(await screen.findByText("₹700.00")).toBeTruthy();
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
  });

  it("requires both signatures before showing an enabled funding action", () => {
    render(<EscrowStatusCard {...baseProps} escrowFunded={false} />);
    expect((screen.getByRole("button", { name: "Fund escrow" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Both parties must sign before funding escrow.")).toBeTruthy();
  });
});
