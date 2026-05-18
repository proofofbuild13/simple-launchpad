import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export default function AdminDisputeDetail() {
  const { id } = useParams();
  const [d, setD] = useState<any>(null);
  const [milestone, setMilestone] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data: dispute } = await supabase.from("disputes").select("*").eq("id", id).maybeSingle();
    setD(dispute);
    if (dispute) {
      const [{ data: m }, { data: c }, { data: pr }, { data: dl }] = await Promise.all([
        dispute.milestone_id ? supabase.from("contract_milestones").select("*").eq("id", dispute.milestone_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("contracts").select("*").eq("id", dispute.contract_id).maybeSingle(),
        supabase.from("payment_records").select("*").eq("contract_id", dispute.contract_id),
        dispute.milestone_id ? supabase.from("deliverables").select("*").eq("milestone_id", dispute.milestone_id) : Promise.resolve({ data: [] }),
      ]);
      setMilestone(m); setContract(c); setPayments(pr ?? []); setDeliverables(dl ?? []);
    }
  };
  useEffect(() => { load(); }, [id]);

  const setStatus = async (status: string, resolution?: string) => {
    if (!d) return;
    setBusy(true);
    const { error } = await supabase.from("disputes").update({
      status, resolution: resolution ?? note ?? null,
      resolved_at: ["resolved","closed","resolved_founder","resolved_builder"].includes(status) ? new Date().toISOString() : null,
    }).eq("id", d.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await logAudit(`dispute_${status}`, "disputes", d.id, { resolution: resolution ?? note });
    toast.success("Updated");
    load();
  };

  if (!d) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Button asChild variant="ghost" size="sm"><Link to="/admin/disputes"><ArrowLeft className="h-4 w-4 mr-1" /> Disputes</Link></Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" /> Dispute {d.id.slice(0,8)}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Contract <span className="font-mono">{d.contract_id.slice(0,8)}</span> · raised {new Date(d.created_at).toLocaleString()}</p>
            </div>
            <Badge variant={d.status === "open" ? "destructive" : "outline"}>{d.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Reason</p>
            <p>{d.reason}</p>
          </div>
          {d.resolution && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Resolution</p>
              <p>{d.resolution}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {milestone && (
        <Card>
          <CardHeader><CardTitle className="text-base">Milestone</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span>{milestone.title}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>${Number(milestone.amount).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline">{milestone.status}</Badge></div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Payments ({payments.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payments.length === 0 && <p className="text-xs text-muted-foreground">No payments recorded.</p>}
            {payments.map((p) => (
              <div key={p.id} className="text-sm p-2 rounded-md bg-muted/40 space-y-1">
                <div className="flex justify-between"><span>Declared</span><span>${Number(p.declared_amount).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Confirmed</span><span>{p.confirmed_amount ? `$${Number(p.confirmed_amount).toLocaleString()}` : "—"}</span></div>
                <div className="flex justify-between"><span>Method</span><span className="uppercase text-xs">{p.payment_method}</span></div>
                <div className="flex justify-between"><span>UTR</span><span className="font-mono text-xs">{p.transaction_ref}</span></div>
                <div className="flex justify-between items-center"><span>Status</span><Badge variant={p.status === "disputed" ? "destructive" : "outline"}>{p.status}</Badge></div>
                {p.screenshot_url && <a href={p.screenshot_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View proof</a>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Deliverables ({deliverables.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {deliverables.length === 0 && <p className="text-xs text-muted-foreground">No deliverables.</p>}
            {deliverables.map((dl) => (
              <div key={dl.id} className="text-sm p-2 rounded-md bg-muted/40">
                <div className="text-xs text-muted-foreground">Rev {dl.revision_number} · {new Date(dl.submitted_at).toLocaleDateString()}</div>
                {dl.write_up && <p className="mt-1">{dl.write_up}</p>}
                {dl.demo_url && <a href={dl.demo_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Demo</a>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Admin actions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="Resolution / admin note…" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus("under_review")}>Mark under review</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus("mediation")}>Open mediation</Button>
            <Button size="sm" disabled={busy} onClick={() => setStatus("resolved_builder", note || "Released to builder")}>Release to builder</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setStatus("resolved_founder", note || "Refund founder")}>Refund founder</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus("closed")}>Close</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
