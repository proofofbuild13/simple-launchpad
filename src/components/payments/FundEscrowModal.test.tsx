import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// --- Mocks ---
const rpcMock = vi.fn();
const fromMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    from: (...args: any[]) => fromMock(...args),
    storage: { from: () => ({ upload: vi.fn() }) },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: any[]) => toastErrorMock(...args),
    success: (...args: any[]) => toastSuccessMock(...args),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "founder-1" } }),
}));

import { FundEscrowModal } from "./FundEscrowModal";

function mockNoRecentNotifications() {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    limit: () => Promise.resolve({ data: [], error: null }),
  };
  fromMock.mockReturnValue(chain);
}

const contract = { id: "contract-abc-12345678", builder_id: "builder-1" };
const milestones = [
  { id: "m1", amount: 1000, status: "pending" },
  { id: "m2", amount: 500, status: "pending" },
];

describe("FundEscrowModal (e2e: payment-details gate)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it("blocks funding and notifies builder when payment details are missing", async () => {
    // 1st rpc -> builder_payment_status: no method.
    // 2nd rpc -> send_notification.
    rpcMock
      .mockResolvedValueOnce({
        data: [{ has_method: false, is_verified: false }],
        error: null,
      })
      .mockResolvedValueOnce({ data: "notif-1", error: null });
    mockNoRecentNotifications();

    render(
      <FundEscrowModal
        open
        onOpenChange={() => {}}
        contract={contract}
        milestones={milestones}
        onDone={() => {}}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/407812345678/i), {
      target: { value: "UTR-999" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirm deposit/i }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("builder_payment_status", {
        _builder_id: "builder-1",
      });
    });

    await waitFor(() => {
      const sendCall = rpcMock.mock.calls.find(
        ([name]) => name === "send_notification"
      );
      expect(sendCall).toBeTruthy();
      expect(sendCall![1]).toMatchObject({
        _user_id: "builder-1",
        _type: "payment_method_missing",
        _link: "/settings?tab=payments",
      });
    });

    // fund_escrow must NEVER be called when details are missing.
    expect(
      rpcMock.mock.calls.some(([name]) => name === "fund_escrow")
    ).toBe(false);

    // Founder sees a blocking toast.
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("proceeds to fund_escrow when builder has payment details", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [{ has_method: true, is_verified: true }],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null }); // fund_escrow

    render(
      <FundEscrowModal
        open
        onOpenChange={() => {}}
        contract={contract}
        milestones={milestones}
        onDone={() => {}}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/407812345678/i), {
      target: { value: "UTR-OK" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirm deposit/i }));

    await waitFor(() => {
      const fundCall = rpcMock.mock.calls.find(([name]) => name === "fund_escrow");
      expect(fundCall).toBeTruthy();
      expect(fundCall![1]).toMatchObject({
        _contract_id: contract.id,
        _amount: 1500,
        _transaction_ref: "UTR-OK",
      });
    });

    // No "missing details" notification should be sent.
    expect(
      rpcMock.mock.calls.some(([name]) => name === "send_notification")
    ).toBe(false);

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
  });
});
