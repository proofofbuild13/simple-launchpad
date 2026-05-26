import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_COLOR: Record<string, string> = {
  contract_drafted: "bg-blue-500/15 text-blue-600",
  sent_for_signing: "bg-amber-500/15 text-amber-600",
  partially_signed: "bg-amber-500/15 text-amber-600",
  contract_active: "bg-emerald-500/15 text-emerald-600",
  active: "bg-emerald-500/15 text-emerald-600",
  contract_completed: "bg-primary/15 text-primary",
  completed: "bg-primary/15 text-primary",
  cancelled: "bg-muted text-muted-foreground",
};

export default function Contracts() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("contracts").select("*, projects(title)")
      .or(`founder_id.eq.${user.id},builder_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .then(({ data }) => setContracts(data ?? []));
  }, [user]);
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold">Contracts</h1>
      {contracts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No contracts yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {contracts.map((c) => (
            <Link key={c.id} to={`/contracts/${c.id}`} className="block">
              <Card className="hover:bg-muted/30 transition-colors">
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{c.projects?.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">Escrow ${c.escrow_amount ?? 0} {c.escrow_funded && "· funded"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLOR[c.status] ?? ""} variant="outline">{c.status?.replace(/_/g, " ")}</Badge>
                    <Button size="sm" variant="ghost">Open</Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
