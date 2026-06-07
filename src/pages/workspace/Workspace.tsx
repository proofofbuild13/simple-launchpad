import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, AlertTriangle, CheckCircle2, RotateCw, DollarSign, Wallet, FileText, Receipt, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { WorkflowStepper } from "@/components/workflow/WorkflowStepper";
import { PaymentTimeline, paymentStageIndex } from "@/components/workflow/PaymentTimeline";
import { RecordPaymentModal } from "@/components/payments/RecordPaymentModal";
import { ConfirmReceiptModal } from "@/components/payments/ConfirmReceiptModal";
import { PayCommissionModal } from "@/components/payments/PayCommissionModal";
import { CommissionInvoiceCard } from "@/components/payments/CommissionInvoiceCard";

const STATUS_COLOR: Record<string, string> = {
  in_progress: "bg-blue-500/15 text-blue-600",
  submitted: "bg-amber-500/15 text-amber-600",
  revision_requested: "bg-amber-500/15 text-amber-600",
  approved: "bg-emerald-500/15 text-emerald-600",
  fully_settled: "bg-primary/15 text-primary",
  dispute: "bg-destructive/15 text-destructive",
};

const COLUMNS: [string, string][] = [
  ["in_progress", "In progress"],
  ["submitted", "Submitted"],
  ["revision_requested", "Revisions"],
  ["approved", "Approved"],
  ["fully_settled", "Settled"],
];

