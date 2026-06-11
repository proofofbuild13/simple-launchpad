import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Briefcase, FileSignature, Wallet, AlertTriangle, TrendingUp,
  Activity, Shield, Clock, CheckCircle2, Settings, Save,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fmtUSD } from "@/lib/currency";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export default function AdminDashboard() {
  const { role } = useAuth();
  const [kpis, setKpis] = useState<any>({});
  const [feed, setFeed] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any>({ overdue: 0, openDisputes: 0, flagged: 0 });
  const [trend, setTrend] = useState<{ date: string; gmv: number; revenue: number }[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const isSuper = role === "super_admin";

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

    const since = new Date(Date.now()-30*864e5).toISOString();
    const [{ data: gmvRows }, { data: revRows }, { data: pendRows }, { data: settingsRows }] = await Promise.all([
      supabase.from("payment_records").select("declared_amount, declared_at").gte("declared_at", since),
      supabase.from("commission_invoices").select("commission_amount, status, created_at").eq("status","paid"),
      supabase.from("commission_invoices").select("commission_amount").neq("status","paid"),
      supabase.from("platform_settings").select("key, value"),
    ]);
    const gmv = (gmvRows ?? []).reduce((s, r: any) => s + Number(r.declared_amount || 0), 0);
    const revenue = (revRows ?? []).reduce((s, r: any) => s + Number(r.commission_amount || 0), 0);
    const pending = (pendRows ?? []).reduce((s, r: any) => s + Number(r.commission_amount || 0), 0);

    // Build 30-day daily trend
    const buckets: Record<string, { gmv: number; revenue: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      buckets[d] = { gmv: 0, revenue: 0 };
    }
    (gmvRows ?? []).forEach((r: any) => {
      const d = String(r.declared_at).slice(0, 10);
      if (buckets[d]) buckets[d].gmv += Number(r.declared_amount || 0);
    });
    (revRows ?? []).forEach((r: any) => {
      const d = String(r.created_at).slice(0, 10);
      if (buckets[d]) buckets[d].revenue += Number(r.commission_amount || 0);
    });
    setTrend(Object.entries(buckets).map(([date, v]) => ({ date: date.slice(5), gmv: v.gmv, revenue: v.revenue })));

    setKpis({ users, startups, builders, projects, activeContracts, openDisputes, gmv, revenue, pending });
    setAlerts({ overdue: overdueInv, openDisputes, flagged });

    const s: Record<string, string> = {};
    (settingsRows ?? []).forEach((r: any) => { s[r.key] = typeof r.value === "string" ? r.value : JSON.stringify(r.value); });
    setSettings(s);

    const { data: logs } = await supabase.from("admin_audit_logs").select("*").order("created_at",{ascending:false}).limit(25);
    setFeed(logs ?? []);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const saveSetting = async (key: string) => {
    setSavingKey(key);
    let parsed: any = settings[key];
    try { parsed = JSON.parse(settings[key]); } catch { /* keep as string */ }
    const { error } = await supabase.from("platform_settings").upsert({ key, value: parsed });
    setSavingKey(null);
    if (error) return toast.error(error.message);
    toast.success(`${key} updated`);
  };

  const kpiCards = useMemo(() => [
    { label: "Total users", value: kpis.users, icon: Users },
    { label: "Active startups", value: kpis.startups, icon: Briefcase },
    { label: "Active builders", value: kpis.builders, icon: Users },
    { label: "Total projects", value: kpis.projects, icon: Briefcase },
    { label: "Active contracts", value: kpis.activeContracts, icon: FileSignature },
    { label: "Monthly GMV (30d)", value: fmtUSD(kpis.gmv ?? 0), icon: TrendingUp },
    { label: "Platform revenue", value: fmtUSD(kpis.revenue ?? 0), icon: Wallet },
    { label: "Pending platform fees", value: fmtUSD(kpis.pending ?? 0), icon: Clock },
    { label: "Open disputes", value: kpis.openDisputes, icon: AlertTriangle },
  ], [kpis]);

  const settingDefs = [
    { key: "commission_rate", label: "Commission rate", help: "Decimal e.g. 0.15 = 15%" },
    { key: "placement_fee_percent", label: "Placement fee %", help: "Percent e.g. 8.33" },
    { key: "escrow_release_grace_days", label: "Escrow release grace (days)", help: "Integer" },
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> 30-day GMV & revenue</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="gmv" name="GMV" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Platform settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {settingDefs.map((d) => (
            <div key={d.key} className="space-y-1.5">
              <Label htmlFor={d.key} className="text-xs">{d.label}</Label>
              <div className="flex gap-2">
                <Input id={d.key} value={settings[d.key] ?? ""} onChange={(e) => setSettings({ ...settings, [d.key]: e.target.value })} disabled={!isSuper} />
                <Button size="icon" variant="outline" onClick={() => saveSetting(d.key)} disabled={!isSuper || savingKey === d.key} title="Save">
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{d.help}</p>
            </div>
          ))}
          {!isSuper && <p className="text-xs text-muted-foreground md:col-span-3">Only super admins can edit platform settings.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
