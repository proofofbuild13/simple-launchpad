import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { WorkflowStepper } from "@/components/workflow/WorkflowStepper";

export default function OfferDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<any>(null);
  const [negs, setNegs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [counterRate, setCounterRate] = useState("");
  const [counterMsg, setCounterMsg] = useState("");

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("offers").select("*, projects(*)").eq("id", id).maybeSingle();
    setOffer(data);
    const { data: n } = await supabase.from("offer_negotiations").select("*").eq("offer_id", id).order("round", { ascending: true });
    setNegs(n ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const accept = async () => {
    if (!offer) return;
    const { data: contractId, error } = await supabase.rpc("create_contract_from_offer", {
      _offer_id: offer.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Offer accepted — contract drafted with milestones");
    if (contractId) navigate(`/contracts/${contractId}`);
  };

  const reject = async () => {
    await supabase.from("offers").update({ status: "rejected" }).eq("id", offer.id);
    toast.success("Offer rejected");
    load();
  };

  const sendCounter = async () => {
    if (!user || !offer) return;
    const round = (negs[negs.length - 1]?.round ?? 0) + 1;
    if (round > 1) return toast.error("Only one counter-offer round allowed");
    await supabase.from("offer_negotiations").insert({
      offer_id: offer.id,
      proposed_by: user.id,
      counter_rate: Number(counterRate) || null,
      message: counterMsg,
      round,
      status: "pending",
    });
    await supabase.from("offers").update({ status: "negotiating" }).eq("id", offer.id);
    toast.success("Counter-offer sent");
    setCounterRate(""); setCounterMsg("");
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!offer) return <p className="py-20 text-center text-muted-foreground">Not found.</p>;

  const isBuilder = user?.id === offer.builder_id;
  const expired = offer.expires_at && new Date(offer.expires_at) < new Date();
  const stage = offer.status === "offer_accepted" ? 3 : 2;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">Offer for {offer.projects?.title}</p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">{offer.offer_type} · {offer.duration}</h1>
          <Badge>{expired ? "expired" : offer.status?.replace("_", " ")}</Badge>
        </div>
      </div>

      <Card><CardContent className="pt-6"><WorkflowStepper current={stage} /></CardContent></Card>

      {offer.expires_at && !expired && offer.status !== "offer_accepted" && offer.status !== "rejected" && (
        <Card className="border-amber-500/40">
          <CardContent className="py-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Clock className="h-4 w-4" />
            Expires {formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Terms</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
          <Field label="Rate">${offer.compensation} {offer.rate_type && `/ ${offer.rate_type}`}</Field>
          <Field label="Start date">{offer.start_date ?? "—"}</Field>
          <Field label="Contract type">{offer.offer_type}</Field>
          <Field label="Duration">{offer.duration}</Field>
          {offer.custom_terms && <div className="sm:col-span-2"><Field label="Custom terms"><span className="whitespace-pre-wrap">{offer.custom_terms}</span></Field></div>}
        </CardContent>
      </Card>

      {negs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Negotiation timeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {negs.map((n) => (
              <div key={n.id} className="border-l-2 border-primary/40 pl-3 text-sm">
                <div className="text-xs text-muted-foreground">Round {n.round}</div>
                {n.counter_rate && <div>Counter rate: ${n.counter_rate}</div>}
                {n.message && <p className="text-foreground/80 mt-1">{n.message}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isBuilder && !expired && (offer.status === "offer_sent" || offer.status === "negotiating" || offer.status === "pending") && (
        <Card>
          <CardHeader><CardTitle className="text-base">Your response</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={accept}>Accept offer</Button>
              <Button variant="ghost" onClick={reject}>Reject</Button>
            </div>
            {negs.length === 0 && (
              <div className="space-y-2 pt-3 border-t">
                <Label>Counter-offer (one round only)</Label>
                <Input type="number" placeholder="Counter rate" value={counterRate} onChange={(e) => setCounterRate(e.target.value)} />
                <Textarea rows={3} placeholder="Message…" value={counterMsg} onChange={(e) => setCounterMsg(e.target.value)} />
                <Button variant="outline" onClick={sendCounter}>Send counter-offer</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{children}</div>
    </div>
  );
}
