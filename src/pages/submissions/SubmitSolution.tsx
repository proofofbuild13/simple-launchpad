import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Lightbulb,
  Eye,
  Star,
  Handshake,
  PartyPopper,
  ArrowRight,
  Sparkles,
  FileText,
  Upload,
  Quote,
} from "lucide-react";
import { extractResumeText } from "@/lib/resumeExtract";

const JOURNEY_STEPS = [
  {
    icon: Lightbulb,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    title: "Submit your Idea",
    desc: "Share your solution with the founder — a working demo speaks louder than a pitch.",
  },
  {
    icon: Eye,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    title: "Review by Founder",
    desc: "The founder evaluates quality, feasibility, UX, and execution of your submission.",
  },
  {
    icon: Star,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    title: "Get Shortlisted",
    desc: "Top submissions get shortlisted and builders are invited for an interview round.",
  },
  {
    icon: Handshake,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    title: "Build with Founder",
    desc: "Sign a contract, set milestones, and start building the real product with the founder.",
  },
  {
    icon: PartyPopper,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    title: "Earn & Enjoy",
    desc: "Get paid milestone by milestone. Grow your reputation and unlock bigger opportunities.",
  },
];

export default function SubmitSolution() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", demo_url: "", live_url: "",
    github_url: "", video_url: "", tech_stack: "", notes: "",
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submitResume = async () => {
    if (!user || !projectId || !resumeFile) return;
    setResumeLoading(true);
    try {
      const ext = resumeFile.name.split(".").pop() || "pdf";
      const path = `${user.id}/${projectId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("resumes")
        .upload(path, resumeFile, { upsert: false, contentType: resumeFile.type });
      if (upErr) throw upErr;
      const extracted = await extractResumeText(resumeFile);
      const { error: insErr } = await supabase.from("resume_applications" as any).insert({
        project_id: projectId,
        builder_id: user.id,
        resume_url: path,
        file_name: resumeFile.name,
        extracted_text: extracted || null,
      });
      if (insErr) throw insErr;
      toast.success("Resume application submitted!");
      navigate(`/projects/${projectId}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to submit resume");
    } finally {
      setResumeLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectId) return;
    setLoading(true);
    const { error } = await supabase.from("submissions").insert({
      project_id: projectId, builder_id: user.id,
      title: form.title, description: form.description,
      demo_url: form.demo_url || null, live_url: form.live_url || null,
      github_url: form.github_url || null, video_url: form.video_url || null,
      tech_stack: form.tech_stack.split(",").map((s) => s.trim()).filter(Boolean),
      notes: form.notes || null,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Idea submitted successfully!");
    navigate(`/projects/${projectId}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Submit your Idea</h1>
          <p className="text-sm text-muted-foreground">Show, don't tell. A working demo {">"} a long pitch.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setJourneyOpen(true)}
          className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/5 shrink-0"
        >
          <Sparkles className="h-3.5 w-3.5" />
          See how it works
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
        <Quote className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm italic text-foreground/80">
          "Show the idea or proof of work to get fast hiring."
        </p>
      </div>

      <Card className="border-emerald-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-600" />
            Apply with Resume
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Upload your resume (PDF or TXT) — we'll extract the content and share it with the founder.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center justify-center gap-2 w-full rounded-md border border-dashed border-input bg-background hover:bg-accent/40 transition-colors cursor-pointer px-4 py-6 text-sm">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {resumeFile ? resumeFile.name : "Click to choose resume file"}
            </span>
            <input
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button
            type="button"
            onClick={submitResume}
            disabled={!resumeFile || resumeLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {resumeLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply with Resume
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Your Idea</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Idea Title"><Input required value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
            <Field label="Describe your idea"><Textarea rows={4} required value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
            
            <div className="text-xs text-muted-foreground bg-muted/65 border border-border rounded-md p-3 leading-relaxed">
              "Add your idea prototype link so founders can quickly understand your concept and increase your chances of getting hired"
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Demo URL"><Input value={form.demo_url} onChange={(e) => set("demo_url", e.target.value)} placeholder="https://" /></Field>
              <Field label="Live URL"><Input value={form.live_url} onChange={(e) => set("live_url", e.target.value)} placeholder="https://" /></Field>
              <Field label="GitHub URL"><Input value={form.github_url} onChange={(e) => set("github_url", e.target.value)} placeholder="https://github.com/" /></Field>
              <Field label="Video walkthrough"><Input value={form.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="https://" /></Field>
            </div>
            <Field label="Tech stack & tools  (comma separated)"><Input value={form.tech_stack} onChange={(e) => set("tech_stack", e.target.value)} placeholder="React, Postgres, ..." /></Field>
            <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              onClick={() => !loading && setJourneyOpen(false)}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Idea
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Journey / How It Works Popup */}
      <Dialog open={journeyOpen} onOpenChange={setJourneyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Your journey on proof_of_build
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              From idea to income — here's the full path.
            </p>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {JOURNEY_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className={`flex-shrink-0 h-10 w-10 rounded-xl ${step.bg} border ${step.border} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${step.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-semibold">{step.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                  {i < JOURNEY_STEPS.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0 mt-3 rotate-90 hidden" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Ready to start your journey?</p>
            <Button size="sm" onClick={() => setJourneyOpen(false)}>
              Submit Idea <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
