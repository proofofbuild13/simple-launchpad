import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ExternalLink, Calendar, HandCoins, Briefcase } from "lucide-react";
import { isHireToBuild } from "@/lib/engagement";
import { toast } from "sonner";
import { StarRating } from "@/components/workflow/StarRating";
import { WorkflowStatusTracker } from "@/components/workflow/WorkflowStatusTracker";

const CRITERIA = [
  { key: "problem_fit", label: "Problem fit" },
  { key: "execution", label: "Execution quality" },
  { key: "ux", label: "UX" },
  { key: "feasibility", label: "Feasibility" },
  { key: "innovation", label: "Innovation" },
] as const;

type ScoreState = Record<string, number>;

export default function SubmissionReview() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sub, setSub] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<ScoreState>({});
  const [notes, setNotes] = useState("");

  const load = async () => {
    if (!id || !user) return;
    const { data } = await supabase.from("submissions").select("*, projects(*)").eq("id", id).maybeSingle();
    setSub(data);
    setProject(data?.projects);
    const { data: r } = await supabase
      .from("submission_reviews")
      .select("*")
      .eq("submission_id", id)
      .eq("reviewer_id", user.id)
      .maybeSingle();
    if (r) {
      setReview(r);
      const s: ScoreState = {};
      CRITERIA.forEach((c) => { s[c.key] = (r as any)[c.key] ?? 0; });
      setScores(s);
      setNotes(r.notes ?? "");
    }
    // mark as under_review on first founder open
    if (data?.status === "submitted" && data.projects?.founder_id === user.id) {
      await supabase.from("submissions").update({ status: "under_review" }).eq("id", id);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [id, user]);

  const setScore = (k: string, v: number) => setScores((s) => ({ ...s, [k]: v }));

  const totalScore = () => {
    const vals = CRITERIA.map((c) => scores[c.key] ?? 0);
    if (vals.every((v) => v === 0)) return null;
    return Number(((vals.reduce((a, b) => a + b, 0) / 25) * 100).toFixed(1));
  };

  const saveReview = async (decision: string) => {
    if (!user || !id) return;
    const score = totalScore();
    const payload = {
      submission_id: id,
      reviewer_id: user.id,
      ...Object.fromEntries(CRITERIA.map((c) => [c.key, scores[c.key] || null])),
      score,
      notes,
      decision,
      decided_at: decision !== "pending" ? new Date().toISOString() : null,
    };
    if (review) {
      await supabase.from("submission_reviews").update(payload).eq("id", review.id);
    } else {
      await supabase.from("submission_reviews").insert(payload);
    }
    if (decision === "shortlisted") {
      await supabase.from("submissions").update({ status: "shortlisted", score }).eq("id", id);
      toast.success("Builder shortlisted");
    } else if (decision === "rejected") {
      await supabase.from("submissions").update({ status: "rejected", score }).eq("id", id);
      toast.success("Submission rejected");
    } else {
      await supabase.from("submissions").update({ score }).eq("id", id);
      toast.success("Review saved");
    }
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!sub) return <p className="py-20 text-center text-muted-foreground">Not found.</p>;

  const isFounder = user?.id === project?.founder_id;
  const isBuilder = user?.id === sub.builder_id;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link to={`/projects/${project?.id}/leaderboard`} className="text-xs text-muted-foreground hover:text-foreground">
              ← Back to leaderboard
            </Link>
            <h1 className="text-2xl font-semibold mt-1">{sub.title}</h1>
            <p className="text-sm text-muted-foreground">For project: {project?.title}</p>
          </div>
          <Badge className="capitalize">{sub.status}</Badge>
        </div>
        <Card><CardContent className="pt-6"><WorkflowStatusTracker submissionId={sub.id} /></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">{sub.description || "—"}</CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Proof of work</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2 text-sm">
              {[["Demo", sub.demo_url], ["Live URL", sub.live_url], ["GitHub", sub.github_url], ["Video", sub.video_url]].map(([l, u]) =>
                u ? (
                  <a key={l} href={u as string} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/40 transition-colors">
                    <span className="font-medium">{l}</span><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                ) : null
              )}
            </CardContent>
          </Card>

          {sub.tech_stack?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Tech stack</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {sub.tech_stack.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}
              </CardContent>
            </Card>
          )}

          {isFounder && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3">
                  <span className="text-sm font-medium mr-auto">Review actions</span>
                  <Button variant="ghost" onClick={() => saveReview("rejected")}>Reject</Button>
                  <Button variant="outline" onClick={() => saveReview("pending")}>Save review</Button>
                  <Button onClick={() => saveReview("shortlisted")}>Shortlist builder</Button>
                </CardContent>
              </Card>

              {sub.status === "shortlisted" && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3">
                    <span className="text-sm font-medium mr-auto text-primary">Next steps</span>
                    <Button variant="outline" className="bg-background" onClick={() => navigate(`/interviews/new?submission=${sub.id}`)}>
                      <Calendar className="h-4 w-4 mr-2" />Schedule interview
                    </Button>
                    {isHireToBuild(project) ? (
                      <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate(`/job-offers/new?submission=${sub.id}`)}>
                        <Briefcase className="h-4 w-4 mr-2" />Make job offer
                      </Button>
                    ) : (
                      <Button onClick={() => navigate(`/offers/new?submission=${sub.id}`)}>
                        <HandCoins className="h-4 w-4 mr-2" />Send offer
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {isFounder ? (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Score submission</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {CRITERIA.map((c) => (
                    <div key={c.key} className="flex items-center justify-between">
                      <span className="text-sm">{c.label}</span>
                      <StarRating value={scores[c.key] ?? 0} onChange={(v) => setScore(c.key, v)} />
                    </div>
                  ))}
                  <div className="pt-3 border-t flex items-center justify-between">
                    <span className="text-sm font-medium">Total</span>
                    <span className="text-lg font-semibold">{totalScore() ?? "—"}<span className="text-xs text-muted-foreground">/100</span></span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Private notes</CardTitle></CardHeader>
                <CardContent>
                  <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes only you can see…" />
                </CardContent>
              </Card>
            </>
          ) : isBuilder ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Review status</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge>{sub.status}</Badge></div>
                {sub.score != null && <div className="flex justify-between"><span className="text-muted-foreground">Score</span><span className="font-mono">{sub.score}/100</span></div>}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
