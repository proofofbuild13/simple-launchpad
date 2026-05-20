import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, Briefcase, MapPin } from "lucide-react";
import { engagementBadgeClass, engagementLabel, formatCtcRange, isHireToBuild } from "@/lib/engagement";

export default function PublicProject() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      setProject(p);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!project) return <p className="text-center text-muted-foreground py-20">Project not found or is private.</p>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-10 px-4">


      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="outline" className={engagementBadgeClass(project.engagement_type)}>
              {isHireToBuild(project) && <Briefcase className="h-3 w-3 mr-1" />}
              {engagementLabel(project.engagement_type)}
            </Badge>
            {project.category && <Badge variant="outline" className="bg-background border-border">{project.category}</Badge>}
            {isHireToBuild(project) && project.location_type && (
              <Badge variant="outline"><MapPin className="h-3 w-3 mr-1" />{project.location_type}</Badge>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{project.title}</h1>
          <p className="text-base text-muted-foreground mt-2 text-balance leading-relaxed">{project.short_description}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {isHireToBuild(project) ? (
              <div className="text-lg font-semibold bg-emerald-500/10 text-emerald-700 px-3 py-1 rounded-full">{formatCtcRange(project)}</div>
            ) : (
              project.budget && <div className="text-lg font-semibold bg-primary/5 text-primary px-3 py-1 rounded-full">${project.budget}</div>
            )}
            <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">{project.status}</Badge>
          </div>
          <Link to="/register" className="mt-2 sm:mt-0">
            <Button className="shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all duration-300">
              Apply
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-xs text-muted-foreground">Timeline</CardTitle></CardHeader><CardContent className="font-medium">{project.timeline || "—"}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-xs text-muted-foreground">Difficulty</CardTitle></CardHeader><CardContent className="font-medium capitalize">{project.difficulty || "—"}</CardContent></Card>
      </div>

      <Section title="Problem statement">{project.description}</Section>
      <Section title="Requirements">{project.requirements}</Section>
      <Section title="Deliverables">{project.deliverables}</Section>

      {/* Banner CTA for unauthenticated users */}
      <Card className="mt-12 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-primary/20 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 opacity-10 mix-blend-overlay"></div>
        <CardContent className="flex flex-col sm:flex-row items-center justify-between py-8 gap-6 relative z-10">
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Join proof_of_build to innovate future</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-lg leading-relaxed">
              Create an account find business problem make an idea, submit and get hired by founders, make an solution and solve it. Earn and Enjoy
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto shrink-0">
            <Link to="/login" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full hover:bg-background/80 backdrop-blur-sm transition-all duration-300">
                Log in
              </Button>
            </Link>
            <Link to="/register" className="w-full sm:w-auto">
              <Button className="w-full shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all duration-300">
                Sign up <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
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
