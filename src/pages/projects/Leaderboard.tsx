import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Loader2, Medal, Award, ArrowLeft } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type RangeKey = "day" | "week" | "all";
const RANGE_LABEL: Record<RangeKey, string> = { day: "Today", week: "This week", all: "All time" };

const STATUS_COLOR: Record<string, string> = {
  submitted: "bg-muted text-foreground",
  under_review: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  shortlisted: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  winner: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
};

const rankBadge = (i: number) => {
  if (i === 0) return { icon: Trophy, cls: "text-yellow-500 bg-yellow-500/10 ring-yellow-500/30" };
  if (i === 1) return { icon: Medal, cls: "text-slate-400 bg-slate-400/10 ring-slate-400/30" };
  if (i === 2) return { icon: Award, cls: "text-amber-700 bg-amber-700/10 ring-amber-700/30" };
  return null;
};

const initials = (name?: string) =>
  (name ?? "B").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

export default function Leaderboard() {
  const { id } = useParams();
  const [rows, setRows] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("all");

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      setProject(p);
      const { data } = await supabase
        .from("submissions")
        .select("*, profiles:builder_id(full_name, avatar_url)")
        .eq("project_id", id)
        .order("score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: true });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filteredRows = useMemo(() => {
    if (range === "all") return rows;
    const cutoff = Date.now() - (range === "day" ? 1 : 7) * 24 * 60 * 60 * 1000;
    return rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  }, [rows, range]);

  const scored = filteredRows.filter((r) => r.score != null);
  const avgScore = scored.length
    ? (scored.reduce((s, r) => s + Number(r.score), 0) / scored.length).toFixed(1)
    : "—";
  const topScore = scored.length ? Math.max(...scored.map((r) => Number(r.score))) : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Link
            to={`/projects/${id}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to project
          </Link>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Leaderboard</p>
          <h1 className="text-2xl md:text-3xl font-semibold">{project?.title}</h1>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center min-w-[280px]">
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entries</p>
            <p className="text-lg font-semibold">{filteredRows.length}</p>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Top score</p>
            <p className="text-lg font-semibold font-mono">{topScore ?? "—"}</p>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg</p>
            <p className="text-lg font-semibold font-mono">{avgScore}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Submissions
            <span className="text-xs font-normal text-muted-foreground">· {RANGE_LABEL[range]}</span>
          </CardTitle>
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(v) => v && setRange(v as RangeKey)}
            size="sm"
            variant="outline"
          >
            <ToggleGroupItem value="day" className="text-xs h-8 px-3">Daily</ToggleGroupItem>
            <ToggleGroupItem value="week" className="text-xs h-8 px-3">Weekly</ToggleGroupItem>
            <ToggleGroupItem value="all" className="text-xs h-8 px-3">All time</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16 text-center">Rank</TableHead>
                <TableHead>Builder</TableHead>
                <TableHead>Submission</TableHead>
                <TableHead className="w-24 text-right">Score</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-28 text-right pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const badge = rankBadge(i);
                const Icon = badge?.icon;
                return (
                  <TableRow key={r.id} className={i < 3 ? "bg-muted/20" : ""}>
                    <TableCell className="text-center">
                      {badge && Icon ? (
                        <div
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ${badge.cls}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">{i + 1}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={r.profiles?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {initials(r.profiles?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">
                          {r.profiles?.full_name ?? "Builder"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {r.title}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {r.score ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${STATUS_COLOR[r.status] ?? ""} text-[10px] capitalize`}
                      >
                        {(r.status ?? "").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Link to={`/submissions/${r.id}`}>
                        <Button size="sm" variant="outline">Review</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                    No submissions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
