import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status = "active" | "flagged" | "suspended" | "banned" | "under_review";

interface Props {
  userId: string | null;
  status: Status | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

const LABELS: Record<Status, string> = {
  active: "Reactivate user",
  flagged: "Flag user",
  suspended: "Suspend user",
  banned: "Ban user",
  under_review: "Mark under review",
};

export function UserStatusDialog({ userId, status, open, onOpenChange, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!userId || !status) return;
    if (status !== "active" && !reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_user_status", {
      _user_id: userId,
      _status: status,
      _reason: reason || null,
      _notify: notify,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    setReason("");
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{status ? LABELS[status] : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason {status !== "active" && <span className="text-destructive">*</span>}</Label>
            <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you taking this action?" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="notify" checked={notify} onCheckedChange={(v) => setNotify(!!v)} />
            <Label htmlFor="notify" className="text-sm font-normal cursor-pointer">Notify the user in-app</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
