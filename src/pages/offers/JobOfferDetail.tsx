import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Clock, Briefcase, Calendar, MapPin, DollarSign } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  sent: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  viewed: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  accepted: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  declined: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground",
  withdrawn: "bg-muted text-muted-foreground",
  joined: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
};

export default function JobOfferDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data } = await (supabase as any)
      .from("employment_offers")
      .select("*, projects(title, founder_id, category)")
      .eq("id", id)
      .maybeSingle();
    setOffer(data);
    setProject(data?.projects);
    // Mark as viewed if the builder is the first reader
    if (data && user?.id === data.builder_id && data.status === "sent") {
      await (supabase as any).from("employment_offers").update({ status: "viewed" }).eq("id", id);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, user]);

  const respond = async (status: "accepted" | "declined") => {
    if (!offer) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from("employment_offers")
      .update({ status })
      .eq("id", offer.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(status === "accepted" ? "Offer accepted — placement invoice generated" : "Offer declined");
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!offer) return <p className="text-center text-muted-foreground py-20">Job offer not found.</p>;

  const isBuilder = user?.id === offer.builder_id;
  const isStartup = user?.id === offer.startup_id;
  const expired = new Date(offer.expires_at) < new Date();
  const status = expired && (offer.status === "sent" || offer.status === "viewed") ? "expired" : offer.status;
  const canRespond = isBuilder && (status === "sent" || status === "viewed") && !expired;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/job-offers" className="text-xs text-muted-foreground hover:text-foreground">← All job offers</Link>
          <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-emerald-600" />
            {offer.job_title}
          </h1>
          <p className="text-sm text-muted-foreground">For project: {project?.title}</p>
        </div>
        <Badge className={STATUS_COLOR[status] ?? ""} variant="outline">{status}</Badge>
      </div>

      <Card className="border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20">
        <CardContent className="py-5 grid sm:grid-cols-2 gap-4 text-sm">
          <Detail icon={<DollarSign className="h-4 w-4" />} label="Annual CTC" value={`$${Number(offer.annual_ctc).toLocaleString()}`} />
          <Detail icon={<Calendar className="h-4 w-4" />} label="Joining date" value={format(new Date(offer.start_date), "MMM d, yyyy")} />
          <Detail icon={<MapPin className="h-4 w-4" />} label="Work mode" value={offer.work_location + (offer.office_location ? ` · ${offer.office_location}` : "")} />
          <Detail icon={<Clock className="h-4 w-4" />} label="Probation" value={offer.probation_months ? `${offer.probation_months} months` : "None"} />
          {offer.reporting_manager && <Detail icon={<Briefcase className="h-4 w-4" />} label="Reporting manager" value={offer.reporting_manager} />}
        </CardContent>
      </Card>

      {offer.custom_notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes from founder</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap text-foreground/80">{offer.custom_notes}</CardContent>
        </Card>
      )}

      {offer.offer_letter_url && (
        <a href={offer.offer_letter_url} target="_blank" rel="noreferrer">
          <Button variant="outline" className="w-full">
            <ExternalLink className="h-4 w-4 mr-2" /> Download offer letter
          </Button>
        </a>
      )}

      {(status === "sent" || status === "viewed") && !expired && (
        <Card>
          <CardContent className="py-3 flex items-center gap-2 text-sm text-amber-700">
            <Clock className="h-4 w-4" />
            Offer expires {formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true })}
          </CardContent>
        </Card>
      )}

      {canRespond && (
        <div className="flex gap-3">
          <Button variant="outline" disabled={busy} onClick={() => respond("declined")} className="flex-1">Decline</Button>
          <Button disabled={busy} onClick={() => respond("accepted")} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Accept offer
          </Button>
        </div>
      )}

      {status === "accepted" && (
        <Card className="border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardContent className="py-4 text-sm">
            <div className="font-medium text-emerald-700 mb-1">Placement successful</div>
            <p className="text-muted-foreground">
              {isStartup
                ? "Your placement invoice has been generated. View it under Payments → Placement fees."
                : "Congrats! The founder has been notified. Expect onboarding details by your joining date."}
            </p>
            {isStartup && (
              <Button size="sm" className="mt-3" onClick={() => navigate("/payments/startup")}>
                View placement invoices
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-emerald-600">{icon}</div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
