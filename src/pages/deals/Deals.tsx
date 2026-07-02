import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Handshake, ArrowRight, Loader2 } from "lucide-react";

interface DealRow {
  submission_id: string;
  submission_title: string;
  submission_status: string;
  project_title: string;
  counterparty: string;
  stage: string;
  updated_at: string;
  ai_score: number | null;
}

const STAGE_ORDER = ["Submission", "Interview", "Offer", "Contract", "Work", "Payment", "Completed"];

function deriveStage(sub: any, interview: any, offer: any, contract: any): string {
  if (contract) {
    if (contract.status === "completed") return "Completed";
    if (["payment_pending", "fully_settled"].includes(contract.status)) return "Payment";
    if (["contract_active", "awaiting_release"].includes(contract.status)) return "Work";
    return "Contract";
  }
  if (offer) return "Offer";
  if (interview) return "Interview";
  return "Submission";
}

export default function Deals() {
  const { user, role } = useAuth();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const isFounder = role === "startup";
      // Fetch submissions relevant to this user
      let subsQuery = supabase
        .from("submissions")
        .select("id, title, status, builder_id, created_at, updated_at, ai_score, projects!inner(id, title, founder_id)")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (isFounder) subsQuery = subsQuery.eq("projects.founder_id", user.id);
      else subsQuery = subsQuery.eq("builder_id", user.id);
      const { data: subs } = await subsQuery;
      const subIds = (subs ?? []).map((s: any) => s.id);
      if (subIds.length === 0) {
        setDeals([]);
        setLoading(false);
        return;
      }

      const [{ data: interviews }, { data: offers }] = await Promise.all([
        supabase.from("interviews").select("submission_id, status").in("submission_id", subIds),
        supabase.from("offers").select("id, submission_id, status").in("submission_id", subIds),
      ]);
      const offerIds = (offers ?? []).map((o: any) => o.id);
      const { data: contracts } = offerIds.length
        ? await supabase.from("contracts").select("id, offer_id, status").in("offer_id", offerIds)
        : { data: [] as any[] };

      // Fetch counterparty names
      const otherIds = Array.from(
        new Set((subs ?? []).map((s: any) => (isFounder ? s.builder_id : s.projects.founder_id)))
      );
      const [{ data: builders }, { data: profiles }] = await Promise.all([
        isFounder && otherIds.length
          ? supabase.from("builder_profiles").select("id, full_name").in("id", otherIds)
          : Promise.resolve({ data: [] as any[] }),
        !isFounder && otherIds.length
          ? supabase.from("startup_profiles").select("id, company_name").in("id", otherIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const rows: DealRow[] = (subs ?? []).map((s: any) => {
        const iv = (interviews ?? []).find((i: any) => i.submission_id === s.id);
        const of = (offers ?? []).find((o: any) => o.submission_id === s.id);
        const ct = of ? (contracts ?? []).find((c: any) => c.offer_id === of.id) : null;
        const cpId = isFounder ? s.builder_id : s.projects.founder_id;
        const cpName = isFounder
          ? (builders ?? []).find((b: any) => b.id === cpId)?.full_name ?? "Builder"
          : (profiles ?? []).find((p: any) => p.id === cpId)?.company_name ?? "Founder";
        return {
          submission_id: s.id,
          submission_title: s.title,
          submission_status: s.status,
          project_title: s.projects.title,
          counterparty: cpName,
          stage: deriveStage(s, iv, of, ct),
          updated_at: s.updated_at,
          ai_score: s.ai_score,
        };
      });
      setDeals(rows);
      setLoading(false);
    })();
  }, [user, role]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Handshake className="h-6 w-6" /> Deals
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every engagement in one place — submission through payment.
        </p>
      </div>

      {deals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No deals yet. {role === "startup" ? "Post a project and invite builders from the Agent." : "Browse projects and submit your work to get started."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {deals.map((d) => (
            <Link key={d.submission_id} to={`/deals/${d.submission_id}`}>
              <Card className="hover:border-primary/40 hover:shadow-md transition">
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{d.submission_title}</span>
                      <Badge variant="secondary" className="text-xs">{d.stage}</Badge>
                      {d.ai_score != null && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono text-xs">
                          {d.ai_score}/100
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {d.project_title} · {d.counterparty}
                    </div>
                  </div>
                  <StageRail current={d.stage} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StageRail({ current }: { current: string }) {
  const idx = STAGE_ORDER.indexOf(current);
  return (
    <div className="hidden md:flex items-center gap-1">
      {STAGE_ORDER.map((s, i) => (
        <div
          key={s}
          className={`h-1.5 w-6 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`}
          title={s}
        />
      ))}
    </div>
  );
}
