import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTS = [
  "draft","open","open_for_submissions","reviewing_submissions",
  "hiring_in_progress","closed","archived"
];

export default function EditProject() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      setData(p);
    })();
  }, [id]);

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (user && data.founder_id !== user.id) return <p className="text-center py-20 text-muted-foreground">Not your project.</p>;

  const set = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("projects").update({
      title: data.title, short_description: data.short_description, description: data.description,
      requirements: data.requirements, deliverables: data.deliverables,
      budget: data.budget ? Number(data.budget) : null,
      timeline: data.timeline, deadline: data.deadline,
      visibility: data.visibility, status: data.status,
      max_hires: data.max_hires ? Number(data.max_hires) : 1,
      tags: typeof data.tags === "string" ? data.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : data.tags,
      nda_required: data.nda_required, ip_agreement: data.ip_agreement,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Project updated");
    navigate(`/projects/${id}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Edit project</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Title"><Input value={data.title ?? ""} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Short description"><Textarea rows={2} value={data.short_description ?? ""} onChange={(e) => set("short_description", e.target.value)} /></Field>
          <Field label="Description"><Textarea rows={5} value={data.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Requirements"><Textarea rows={3} value={data.requirements ?? ""} onChange={(e) => set("requirements", e.target.value)} /></Field>
          <Field label="Deliverables"><Textarea rows={3} value={data.deliverables ?? ""} onChange={(e) => set("deliverables", e.target.value)} /></Field>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Budget (USD)"><Input type="number" value={data.budget ?? ""} onChange={(e) => set("budget", e.target.value)} /></Field>
            <Field label="Timeline"><Input value={data.timeline ?? ""} onChange={(e) => set("timeline", e.target.value)} /></Field>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Deadline"><Input type="date" value={data.deadline ? data.deadline.slice(0,10) : ""} onChange={(e) => set("deadline", e.target.value || null)} /></Field>
            <Field label="Max hires"><Input type="number" min={1} value={data.max_hires ?? 1} onChange={(e) => set("max_hires", e.target.value)} /></Field>
            <Field label="Visibility">
              <Select value={data.visibility} onValueChange={(v) => set("visibility", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="invite">Invite only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Status">
            <Select value={data.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTS.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Tags (comma separated)">
            <Input value={Array.isArray(data.tags) ? data.tags.join(", ") : (data.tags ?? "")} onChange={(e) => set("tags", e.target.value)} />
          </Field>
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="text-sm">NDA required</div>
            <Switch checked={!!data.nda_required} onCheckedChange={(v) => set("nda_required", v)} />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="text-sm">IP assignment</div>
            <Switch checked={!!data.ip_agreement} onCheckedChange={(v) => set("ip_agreement", v)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
            <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: any) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
