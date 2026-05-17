import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { COMMISSION_RATE } from "@/config/platformPayee";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  milestone: any;
  contract: any;
  onDone: () => void;
}

export function RecordPaymentModal({ open, onOpenChange, milestone, contract, onDone }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState<string>(String(milestone?.amount ?? ""));
  const [method, setMethod] = useState("upi");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  if (!milestone || !contract) return null;
  const commission = (Number(amount || 0) * COMMISSION_RATE).toFixed(2);

  const submit = async () => {
    if (!user) return;
    if (!amount || !ref) return toast.error("Amount and transaction reference required");
    setSaving(true);
    try {
      let screenshot_url: string | null = null;
      if (file) {
        const path = `${user.id}/${milestone.id}-${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file);
        if (upErr) throw upErr;
        screenshot_url = path;
      }
      const { error } = await supabase.from("payment_records").insert({
        milestone_id: milestone.id,
        contract_id: contract.id,
        startup_id: contract.founder_id,
        builder_id: contract.builder_id,
        declared_amount: Number(amount),
        payment_method: method,
        transaction_ref: ref,
        notes: notes || null,
        screenshot_url,
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: contract.builder_id,
        type: "payment_declared",
        title: "Payment recorded — please confirm",
        body: `Founder declared ₹${amount} via ${method.toUpperCase()}.`,
        link: `/workspace/${contract.id}`,
      });
      toast.success("Payment recorded");
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
          <DialogTitle>Record builder payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted p-3 text-xs space-y-1">
            <div className="flex justify-between"><span>Milestone</span><span className="font-medium">{milestone.title}</span></div>
            <div className="flex justify-between"><span>Platform commission ({(COMMISSION_RATE * 100).toFixed(0)}%)</span><span className="font-mono">₹{commission}</span></div>
          </div>
          <div>
            <Label>Amount paid (₹)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Payment method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="neft">NEFT</SelectItem>
                <SelectItem value="imps">IMPS</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>UPI / UTR reference</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          <div>
            <Label>Screenshot proof (optional)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Record payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
