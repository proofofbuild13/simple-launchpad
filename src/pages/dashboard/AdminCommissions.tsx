import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, X, DollarSign, AlertCircle, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csvExport";

export default function AdminCommissions() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoiceMap, setInvoiceMap] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [range, setRange] = useState("30");

  const load = async () => {
    setLoading(true);
    const [{ data: cps }, { data: invs }] = await Promise.all([
      supabase.from("commission_payments").select("*").order("submitted_at", { ascending: false }),
      supabase.from("commission_invoices").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setPayments(cps ?? []);
    setInvoices(invs ?? []);
    const map: Record<string, any> = {};
    (invs ?? []).forEach((i) => { map[i.id] = i; });
    setInvoiceMap(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const decide = async (id: string, approve: boolean) => {
    const { error } = await supabase.rpc("verify_commission_payment", { _payment_id: id, _approve: approve, _notes: notes[id] ?? null });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Verified" : "Rejected");
    load();
  };

  const adjust = async (invoiceId: string, action: "waive" | "mark_paid" | "reopen") => {
    if (!confirm(`${action.replace("_", " ")} this invoice?`)) return;
    const { error } = await supabase.rpc("admin_adjust_commission_invoice", { _invoice_id: invoiceId, _action: action, _notes: null });
    if (error) return toast.error(error.message);
    toast.success("Invoice updated");
    load();
  };

  const exportRevenue = () => {
    const days = range === "all" ? Infinity : Number(range);
    const cutoff = Date.now() - days * 864e5;
    const paid = invoices.filter((i) => i.status === "paid" && new Date(i.created_at).getTime() >= cutoff);
    downloadCSV(`revenue-${range}d-${new Date().toISOString().slice(0,10)}.csv`, paid.map((i) => ({
      invoice_number: i.invoice_number,
      base_amount: i.base_amount,
      commission_rate: i.commission_rate,
      commission_amount: i.commission_amount,
      status: i.status,
      due_date: i.due_date,
      created_at: i.created_at,
    })));
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const queue = payments.filter((p) => p.status === "submitted");
  const totalRevenue = payments.filter((p) => p.status === "admin_verified").reduce((a, b) => a + Number(b.amount), 0);
  const filteredInvoices = invoices.filter((i) => statusFilter === "all" || i.status === statusFilter);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Platform fee verification</h1>
        <div className="flex gap-2 items-center">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportRevenue}>
            <Download className="h-4 w-4 mr-1" /> Export revenue
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><DollarSign className="h-4 w-4" />Platform revenue</div>
          <div className="text-2xl font-semibold mt-1">${totalRevenue.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><ShieldCheck className="h-4 w-4" />Pending verifications</div>
          <div className="text-2xl font-semibold mt-1">{queue.length}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><AlertCircle className="h-4 w-4" />Rejected</div>
          <div className="text-2xl font-semibold mt-1">{payments.filter((p) => p.status === "rejected").length}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Verification queue</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {queue.length === 0 && <p className="text-sm text-muted-foreground">Nothing pending.</p>}
          {queue.map((p) => {
            const inv = invoiceMap[p.invoice_id];
            return (
              <div key={p.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{inv?.invoice_number} · ${p.amount}</div>
                    <div className="text-xs text-muted-foreground font-mono">Ref {p.transaction_ref} · submitted {new Date(p.submitted_at).toLocaleString()}</div>
                  </div>
                  <Badge variant="outline">submitted</Badge>
                </div>
                <Input placeholder="Verification notes (optional)" value={notes[p.id] ?? ""} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(p.id, true)}><ShieldCheck className="h-4 w-4 mr-1" />Verify</Button>
                  <Button size="sm" variant="outline" onClick={() => decide(p.id, false)}><X className="h-4 w-4 mr-1" />Reject</Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> All commission invoices ({filteredInvoices.length})</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="generated">Generated</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredInvoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices.</p>}
          {filteredInvoices.slice(0, 50).map((i) => (
            <div key={i.id} className="border rounded-md p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <div className="font-medium">{i.invoice_number} · ${Number(i.commission_amount).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Base ${Number(i.base_amount).toLocaleString()} · due {i.due_date}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={i.status === "paid" ? "outline" : i.status === "waived" ? "secondary" : "destructive"}>{i.status}</Badge>
                {i.status !== "paid" && i.status !== "waived" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => adjust(i.id, "mark_paid")}>Mark paid</Button>
                    <Button size="sm" variant="ghost" onClick={() => adjust(i.id, "waive")}>Waive</Button>
                  </>
                )}
                {(i.status === "paid" || i.status === "waived") && (
                  <Button size="sm" variant="ghost" onClick={() => adjust(i.id, "reopen")}>Reopen</Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
