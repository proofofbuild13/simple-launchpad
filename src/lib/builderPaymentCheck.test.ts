import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
const rpcMock = vi.fn();
const fromMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    from: (...args: any[]) => fromMock(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: any[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}));

import { ensureBuilderPaymentReady } from "./builderPaymentCheck";

const contract = { id: "c1", builder_id: "b1" };

function mockNotificationsQuery(recent: any[]) {
  // chain: from('notifications').select().eq().eq().gte().limit()
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    limit: () => Promise.resolve({ data: recent, error: null }),
  };
  fromMock.mockReturnValue(chain);
}

describe("ensureBuilderPaymentReady", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("returns false and short-circuits when builder_id is missing", async () => {
    const ok = await ensureBuilderPaymentReady({ id: "c1", builder_id: "" });
    expect(ok).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns true and does NOT notify when builder has a payment method", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ has_method: true, is_verified: true }],
      error: null,
    });

    const ok = await ensureBuilderPaymentReady(contract);

    expect(ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("builder_payment_status", {
      _builder_id: "b1",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("returns false and sends notification when builder has no payment method", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [{ has_method: false, is_verified: false }],
        error: null,
      })
      .mockResolvedValueOnce({ data: "notif-1", error: null });
    mockNotificationsQuery([]); // no recent reminder

    const ok = await ensureBuilderPaymentReady(contract);

    expect(ok).toBe(false);
    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls[1][0]).toBe("send_notification");
    expect(rpcMock.mock.calls[1][1]).toMatchObject({
      _user_id: "b1",
      _type: "payment_method_missing",
      _link: "/settings?tab=payments",
    });
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT re-send notification if one was sent in the last 24h", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ has_method: false, is_verified: false }],
      error: null,
    });
    mockNotificationsQuery([{ id: "existing" }]); // recent reminder exists

    const ok = await ensureBuilderPaymentReady(contract);

    expect(ok).toBe(false);
    // Only the status RPC; send_notification must NOT be called.
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it("returns false and toasts when the status RPC errors", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });

    const ok = await ensureBuilderPaymentReady(contract);

    expect(ok).toBe(false);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("handles non-array RPC response shape", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { has_method: true, is_verified: false },
      error: null,
    });

    const ok = await ensureBuilderPaymentReady(contract);
    expect(ok).toBe(true);
  });
});
