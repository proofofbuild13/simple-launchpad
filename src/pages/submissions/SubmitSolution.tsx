import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function SubmitSolution() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", demo_url: "", live_url: "",
    github_url: "", video_url: "", tech_stack: "", notes: "",
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

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
    toast.success("Submission sent");
    navigate(`/projects/${projectId}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Submit your solution</h1>
        <p className="text-sm text-muted-foreground">Show, don't tell. Working demo {">"} a long pitch.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Submission</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Title"><Input required value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
            <Field label="Description"><Textarea rows={4} required value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Demo URL"><Input value={form.demo_url} onChange={(e) => set("demo_url", e.target.value)} placeholder="https://" /></Field>
              <Field label="Live URL"><Input value={form.live_url} onChange={(e) => set("live_url", e.target.value)} placeholder="https://" /></Field>
              <Field label="GitHub URL"><Input value={form.github_url} onChange={(e) => set("github_url", e.target.value)} placeholder="https://github.com/" /></Field>
              <Field label="Video walkthrough"><Input value={form.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="https://" /></Field>
            </div>
            <Field label="Tech stack (comma separated)"><Input value={form.tech_stack} onChange={(e) => set("tech_stack", e.target.value)} placeholder="React, Postgres, ..." /></Field>
            <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit solution
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
