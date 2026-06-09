import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Verify that the builder on a contract has a payment method on file before
 * the founder initiates any payment action (escrow funding, milestone approval,
 * or recording a manual payment).
 *
 * Behaviour:
 *  - Returns `true` if the builder has at least one payment method.
 *  - Returns `false` and notifies the builder (max once per 24h) if not,
 *    showing the founder a toast explaining what happened.
 */
export async function ensureBuilderPaymentReady(contract: {
  id: string;
  builder_id: string;
}): Promise<boolean> {
  if (!contract?.builder_id) return false;

  const { data, error } = await supabase.rpc("builder_payment_status", {
    _builder_id: contract.builder_id,
  });
  if (error) {
    toast.error("Could not verify builder payment details: " + error.message);
    return false;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.has_method) return true;

  // Throttle reminders: don't spam more than one per 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", contract.builder_id)
    .eq("type", "payment_method_missing")
    .gte("created_at", since)
    .limit(1);

  if (!recent || recent.length === 0) {
    await supabase.rpc("send_notification", {
      _user_id: contract.builder_id,
      _type: "payment_method_missing",
      _title: "Action required: Add your payment details",
      _body:
        "The startup is ready to pay you for a milestone, but your payment details are missing. Please add them to receive funds.",
      _link: "/settings?tab=payments",
    });
  }

  toast.error(
    "Builder hasn't added payment details yet — we've notified them. Try again once they update."
  );
  return false;
}
