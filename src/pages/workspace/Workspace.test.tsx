import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const readyMock = vi.fn();
const updateMock = vi.fn();
const errorMock = vi.fn();
const successMock = vi.fn();
const db: Record<string, any[]> = {};

function query(table: string) {
  let rows = [...(db[table] ?? [])];
  const api: any = {
    select: () => api,
    eq: (key: string, value: any) => { rows = rows.filter((row) => row[key] === value); return api; },
    neq: (key: string, value: any) => { rows = rows.filter((row) => row[key] !== value); return api; },
    in: (key: string, values: any[]) => { rows = rows.filter((row) => values.includes(row[key])); return api; },
    order: () => api,
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    update: (values: any) => { updateMock(table, values); return api; },
    then: (resolve: any) => resolve({ data: rows, error: null }),
  };
  return api;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => query(table), rpc: (...args: any[]) => rpcMock(...args) } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "founder-1" } }) }));
vi.mock("react-router-dom", () => ({ useParams: () => ({ id: "contract-1" }) }));
vi.mock("@/lib/builderPaymentCheck", () => ({ ensureBuilderPaymentReady: (...args: any[]) => readyMock(...args) }));
vi.mock("sonner", () => ({ toast: { error: (...args: any[]) => errorMock(...args), success: (...args: any[]) => successMock(...args) } }));
vi.mock("@/components/payments/RecordPaymentModal", () => ({ RecordPaymentModal: () => null }));
vi.mock("@/components/payments/ConfirmReceiptModal", () => ({ ConfirmReceiptModal: () => null }));
vi.mock("@/components/payments/PayCommissionModal", () => ({ PayCommissionModal: () => null }));
vi.mock("@/components/payments/CommissionInvoiceCard", () => ({ CommissionInvoiceCard: () => null }));
vi.mock("@/components/workflow/WorkflowStepper", () => ({ WorkflowStepper: () => null }));
vi.mock("@/components/workflow/PaymentTimeline", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/workflow/PaymentTimeline")>();
  return { ...original, PaymentTimeline: ({ current }: { current: number }) => <span>Payment stage {current}</span> };
});

import Workspace from "./Workspace";

async function selectMilestone() {
  fireEvent.click(await screen.findByRole("button", { name: /Ship dashboard/ }));
}

describe("Workspace escrow approval", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    db.contracts = [{ id: "contract-1", founder_id: "founder-1", builder_id: "builder-1", status: "contract_active", escrow_funded: true, escrow_amount: 1000.5, currency: "INR", projects: { title: "Startup dashboard" } }];
    db.contract_milestones = [{ id: "milestone-1", contract_id: "contract-1", title: "Ship dashboard", amount: 1000.5, status: "submitted" }];
    db.deliverables = [];
    db.payment_records = [];
    db.commission_invoices = [];
    db.commission_payments = [];
    db.startup_profiles = [];
    db.builder_profiles = [];
    readyMock.mockResolvedValue(true);
    rpcMock.mockResolvedValue({ data: "ledger-1", error: null });
  });

  it("approves a submitted milestone with one atomic release RPC and no direct status update", async () => {
    render(<Workspace />);
    await selectMilestone();
    fireEvent.click(screen.getByRole("button", { name: "Approve & release escrow" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("release_escrow_for_milestone", { _milestone_id: "milestone-1" }));
    expect(updateMock).not.toHaveBeenCalled();
    await waitFor(() => expect(successMock).toHaveBeenCalledWith("Milestone approved — escrow release recorded"));
  });

  it("retains the submitted milestone and permits retry when the release fails", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "Insufficient escrow balance" } });
    render(<Workspace />);
    await selectMilestone();
    fireEvent.click(screen.getByRole("button", { name: "Approve & release escrow" }));
    await waitFor(() => expect(errorMock).toHaveBeenCalledWith("Escrow release failed: Insufficient escrow balance"));
    expect(screen.getByRole("button", { name: "Approve & release escrow" })).toBeTruthy();
    expect(db.contract_milestones[0].status).toBe("submitted");
    expect(updateMock).not.toHaveBeenCalled();
    expect(successMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Approve & release escrow" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
  });

  it("blocks repeated approval while payment details are being checked", async () => {
    let finishCheck!: (value: boolean) => void;
    readyMock.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finishCheck = resolve; }));
    render(<Workspace />);
    await selectMilestone();
    const button = screen.getByRole("button", { name: "Approve & release escrow" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(readyMock).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
    await act(async () => { finishCheck(true); });
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
  });

  it("offers release for an approved milestone left by an earlier failed attempt", async () => {
    db.contract_milestones[0].status = "approved";
    render(<Workspace />);
    fireEvent.click(await screen.findByRole("button", { name: "Release escrow" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("release_escrow_for_milestone", { _milestone_id: "milestone-1" }));
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("keeps the admin verification stage and uses the invoice's fee without deducting the builder payment", async () => {
    db.contract_milestones[0].status = "escrow_released";
    db.payment_records = [{ id: "payment-1", milestone_id: "milestone-1", contract_id: "contract-1", payment_method: "escrow", status: "confirmed", declared_amount: 1000.5, confirmed_amount: 1000.5 }];
    db.commission_invoices = [{ id: "invoice-1", payment_record_id: "payment-1", status: "generated", commission_rate: 0.1, commission_amount: 100.05 }];
    db.commission_payments = [{ id: "fee-1", invoice_id: "invoice-1", status: "submitted", amount: 100.05 }];
    render(<Workspace />);
    expect(await screen.findByText("Payment stage 5")).toBeTruthy();
    expect(screen.getByText("Platform fee (10%)")).toBeTruthy();
    expect(screen.getAllByText("₹1,000.50").length).toBeGreaterThan(0);
    expect(screen.queryByText("₹850.43")).toBeNull();
  });

  it("allows a rejected fee payment to be resubmitted", async () => {
    db.contract_milestones[0].status = "escrow_released";
    db.payment_records = [{ id: "payment-1", milestone_id: "milestone-1", status: "confirmed", payment_method: "escrow" }];
    db.commission_invoices = [{ id: "invoice-1", payment_record_id: "payment-1", status: "generated", commission_rate: 0.15, commission_amount: 150 }];
    db.commission_payments = [{ id: "fee-1", invoice_id: "invoice-1", status: "rejected", amount: 150 }];
    render(<Workspace />);
    expect(await screen.findByRole("button", { name: "Pay platform fee" })).toBeTruthy();
  });

  it("gates actions on draft contracts without hiding the workspace", async () => {
    db.contracts[0].status = "contract_drafted";
    db.contracts[0].escrow_funded = false;
    render(<Workspace />);
    await selectMilestone();
    expect(screen.queryByRole("button", { name: "Approve milestone" })).toBeNull();
    expect(screen.getByText(/Work and payments become available/)).toBeTruthy();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
