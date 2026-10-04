import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const uploadMock = vi.fn();
const errorMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: any[]) => rpcMock(...args), storage: { from: () => ({ upload: (...args: any[]) => uploadMock(...args) }) } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "builder-1" } }) }));
vi.mock("sonner", () => ({ toast: { error: (...args: any[]) => errorMock(...args), success: vi.fn() } }));

import { ConfirmReceiptModal } from "./ConfirmReceiptModal";

const firstRecord = { id: "payment-1", declared_amount: 1000.5, payment_method: "upi", currency: "INR" };
const baseProps = { onOpenChange: vi.fn(), onDone: vi.fn() };

describe("ConfirmReceiptModal", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ data: "invoice-1", error: null });
    uploadMock.mockResolvedValue({ data: null, error: null });
  });

  it("initializes the amount when a record arrives after the modal mounted", async () => {
    const view = render(<ConfirmReceiptModal {...baseProps} open={false} paymentRecord={null} />);
    view.rerender(<ConfirmReceiptModal {...baseProps} open paymentRecord={firstRecord} />);
    expect((await screen.findByLabelText(/Amount you received/) as HTMLInputElement).value).toBe("1000.5");
    fireEvent.click(screen.getByRole("button", { name: "Confirm receipt" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("confirm_payment_record", { _id: "payment-1", _confirmed_amount: 1000.5, _screenshot: null }));
  });

  it("resets edited amount and proof when confirming another payment", async () => {
    const view = render(<ConfirmReceiptModal {...baseProps} open paymentRecord={firstRecord} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "20" } });
    const file = new File(["proof"], "receipt.png", { type: "image/png" });
    fireEvent.change(view.container.querySelector('input[type="file"]') ?? document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    view.rerender(<ConfirmReceiptModal {...baseProps} open={false} paymentRecord={firstRecord} />);
    view.rerender(<ConfirmReceiptModal {...baseProps} open paymentRecord={{ ...firstRecord, id: "payment-2", declared_amount: 75.25 }} />);
    await waitFor(() => expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("75.25"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm receipt" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("confirm_payment_record", { _id: "payment-2", _confirmed_amount: 75.25, _screenshot: null }));
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it.each(["", "0", "-5"])("rejects an invalid received amount (%s) before confirmation", async (value) => {
    render(<ConfirmReceiptModal {...baseProps} open paymentRecord={firstRecord} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm receipt" }));
    await waitFor(() => expect(errorMock).toHaveBeenCalledWith("Enter a valid amount greater than zero"));
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
