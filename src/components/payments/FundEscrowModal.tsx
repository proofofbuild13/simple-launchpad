import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ShieldCheck, Info } from "lucide-react";
import { PLATFORM_PAYEE, COMMISSION_RATE } from "@/config/platformPayee";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: any;
  milestones: any[];
  onDone: () => void;
}

export function FundEscrowModal({ open, onOpenChange, contract, milestones, onDone }: Props) {
  const { user } = useAuth();
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  if (!contract) return null;

  const totalAmount = milestones
    .filter((m) => m.status !== "cancelled")
    .reduce((a, b) => a + Number(b.amount || 0), 0);

  const commission = Math.round(totalAmount * COMMISSION_RATE * 100) / 100;

  const submit = async () => {
    if (!user) return;
    if (!ref.trim()) { toast.error("Transaction reference required"); return; }
    setSaving(true);
    try {
      let screenshotUrl: string | null = null;
      if (file) {
        const path = `${user.id}/escrow-${contract.id}-${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file);
        if (upErr) throw upErr;
        screenshotUrl = path;
      }

      const { error } = await supabase.rpc("fund_escrow", {
        _contract_id: contract.id,
        _amount: totalAmount,
        _transaction_ref: ref.trim(),
        _screenshot_url: screenshotUrl,
      });
      if (error) throw error;
      toast.success("Escrow funded — contract is now active");
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Fund escrow
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Funds are held in escrow and released to the builder only after you approve each milestone deliverable.
            </AlertDescription>
          </Alert>

          <div className="rounded-md border divide-y text-sm">
            <div className="flex justify-between px-3 py-2">
              <span className="text-muted-foreground">Milestones total</span>
              <span className="font-mono font-medium">₹{totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between px-3 py-2">
              <span className="text-muted-foreground">Platform commission</span>
              <span className="font-mono text-muted-foreground">₹{commission.toLocaleString()} (billed per milestone)</span>
            </div>
            <div className="flex justify-between px-3 py-2 font-medium">
              <span>Amount to deposit now</span>
              <span className="font-mono">₹{totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="rounded-md bg-muted p-3 text-xs space-y-1.5">
            <p className="font-medium text-sm">Transfer to</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">UPI ID</span>
              <span className="font-mono select-all">{PLATFORM_PAYEE.upiId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account name</span>
              <span>{PLATFORM_PAYEE.accountName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account no.</span>
              <span className="font-mono select-all">{PLATFORM_PAYEE.accountNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IFSC</span>
              <span className="font-mono">{PLATFORM_PAYEE.ifsc}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono text-primary select-all">ESCROW-{contract.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>UPI / UTR transaction reference *</Label>
              <Input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="e.g. 407812345678"
                className="font-mono"
              />
            </div>
            <div>
              <Label>Payment screenshot (optional)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={saving}>
              {saving ? "Submitting…" : "Confirm deposit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
