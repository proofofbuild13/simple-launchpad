import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PLATFORM_PAYEE } from "@/config/platformPayee";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: any;
  contractId: string;
  onDone: () => void;
}

export function PayCommissionModal({ open, onOpenChange, invoice, contractId, onDone }: Props) {
  const { user } = useAuth();
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  if (!invoice) return null;

  const submit = async () => {
    if (!user) return;
    if (!ref) return toast.error("Reference required");
    setSaving(true);
    try {
      let screenshot: string | null = null;
      if (file) {
        const path = `${user.id}/commission-${invoice.id}-${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file);
        if (upErr) throw upErr;
        screenshot = path;
      }
      const { error } = await supabase.from("commission_payments").insert({
        invoice_id: invoice.id,
        startup_id: user.id,
        amount: invoice.commission_amount,
        transaction_ref: ref,
        screenshot_url: screenshot,
      });
      if (error) throw error;
      toast.success("Submitted for admin verification");
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
          <DialogTitle>Pay platform fee · {invoice.invoice_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border p-3 text-xs space-y-1">
            <div className="flex justify-between"><span>Amount due</span><span className="font-mono font-semibold">${invoice.commission_amount}</span></div>
            <div className="flex justify-between"><span>Due date</span><span>{new Date(invoice.due_date).toLocaleDateString()}</span></div>
          </div>
          <div className="rounded-md bg-muted p-3 text-xs space-y-1">
            <div className="font-semibold mb-1">Pay to</div>
            <div className="flex justify-between"><span>UPI</span><span className="font-mono">{PLATFORM_PAYEE.upiId}</span></div>
            <div className="flex justify-between"><span>Bank</span><span>{PLATFORM_PAYEE.bankName}</span></div>
            <div className="flex justify-between"><span>A/C name</span><span>{PLATFORM_PAYEE.accountName}</span></div>
            <div className="flex justify-between"><span>A/C no</span><span className="font-mono">{PLATFORM_PAYEE.accountNumber}</span></div>
            <div className="flex justify-between"><span>IFSC</span><span className="font-mono">{PLATFORM_PAYEE.ifsc}</span></div>
          </div>
          <div>
            <Label>UPI / UTR reference</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          <div>
            <Label>Screenshot proof (optional)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving ? "Submitting..." : "Submit for verification"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
