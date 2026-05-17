import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet, FileText, AlertCircle } from "lucide-react";

export default function StartupPayments() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prs } = await supabase
        .from("payment_records").select("*").eq("startup_id", user.id).order("declared_at", { ascending: false });
      setRecords(prs ?? []);
      if (prs?.length) {
        const { data: invs } = await supabase
          .from("commission_invoices").select("*").in("payment_record_id", prs.map((p) => p.id));
        setInvoices(invs ?? []);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const totalPaid = records.filter((r) => r.status === "settled" || r.status === "confirmed").reduce((a, b) => a + Number(b.declared_amount), 0);
  const pendingInvoices = invoices.filter((i) => i.status !== "paid");
  const overdue = pendingInvoices.filter((i) => new Date(i.due_date) < new Date());

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat icon={<Wallet className="h-4 w-4" />} label="Total paid to builders" value={`₹${totalPaid.toLocaleString()}`} />
        <Stat icon={<FileText className="h-4 w-4" />} label="Invoices due" value={String(pendingInvoices.length)} />
        <Stat icon={<AlertCircle className="h-4 w-4 text-destructive" />} label="Overdue" value={String(overdue.length)} accent={overdue.length > 0} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment history</CardTitle></CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="space-y-2">
              {records.map((r) => {
                const inv = invoices.find((i) => i.payment_record_id === r.id);
                return (
                  <div key={r.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                    <div>
                      <div className="font-medium">₹{r.declared_amount} · <span className="uppercase text-xs">{r.payment_method}</span></div>
                      <div className="text-xs text-muted-foreground font-mono">{r.transaction_ref} · {new Date(r.declared_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {inv && <Badge variant="outline" className="font-mono text-[10px]">{inv.invoice_number}</Badge>}
                      <Badge variant="outline" className="capitalize">{r.status}</Badge>
                      <Button asChild size="sm" variant="ghost"><Link to={`/workspace/${r.contract_id}`}>Open</Link></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, accent }: any) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${accent ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
