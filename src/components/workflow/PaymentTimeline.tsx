import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  "Approved",
  "Startup Paying",
  "Builder Confirming",
  "Invoice",
  "Platform Fee Paying",
  "Admin Verifying",
  "Settled",
];

export function PaymentTimeline({ current }: { current: number }) {
  return (
    <div className="flex items-center w-full">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-medium border",
                  done && "bg-primary text-primary-foreground border-primary",
                  active && "bg-primary/10 text-primary border-primary",
                  !done && !active && "bg-muted text-muted-foreground border-border",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] mt-1.5 whitespace-nowrap",
                  active ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {s}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={cn("h-0.5 flex-1 mx-2", done ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function paymentStageIndex(args: {
  paymentRecord?: { status: string } | null;
  invoice?: { status: string } | null;
  commissionPayment?: { status: string } | null;
}): number {
  const { paymentRecord, invoice, commissionPayment } = args;
  if (commissionPayment?.status === "admin_verified" && invoice?.status === "paid") return 7;
  if (commissionPayment?.status === "submitted") return 5;
  if (invoice && invoice.status !== "paid") return 4;
  if (paymentRecord?.status === "confirmed") return 3;
  if (paymentRecord?.status === "declared") return 2;
  if (paymentRecord?.status === "disputed") return 2;
  if (!paymentRecord) return 1;
  return 0;
}
