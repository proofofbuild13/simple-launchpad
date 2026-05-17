import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User } from "lucide-react";

export default function AdminUserDetail() {
  const { id } = useParams();
  const [data, setData] = useState<any>({});

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: profile }, { data: roleRow }, { data: statusRow },
        { data: contracts }, { data: disputes }, { data: payments }, { data: logs }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", id).maybeSingle(),
        supabase.from("user_status").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("contracts").select("id,status,escrow_amount,created_at").or(`founder_id.eq.${id},builder_id.eq.${id}`).limit(20),
        supabase.from("disputes").select("id,status,reason,created_at").eq("raised_by", id).limit(20),
        supabase.from("payment_records").select("id,declared_amount,status,declared_at").or(`startup_id.eq.${id},builder_id.eq.${id}`).limit(20),
        supabase.from("admin_audit_logs").select("*").eq("actor_id", id).order("created_at",{ascending:false}).limit(25),
      ]);
      setData({ profile, role: roleRow?.role, status: statusRow, contracts, disputes, payments, logs });
    })();
  }, [id]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Button asChild variant="ghost" size="sm"><Link to="/admin/users"><ArrowLeft className="h-4 w-4 mr-1" /> Users</Link></Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-6 w-6 text-primary" /></div>
            <div>
              <CardTitle>{data.profile?.full_name ?? "—"}</CardTitle>
              <p className="text-xs text-muted-foreground font-mono">{id}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <Badge variant="outline">{data.role ?? "—"}</Badge>
              <Badge variant={data.status?.status === "active" ? "outline" : "destructive"}>{data.status?.status ?? "active"}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Contracts ({data.contracts?.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {(data.contracts ?? []).map((c: any) => (
              <Link key={c.id} to={`/contracts/${c.id}`} className="block text-sm p-2 rounded-md hover:bg-muted/50 flex justify-between">
                <span className="font-mono text-xs">{c.id.slice(0,8)}</span><Badge variant="outline">{c.status}</Badge>
              </Link>
            ))}
            {!data.contracts?.length && <p className="text-xs text-muted-foreground">None</p>}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">Disputes ({data.disputes?.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {(data.disputes ?? []).map((d: any) => (
              <div key={d.id} className="text-sm p-2 rounded-md bg-muted/30">
                <div className="flex justify-between"><Badge variant="destructive">{d.status}</Badge><span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span></div>
                <p className="text-xs mt-1 truncate">{d.reason}</p>
              </div>
            ))}
            {!data.disputes?.length && <p className="text-xs text-muted-foreground">None</p>}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">Payments ({data.payments?.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {(data.payments ?? []).map((p: any) => (
              <div key={p.id} className="text-sm p-2 rounded-md bg-muted/30 flex justify-between">
                <span>₹{Number(p.declared_amount).toLocaleString()}</span><Badge variant="outline">{p.status}</Badge>
              </div>
            ))}
            {!data.payments?.length && <p className="text-xs text-muted-foreground">None</p>}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">Audit trail</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 max-h-[320px] overflow-y-auto">
            {(data.logs ?? []).map((l: any) => (
              <div key={l.id} className="text-xs p-2 rounded-md bg-muted/30">
                <div className="font-medium">{l.action_type}</div>
                <div className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</div>
              </div>
            ))}
            {!data.logs?.length && <p className="text-xs text-muted-foreground">None</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
