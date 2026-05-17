import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

/**
 * CENTRAL workflow tracker. Single source of truth across every page that
 * shows progress for a hire flow (submission → contract → settlement).
 *
 * Pass any one of: submissionId, offerId, contractId, milestoneId.
 * The component resolves the latest authoritative status by querying
 * contracts → offers → submissions in that order.
 */

const STAGES = [
  { key: "submitted",            label: "Submitted",       group: 0 },
  { key: "under_review",         label: "Under review",    group: 0 },
  { key: "shortlisted",          label: "Shortlisted",     group: 1 },
  { key: "interview_scheduled",  label: "Interview",       group: 1 },
  { key: "offer_sent",           label: "Offer sent",      group: 2 },
  { key: "offer_accepted",       label: "Offer accepted",  group: 2 },
  { key: "contract_drafted",     label: "Contract drafted",group: 3 },
  { key: "sent_for_signing",     label: "For signing",     group: 3 },
  { key: "partially_signed",     label: "Partially signed",group: 3 },
  { key: "contract_active",      label: "Active contract", group: 4 },
  { key: "milestone_in_progress",label: "Milestone work",  group: 4 },
  { key: "payment_pending",      label: "Payment pending", group: 5 },
  { key: "fully_settled",        label: "Settled",         group: 5 },
  { key: "contract_completed",   label: "Completed",       group: 5 },
] as const;

const COMPACT_GROUPS = [
  "Submission", "Shortlist", "Offer", "Contract", "Active", "Settled",
];

export type WorkflowKey = typeof STAGES[number]["key"];

export function WorkflowStatusTracker({
  submissionId,
  offerId,
  contractId,
  milestoneId,
  compact = true,
  className,
}: {
  submissionId?: string;
  offerId?: string;
  contractId?: string;
  milestoneId?: string;
  compact?: boolean;
  className?: string;
}) {
  const [status, setStatus] = useState<WorkflowKey>("submitted");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resolved = await resolveStatus({ submissionId, offerId, contractId, milestoneId });
      if (!cancelled) {
        setStatus(resolved);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [submissionId, offerId, contractId, milestoneId]);

  const currentIdx = Math.max(0, STAGES.findIndex((s) => s.key === status));
  const currentGroup = STAGES[currentIdx]?.group ?? 0;

  if (compact) {
    return (
      <div className={cn("flex items-center w-full", className)}>
        {COMPACT_GROUPS.map((g, i) => {
          const done = i < currentGroup;
          const active = i === currentGroup;
          return (
            <div key={g} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border",
                  done && "bg-primary text-primary-foreground border-primary",
                  active && "bg-primary/10 text-primary border-primary",
                  !done && !active && "bg-muted text-muted-foreground border-border",
                )}>
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn(
                  "text-[10px] mt-1.5 whitespace-nowrap",
                  active ? "text-foreground font-medium" : "text-muted-foreground",
                )}>{g}</span>
              </div>
              {i < COMPACT_GROUPS.length - 1 && (
                <div className={cn("h-0.5 flex-1 mx-2", done ? "bg-primary" : "bg-border")} />
              )}
            </div>
          );
        })}
        {loading && <span className="sr-only">Loading status…</span>}
      </div>
    );
  }

  const stage = STAGES[currentIdx];
  return (
    <div className={cn("inline-flex items-center gap-2 text-xs", className)}>
      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
      <span className="font-medium">{stage?.label ?? status}</span>
    </div>
  );
}

async function resolveStatus(opts: {
  submissionId?: string; offerId?: string; contractId?: string; milestoneId?: string;
}): Promise<WorkflowKey> {
  let { submissionId, offerId, contractId, milestoneId } = opts;

  // Milestone → contract
  if (milestoneId && !contractId) {
    const { data } = await supabase.from("contract_milestones")
      .select("contract_id, status").eq("id", milestoneId).maybeSingle();
    if (data) {
      contractId = data.contract_id;
      if (data.status === "fully_settled") return "fully_settled";
      if (data.status === "paid") return "payment_pending";
      if (data.status === "submitted") return "milestone_in_progress";
    }
  }

  // Submission → offer/contract
  if (submissionId && !contractId) {
    const { data: o } = await supabase.from("offers")
      .select("id, status").eq("submission_id", submissionId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (o) {
      offerId = o.id;
      const { data: c } = await supabase.from("contracts")
        .select("id, status, escrow_funded").eq("offer_id", o.id).maybeSingle();
      if (c) contractId = c.id;
    }
  }

  // Offer → contract
  if (offerId && !contractId) {
    const { data: c } = await supabase.from("contracts")
      .select("id").eq("offer_id", offerId).maybeSingle();
    if (c) contractId = c.id;
  }

  // Contract is highest authority
  if (contractId) {
    const { data: c } = await supabase.from("contracts")
      .select("status, escrow_funded").eq("id", contractId).maybeSingle();
    if (c) {
      if (c.status === "contract_completed") return "contract_completed";
      if (c.status === "contract_active" || c.status === "active") {
        // Look at milestones for finer detail
        const { data: ms } = await supabase.from("contract_milestones")
          .select("status").eq("contract_id", contractId);
        if (ms?.some((m) => m.status === "fully_settled")) return "fully_settled";
        if (ms?.some((m) => m.status === "paid")) return "payment_pending";
        return "milestone_in_progress";
      }
      if (c.status === "partially_signed") return "partially_signed";
      if (c.status === "sent_for_signing") return "sent_for_signing";
      if (c.status === "contract_drafted") return "contract_drafted";
    }
  }

  // Offer-only state
  if (offerId) {
    const { data: o } = await supabase.from("offers")
      .select("status").eq("id", offerId).maybeSingle();
    if (o) {
      if (o.status === "offer_accepted" || o.status === "accepted") return "offer_accepted";
      if (o.status === "offer_sent" || o.status === "pending" || o.status === "negotiating") return "offer_sent";
    }
  }

  // Submission-only state
  if (submissionId) {
    const { data: s } = await supabase.from("submissions")
      .select("status").eq("id", submissionId).maybeSingle();
    if (s) {
      if (s.status === "hired") return "offer_accepted";
      if (s.status === "shortlisted") {
        // Check for interview
        const { data: iv } = await supabase.from("interviews")
          .select("id").eq("submission_id", submissionId).limit(1).maybeSingle();
        return iv ? "interview_scheduled" : "shortlisted";
      }
      if (s.status === "under_review") return "under_review";
    }
  }

  return "submitted";
}
