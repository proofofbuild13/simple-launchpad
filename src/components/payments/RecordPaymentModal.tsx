import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { COMMISSION_RATE } from "@/config/platformPayee";
import { BellRing, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  milestone: any;
  contract: any;
  onDone: () => void;
}

export function RecordPaymentModal({ open, onOpenChange, milestone, contract, onDone }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState("upi");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [builderMethods, setBuilderMethods] = useState<any[]>([]);
  const [fetchingMethods, setFetchingMethods] = useState(true);

  useEffect(() => {
    if (open && milestone) {
      setAmount(String(milestone.amount ?? ""));
    }
  }, [open, milestone]);

  useEffect(() => {
    if (!open || !contract?.builder_id) return;
    (async () => {
      setFetchingMethods(true);
      const { data } = await supabase.rpc("get_builder_default_payment", { _builder_id: contract.builder_id });
      const rows = (data ?? []).map((r: any) => ({
        method_type: r.method_type,
        upi_id: r.upi_id,
        bank_name: r.bank_name,
        account_number: r.account_number_masked,
        ifsc: r.ifsc,
        account_holder: r.account_holder,
        verified: r.verified,
        is_default: true,
      }));
      setBuilderMethods(rows);
      setFetchingMethods(false);
      if (rows.length > 0) {
        setMethod(rows[0].method_type);
      }
    })();
  }, [open, contract]);


  if (!milestone || !contract) return null;
  const commission = (Number(amount || 0) * COMMISSION_RATE).toFixed(2);

  const remindBuilder = async () => {
    await supabase.rpc("send_notification", {
      _user_id: contract.builder_id,
      _type: "payment_method_missing",
      _title: "Action required: Update payment details",
      _body: "The startup is ready to pay for your milestone, but your payment details are missing. Please update them.",
      _link: `/settings?tab=payments`,
    });
    toast.success("Reminder sent to builder");
  };

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
      await supabase.rpc("send_notification", {
        _user_id: contract.builder_id,
        _type: "payment_declared",
        _title: "Payment recorded — please confirm",
        _body: `Founder declared $${amount} via ${method.toUpperCase()}.`,
        _link: `/workspace/${contract.id}`,
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

  const selectedMethodInfo = builderMethods.find((m) => m.method_type === method);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record builder payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-xs space-y-1">
            <div className="flex justify-between"><span>Milestone</span><span className="font-medium">{milestone.title}</span></div>
            <div className="flex justify-between"><span>Platform commission ({(COMMISSION_RATE * 100).toFixed(0)}%)</span><span className="font-mono">${commission}</span></div>
          </div>

          <div className="space-y-2">
            <Label>Builder's Payment Details</Label>
            {!fetchingMethods && builderMethods.length === 0 ? (
              <Alert variant="destructive" className="bg-destructive/5 text-destructive border-destructive/20">
                <AlertDescription className="flex items-center justify-between">
                  <span>Builder has not added any payment methods.</span>
                  <Button size="sm" variant="outline" className="border-destructive/30 hover:bg-destructive/10" onClick={remindBuilder}>
                    <BellRing className="h-3.5 w-3.5 mr-1.5" />Remind Builder
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="rounded-md border p-3 bg-card text-sm space-y-2">
                {selectedMethodInfo ? (
                  <>
                    {selectedMethodInfo.method_type === "upi" && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">UPI ID</span>
                        <span className="font-medium select-all">{selectedMethodInfo.upi_id}</span>
                      </div>
                    )}
                    {selectedMethodInfo.method_type !== "upi" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Account Holder</span>
                          <span className="font-medium">{selectedMethodInfo.account_holder}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Account Number</span>
                          <span className="font-mono select-all">{selectedMethodInfo.account_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">IFSC / Bank</span>
                          <span className="font-medium">{selectedMethodInfo.ifsc} / {selectedMethodInfo.bank_name}</span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">No details found for the selected method.</p>
                )}
              </div>
            )}
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
            <Label>Amount paid ($)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
          <Button className="w-full" onClick={submit} disabled={saving || builderMethods.length === 0}>
            {saving ? "Saving..." : "Record payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
