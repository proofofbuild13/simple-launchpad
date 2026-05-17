import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Search } from "lucide-react";

export default function AdminAuditLogs() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("admin_audit_logs").select("*").order("created_at",{ascending:false}).limit(500);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const types = Array.from(new Set(rows.map((r) => r.action_type)));
  const filtered = rows.filter((r) => {
    if (type !== "all" && r.action_type !== type) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.action_type ?? "").toLowerCase().includes(s) ||
           (r.entity_type ?? "").toLowerCase().includes(s) ||
           (r.entity_id ?? "").includes(s) ||
           (r.actor_id ?? "").includes(s);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><ScrollText className="h-6 w-6" /> Audit logs</h1>
        <p className="text-sm text-muted-foreground">Immutable record of platform actions · {filtered.length} entries</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search action, entity, id…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No entries.</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary">{r.action_type}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {r.entity_type && <Badge variant="outline" className="mr-1">{r.entity_type}</Badge>}
                    {r.entity_id && <span className="font-mono text-muted-foreground">{String(r.entity_id).slice(0,8)}</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.actor_id ? String(r.actor_id).slice(0,8) : "—"}</TableCell>
                  <TableCell>{r.actor_role && <Badge variant="outline">{r.actor_role}</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
