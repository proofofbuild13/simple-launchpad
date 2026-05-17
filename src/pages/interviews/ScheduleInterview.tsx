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

export default function ScheduleInterview() {
  const [params] = useSearchParams();
  const submissionId = params.get("submission");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<any>(null);
  const [type, setType] = useState("video");
  const [scheduledAt, setScheduledAt] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!submissionId) return;
    supabase.from("submissions").select("*, projects(*)").eq("id", submissionId).maybeSingle()
      .then(({ data }) => setSubmission(data));
  }, [submissionId]);

  const send = async () => {
    if (!user || !submission) return;
    setSubmitting(true);
    const { error } = await supabase.from("interviews").insert({
      submission_id: submission.id,
      project_id: submission.project_id,
      founder_id: user.id,
      builder_id: submission.builder_id,
      type,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      meeting_url: meetingUrl || null,
      context_message: context || null,
      status: "invited",
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Interview invite sent");
    navigate("/interviews");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Schedule interview</h1>
        {submission && <p className="text-sm text-muted-foreground mt-1">For: {submission.title}</p>}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video call</SelectItem>
                <SelectItem value="technical">Technical interview</SelectItem>
                <SelectItem value="async">Async loom review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Scheduled time</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Meeting URL</Label>
            <Input placeholder="https://meet.google.com/..." value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Context message</Label>
            <Textarea rows={4} value={context} onChange={(e) => setContext(e.target.value)} placeholder="What you'd like to discuss…" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
            <Button onClick={send} disabled={submitting}>Send invite</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
