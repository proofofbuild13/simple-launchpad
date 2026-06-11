import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users as UsersIcon, Search, Eye, Flag, Ban, ShieldCheck, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { UserStatusDialog } from "@/components/admin/UserStatusDialog";
import { downloadCSV } from "@/lib/csvExport";

type Status = "active" | "flagged" | "suspended" | "banned" | "under_review";

export default function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; userId: string | null; status: Status | null }>({ open: false, userId: null, status: null });

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: status }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url, created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_status").select("*"),
    ]);
    const byRole = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]));
    const byStatus = new Map((status ?? []).map((s: any) => [s.user_id, s]));
    setRows((profiles ?? []).map((p: any) => ({
      ...p,
      role: byRole.get(p.id) ?? "—",
      status: byStatus.get(p.id)?.status ?? "active",
      reason: byStatus.get(p.id)?.reason,
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openDialog = (userId: string, status: Status) => setDialog({ open: true, userId, status });

  const filtered = rows.filter((r) => {
    if (roleFilter !== "all" && r.role !== roleFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!search) return true;
    return (r.full_name ?? "").toLowerCase().includes(search.toLowerCase()) || r.id.includes(search);
  });

  const exportCSV = () => {
    downloadCSV(`users-${new Date().toISOString().slice(0,10)}.csv`, filtered.map((r) => ({
      id: r.id, full_name: r.full_name ?? "", role: r.role, status: r.status,
      reason: r.reason ?? "", joined_at: new Date(r.created_at).toISOString(),
    })));
  };

  const statusBadge = (s: string) => {
    const map: Record<string, "default"|"destructive"|"secondary"|"outline"> = {
      active: "outline", flagged: "secondary", suspended: "destructive", banned: "destructive", under_review: "secondary",
    };
    return <Badge variant={map[s] ?? "outline"}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><UsersIcon className="h-6 w-6" /> User management</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} users</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCSV} disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search name or id…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="startup">Startup</SelectItem>
                <SelectItem value="builder">Builder</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="under_review">Under review</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users.</TableCell></TableRow>
              ) : filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                  <TableCell>{statusBadge(u.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button asChild size="sm" variant="ghost"><Link to={`/admin/users/${u.id}`}><Eye className="h-3.5 w-3.5" /></Link></Button>
                    <Button size="sm" variant="ghost" onClick={() => openDialog(u.id, "flagged")} title="Flag"><Flag className="h-3.5 w-3.5 text-amber-500" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => openDialog(u.id, "suspended")} title="Suspend"><Ban className="h-3.5 w-3.5 text-destructive" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => openDialog(u.id, "active")} title="Activate"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserStatusDialog
        open={dialog.open}
        userId={dialog.userId}
        status={dialog.status}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onDone={load}
      />
    </div>
  );
}
