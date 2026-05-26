import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Loader2, ArrowRight } from "lucide-react";
import { WorkflowStatusTracker } from "@/components/workflow/WorkflowStatusTracker";

export default function Workspaces() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("contracts")
        .select("*, projects(title)")
        .or(`founder_id.eq.${user.id},builder_id.eq.${user.id}`)
        .in("status", ["contract_active", "active", "contract_completed"])
        .order("updated_at", { ascending: false });
      setContracts(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Briefcase className="h-5 w-5" /> Workspaces</h1>
        <p className="text-sm text-muted-foreground">Active collaboration spaces — milestones, deliverables, and payments.</p>
      </div>

      {contracts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
          No active workspaces yet. A workspace is created automatically once a contract becomes active.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {contracts.map((c) => (
            <Card key={c.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{c.projects?.title ?? "Untitled project"}</div>
                    <div className="text-xs text-muted-foreground">Contract #{c.id.slice(0, 8)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">{c.status?.replace(/_/g, " ")}</Badge>
                    <Link to={`/workspace/${c.id}`}>
                      <Button size="sm">Open <ArrowRight className="h-4 w-4 ml-1" /></Button>
                    </Link>
                  </div>
                </div>
                <WorkflowStatusTracker contractId={c.id} compact />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
