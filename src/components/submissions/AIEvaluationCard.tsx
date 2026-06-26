import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { runAIEvaluation } from "@/lib/aiEvaluation";

interface Evaluation {
  id: string;
  submission_id: string;
  score_problem_fit: number | null;
  score_execution: number | null;
  score_ux: number | null;
  score_feasibility: number | null;
  score_innovation: number | null;
  total_score: number | null;
  summary_verdict: string | null;
  strengths: string[] | null;
  gaps: string[] | null;
  recommendation: "fundable" | "iterate" | "pass" | null;
  startup_grade: "A" | "B" | "C" | "D" | "F" | null;
  model_used: string | null;
  prompt_version: number | null;
  evaluated_at: string | null;
  error: string | null;
}

const CRITERIA: Array<{ key: keyof Evaluation; label: string }> = [
  { key: "score_problem_fit", label: "Market & demand" },
  { key: "score_execution", label: "Business model" },
  { key: "score_ux", label: "Moat & differentiation" },
  { key: "score_feasibility", label: "GTM & traction" },
  { key: "score_innovation", label: "Investability" },
];

function RecommendationBadge({ rec }: { rec: Evaluation["recommendation"] }) {
  if (rec === "fundable") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20">
        <ThumbsUp className="h-3 w-3 mr-1" /> Fundable
      </Badge>
    );
  }
  if (rec === "pass") {
    return (
      <Badge className="bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/20">
        <ThumbsDown className="h-3 w-3 mr-1" /> Pass
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20">
      <HelpCircle className="h-3 w-3 mr-1" /> Iterate
    </Badge>
  );
}

function GradeBadge({ grade }: { grade: Evaluation["startup_grade"] }) {
  if (!grade) return null;
  const tone =
    grade === "A"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : grade === "B"
      ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
      : grade === "C"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
      : grade === "D"
      ? "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30"
      : "bg-destructive/15 text-destructive border-destructive/30";
  return (
    <Badge variant="outline" className={`${tone} font-mono text-base px-2.5`}>
      {grade}
    </Badge>
  );
}

interface Props {
  submissionId: string;
  canRun?: boolean;
}

export function AIEvaluationCard({ submissionId, canRun = false }: Props) {
  const [evalData, setEvalData] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("ai_submission_evaluations")
      .select("*")
      .eq("submission_id", submissionId)
      .maybeSingle();
    setEvalData(data as Evaluation | null);
    setLoading(false);
  }, [submissionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`ai-eval-${submissionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_submission_evaluations",
          filter: `submission_id=eq.${submissionId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [submissionId, load]);

  const run = async () => {
    setRunning(true);
    try {
      await runAIEvaluation(submissionId);
      toast.success("AI evaluation started");
      // realtime listener will pick up the new row; also poll once after a delay
      setTimeout(load, 1500);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to run AI evaluation");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading AI evaluation…
        </CardContent>
      </Card>
    );
  }

  if (!evalData) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 flex flex-col sm:flex-row items-center gap-3 justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            No AI evaluation yet for this submission.
          </div>
          {canRun && (
            <Button size="sm" onClick={run} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Run AI evaluation
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (evalData.error) {
    return (
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> AI evaluation failed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{evalData.error}</p>
          {canRun && (
            <Button size="sm" variant="outline" onClick={run} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const total = evalData.total_score ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI evaluation
          </CardTitle>
          <div className="flex items-center gap-2">
            <RecommendationBadge rec={evalData.recommendation} />
            <Badge variant="outline" className="font-mono">
              {total}<span className="text-muted-foreground">/100</span>
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {evalData.summary_verdict && (
          <p className="text-sm leading-relaxed">{evalData.summary_verdict}</p>
        )}

        <div className="space-y-2.5">
          {CRITERIA.map((c) => {
            const v = (evalData[c.key] as number | null) ?? 0;
            return (
              <div key={c.key as string} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-mono">{v}<span className="text-muted-foreground">/20</span></span>
                </div>
                <Progress value={(v / 20) * 100} className="h-1.5" />
              </div>
            );
          })}
        </div>

        {(evalData.strengths?.length || evalData.gaps?.length) ? (
          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            {evalData.strengths && evalData.strengths.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Strengths</p>
                <ul className="space-y-1.5">
                  {evalData.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {evalData.gaps && evalData.gaps.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Gaps</p>
                <ul className="space-y-1.5">
                  {evalData.gaps.map((g, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground">
          <span>
            {evalData.model_used} · v{evalData.prompt_version}
            {evalData.evaluated_at && ` · ${new Date(evalData.evaluated_at).toLocaleString()}`}
          </span>
          {canRun && (
            <Button size="sm" variant="ghost" onClick={run} disabled={running}>
              {running ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
              Re-run
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
