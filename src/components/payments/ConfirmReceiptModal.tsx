import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paymentRecord: any;
  onDone: () => void;
}

export function ConfirmReceiptModal({ open, onOpenChange, paymentRecord, onDone }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState<string>(String(paymentRecord?.declared_amount ?? ""));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  if (!paymentRecord) return null;

  const submit = async () => {
    if (!user) return;
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
        _confirmed_amount: Number(amount),
        _screenshot: screenshot,
      });
      if (error) throw error;
      toast.success(
        Number(amount) === Number(paymentRecord.declared_amount)
          ? "Confirmed — invoice generated"
          : "Mismatch reported — admin notified",
      );
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm payment received</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted p-3 text-xs">
            Founder declared <span className="font-mono">₹{paymentRecord.declared_amount}</span> via{" "}
            <span className="uppercase">{paymentRecord.payment_method}</span> · ref{" "}
            <span className="font-mono">{paymentRecord.transaction_ref}</span>
          </div>
          <div>
            <Label>Amount you received (₹)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Mismatch will auto-open a dispute.
            </p>
          </div>
          <div>
            <Label>Proof (optional)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Confirm receipt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
