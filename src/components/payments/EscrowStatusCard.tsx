import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Wallet, TrendingDown, Clock } from "lucide-react";

interface Props {
  contractId: string;
  totalAmount: number;
  escrowFunded: boolean;
  escrowBalance: number;
  isFounder: boolean;
  onFundClick: () => void;
}

interface LedgerEntry {
  id: string;
  entry_type: string;
  amount: number;
  balance_after: number;
  notes: string | null;
  created_at: string;
  milestone_id: string | null;
}

export function EscrowStatusCard({
  contractId,
  totalAmount,
  escrowFunded,
  escrowBalance,
  isFounder,
  onFundClick,
}: Props) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    if (!escrowFunded) return;
    (async () => {
      const [{ data: entries }, { data: sum }] = await Promise.all([
        supabase
          .from("escrow_ledger")
          .select("*")
          .eq("contract_id", contractId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.rpc("get_escrow_summary", { _contract_id: contractId }),
      ]);
      setLedger(entries ?? []);
      if (sum) setSummary(sum[0]);
    })();
  }, [contractId, escrowFunded]);

  const pctReleased = totalAmount > 0 ? Math.round(((totalAmount - escrowBalance) / totalAmount) * 100) : 0;

  const entryLabel: Record<string, string> = {
    funded: "Deposit",
    released: "Milestone released",
    refunded: "Refund",
    commission_held: "Commission",
  };

  const entryColor: Record<string, string> = {
    funded: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    released: "bg-blue-500/10 text-blue-700 border-blue-200",
    refunded: "bg-amber-500/10 text-amber-700 border-amber-200",
    commission_held: "bg-muted text-muted-foreground",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Escrow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!escrowFunded ? (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
              Contract cannot activate until escrow is funded. Both parties' signatures + deposit = active contract.
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount required</span>
              <span className="font-mono font-medium">₹{totalAmount.toLocaleString()}</span>
            </div>
            {isFounder && (
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={onFundClick}>
                <Wallet className="h-4 w-4 mr-2" />
                Fund escrow
              </Button>
            )}
            {!isFounder && (
              <p className="text-xs text-muted-foreground">Waiting for founder to fund escrow.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-xs text-muted-foreground mb-1">Held</div>
                <div className="text-sm font-semibold font-mono">₹{escrowBalance.toLocaleString()}</div>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-xs text-muted-foreground mb-1">Released</div>
                <div className="text-sm font-semibold font-mono">₹{(totalAmount - escrowBalance).toLocaleString()}</div>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-xs text-muted-foreground mb-1">Progress</div>
                <div className="text-sm font-semibold">{pctReleased}%</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${pctReleased}%` }}
                />
              </div>
              {summary && (
                <div className="text-xs text-muted-foreground">
                  {summary.released_count} of {summary.milestone_count} milestones released
                </div>
              )}
            </div>

            {/* Ledger */}
            {ledger.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ledger</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {ledger.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${entryColor[e.entry_type] ?? ""}`}>
                          {entryLabel[e.entry_type] ?? e.entry_type}
                        </Badge>
                        <span className="text-muted-foreground font-mono">
                          {e.entry_type === "released" ? "-" : "+"}₹{e.amount.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        bal ₹{e.balance_after.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
