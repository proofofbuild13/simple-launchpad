import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, Flag, Ban, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UserStatusDialog } from "@/components/admin/UserStatusDialog";
import { useAuth } from "@/contexts/AuthContext";

type Status = "active" | "flagged" | "suspended" | "banned" | "under_review";

export default function AdminUserDetail() {
  const { id } = useParams();
  const { role: myRole } = useAuth();
  const [data, setData] = useState<any>({});
  const [newRole, setNewRole] = useState<string>("");
  const [savingRole, setSavingRole] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; status: Status | null }>({ open: false, status: null });

  const load = async () => {
    if (!id) return;
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
    setNewRole(roleRow?.role ?? "");
  };
  useEffect(() => { load(); }, [id]);

  const saveRole = async () => {
    if (!id || !newRole || newRole === data.role) return;
    setSavingRole(true);
    const { error } = await supabase.rpc("admin_set_user_role", { _user_id: id, _role: newRole as any });
    setSavingRole(false);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    load();
  };

  if (!data.profile) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const isSuper = myRole === "super_admin";
  const roleOptions = isSuper
    ? ["startup","builder","admin","super_admin"]
    : ["startup","builder"];

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
              <Badge variant={data.status?.status === "active" || !data.status ? "outline" : "destructive"}>{data.status?.status ?? "active"}</Badge>
            </div>
          </div>
        </CardHeader>
        {data.status?.reason && (
          <CardContent className="text-sm">
            <p className="text-xs text-muted-foreground">Status reason</p>
            <p>{data.status.reason}</p>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Account actions</CardTitle></CardHeader>
          <CardContent className="space-y-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, status: "flagged" })}><Flag className="h-3.5 w-3.5 mr-1 text-amber-500" /> Flag</Button>
            <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, status: "under_review" })}>Under review</Button>
            <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, status: "suspended" })}><Ban className="h-3.5 w-3.5 mr-1 text-destructive" /> Suspend</Button>
            <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, status: "banned" })}><Ban className="h-3.5 w-3.5 mr-1 text-destructive" /> Ban</Button>
            <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, status: "active" })}><ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Activate</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Role</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={saveRole} disabled={savingRole || !newRole || newRole === data.role}>Save</Button>
            {!isSuper && <p className="text-xs text-muted-foreground">Only super admins can grant admin roles.</p>}
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-base">Contracts ({data.contracts?.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {(data.contracts ?? []).map((c: any) => (
              <Link key={c.id} to={`/contracts/${c.id}`} className="text-sm p-2 rounded-md hover:bg-muted/50 flex justify-between">
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
                <span>${Number(p.declared_amount).toLocaleString()}</span><Badge variant="outline">{p.status}</Badge>
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

      <UserStatusDialog
        open={dialog.open}
        userId={id ?? null}
        status={dialog.status}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onDone={load}
      />
    </div>
  );
}