export default function Workspace() {
  const { id } = useParams();
  const { user } = useAuth();
  const [contract, setContract] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<Record<string, any[]>>({});
  const [paymentRecords, setPaymentRecords] = useState<Record<string, any>>({});
  const [invoices, setInvoices] = useState<Record<string, any>>({});
  const [commissionPayments, setCommissionPayments] = useState<Record<string, any>>({});
  const [parties, setParties] = useState<{ founder?: string; builder?: string }>({});
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any>(null);
  const [delForm, setDelForm] = useState({ demo_url: "", write_up: "", file_urls: "" });
  const [revReason, setRevReason] = useState("");
  const [disputeReason, setDisputeReason] = useState("");

  // payment modal state
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMilestone, setRecordMilestone] = useState<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRecord, setConfirmRecord] = useState<any>(null);
  const [payCommissionOpen, setPayCommissionOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<any>(null);

  const load = async () => {
    if (!id) return;
    const { data: c } = await supabase.from("contracts").select("*, projects(*)").eq("id", id).maybeSingle();
    setContract(c);
    if (!c) { setLoading(false); return; }

    const { data: ms } = await supabase.from("contract_milestones").select("*").eq("contract_id", id).neq("status", "cancelled").order("order_index");
    setMilestones(ms ?? []);

    if (ms && ms.length) {
      const ids = ms.map((m) => m.id);
      const [{ data: ds }, { data: prs }] = await Promise.all([
        supabase.from("deliverables").select("*").in("milestone_id", ids).order("submitted_at", { ascending: false }),
        supabase.from("payment_records").select("*").in("milestone_id", ids).order("created_at", { ascending: false }),
      ]);
      const grouped: Record<string, any[]> = {};
      (ds ?? []).forEach((d) => { (grouped[d.milestone_id] = grouped[d.milestone_id] || []).push(d); });
      setDeliverables(grouped);
      const prMap: Record<string, any> = {};
      (prs ?? []).forEach((p) => { if (!prMap[p.milestone_id]) prMap[p.milestone_id] = p; });
      setPaymentRecords(prMap);

      const prIds = (prs ?? []).map((p) => p.id);
      if (prIds.length) {
        const { data: invs } = await supabase.from("commission_invoices").select("*").in("payment_record_id", prIds);
        const invMap: Record<string, any> = {};
        (invs ?? []).forEach((i) => { invMap[i.payment_record_id] = i; });
        setInvoices(invMap);
        const invIds = (invs ?? []).map((i) => i.id);
        if (invIds.length) {
          const { data: cps } = await supabase.from("commission_payments").select("*").in("invoice_id", invIds).order("submitted_at", { ascending: false });
          const cpMap: Record<string, any> = {};
          (cps ?? []).forEach((p) => { if (!cpMap[p.invoice_id]) cpMap[p.invoice_id] = p; });
          setCommissionPayments(cpMap);
        }
      }
    }

    // names
    const { data: founders } = await supabase.from("startup_profiles").select("company_name").eq("id", c.founder_id).maybeSingle();
    const { data: builders } = await supabase.from("builder_profiles").select("full_name").eq("id", c.builder_id).maybeSingle();
    setParties({ founder: founders?.company_name, builder: builders?.full_name });

    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const isFounder = user?.id === contract?.founder_id;
  const isBuilder = user?.id === contract?.builder_id;

  const notifyOther = async (type: string, title: string, body: string) => {
    if (!contract || !user) return;
    const otherId = user.id === contract.founder_id ? contract.builder_id : contract.founder_id;
    await supabase.rpc("send_notification", {
      _user_id: otherId, _type: type, _title: title, _body: body, _link: `/workspace/${contract.id}`,
    });
  };

  const submitDeliverable = async (m: any) => {
    if (!user) return;
    const revisions = (deliverables[m.id] ?? []).length + 1;
    if (revisions > 3) {
      toast.error("Max revisions reached — opening dispute");
      await supabase.from("disputes").insert({ contract_id: contract.id, milestone_id: m.id, raised_by: user.id, reason: "Max revisions exceeded" });
      await supabase.from("contract_milestones").update({ status: "dispute" }).eq("id", m.id);
      await notifyOther("milestone_dispute", "Milestone in dispute", `Max revisions exceeded on "${m.title}".`);
      load(); return;
    }
    await supabase.from("deliverables").insert({
      milestone_id: m.id,
      submitted_by: user.id,
      file_urls: delForm.file_urls ? delForm.file_urls.split(",").map((s) => s.trim()) : [],
      demo_url: delForm.demo_url || null,
      write_up: delForm.write_up || null,
      revision_number: revisions,
    });
    await supabase.from("contract_milestones").update({ status: "submitted" }).eq("id", m.id);
    await notifyOther("deliverable_submitted", "New deliverable submitted", `Builder submitted "${m.title}" (revision ${revisions}).`);
    setDelForm({ demo_url: "", write_up: "", file_urls: "" });
    setActive(null);
    toast.success("Deliverable submitted");
    load();
  };

  const approve = async (m: any) => {
    const { error: mErr } = await supabase.from("contract_milestones").update({ status: "approved" }).eq("id", m.id);
    if (mErr) { toast.error(mErr.message); return; }

    if (contract?.escrow_funded) {
      const { error } = await supabase.rpc("release_escrow_for_milestone", { _milestone_id: m.id });
      if (error) {
        toast.error("Approval saved but escrow release failed: " + error.message);
      } else {
        toast.success("Milestone approved — escrow released to builder");
      }
    } else {
      await notifyOther("milestone_approved", "Milestone approved", `"${m.title}" was approved. Awaiting payment.`);
      toast.success("Milestone approved — record the payment");
      setRecordMilestone(m);
      setRecordOpen(true);
    }
    setActive(null);
    load();
  };

  const requestRevision = async (m: any) => {
    if (!revReason) return toast.error("Add a reason");
    await supabase.from("contract_milestones").update({ status: "revision_requested" }).eq("id", m.id);
    await notifyOther("revision_requested", "Revision requested", `On "${m.title}": ${revReason}`);
    setRevReason(""); setActive(null);
    toast.success("Revision requested");
    load();
  };

  const openDispute = async (m: any) => {
    if (!user || !disputeReason) return;
    await supabase.from("disputes").insert({ contract_id: contract.id, milestone_id: m.id, raised_by: user.id, reason: disputeReason });
    await supabase.from("contract_milestones").update({ status: "dispute" }).eq("id", m.id);
    await notifyOther("milestone_dispute", "Dispute opened", `On "${m.title}": ${disputeReason}`);
    setDisputeReason(""); setActive(null);
    toast.success("Dispute opened");
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!contract) return <p className="py-20 text-center text-muted-foreground">Not found.</p>;

  const settledMilestones = milestones.filter((m) => paymentRecords[m.id]);
  const totalPaid = settledMilestones
    .filter((m) => paymentRecords[m.id]?.status === "settled")
    .reduce((a, b) => a + Number(b.amount || 0), 0);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">Workspace</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold truncate">{contract.projects?.title}</h1>
          <div className="flex items-center gap-2 text-sm shrink-0">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">${totalPaid}</span>
            <span className="text-muted-foreground">/ ${contract.escrow_amount}</span>
          </div>
        </div>
      </div>

      <Card><CardContent className="pt-6"><WorkflowStepper current={
        contract.status === "contract_completed" ? 5
        : (contract.status === "contract_active" || contract.status === "active") ? 4
        : 3
      } /></CardContent></Card>

      {/* Kanban board — horizontally scrollable on mobile */}
      <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-2">
        <div className="flex gap-2 sm:grid sm:grid-cols-5 sm:gap-3" style={{ minWidth: "max-content" }}>
          {COLUMNS.map(([key, label]) => (
            <div key={key} className="space-y-2 w-[160px] sm:w-auto flex-shrink-0">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">{label}</h3>
                <Badge variant="outline" className="text-[10px]">{milestones.filter((m) => m.status === key).length}</Badge>
              </div>
              <div className="space-y-2 min-h-[120px] bg-muted/20 rounded-md p-2">
                {milestones.filter((m) => m.status === key).map((m) => (
                  <button key={m.id} onClick={() => setActive(m)} className="w-full text-left">
                    <Card className="hover:border-primary transition-colors">
                      <CardContent className="p-3 space-y-1">
                        <div className="text-sm font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground">${m.amount}</div>
                        <Badge className={`${STATUS_COLOR[m.status]} text-[10px]`} variant="outline">{m.status?.replace(/_/g, " ")}</Badge>
                        {m.status === "approved" && paymentRecords[m.id] && (
                          <div className="text-[10px] text-muted-foreground pt-1">
                            {paymentRecords[m.id].status === "declared" && "Awaiting builder confirmation"}
                            {paymentRecords[m.id].status === "confirmed" && "Awaiting admin verification"}
                            {paymentRecords[m.id].status === "disputed" && "Payment disputed"}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {active && (
        <Card className="border-primary/40">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{active.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{active.description}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActive(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(deliverables[active.id] ?? []).length > 0 && (
              <div className="space-y-2">
                <Label>Deliverables</Label>
                {deliverables[active.id].map((d) => (
                  <div key={d.id} className="border rounded-md p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <Badge variant="outline">Revision {d.revision_number}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(d.submitted_at).toLocaleString()}</span>
                    </div>
                    {d.demo_url && <a href={d.demo_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">{d.demo_url}</a>}
                    {d.write_up && <p className="text-foreground/80 whitespace-pre-wrap">{d.write_up}</p>}
                  </div>
                ))}
              </div>
            )}

            {isBuilder && (active.status === "in_progress" || active.status === "revision_requested") && (
              <div className="space-y-2 p-3 border-2 border-dashed rounded-md">
                <Label>Submit deliverable</Label>
                <Input placeholder="Demo URL" value={delForm.demo_url} onChange={(e) => setDelForm({ ...delForm, demo_url: e.target.value })} />
                <Input placeholder="File URLs (comma separated)" value={delForm.file_urls} onChange={(e) => setDelForm({ ...delForm, file_urls: e.target.value })} />
                <Textarea rows={3} placeholder="Write-up" value={delForm.write_up} onChange={(e) => setDelForm({ ...delForm, write_up: e.target.value })} />
                <Button size="sm" onClick={() => submitDeliverable(active)}><Upload className="h-4 w-4 mr-1" />Submit</Button>
              </div>
            )}

            {isFounder && active.status === "submitted" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => approve(active)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {contract?.escrow_funded ? "Approve & release escrow" : "Approve milestone"}
                  </Button>
                  <div className="flex gap-2 items-center">
                    <Input placeholder="Revision reason" value={revReason} onChange={(e) => setRevReason(e.target.value)} className="w-60" />
                    <Button size="sm" variant="outline" onClick={() => requestRevision(active)}><RotateCw className="h-4 w-4 mr-1" />Request revision</Button>
                  </div>
                </div>
                {contract?.escrow_funded && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    Approving will automatically release ₹{active.amount} from escrow.
                  </p>
                )}
              </div>
            )}

            {isFounder && active.status === "approved" && !paymentRecords[active.id] && (
              <Button size="sm" onClick={() => { setRecordMilestone(active); setRecordOpen(true); }}>
                <Wallet className="h-4 w-4 mr-1" />Record payment
              </Button>
            )}

            {(isFounder || isBuilder) && active.status !== "fully_settled" && active.status !== "dispute" && (
              <div className="flex gap-2 items-center pt-3 border-t">
                <Input placeholder="Dispute reason" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => openDispute(active)}><AlertTriangle className="h-4 w-4 mr-1" />Open dispute</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PAYMENTS SECTION */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Payments</h2>
        </div>

        {milestones.filter((m) => ["approved", "awaiting_release", "escrow_released", "fully_settled"].includes(m.status) || paymentRecords[m.id]).length === 0 && (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            Approved milestones will appear here for payment tracking.
          </CardContent></Card>
        )}

        {milestones.filter((m) => ["approved", "awaiting_release", "escrow_released", "fully_settled"].includes(m.status) || paymentRecords[m.id]).map((m) => {
          const pr = paymentRecords[m.id];
          const inv = pr ? invoices[pr.id] : null;
          const cp = inv ? commissionPayments[inv.id] : null;
          const stage = paymentStageIndex({ paymentRecord: pr, invoice: inv, commissionPayment: cp });

          return (
            <Card key={m.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">${m.amount}</p>
                  </div>
                  {m.status === "escrow_released" && (
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30" variant="outline">
                      <ShieldCheck className="h-3 w-3 mr-1" />Escrow released
                    </Badge>
                  )}
                  {m.status === "awaiting_release" && (
                    <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30" variant="outline">Releasing…</Badge>
                  )}
                  {pr?.status === "settled" && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30" variant="outline">Fully settled</Badge>}
                  {pr?.status === "disputed" && <Badge variant="destructive">Disputed</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {contract?.escrow_funded && ["escrow_released", "fully_settled"].includes(m.status) && (
                  <div className="rounded-md border bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" />Released from escrow
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div><span className="text-muted-foreground">Gross</span><div className="font-mono">₹{Number(m.amount).toLocaleString()}</div></div>
                      <div><span className="text-muted-foreground">Commission (15%)</span><div className="font-mono">-₹{(Number(m.amount) * 0.15).toFixed(2)}</div></div>
                      <div><span className="text-muted-foreground">Builder receives</span><div className="font-mono">₹{(Number(m.amount) * 0.85).toFixed(2)}</div></div>
                    </div>
                  </div>
                )}
                <PaymentTimeline current={stage} />

                {/* Step 1: founder records */}
                {isFounder && !pr && m.status === "approved" && (
                  <Button size="sm" onClick={() => { setRecordMilestone(m); setRecordOpen(true); }}>
                    <Wallet className="h-4 w-4 mr-1" />Record builder payment
                  </Button>
                )}

                {/* Payment record card */}
                {pr && (
                  <div className="rounded-md border p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /><span className="font-medium">Direct payment</span></div>
                      <Badge variant="outline" className="capitalize">{pr.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                      <div>Declared: <span className="text-foreground font-mono">${pr.declared_amount}</span></div>
                      <div>Method: <span className="text-foreground uppercase">{pr.payment_method}</span></div>
                      <div>Ref: <span className="text-foreground font-mono">{pr.transaction_ref}</span></div>
                      {pr.confirmed_amount != null && <div>Confirmed: <span className="text-foreground font-mono">${pr.confirmed_amount}</span></div>}
                    </div>
                    {isBuilder && pr.status === "declared" && (
                      <Button size="sm" className="mt-2" onClick={() => { setConfirmRecord(pr); setConfirmOpen(true); }}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />Confirm receipt
                      </Button>
                    )}
                  </div>
                )}

                {/* Invoice */}
                {inv && (
                  <CommissionInvoiceCard
                    invoice={inv}
                    founderName={parties.founder}
                    builderName={parties.builder}
                    projectTitle={contract.projects?.title}
                    milestoneTitle={m.title}
                  />
                )}

                {/* Step 5: founder pays commission */}
                {isFounder && inv && inv.status !== "paid" && !cp && (
                  <Button size="sm" onClick={() => { setPayInvoice(inv); setPayCommissionOpen(true); }}>
                    <FileText className="h-4 w-4 mr-1" />Pay platform fee
                  </Button>
                )}

                {/* Commission payment */}
                {cp && (
                  <div className="rounded-md border p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Platform fee payment</span>
                      <Badge variant="outline" className="capitalize">{cp.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="text-muted-foreground">Ref <span className="text-foreground font-mono">{cp.transaction_ref}</span> · ${cp.amount}</div>
                    {cp.status === "submitted" && <p className="text-muted-foreground">Awaiting admin verification.</p>}
                    {cp.status === "rejected" && cp.admin_notes && <p className="text-destructive">{cp.admin_notes}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <RecordPaymentModal
        open={recordOpen}
        onOpenChange={setRecordOpen}
        milestone={recordMilestone}
        contract={contract}
        onDone={load}
      />
      <ConfirmReceiptModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        paymentRecord={confirmRecord}
        onDone={load}
      />
      <PayCommissionModal
        open={payCommissionOpen}
        onOpenChange={setPayCommissionOpen}
        invoice={payInvoice}
        contractId={contract.id}
        onDone={load}
      />
    </div>
  );
}
