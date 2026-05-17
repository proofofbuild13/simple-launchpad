import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Loader2 } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  submitted: "bg-muted text-foreground",
  under_review: "bg-blue-500/15 text-blue-600",
  shortlisted: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-destructive/15 text-destructive",
  winner: "bg-yellow-500/15 text-yellow-600",
};

export default function Leaderboard() {
  const { id } = useParams();
  const [rows, setRows] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <p className="text-xs text-muted-foreground">Leaderboard</p>
        <h1 className="text-2xl font-semibold">{project?.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{rows.length} submissions · sorted by score</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-500" />Submissions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Builder</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell className="text-sm">{r.profiles?.full_name ?? "Builder"}</TableCell>
                  <TableCell className="text-sm">{r.title}</TableCell>
                  <TableCell className="font-mono text-sm">{r.score ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLOR[r.status] ?? ""} variant="outline">{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={`/submissions/${r.id}`}><Button size="sm" variant="outline">Review</Button></Link>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No submissions yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
