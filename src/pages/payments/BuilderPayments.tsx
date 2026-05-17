import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet, Clock, CheckCircle2 } from "lucide-react";

export default function BuilderPayments() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("payment_records").select("*").eq("builder_id", user.id).order("declared_at", { ascending: false });
      setRecords(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const totalReceived = records.filter((r) => r.status !== "declared" && r.status !== "disputed").reduce((a, b) => a + Number(b.confirmed_amount ?? b.declared_amount), 0);
  const pending = records.filter((r) => r.status === "declared");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Earnings</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat icon={<Wallet className="h-4 w-4" />} label="Total received" value={`₹${totalReceived.toLocaleString()}`} />
        <Stat icon={<Clock className="h-4 w-4" />} label="Pending confirmations" value={String(pending.length)} />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Settled" value={String(records.filter((r) => r.status === "settled").length)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <div key={r.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                  <div>
                    <div className="font-medium">₹{r.declared_amount} · <span className="uppercase text-xs">{r.payment_method}</span></div>
                    <div className="text-xs text-muted-foreground font-mono">{r.transaction_ref} · {new Date(r.declared_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{r.status}</Badge>
                    <Button asChild size="sm" variant={r.status === "declared" ? "default" : "ghost"}>
                      <Link to={`/workspace/${r.contract_id}`}>{r.status === "declared" ? "Confirm" : "Open"}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: any) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
