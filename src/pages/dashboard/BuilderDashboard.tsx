import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, FileSignature, DollarSign, Search } from "lucide-react";

export default function BuilderDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ submissions: 0, contracts: 0 });
  const [recommended, setRecommended] = useState<any[]>([]);
  const [mySubs, setMySubs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: subC }, { count: cc }, { data: rec }, { data: subs }] = await Promise.all([
        supabase.from("submissions").select("*", { count: "exact", head: true }).eq("builder_id", user.id),
        supabase.from("contracts").select("*", { count: "exact", head: true }).eq("builder_id", user.id).in("status", ["contract_drafted", "active"]),
        supabase.from("projects").select("*").eq("status", "open").eq("visibility", "public").order("created_at", { ascending: false }).limit(5),
        supabase.from("submissions").select("*, projects(title)").eq("builder_id", user.id).order("created_at", { ascending: false }).limit(5),
      ]);
      setStats({ submissions: subC ?? 0, contracts: cc ?? 0 });
      setRecommended(rec ?? []);
      setMySubs(subs ?? []);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Builder dashboard</h1>
          <p className="text-sm text-muted-foreground">Ship working solutions. Win contracts.</p>
        </div>
        <Link to="/browse"><Button><Search className="h-4 w-4 mr-2" />Find projects</Button></Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Send} label="My submissions" value={stats.submissions} href="/submissions" />
        <StatCard icon={FileSignature} label="Active contracts" value={stats.contracts} href="/contracts" />
        <StatCard icon={DollarSign} label="Earnings" value={0} prefix="$" href="/payments/builder" />
        <StatCard icon={Search} label="Open projects" value={recommended.length} href="/browse" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recommended projects</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recommended.length === 0 && <p className="text-sm text-muted-foreground">Nothing live yet — check back soon.</p>}
            {recommended.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="block p-3 rounded-md border hover:bg-muted/40">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{p.title}</div>
                  {p.budget && <Badge variant="secondary">${p.budget}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.short_description}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">My recent submissions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {mySubs.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
            {mySubs.map((s: any) => (
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

function StatCard({ icon: Icon, label, value, href, prefix = "" }: { icon: any; label: string; value: number; href: string; prefix?: string }) {
  const navigate = useNavigate();
  return (
    <Card
      className="cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-95"
      onClick={() => navigate(href)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(href)}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold mt-1">{prefix}{value}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
