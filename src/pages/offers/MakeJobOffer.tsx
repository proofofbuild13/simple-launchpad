import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function MakeJobOffer() {
  const [params] = useSearchParams();
  const submissionId = params.get("submission");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    job_title: "",
    annual_ctc: "",
    work_location: "Remote",
    office_location: "",
    start_date: "",
    probation_months: "3",
    reporting_manager: "",
    custom_notes: "",
    offer_letter_url: "",
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!submissionId) return;
    supabase.from("submissions").select("*, projects(*)").eq("id", submissionId).maybeSingle()
      .then(({ data }) => {
        setSubmission(data);
        const proj = (data as any)?.projects;
        if (proj) {
          setForm((p) => ({
            ...p,
            job_title: proj.job_title || "",
            work_location: proj.location_type || "Remote",
            office_location: proj.office_location || "",
            probation_months: String(proj.probation_months ?? 3),
            annual_ctc: String(proj.ctc_max ?? proj.ctc_min ?? ""),
          }));
        }
      });
  }, [submissionId]);

  const send = async () => {
    if (!user || !submission) return;
    if (!form.job_title || !form.annual_ctc || !form.start_date) {
      toast.error("Job title, CTC and start date are required");
      return;
    }
    setBusy(true);
    const { data, error } = await (supabase as any).from("employment_offers").insert({
      project_id: submission.project_id,
      submission_id: submission.id,
      startup_id: user.id,
      builder_id: submission.builder_id,
      job_title: form.job_title,
      annual_ctc: Number(form.annual_ctc),
      work_location: form.work_location,
      office_location: form.office_location || null,
      start_date: form.start_date,
      probation_months: Number(form.probation_months) || 0,
      reporting_manager: form.reporting_manager || null,
      custom_notes: form.custom_notes || null,
      offer_letter_url: form.offer_letter_url || null,
      status: "sent",
    }).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Job offer sent — expires in 72 hours");
    navigate(`/job-offers/${data.id}`);
  };

  const showOffice = form.work_location === "Hybrid" || form.work_location === "On-site";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Make job offer</h1>
        {submission && <p className="text-sm text-muted-foreground mt-1">For: {submission.title}</p>}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Full-time employment offer</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Job title *</Label>
            <Input value={form.job_title} onChange={(e) => set("job_title", e.target.value)} placeholder="Full Stack Developer" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Annual CTC (USD) *</Label>
              <Input type="number" value={form.annual_ctc} onChange={(e) => set("annual_ctc", e.target.value)} placeholder="80000" />
            </div>
            <div className="space-y-1.5">
              <Label>Joining date *</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Work mode</Label>
              <Select value={form.work_location} onValueChange={(v) => set("work_location", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Remote">Remote</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                  <SelectItem value="On-site">On-site</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Probation</Label>
              <Select value={form.probation_months} onValueChange={(v) => set("probation_months", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="1">1 month</SelectItem>
                  <SelectItem value="3">3 months</SelectItem>
                  <SelectItem value="6">6 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {showOffice && (
            <div className="space-y-1.5">
              <Label>Office location</Label>
              <Input value={form.office_location} onChange={(e) => set("office_location", e.target.value)} placeholder="Bangalore, India" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Reporting manager</Label>
            <Input value={form.reporting_manager} onChange={(e) => set("reporting_manager", e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label>Offer letter URL</Label>
            <Input value={form.offer_letter_url} onChange={(e) => set("offer_letter_url", e.target.value)} placeholder="https://" />
          </div>
          <div className="space-y-1.5">
            <Label>Custom notes</Label>
            <Textarea rows={3} value={form.custom_notes} onChange={(e) => set("custom_notes", e.target.value)} />
          </div>
          <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            On acceptance: project closes, builder is marked hired, and a placement-fee invoice (8.33% of annual CTC) is generated. Offer expires in <strong>72 hours</strong>.
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
            <Button onClick={send} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send job offer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
