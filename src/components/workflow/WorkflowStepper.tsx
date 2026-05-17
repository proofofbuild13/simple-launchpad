import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  "Submission",
  "Interview",
  "Offer",
  "Contract",
  "Active Work",
];

export function WorkflowStepper({ current }: { current: number }) {
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
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border",
                  done && "bg-primary text-primary-foreground border-primary",
                  active && "bg-primary/10 text-primary border-primary",
                  !done && !active && "bg-muted text-muted-foreground border-border"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] mt-1.5 whitespace-nowrap",
                  active ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {s}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-2",
                  done ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
