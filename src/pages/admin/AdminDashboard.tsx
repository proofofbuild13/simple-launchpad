import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Briefcase, FileSignature, Wallet, AlertTriangle, TrendingUp,
  Activity, Shield, Clock, CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fmtUSD } from "@/lib/currency";

export default function AdminDashboard() {
  const [kpis, setKpis] = useState<any>({});
  const [feed, setFeed] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any>({ overdue: 0, openDisputes: 0, flagged: 0 });

  const load = async () => {
    const counts = async (table: string, filter?: any) => {
      let q: any = supabase.from(table as any).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count } = await q;
      return count ?? 0;
    };

    const [
      users, startups, builders, projects, activeContracts,
      openDisputes, overdueInv, pendingInv, flagged
    ] = await Promise.all([
      counts("profiles"),
      counts("user_roles", (q: any) => q.eq("role", "startup")),
      counts("user_roles", (q: any) => q.eq("role", "builder")),
      counts("projects"),
      counts("contracts", (q: any) => q.in("status", ["contract_drafted", "active", "in_progress"])),
      counts("disputes", (q: any) => q.eq("status", "open")),
      counts("commission_invoices", (q: any) => q.lt("due_date", new Date().toISOString().slice(0,10)).neq("status","paid")),
      counts("commission_invoices", (q: any) => q.eq("status", "generated")),
      counts("user_status", (q: any) => q.in("status", ["flagged","suspended","banned","under_review"])),
    ]);

    const { data: gmvRows } = await supabase
      .from("payment_records").select("declared_amount, declared_at").gte("declared_at", new Date(Date.now()-30*864e5).toISOString());
    const gmv = (gmvRows ?? []).reduce((s, r: any) => s + Number(r.declared_amount || 0), 0);

    const { data: revRows } = await supabase
      .from("commission_invoices").select("commission_amount, status").eq("status","paid");
    const revenue = (revRows ?? []).reduce((s, r: any) => s + Number(r.commission_amount || 0), 0);

    const { data: pendRows } = await supabase
      .from("commission_invoices").select("commission_amount").neq("status","paid");
    const pending = (pendRows ?? []).reduce((s, r: any) => s + Number(r.commission_amount || 0), 0);

    setKpis({
      users, startups, builders, projects, activeContracts,
      openDisputes, gmv, revenue, pending,
    });
    setAlerts({ overdue: overdueInv, openDisputes, flagged });

    const { data: logs } = await supabase
      .from("admin_audit_logs").select("*").order("created_at",{ascending:false}).limit(25);
    setFeed(logs ?? []);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const kpiCards = [
    { label: "Total users", value: kpis.users, icon: Users },
    { label: "Active startups", value: kpis.startups, icon: Briefcase },
    { label: "Active builders", value: kpis.builders, icon: Users },
    { label: "Total projects", value: kpis.projects, icon: Briefcase },
    { label: "Active contracts", value: kpis.activeContracts, icon: FileSignature },
    { label: "Monthly GMV (30d)", value: fmtUSD(kpis.gmv ?? 0), icon: TrendingUp },
    { label: "Platform revenue", value: fmtUSD(kpis.revenue ?? 0), icon: Wallet },
    { label: "Pending platform fees", value: fmtUSD(kpis.pending ?? 0), icon: Clock },
    { label: "Open disputes", value: kpis.openDisputes, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Admin Control Panel
          </h1>
          <p className="text-sm text-muted-foreground">Platform monitoring · {new Date().toLocaleString()}</p>
        </div>
        <Badge variant="outline" className="gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-3">
        {kpiCards.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-xl font-semibold mt-1">{k.value ?? "—"}</p>
              </div>
              <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                <k.icon className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Live activity feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {feed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto">
                {feed.map((f) => (
                  <div key={f.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 text-sm">
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{f.action_type}</span>
                        {f.entity_type && <Badge variant="outline" className="text-[10px]">{f.entity_type}</Badge>}
                        {f.actor_role && <Badge variant="secondary" className="text-[10px]">{f.actor_role}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(f.created_at))} ago
                        {f.entity_id && <span className="font-mono"> · {String(f.entity_id).slice(0, 8)}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/admin/disputes" className="block p-3 rounded-md border hover:bg-muted/50">
              <div className="flex justify-between items-center">
                <span className="text-sm">Open disputes</span>
                <Badge variant={alerts.openDisputes > 0 ? "destructive" : "outline"}>{alerts.openDisputes}</Badge>
              </div>
            </Link>
            <Link to="/admin/commissions" className="block p-3 rounded-md border hover:bg-muted/50">
              <div className="flex justify-between items-center">
                <span className="text-sm">Overdue platform fees</span>
                <Badge variant={alerts.overdue > 0 ? "destructive" : "outline"}>{alerts.overdue}</Badge>
              </div>
            </Link>
            <Link to="/admin/users" className="block p-3 rounded-md border hover:bg-muted/50">
              <div className="flex justify-between items-center">
                <span className="text-sm">Flagged accounts</span>
                <Badge variant={alerts.flagged > 0 ? "destructive" : "outline"}>{alerts.flagged}</Badge>
              </div>
            </Link>
            <Link to="/admin/audit-logs" className="block p-3 rounded-md border hover:bg-muted/50">
              <div className="flex justify-between items-center">
                <span className="text-sm">Audit log</span>
                <Badge variant="outline">View</Badge>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
