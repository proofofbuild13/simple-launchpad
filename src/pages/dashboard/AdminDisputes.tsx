import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function AdminDisputes() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase.from("disputes").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const resolve = async (id: string, status: string) => {
    await supabase.from("disputes").update({
      status, resolution: resolutions[id] || null, resolved_at: new Date().toISOString(),
    }).eq("id", id);
    toast.success("Dispute updated");
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold">Dispute center</h1>
      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No disputes.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {items.map((d) => (
            <Card key={d.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between">
                  <CardTitle className="text-sm">Dispute · contract {d.contract_id.slice(0, 8)}</CardTitle>
                  <Badge variant={d.status === "open" ? "destructive" : "outline"}>{d.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p><span className="text-muted-foreground">Reason:</span> {d.reason}</p>
                {d.resolution && <p><span className="text-muted-foreground">Resolution:</span> {d.resolution}</p>}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/disputes/${d.id}`}><ExternalLink className="h-3.5 w-3.5 mr-1" /> Open detail</Link>
                  </Button>
                  {d.status === "open" && (
                    <>
                      <Input className="max-w-xs" placeholder="Resolution note" value={resolutions[d.id] ?? ""} onChange={(e) => setResolutions({ ...resolutions, [d.id]: e.target.value })} />
                      <Button size="sm" onClick={() => resolve(d.id, "resolved_founder")}>Refund founder</Button>
                      <Button size="sm" variant="secondary" onClick={() => resolve(d.id, "resolved_builder")}>Release to builder</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
