import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Building2, CheckCircle2 } from "lucide-react";

export default function ProjectDetail() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      setProject(p);
      const { data: subs } = await supabase.from("submissions").select("*").eq("project_id", id).order("created_at", { ascending: false });
      setSubmissions(subs ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!project) return <p className="text-center text-muted-foreground py-20">Project not found.</p>;

  const isFounder = user?.id === project.founder_id;
  const mySubmission = submissions.find((s) => s.builder_id === user?.id);
  const deadlinePassed = project.deadline && new Date(project.deadline) < new Date();
  const closed = project.hire_locked || deadlinePassed || project.status === "closed" || project.status === "completed";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex-1">
          <Badge variant="outline" className="mb-2 bg-background border-border">{project.category}</Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{project.title}</h1>
          <p className="text-base text-muted-foreground mt-2 text-balance leading-relaxed">{project.short_description}</p>
          <div className="mt-4">
            <Link to={`/startups/${project.founder_id}`}>
              <Button variant="outline" size="sm" className="rounded-full shadow-sm hover:bg-secondary/80 transition-colors">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground mr-2" />
                View Startup Profile
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {project.budget && <div className="text-lg font-semibold bg-primary/5 text-primary px-3 py-1 rounded-full">${project.budget}</div>}
            <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">{project.status}</Badge>
          </div>
          
          {role === "builder" && !isFounder && (
            <div className="mt-2 w-full sm:w-auto">
              {!closed ? (
                <Link to={`/projects/${project.id}/submit`} className="w-full">
                  <Button size="lg" className="w-full sm:w-auto shadow-md hover:shadow-lg transition-shadow">
                    <Send className="h-4 w-4 mr-2" />
                    {mySubmission ? "Submit another solution" : "Submit your solution"}
                  </Button>
                </Link>
              ) : (
                <Badge variant="outline" className="px-3 py-1 text-xs bg-muted/50 text-muted-foreground border-dashed">Submissions Closed</Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {role === "builder" && !isFounder && mySubmission && (
        <Card className="border-primary/30 bg-primary/5 shadow-sm">
          <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">You have already submitted a solution for this project.</span>
            </div>
            <Link to={`/submissions/${mySubmission.id}`}>
              <Button size="sm" variant="outline" className="bg-background">View your submission</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-xs text-muted-foreground">Timeline</CardTitle></CardHeader><CardContent className="font-medium">{project.timeline || "—"}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-xs text-muted-foreground">Difficulty</CardTitle></CardHeader><CardContent className="font-medium capitalize">{project.difficulty || "—"}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-xs text-muted-foreground">Submissions</CardTitle></CardHeader><CardContent className="font-medium">{submissions.length}</CardContent></Card>
      </div>

      <Section title="Problem statement">{project.description}</Section>
      <Section title="Requirements">{project.requirements}</Section>
      <Section title="Deliverables">{project.deliverables}</Section>



      {isFounder && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Submissions ({submissions.length})</CardTitle>
            <Link to={`/projects/${project.id}/leaderboard`}>
              <Button size="sm" variant="outline">View leaderboard</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {submissions.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
            {submissions.map((s) => (
              <Link key={s.id} to={`/submissions/${s.id}`} className="block p-3 rounded-md border hover:bg-muted/40">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{s.title}</div>
                  <Badge variant="outline">{s.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{s.description}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  if (!children) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="text-sm whitespace-pre-wrap text-foreground/80">{children}</CardContent>
    </Card>
  );
}
