import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Briefcase, Hammer, Check, Sparkles } from "lucide-react";

const steps = ["Basics", "Engagement", "Problem", "Settings", "Privacy", "Review"];

type EngagementType = "project_hire" | "hire_to_build";

export default function PostProject() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [userEditedBrief, setUserEditedBrief] = useState(false);

  const [form, setForm] = useState<any>({
    title: "", category: "", short_description: "",
    description: "", requirements: "", deliverables: "",
    engagement_type: "project_hire" as EngagementType,
    budget: "", timeline: "", contract_type: "fixed", difficulty: "mid",
    // hire_to_build fields
    job_title: "", seniority_level: "mid",
    location_type: "Remote", office_location: "",
    ctc_min: "", ctc_max: "", ctc_confidential: false, probation_months: "3",
    visibility: "public", nda_required: false, ip_agreement: false,
  });
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const isH2B = form.engagement_type === "hire_to_build";

  const submit = async () => {
    if (!user) return;
    setLoading(true);
    const payload: any = {
      founder_id: user.id,
      title: form.title, category: form.category, short_description: form.short_description,
      description: form.description, requirements: form.requirements, deliverables: form.deliverables,
      engagement_type: form.engagement_type,
      difficulty: form.difficulty,
      visibility: form.visibility, nda_required: form.nda_required, ip_agreement: form.ip_agreement,
      status: "open",
    };
    if (isH2B) {
      Object.assign(payload, {
        job_title: form.job_title || form.title,
        seniority_level: form.seniority_level,
        location_type: form.location_type,
        office_location: form.location_type !== "Remote" ? (form.office_location || null) : null,
        ctc_min: form.ctc_min ? Number(form.ctc_min) : null,
        ctc_max: form.ctc_max ? Number(form.ctc_max) : null,
        ctc_confidential: form.ctc_confidential,
        probation_months: Number(form.probation_months) || 0,
        contract_type: "full-time",
      });
    } else {
      Object.assign(payload, {
        budget: form.budget ? Number(form.budget) : null,
        timeline: form.timeline,
        contract_type: form.contract_type,
      });
    }
    const { data, error } = await (supabase as any).from("projects").insert(payload).select().single();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project published");
    navigate(`/projects/${data.id}`);
  };

  const canContinue = () => {
    if (step === 0) return !!form.title && !!form.category;
    if (step === 1) return !!form.engagement_type;
    return true;
  };

  const generateWithAI = async () => {
    if (!form.title || !form.short_description) {
      toast.error("Add a title and short description in Step 1 first");
      return;
    }
    if (userEditedBrief && !window.confirm("This will overwrite your edits to description, requirements, and deliverables. Continue?")) {
      return;
    }
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-project-brief", {
      body: {
        title: form.title,
        category: form.category,
        engagement_type: form.engagement_type,
        short_description: form.short_description,
        job_title: isH2B ? form.job_title : undefined,
        timeline: !isH2B ? form.timeline : undefined,
        difficulty: form.difficulty,
      },
    });
    setGenerating(false);
    if (error || !data || data.error) {
      const msg = (data as any)?.message || (data as any)?.error || error?.message || "Generation failed";
      toast.error(msg === "rate_limited" ? "AI is busy. Try again shortly." : msg);
      return;
    }
    setForm((p: any) => ({
      ...p,
      description: data.description ?? p.description,
      requirements: data.requirements ?? p.requirements,
      deliverables: data.deliverables ?? p.deliverables,
    }));
    setUserEditedBrief(false);
    toast.success("Draft generated — review and edit before continuing");
  };


  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('profile.projects.post.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('profile.projects.post.step')}{step + 1}{t('profile.projects.post.of')}{steps.length}: {steps.at(step)}</p>
      </div>
      <div className="flex gap-2">
        {steps.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded ${i <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{steps.at(step)}</CardTitle></CardHeader>
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
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('profile.projects.post.engageBuilder')}</p>
              <EngagementCard
                selected={form.engagement_type === "project_hire"}
                onClick={() => set("engagement_type", "project_hire")}
                accent="blue"
                icon={<Hammer className="h-5 w-5" />}
                title="Project Hire"
                subtitle="Fixed contract with milestones and escrow/direct payments."
                features={["Budget + deadline", "Milestone contracts", "3 / 6 / 12 month engagement", "Platform fee: 15% per milestone"]}
              />
              <EngagementCard
                selected={form.engagement_type === "hire_to_build"}
                onClick={() => set("engagement_type", "hire_to_build")}
                accent="emerald"
                icon={<Briefcase className="h-5 w-5" />}
                title="Hire to Build"
                subtitle="Full-time permanent role — hire the builder who solves your challenge."
                features={["No upfront financial commitment", "Permanent employment", "Challenge-based hiring", "One-time placement fee"]}
              />
            </div>
          )}

          {step === 2 && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Draft the problem statement, requirements, and deliverables. Builders submit against this brief.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={generateWithAI} disabled={generating}>
                  {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {generating ? "Generating…" : "Generate with AI"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-2">
                AI draft — edit freely before publishing. Nothing is saved until you finish posting.
              </p>
              {!form.short_description && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Add a short description in Step 1 so AI has something to work from.
                </p>
              )}
              <Field label="Detailed description / challenge"><Textarea rows={5} value={form.description} onChange={(e) => { set("description", e.target.value); setUserEditedBrief(true); }} /></Field>
              <Field label="Requirements"><Textarea rows={3} value={form.requirements} onChange={(e) => { set("requirements", e.target.value); setUserEditedBrief(true); }} /></Field>
              <Field label="Deliverables"><Textarea rows={3} value={form.deliverables} onChange={(e) => { set("deliverables", e.target.value); setUserEditedBrief(true); }} /></Field>
            </>
          )}


          {step === 3 && !isH2B && (
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
                      <SelectItem value="fixed">{t('profile.projects.post.contractTypes.fixed')}</SelectItem>
                      <SelectItem value="milestone">{t('profile.projects.post.contractTypes.milestone')}</SelectItem>
                      <SelectItem value="hourly">{t('profile.projects.post.contractTypes.hourly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Difficulty">
                  <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">{t('profile.projects.post.difficulties.immediate')}</SelectItem>
                      <SelectItem value="1_month">1 month</SelectItem>
                      <SelectItem value="3_month">3 months</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </>
          )}

          {step === 3 && isH2B && (
            <>
              <Field label="Job title"><Input value={form.job_title} onChange={(e) => set("job_title", e.target.value)} placeholder="Full Stack Developer" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Seniority level">
                  <Select value={form.seniority_level} onValueChange={(v) => set("seniority_level", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">{t('profile.projects.post.seniorities.junior')}</SelectItem>
                      <SelectItem value="mid">{t('profile.projects.post.seniorities.mid')}</SelectItem>
                      <SelectItem value="senior">{t('profile.projects.post.seniorities.senior')}</SelectItem>
                      <SelectItem value="lead">{t('profile.projects.post.seniorities.lead')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Work location">
                  <Select value={form.location_type} onValueChange={(v) => set("location_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Remote">{t('profile.projects.post.locations.remote')}</SelectItem>
                      <SelectItem value="Hybrid">{t('profile.projects.post.locations.hybrid')}</SelectItem>
                      <SelectItem value="On-site">On-site</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {(form.location_type === "Hybrid" || form.location_type === "On-site") && (
                <Field label="Office location">
                  <Input value={form.office_location} onChange={(e) => set("office_location", e.target.value)} placeholder="Bangalore, India" />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="CTC min (USD/yr)">
                  <Input type="number" disabled={form.ctc_confidential} value={form.ctc_min} onChange={(e) => set("ctc_min", e.target.value)} placeholder="60000" />
                </Field>
                <Field label="CTC max (USD/yr)">
                  <Input type="number" disabled={form.ctc_confidential} value={form.ctc_max} onChange={(e) => set("ctc_max", e.target.value)} placeholder="90000" />
                </Field>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <div className="font-medium text-sm">{t('profile.projects.post.salary.confidential')}</div>
                  <div className="text-xs text-muted-foreground">{t('profile.projects.post.salary.confidentialDesc')}</div>
                </div>
                <Switch checked={form.ctc_confidential} onCheckedChange={(v) => set("ctc_confidential", v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Probation">
                  <Select value={form.probation_months} onValueChange={(v) => set("probation_months", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('profile.projects.post.probation.none')}</SelectItem>
                      <SelectItem value="1">1 month</SelectItem>
                      <SelectItem value="3">3 months</SelectItem>
                      <SelectItem value="6">6 months</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Difficulty">
                  <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">{t('profile.projects.post.difficulties.immediate')}</SelectItem>
                      <SelectItem value="1_month">1 month</SelectItem>
                      <SelectItem value="3_month">3 months</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <Field label="Visibility">
                <Select value={form.visibility} onValueChange={(v) => set("visibility", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">{t('profile.projects.post.visibility.public')}</SelectItem>
                    <SelectItem value="private">{t('profile.projects.post.visibility.private')}</SelectItem>
                    <SelectItem value="invite">{t('profile.projects.post.visibility.invite')}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div><div className="font-medium text-sm">{t('profile.projects.post.nda')}</div><div className="text-xs text-muted-foreground">Builders must sign an NDA to view full brief</div></div>
                <Switch checked={form.nda_required} onCheckedChange={(v) => set("nda_required", v)} />
              </div>
              {!isH2B && (
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div><div className="font-medium text-sm">{t('profile.projects.post.ip')}</div><div className="text-xs text-muted-foreground">Winner assigns IP on contract</div></div>
                  <Switch checked={form.ip_agreement} onCheckedChange={(v) => set("ip_agreement", v)} />
                </div>
              )}
            </>
          )}

          {step === 5 && (
            <div className="space-y-3 text-sm">
              <Row k="Title" v={form.title} />
              <Row k="Category" v={form.category} />
              <Row k="Engagement" v={isH2B ? "Hire to Build (full-time)" : "Project Hire (contract)"} />
              {isH2B ? (
                <>
                  <Row k="Job title" v={form.job_title || form.title} />
                  <Row k="Seniority" v={form.seniority_level} />
                  <Row k="Work mode" v={form.location_type + (form.office_location ? ` · ${form.office_location}` : "")} />
                  <Row k="CTC" v={form.ctc_confidential ? "Competitive Salary" : `${form.ctc_min || "?"} – ${form.ctc_max || "?"}`} />
                  <Row k="Probation" v={form.probation_months === "0" ? "None" : `${form.probation_months} months`} />
                </>
              ) : (
                <>
                  <Row k="Budget" v={form.budget ? `$${form.budget}` : "—"} />
                  <Row k="Timeline" v={form.timeline || "—"} />
                  <Row k="Contract" v={form.contract_type} />
                </>
              )}
              <Row k="Visibility" v={form.visibility} />
              <Row k="NDA" v={form.nda_required ? "Yes" : "No"} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>{t('profile.projects.post.actions.back')}</Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue()}>{t('profile.projects.post.actions.continue')}</Button>
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

function EngagementCard({
  selected, onClick, accent, icon, title, subtitle, features,
}: {
  selected: boolean;
  onClick: () => void;
  accent: "blue" | "emerald";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  features: string[];
}) {
  const ring = selected
    ? accent === "emerald"
      ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30"
      : "border-blue-500 bg-blue-50/60 dark:bg-blue-950/20 ring-2 ring-blue-500/30"
    : "border-border hover:border-muted-foreground/40";
  const iconColor = accent === "emerald" ? "text-emerald-600" : "text-blue-600";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left w-full rounded-lg border-2 transition-all p-4 ${ring}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-md bg-background ${iconColor}`}>{icon}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{title}</div>
            {selected && <Check className={`h-4 w-4 ${iconColor}`} />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-foreground/80">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <span className={`h-1 w-1 rounded-full ${accent === "emerald" ? "bg-emerald-500" : "bg-blue-500"}`} />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  );
}
