import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, FileCheck2, Users, FileSignature, PlusCircle } from "lucide-react";

interface Stats { projects: number; submissions: number; contracts: number; }

export default function StartupDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ projects: 0, submissions: 0, contracts: 0 });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [recentSubs, setRecentSubs] = useState<any[]>([]);
  const [shortlisted, setShortlisted] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: projects, count: pc }, { count: sc }, { count: cc }, { count: shortlistedCount }] = await Promise.all([
        supabase.from("projects").select("*", { count: "exact" }).eq("founder_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("submissions").select("*, projects!inner(founder_id)", { count: "exact", head: true }).eq("projects.founder_id", user.id),
        supabase.from("contracts").select("*", { count: "exact", head: true }).eq("founder_id", user.id).in("status", ["contract_drafted", "active"]),
        supabase.from("submissions").select("*, projects!inner(founder_id)", { count: "exact", head: true }).eq("projects.founder_id", user.id).eq("status", "shortlisted"),
      ]);
      setStats({ projects: pc ?? 0, submissions: sc ?? 0, contracts: cc ?? 0 });
      setShortlisted(shortlistedCount ?? 0);
      setRecentProjects(projects ?? []);
      const { data: subs } = await supabase
        .from("submissions").select("*, projects!inner(title, founder_id)")
        .eq("projects.founder_id", user.id).order("created_at", { ascending: false }).limit(5);
      setRecentSubs(subs ?? []);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Founder dashboard</h1>
          <p className="text-sm text-muted-foreground">Validate ideas. Hire on proof-of-work.</p>
        </div>
        <Link to="/projects/new"><Button><PlusCircle className="h-4 w-4 mr-2" />Post a project</Button></Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={FolderKanban} label="Active projects" value={stats.projects} />
        <StatCard icon={FileCheck2} label="Total submissions" value={stats.submissions} />
        <StatCard icon={Users} label="Shortlisted" value={shortlisted} />
        <StatCard icon={FileSignature} label="Active contracts" value={stats.contracts} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent projects</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentProjects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet. <Link to="/projects/new" className="text-primary">Post one</Link>.</p>}
            {recentProjects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="block p-3 rounded-md border hover:bg-muted/40">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{p.title}</div>
                  <Badge variant="secondary">{p.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{p.category} · {p.budget ? `$${p.budget}` : "Budget TBD"}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recent submissions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentSubs.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
            {recentSubs.map((s: any) => (
              <Link key={s.id} to={`/submissions/${s.id}`} className="block p-3 rounded-md border hover:bg-muted/40">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{s.title}</div>
                  <Badge variant="outline">{s.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">on {s.projects?.title}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
          </div>
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}
