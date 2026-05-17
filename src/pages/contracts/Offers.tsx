import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  offer_sent: "bg-blue-500/15 text-blue-600",
  pending: "bg-blue-500/15 text-blue-600",
  negotiating: "bg-amber-500/15 text-amber-600",
  offer_accepted: "bg-emerald-500/15 text-emerald-600",
  accepted: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-destructive/15 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

export default function Offers() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<any[]>([]);
  const [contractByOffer, setContractByOffer] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadOffers = async () => {
    if (!user) return;
    const { data } = await supabase.from("offers").select("*, projects(title)")
      .or(`founder_id.eq.${user.id},builder_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    setOffers(data ?? []);
    const ids = (data ?? []).map((o) => o.id);
    if (ids.length) {
      const { data: cs } = await supabase.from("contracts").select("id, offer_id").in("offer_id", ids);
      const map: Record<string, string> = {};
      (cs ?? []).forEach((c: any) => { if (c.offer_id) map[c.offer_id] = c.id; });
      setContractByOffer(map);
    }
  };

  const generateContract = async (offerId: string) => {
    setGenerating(offerId);
    const { data, error } = await supabase.rpc("create_contract_from_offer", { _offer_id: offerId });
    setGenerating(null);
    if (error) { toast.error(error.message); return; }
    if (data) navigate(`/contracts/${data}`);
  };

  useEffect(() => {
    loadOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold">Offers</h1>
      {offers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No offers yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {offers.map((o) => {
            const expired = o.expires_at && new Date(o.expires_at) < new Date();
            const status = expired && (o.status === "offer_sent" || o.status === "pending") ? "expired" : o.status;
            const isFounder = user?.id === o.founder_id;
            const contractId = contractByOffer[o.id];
            const accepted = o.status === "offer_accepted" || o.status === "accepted";
            return (
              <Card key={o.id} className="hover:bg-muted/30 transition-colors">
                <CardContent className="py-4 flex items-center justify-between gap-3">
                  <Link to={`/offers/${o.id}`} className="flex-1 min-w-0 space-y-1">
                    <div className="font-medium text-sm">{o.projects?.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.offer_type} · {o.duration} · ${o.compensation}{o.rate_type ? `/${o.rate_type}` : ""}
                    </div>
                    {o.expires_at && (status === "offer_sent" || status === "pending") && (
                      <div className="text-xs text-amber-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Expires {formatDistanceToNow(new Date(o.expires_at), { addSuffix: true })}
                      </div>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={STATUS_COLOR[status] ?? ""} variant="outline">{status?.replace("_", " ")}</Badge>
                    {accepted && contractId ? (
                      <Link to={`/contracts/${contractId}`}>
                        <Button size="sm">{isFounder ? "Manage contract" : "View contract"}</Button>
                      </Link>
                    ) : accepted && !contractId ? (
                      <Button
                        size="sm"
                        onClick={() => generateContract(o.id)}
                        disabled={generating === o.id}
                      >
                        {generating === o.id ? "Generating…" : isFounder ? "Generate contract" : "Open contract workspace"}
                      </Button>
                    ) : (
                      <Link to={`/offers/${o.id}`}>
                        <Button size="sm" variant="ghost">Open</Button>
                      </Link>
                    )}
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
