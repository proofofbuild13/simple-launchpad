import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileCheck2,
  Calendar,
  HandCoins,
  FileSignature,
  Briefcase,
  Wallet,
  ArrowRight,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Circle,
} from "lucide-react";

type Stage = {
  key: string;
  title: string;
  icon: any;
  status: "done" | "active" | "pending";
  summary: React.ReactNode;
  actions?: React.ReactNode;
};

export default function DealDetail() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      setLoading(true);
      const { data: sub } = await supabase
        .from("submissions")
        .select("*, projects!inner(id, title, founder_id, category)")
        .eq("id", id)
        .maybeSingle();
      if (!sub) {
        setLoading(false);
        return;
      }
      const [{ data: interview }, { data: offer }, { data: evaluation }] = await Promise.all([
        supabase.from("interviews").select("*").eq("submission_id", id).order("scheduled_at", { ascending: false }).maybeSingle(),
        supabase.from("offers").select("*").eq("submission_id", id).order("created_at", { ascending: false }).maybeSingle(),
        supabase.from("ai_submission_evaluations").select("*").eq("submission_id", id).maybeSingle(),
      ]);
      const { data: contract } = offer
        ? await supabase.from("contracts").select("*").eq("offer_id", offer.id).maybeSingle()
        : { data: null as any };
      setData({ sub, interview, offer, contract, evaluation });
      setLoading(false);
    })();
  }, [id, user]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">Deal not found.</div>;
  }

  const { sub, interview, offer, contract, evaluation } = data;
  const isFounder = role === "startup";

  const stages: Stage[] = [
    {
      key: "submission",
      title: "Submission",
      icon: FileCheck2,
      status: "done",
      summary: (
        <div className="space-y-1 text-sm">
          <div><span className="text-muted-foreground">Title:</span> {sub.title}</div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{sub.status}</Badge>
            {evaluation && (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono">
                AI {evaluation.overall_score}/100 · {evaluation.verdict}
              </Badge>
            )}
          </div>
        </div>
      ),
      actions: (
        <Link to={`/submissions/${sub.id}`}>
          <Button size="sm" variant="outline">
            Open submission <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </Link>
      ),
    },
    {
      key: "interview",
      title: "Interview",
      icon: Calendar,
      status: interview ? "done" : offer || contract ? "done" : "pending",
      summary: interview ? (
        <div className="text-sm space-y-1">
          <div><span className="text-muted-foreground">Scheduled:</span> {new Date(interview.scheduled_at).toLocaleString()}</div>
          <Badge variant="outline">{interview.status}</Badge>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No interview scheduled (optional).</div>
      ),
      actions: isFounder && !interview && !offer && !contract ? (
        <Link to={`/interviews/new?submission=${sub.id}`}>
          <Button size="sm" variant="outline">Schedule</Button>
        </Link>
      ) : interview ? (
        <Link to="/interviews">
          <Button size="sm" variant="outline">Open <ExternalLink className="h-3.5 w-3.5 ml-1.5" /></Button>
        </Link>
      ) : null,
    },
    {
      key: "offer",
      title: "Offer",
      icon: HandCoins,
      status: contract ? "done" : offer ? "active" : "pending",
      summary: offer ? (
        <div className="text-sm space-y-1">
          <div><span className="text-muted-foreground">Compensation:</span> {offer.currency} {offer.compensation ?? "—"}</div>
          <Badge variant="outline">{offer.status}</Badge>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No offer yet.</div>
      ),
      actions: offer ? (
        <Link to={`/offers/${offer.id}`}>
          <Button size="sm" variant="outline">Open offer <ExternalLink className="h-3.5 w-3.5 ml-1.5" /></Button>
        </Link>
      ) : isFounder && sub.status === "shortlisted" ? (
        <Link to={`/offers/new?submission=${sub.id}`}>
          <Button size="sm">Make offer</Button>
        </Link>
      ) : null,
    },
    {
      key: "contract",
      title: "Contract",
      icon: FileSignature,
      status: contract
        ? ["contract_active", "awaiting_release", "payment_pending", "fully_settled", "completed"].includes(contract.status)
          ? "done"
          : "active"
        : "pending",
      summary: contract ? (
        <div className="text-sm space-y-1">
          <Badge variant="outline">{contract.status}</Badge>
          {contract.escrow_funded && (
            <div className="text-xs text-muted-foreground">Escrow: {contract.currency} {contract.escrow_balance}</div>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No contract drafted.</div>
      ),
      actions: contract ? (
        <Link to={`/contracts/${contract.id}`}>
          <Button size="sm" variant="outline">Open contract <ExternalLink className="h-3.5 w-3.5 ml-1.5" /></Button>
        </Link>
      ) : null,
    },
    {
      key: "work",
      title: "Work",
      icon: Briefcase,
      status: contract && ["contract_active", "awaiting_release"].includes(contract.status)
        ? "active"
        : contract && ["payment_pending", "fully_settled", "completed"].includes(contract.status)
        ? "done"
        : "pending",
      summary: contract && contract.escrow_funded ? (
        <div className="text-sm text-muted-foreground">Milestones and deliverables live in the workspace.</div>
      ) : (
        <div className="text-sm text-muted-foreground">Starts once escrow is funded.</div>
      ),
      actions: contract && contract.escrow_funded ? (
        <Link to={`/workspace/${contract.id}`}>
          <Button size="sm" variant="outline">Open workspace <ExternalLink className="h-3.5 w-3.5 ml-1.5" /></Button>
        </Link>
      ) : null,
    },
    {
      key: "payment",
      title: "Payment",
      icon: Wallet,
      status: contract && ["fully_settled", "completed"].includes(contract.status)
        ? "done"
        : contract && contract.status === "payment_pending"
        ? "active"
        : "pending",
      summary: contract ? (
        <div className="text-sm text-muted-foreground">Escrow releases, receipts, and commission.</div>
      ) : (
        <div className="text-sm text-muted-foreground">Available after contract activation.</div>
      ),
      actions: contract ? (
        <Link to={isFounder ? "/payments/startup" : "/payments/builder"}>
          <Button size="sm" variant="outline">Open payments <ExternalLink className="h-3.5 w-3.5 ml-1.5" /></Button>
        </Link>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link to="/deals" className="text-xs text-muted-foreground hover:text-foreground">← All deals</Link>
        <h1 className="text-2xl font-semibold mt-1">{sub.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          on <Link to={`/projects/${sub.projects.id}`} className="text-primary hover:underline">{sub.projects.title}</Link>
        </p>
      </div>

      <div className="relative">
        <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border" />
        <div className="space-y-4">
          {stages.map((s) => (
            <Card key={s.key} className={s.status === "active" ? "border-primary/50" : ""}>
              <CardContent className="py-4 flex items-start gap-4">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 border ${
                  s.status === "done" ? "bg-primary text-primary-foreground border-primary" :
                  s.status === "active" ? "bg-primary/10 text-primary border-primary" :
                  "bg-muted text-muted-foreground border-border"
                }`}>
                  {s.status === "done" ? <CheckCircle2 className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-medium">{s.title}</h3>
                    {s.actions}
                  </div>
                  {s.summary}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
