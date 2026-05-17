import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const steps = ["Basics", "Problem", "Settings", "Privacy", "Review"];

export default function PostProject() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", category: "", short_description: "",
    description: "", requirements: "", deliverables: "",
    budget: "", timeline: "", contract_type: "fixed", difficulty: "mid",
    visibility: "public", nda_required: false, ip_agreement: false,
  });
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from("projects").insert({
      founder_id: user.id,
      title: form.title, category: form.category, short_description: form.short_description,
      description: form.description, requirements: form.requirements, deliverables: form.deliverables,
      budget: form.budget ? Number(form.budget) : null,
      timeline: form.timeline, contract_type: form.contract_type, difficulty: form.difficulty,
      visibility: form.visibility, nda_required: form.nda_required, ip_agreement: form.ip_agreement,
      status: "open",
    }).select().single();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project published");
    navigate(`/projects/${data.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Post a project</h1>
        <p className="text-sm text-muted-foreground">Step {step + 1} of {steps.length}: {steps[step]}</p>
      </div>
      <div className="flex gap-2">
        {steps.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded ${i <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{steps[step]}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <Field label="Title"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Build an MVP for..." /></Field>
              <Field label="Category">
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["AI", "SaaS", "Mobile", "Web", "No-code", "Marketing", "Data"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Short description"><Textarea rows={3} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} /></Field>
            </>
          )}
          {step === 1 && (
            <>
              <Field label="Detailed description"><Textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
              <Field label="Requirements"><Textarea rows={3} value={form.requirements} onChange={(e) => set("requirements", e.target.value)} /></Field>
              <Field label="Deliverables"><Textarea rows={3} value={form.deliverables} onChange={(e) => set("deliverables", e.target.value)} /></Field>
            </>
          )}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Budget (USD)"><Input type="number" value={form.budget} onChange={(e) => set("budget", e.target.value)} /></Field>
                <Field label="Timeline"><Input value={form.timeline} onChange={(e) => set("timeline", e.target.value)} placeholder="e.g. 2 weeks" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contract type">
                  <Select value={form.contract_type} onValueChange={(v) => set("contract_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed price</SelectItem>
                      <SelectItem value="milestone">Milestone</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Difficulty">
                  <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="mid">Mid</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <Field label="Visibility">
                <Select value={form.visibility} onValueChange={(v) => set("visibility", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="invite">Invite only</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div><div className="font-medium text-sm">NDA required</div><div className="text-xs text-muted-foreground">Builders must sign an NDA to view full brief</div></div>
                <Switch checked={form.nda_required} onCheckedChange={(v) => set("nda_required", v)} />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div><div className="font-medium text-sm">IP ownership agreement</div><div className="text-xs text-muted-foreground">Winner assigns IP on contract</div></div>
                <Switch checked={form.ip_agreement} onCheckedChange={(v) => set("ip_agreement", v)} />
              </div>
            </>
          )}
          {step === 4 && (
            <div className="space-y-3 text-sm">
              <Row k="Title" v={form.title} />
              <Row k="Category" v={form.category} />
              <Row k="Budget" v={form.budget ? `$${form.budget}` : "—"} />
              <Row k="Timeline" v={form.timeline || "—"} />
              <Row k="Contract" v={form.contract_type} />
              <Row k="Visibility" v={form.visibility} />
              <Row k="NDA" v={form.nda_required ? "Yes" : "No"} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !form.title}>Continue</Button>
        ) : (
          <Button onClick={submit} disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Publish project</Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}
