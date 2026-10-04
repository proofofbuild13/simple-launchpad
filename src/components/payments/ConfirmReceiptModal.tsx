import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fmtCurrency, type SupportedCurrency } from "@/lib/currency";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paymentRecord: any;
  currency?: SupportedCurrency;
  onDone: () => void;
}

export function ConfirmReceiptModal({ open, onOpenChange, paymentRecord, currency, onDone }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (open) {
      setAmount(String(paymentRecord?.declared_amount ?? ""));
      setFile(null);
    }
  }, [open, paymentRecord?.id, paymentRecord?.declared_amount]);

  if (!paymentRecord) return null;
  const paymentCurrency = currency ?? paymentRecord.currency ?? "USD";

  const submit = async () => {
    if (!user || submitting.current) return;
    const received = Number(amount);
    if (!amount.trim() || !Number.isFinite(received) || received <= 0) {
      toast.error("Enter a valid amount greater than zero"); return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      let screenshot: string | null = null;
      if (file) {
        const path = `${user.id}/confirm-${paymentRecord.id}-${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file);
        if (upErr) throw upErr;
        screenshot = path;
      }
      const { error } = await supabase.rpc("confirm_payment_record", {
        _id: paymentRecord.id,
        _confirmed_amount: received,
        _screenshot: screenshot,
      });
      if (error) throw error;
      toast.success(
        received === Number(paymentRecord.declared_amount)
          ? "Confirmed — invoice generated"
          : "Mismatch reported — admin notified",
      );
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!saving) onOpenChange(value); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm payment received</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted p-3 text-xs">
            Founder declared <span className="font-mono">{fmtCurrency(paymentRecord.declared_amount, paymentCurrency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> via{" "}
            <span className="uppercase">{paymentRecord.payment_method}</span> · ref{" "}
            <span className="font-mono">{paymentRecord.transaction_ref}</span>
          </div>
          <div>
            <Label htmlFor="receipt-amount">Amount you received ({paymentCurrency})</Label>
            <Input id="receipt-amount" type="number" min="0.01" step="0.01" value={amount} disabled={saving} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Mismatch will auto-open a dispute.
            </p>
          </div>
          <div>
            <Label>Proof (optional)</Label>
            <Input type="file" accept="image/*" disabled={saving} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Confirm receipt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
