import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileSignature, Plus, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { WorkflowStatusTracker } from "@/components/workflow/WorkflowStatusTracker";

export default function ContractDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [c, setC] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [parties, setParties] = useState<{ founder?: string; builder?: string }>({});
  const [loading, setLoading] = useState(true);
  const [newM, setNewM] = useState({ title: "", description: "", amount: "", due_date: "" });

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("contracts").select("*, projects(*)").eq("id", id).maybeSingle();
    setC(data);
    const { data: m } = await supabase.from("contract_milestones").select("*").eq("contract_id", id).order("order_index", { ascending: true });
    setMilestones(m ?? []);
    const { data: s } = await supabase.from("contract_signatures").select("*").eq("contract_id", id);
    setSignatures(s ?? []);

    if (data) {
      const { data: founders } = await supabase.from("startup_profiles").select("company_name").eq("id", data.founder_id).maybeSingle();
      const { data: builders } = await supabase.from("builder_profiles").select("full_name").eq("id", data.builder_id).maybeSingle();
      setParties({ founder: founders?.company_name, builder: builders?.full_name });
    }

    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const isFounder = user?.id === c?.founder_id;
  const isBuilder = user?.id === c?.builder_id;
  const founderSigned = signatures.some((s) => s.role === "founder");
  const builderSigned = signatures.some((s) => s.role === "builder");
  const addMilestone = async () => {
    if (!newM.title) return;
    await supabase.from("contract_milestones").insert({
      contract_id: id,
      title: newM.title,
      description: newM.description || null,
      amount: Number(newM.amount) || 0,
      due_date: newM.due_date || null,
      order_index: milestones.length,
    });
    setNewM({ title: "", description: "", amount: "", due_date: "" });
    load();
  };

  const removeMilestone = async (mid: string) => {
    await supabase.from("contract_milestones").update({ status: "cancelled" }).eq("id", mid);
    load();
  };

  const updateClause = async (field: "ip_assignment" | "nda_included" | "non_compete", val: boolean) => {
    await supabase.from("contracts").update({ [field]: val } as any).eq("id", id);
    load();
  };

  const sendForSigning = async () => {
    await supabase.from("contracts").update({ status: "sent_for_signing" }).eq("id", id);
    await supabase.rpc("send_notification", {
      _user_id: c.builder_id, _type: "contract_sent",
      _title: "Contract ready for signing",
      _body: "The founder has sent the contract for your signature.",
      _link: `/contracts/${id}`,
    });
    toast.success("Sent for signing");
    load();
  };

  const sign = async () => {
    if (!user) return;
    const role = isFounder ? "founder" : "builder";
    await supabase.from("contract_signatures").insert({
      contract_id: id, signed_by: user.id, role,
    });
    const fullySigned = role === "founder" ? builderSigned : founderSigned;
    // Re-fetch contract to read the freshest escrow_funded value
    const { data: fresh } = await supabase.from("contracts")
      .select("escrow_funded").eq("id", id).maybeSingle();
    const funded = !!fresh?.escrow_funded;
    if (fullySigned) {
      await supabase.from("contracts")
        .update({ status: funded ? "contract_active" : "partially_signed" })
        .eq("id", id);
    } else {
      await supabase.from("contracts").update({ status: "partially_signed" }).eq("id", id);
    }
    // Notify the other party
    const otherId = role === "founder" ? c.builder_id : c.founder_id;
    await supabase.rpc("send_notification", {
      _user_id: otherId,
      _type: fullySigned && funded ? "contract_active" : "contract_signed",
      _title: fullySigned && funded ? "Contract is now active" : `${role === "founder" ? "Founder" : "Builder"} signed the contract`,
      _body: fullySigned && funded ? "Open the workspace to start collaborating." : (fullySigned ? "Both parties signed — awaiting escrow funding." : "Awaiting the other party's signature."),
      _link: `/contracts/${id}`,
    });
    toast.success("Signed");
    load();
  };

  const fundEscrow = async () => {
    const fullySigned = founderSigned && builderSigned;
    await supabase.from("contracts")
      .update({ escrow_funded: true, status: fullySigned ? "contract_active" : c.status })
      .eq("id", id);
    if (fullySigned) {
      await Promise.all([
        supabase.rpc("send_notification", { _user_id: c.builder_id, _type: "contract_active", _title: "Contract is now active", _body: "Escrow funded — start your first milestone.", _link: `/workspace/${id}` }),
        supabase.rpc("send_notification", { _user_id: c.founder_id, _type: "contract_active", _title: "Contract is now active", _body: "Builder can now begin work.", _link: `/workspace/${id}` }),
      ]);
    }
    toast.success("Escrow funded");
    load();
  };

  const downloadPdf = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Contract ${c.id.slice(0,8)}</title>
      <style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;color:#111;line-height:1.6}
      h1{font-size:22px;border-bottom:2px solid #111;padding-bottom:8px}
      h2{font-size:15px;margin-top:28px;text-transform:uppercase;letter-spacing:1px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      td,th{border:1px solid #999;padding:6px 8px;font-size:13px;text-align:left}
      .sig{margin-top:60px;display:flex;justify-content:space-between}
      .sig div{width:45%;border-top:1px solid #111;padding-top:6px;font-size:12px}</style></head><body>
      <h1>Service Agreement — ${c.projects?.title ?? ""}</h1>
      <p><strong>Contract ID:</strong> ${c.id}<br/><strong>Status:</strong> ${c.status}</p>
      <h2>Parties</h2>
      <p>Founder ID: ${c.founder_id}<br/>Builder ID: ${c.builder_id}</p>
      <h2>Terms</h2>
      <p>Start date: ${c.start_date ?? "—"}<br/>Escrow amount: $${c.escrow_amount ?? 0}<br/>
      IP Assignment: ${c.ip_assignment ? "Yes" : "No"} · NDA: ${c.nda_included ? "Yes" : "No"} · Non-compete: ${c.non_compete ? "Yes" : "No"}</p>
      <h2>Milestones</h2>
      <table><tr><th>#</th><th>Title</th><th>Amount</th><th>Due</th></tr>
      ${milestones.filter((m:any)=>m.status!=="cancelled").map((m:any,i:number)=>`<tr><td>${i+1}</td><td>${m.title}</td><td>$${m.amount}</td><td>${m.due_date ?? "—"}</td></tr>`).join("")}
      </table>
      <div class="sig">
        <div>Founder signature<br/>${parties.founder ? parties.founder : ""}<br/>${founderSigned ? "✓ Signed" : ""}</div>
        <div>Builder signature<br/>${parties.builder ? parties.builder : ""}<br/>${builderSigned ? "✓ Signed" : ""}</div>
      </div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!c) return <p className="py-20 text-center text-muted-foreground">Not found.</p>;

  const totalMilestones = milestones.filter((m) => m.status !== "cancelled").reduce((a, b) => a + Number(b.amount || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">Contract for {c.projects?.title}</p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Contract #{c.id.slice(0, 8)}</h1>
          <Badge>{c.status?.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      <Card><CardContent className="pt-6"><WorkflowStatusTracker contractId={c.id} /></CardContent></Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Contract timeline</CardTitle>
          <Button size="sm" variant="outline" onClick={downloadPdf}>Download PDF</Button>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
            {[
              { key: "drafted",   label: "Drafted",         done: true },
              { key: "sent",      label: "Sent",            done: ["sent_for_signing","partially_signed","contract_active","active","contract_completed"].includes(c.status) },
              { key: "founder",   label: "Founder signed",  done: founderSigned },
              { key: "builder",   label: "Builder signed",  done: builderSigned },
              { key: "escrow",    label: "Escrow funded",   done: !!c.escrow_funded },
              { key: "active",    label: "Active",          done: c.status === "contract_active" || c.status === "active" || c.status === "contract_completed" },
            ].map((step) => (
              <li key={step.key} className={`rounded-md border p-2 text-center ${step.done ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                <div className={`mx-auto mb-1 h-2 w-2 rounded-full ${step.done ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                {step.label}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {(c.status === "contract_active" || c.status === "active") && (
        <Card className="border-emerald-500/40">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="text-sm">Contract is live. Open the workspace to manage milestones and deliverables.</div>
            <Button onClick={() => navigate(`/workspace/${c.id}`)}>Open workspace <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Clauses</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Clause label="IP assignment to founder" value={c.ip_assignment} disabled={!isFounder || c.status !== "contract_drafted"} onChange={(v) => updateClause("ip_assignment", v)} />
              <Clause label="NDA included" value={c.nda_included} disabled={!isFounder || c.status !== "contract_drafted"} onChange={(v) => updateClause("nda_included", v)} />
              <Clause label="Non-compete" value={c.non_compete} disabled={!isFounder || c.status !== "contract_drafted"} onChange={(v) => updateClause("non_compete", v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Milestones · ${totalMilestones}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {milestones.filter((m) => m.status !== "cancelled").map((m, i) => (
                <div key={m.id} className="flex items-start justify-between gap-3 p-3 border rounded-md">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{i + 1}. {m.title}</div>
                    {m.description && <p className="text-xs text-muted-foreground mt-1">{m.description}</p>}
                    <div className="text-xs text-muted-foreground mt-1">
                      {m.due_date ? format(new Date(m.due_date), "PP") : "No date"} · ${m.amount}
                    </div>
                  </div>
                  {isFounder && c.status === "contract_drafted" && (
                    <Button size="icon" variant="ghost" onClick={() => removeMilestone(m.id)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              ))}
              {isFounder && c.status === "contract_drafted" && (
                <div className="space-y-2 p-3 border-2 border-dashed rounded-md">
                  <Input placeholder="Milestone title" value={newM.title} onChange={(e) => setNewM({ ...newM, title: e.target.value })} />
                  <Textarea rows={2} placeholder="Description" value={newM.description} onChange={(e) => setNewM({ ...newM, description: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="Amount" value={newM.amount} onChange={(e) => setNewM({ ...newM, amount: e.target.value })} />
                    <Input type="date" value={newM.due_date} onChange={(e) => setNewM({ ...newM, due_date: e.target.value })} />
                  </div>
                  <Button size="sm" onClick={addMilestone}><Plus className="h-4 w-4 mr-1" />Add milestone</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Escrow</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-semibold">${c.escrow_amount ?? 0}</div>
              <Badge variant={c.escrow_funded ? "default" : "outline"}>{c.escrow_funded ? "Funded" : "Not funded"}</Badge>
              {isFounder && !c.escrow_funded && (
                <Button className="w-full" size="sm" onClick={fundEscrow}>Fund escrow</Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Signatures</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SignRow label="Founder" signed={founderSigned} name={parties.founder} />
              <SignRow label="Builder" signed={builderSigned} name={parties.builder} />

              {isFounder && c.status === "contract_drafted" && milestones.length > 0 && (
                <Button className="w-full" size="sm" onClick={sendForSigning}>Send for signing</Button>
              )}
              {((isFounder && !founderSigned) || (isBuilder && !builderSigned)) &&
                (c.status === "sent_for_signing" || c.status === "partially_signed") && (
                <Button className="w-full" size="sm" onClick={sign}>
                  <FileSignature className="h-4 w-4 mr-2" />Sign contract
                </Button>
              )}
            </CardContent>
          </Card>

          <Link to={`/projects/${c.project_id}`}>
            <Button variant="outline" size="sm" className="w-full">View project</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Clause({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <Checkbox checked={!!value} onCheckedChange={(v) => onChange(!!v)} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

function SignRow({ label, signed, name }: { label: string; signed: boolean; name?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="font-medium">{label}</span>
        {signed && name && <div className="text-xs text-muted-foreground mt-0.5">{name}</div>}
      </div>
      <Badge variant={signed ? "default" : "outline"}>{signed ? "Signed" : "Pending"}</Badge>
    </div>
  );
}
