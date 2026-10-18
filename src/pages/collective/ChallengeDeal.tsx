import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, Trophy, XCircle, ExternalLink } from "lucide-react";
import { fetchProfileNames } from "@/lib/collective";

export const CHALLENGE_STEPS = ["Apply", "Approved", "Build", "Submit", "Reviewed", "Winner"] as const;

/** Index of the last completed step for an application status. */
export function stepIndexForStatus(status: string | null | undefined): number {
  switch (status) {
    case "pending": return 0;
    case "approved": return 2; // approved → now building
    case "submitted": return 3;
    case "reviewed": return 4;
    case "winner": return 5;
    default: return -1;
  }
}

function Timeline({ status }: { status?: string | null }) {
  const idx = stepIndexForStatus(status);
  return (
    <ol className="flex flex-wrap gap-2">
      {CHALLENGE_STEPS.map((s, i) => {
        const done = i < idx || (i === idx && status === "winner");
        const active = i === idx && status !== "winner";
        return (
          <li key={s} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
            done ? "bg-primary text-primary-foreground border-primary" :
            active ? "border-primary text-primary bg-primary/10" : "text-muted-foreground"}`}>
            {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            {s}
          </li>
        );
      })}
    </ol>
  );
}

const db = supabase as any;

export default function ChallengeDeal() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<any>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, { name: string }>>({});
  const [count, setCount] = useState(0);
  const [pitch, setPitch] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [buildUrl, setBuildUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: c } = await db.from("community_challenges").select("*").eq("id", id).maybeSingle();
    setChallenge(c);
    const { data: a } = await db.from("challenge_applications").select("*").eq("challenge_id", id).order("created_at");
    setApps(a ?? []);
    setNames(await fetchProfileNames([...new Set((a ?? []).map((x: any) => x.builder_id))] as string[]));
    const { data: n } = await db.rpc("challenge_application_count", { _challenge: id });
    setCount(n ?? 0);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!challenge) return <div className="text-sm text-muted-foreground">Challenge not found.</div>;

  const isCreator = challenge.created_by === user?.id;
  const mine = apps.find((a) => a.builder_id === user?.id);

  const apply = async () => {
    if (!pitch.trim()) return;
    setBusy(true);
    const { error } = await db.from("challenge_applications").insert({
      challenge_id: challenge.id, builder_id: user!.id, pitch: pitch.trim(), portfolio_url: portfolio.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Application sent");
    load();
  };

  const submitBuild = async () => {
    if (!buildUrl.trim()) return;
    setBusy(true);
    const { error } = await db.from("challenge_applications")
      .update({ status: "submitted", submission_url: buildUrl.trim() }).eq("id", mine.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Build submitted");
    load();
  };

  const setStatus = async (appId: string, status: string) => {
    const { error } = await db.from("challenge_applications").update({ status }).eq("id", appId);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    load();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link to="/collective" className="text-xs text-muted-foreground hover:text-foreground">← Collective</Link>
        <h1 className="text-2xl font-semibold mt-1">{challenge.title}</h1>
        {challenge.description && <p className="text-sm text-muted-foreground mt-1">{challenge.description}</p>}
        <p className="text-xs text-muted-foreground mt-2">
          {new Date(challenge.start_date).toLocaleDateString()} – {new Date(challenge.end_date).toLocaleDateString()} · {count} {count === 1 ? "applicant" : "applicants"}
        </p>
      </div>

      {!isCreator && role === "builder" && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Your progress</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Timeline status={mine?.status} />
            {!mine && (
              <div className="space-y-2">
                <Textarea placeholder="Short pitch: why you want to build this" rows={3} value={pitch} onChange={(e) => setPitch(e.target.value)} />
                <Input placeholder="Portfolio or GitHub link" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} />
                <Button disabled={busy || !pitch.trim()} onClick={apply}>Apply</Button>
              </div>
            )}
            {mine?.status === "pending" && <p className="text-sm text-muted-foreground">Waiting for the challenge creator to approve you.</p>}
            {mine?.status === "rejected" && <p className="text-sm text-destructive">Your application wasn't approved this time.</p>}
            {mine?.status === "approved" && (
              <div className="space-y-2">
                <p className="text-sm">You're approved — start building, then submit your link.</p>
                <Input placeholder="Repo or demo link" value={buildUrl} onChange={(e) => setBuildUrl(e.target.value)} />
                <Button disabled={busy || !buildUrl.trim()} onClick={submitBuild}>Submit build</Button>
              </div>
            )}
            {mine?.status === "submitted" && <p className="text-sm text-muted-foreground">Submitted. Awaiting review.</p>}
            {mine?.status === "reviewed" && <p className="text-sm text-muted-foreground">Reviewed. Winner announcement pending.</p>}
            {mine?.status === "winner" && <p className="text-sm font-medium flex items-center gap-1"><Trophy className="h-4 w-4" /> You won this challenge!</p>}
          </CardContent>
        </Card>
      )}

      {isCreator && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Applications ({apps.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {apps.length === 0 && <p className="text-sm text-muted-foreground">No applications yet.</p>}
            {apps.map((a) => (
              <div key={a.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{names[a.builder_id]?.name ?? "Builder"}</span>
                  <Badge variant="outline">{a.status}</Badge>
                </div>
                <p className="text-sm">{a.pitch}</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  {a.portfolio_url && <a href={a.portfolio_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">Portfolio <ExternalLink className="h-3 w-3" /></a>}
                  {a.submission_url && <a href={a.submission_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">Build <ExternalLink className="h-3 w-3" /></a>}
                </div>
                <Timeline status={a.status} />
                <div className="flex flex-wrap gap-2">
                  {a.status === "pending" && (<>
                    <Button size="sm" onClick={() => setStatus(a.id, "approved")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "rejected")}><XCircle className="h-3.5 w-3.5 mr-1" />Reject</Button>
                  </>)}
                  {a.status === "submitted" && <Button size="sm" onClick={() => setStatus(a.id, "reviewed")}>Mark reviewed</Button>}
                  {a.status === "reviewed" && <Button size="sm" onClick={() => setStatus(a.id, "winner")}><Trophy className="h-3.5 w-3.5 mr-1" />Pick as winner</Button>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
