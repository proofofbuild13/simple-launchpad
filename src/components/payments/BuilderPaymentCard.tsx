import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Wallet } from "lucide-react";

export function BuilderPaymentCard({ builderId }: { builderId: string }) {
  const [pm, setPm] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!builderId) return;
    (async () => {
      const { data } = await supabase.rpc("get_builder_default_payment", { _builder_id: builderId });
      setPm(Array.isArray(data) ? data[0] ?? null : data ?? null);
      setLoading(false);
    })();
  }, [builderId]);

  if (loading) return null;
  if (!pm) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" />Builder payment details</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Builder has not added a payment method yet.</CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" />Builder payment details</CardTitle>
        {pm.verified && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>}
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Method</div>
        <div className="font-medium uppercase">{pm.method_type}</div>
        {pm.method_type === "upi" ? (
          <div className="text-sm mt-2"><span className="text-muted-foreground">UPI ID: </span>{pm.upi_id}</div>
        ) : (
          <div className="space-y-1 mt-2">
            <div><span className="text-muted-foreground">Account holder: </span>{pm.account_holder}</div>
            <div><span className="text-muted-foreground">Bank: </span>{pm.bank_name}</div>
            <div><span className="text-muted-foreground">Account: </span>{pm.account_number_masked}</div>
            <div><span className="text-muted-foreground">IFSC: </span>{pm.ifsc}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
