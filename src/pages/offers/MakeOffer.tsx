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

export default function MakeOffer() {
  const [params] = useSearchParams();
  const submissionId = params.get("submission");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<any>(null);
  const [contractType, setContractType] = useState("contract");
  const [duration, setDuration] = useState("3 months");
  const [rate, setRate] = useState("");
  const [rateType, setRateType] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [terms, setTerms] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!submissionId) return;
    supabase.from("submissions").select("*, projects(*)").eq("id", submissionId).maybeSingle()
      .then(({ data }) => setSubmission(data));
  }, [submissionId]);

  const send = async () => {
    if (!user || !submission) return;
    setBusy(true);
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    const { error } = await supabase.from("offers").insert({
      project_id: submission.project_id,
      submission_id: submission.id,
      founder_id: user.id,
      builder_id: submission.builder_id,
      offer_type: contractType,
      duration,
      compensation: Number(rate) || null,
      rate_type: rateType,
      start_date: startDate || null,
      custom_terms: terms || null,
      expires_at: expiresAt,
      status: "offer_sent",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Offer sent — expires in 72 hours");
    navigate("/offers");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Send hire offer</h1>
        {submission && <p className="text-sm text-muted-foreground mt-1">For: {submission.title}</p>}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Offer terms</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Contract type</Label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3 months">3 months</SelectItem>
                  <SelectItem value="6 months">6 months</SelectItem>
                  <SelectItem value="12 months">12 months</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rate</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="5000" />
            </div>
            <div className="space-y-1.5">
              <Label>Rate type</Label>
              <Select value={rateType} onValueChange={setRateType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="fixed">Fixed project</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Custom terms</Label>
            <Textarea rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Any additional terms…" />
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            Offer expires in <strong>72 hours</strong>. Builder can accept, reject, or counter once.
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
            <Button onClick={send} disabled={busy || !rate}>Send offer</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
