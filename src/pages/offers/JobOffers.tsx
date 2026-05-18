import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLOR: Record<string, string> = {
  sent: "bg-blue-500/15 text-blue-600",
  viewed: "bg-amber-500/15 text-amber-600",
  accepted: "bg-emerald-500/15 text-emerald-700",
  declined: "bg-destructive/15 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

export default function JobOffers() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("employment_offers")
        .select("*, projects(title)")
        .or(`startup_id.eq.${user.id},builder_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      setOffers(data ?? []);
    })();
  }, [user]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Briefcase className="h-6 w-6 text-emerald-600" />
        <h1 className="text-2xl font-semibold">Job offers</h1>
      </div>
      {offers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No job offers yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {offers.map((o) => {
            const expired = new Date(o.expires_at) < new Date();
            const status = expired && (o.status === "sent" || o.status === "viewed") ? "expired" : o.status;
            return (
              <Card key={o.id} className="hover:bg-muted/30 transition-colors">
                <CardContent className="py-4 flex items-center justify-between gap-3">
                  <Link to={`/job-offers/${o.id}`} className="flex-1 min-w-0 space-y-1">
                    <div className="font-medium text-sm">{o.job_title}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.projects?.title} · ${Number(o.annual_ctc).toLocaleString()}/yr · {o.work_location}
                    </div>
                    {(status === "sent" || status === "viewed") && (
                      <div className="text-xs text-amber-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Expires {formatDistanceToNow(new Date(o.expires_at), { addSuffix: true })}
                      </div>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={STATUS_COLOR[status] ?? ""} variant="outline">{status}</Badge>
                    <Link to={`/job-offers/${o.id}`}><Button size="sm" variant="ghost">Open</Button></Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
