import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck, X, DollarSign, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function AdminCommissions() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data: cps } = await supabase.from("commission_payments").select("*").order("submitted_at", { ascending: false });
    setPayments(cps ?? []);
    if (cps?.length) {
      const { data: invs } = await supabase.from("commission_invoices").select("*").in("id", cps.map((c) => c.invoice_id));
      const map: Record<string, any> = {};
      (invs ?? []).forEach((i) => { map[i.id] = i; });
      setInvoices(map);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const decide = async (id: string, approve: boolean) => {
    const { error } = await supabase.rpc("verify_commission_payment", { _payment_id: id, _approve: approve, _notes: notes[id] ?? null });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Verified" : "Rejected");
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const queue = payments.filter((p) => p.status === "submitted");
  const totalRevenue = payments.filter((p) => p.status === "admin_verified").reduce((a, b) => a + Number(b.amount), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Commission verification</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><DollarSign className="h-4 w-4" />Platform revenue</div>
          <div className="text-2xl font-semibold mt-1">₹{totalRevenue.toLocaleString()}</div>
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
            const inv = invoices[p.invoice_id];
            return (
              <div key={p.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{inv?.invoice_number} · ₹{p.amount}</div>
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
    </div>
  );
}
