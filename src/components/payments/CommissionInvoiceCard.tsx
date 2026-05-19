import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  generated: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  sent: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  overdue: "bg-destructive/15 text-destructive border-destructive/30",
  waived: "bg-muted text-muted-foreground border-border",
};

export function CommissionInvoiceCard({ invoice, founderName, builderName, projectTitle, milestoneTitle }: any) {
  const overdue = invoice.status === "generated" && new Date(invoice.due_date) < new Date();
  const status = overdue ? "overdue" : invoice.status;
  return (
    <Card className="border-2">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tax invoice</div>
            <div className="text-lg font-semibold font-mono">{invoice.invoice_number}</div>
          </div>
          <Badge variant="outline" className={`${STATUS_COLORS[status]} capitalize`}>{status}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><div className="text-muted-foreground">From</div><div className="font-medium">{founderName ?? "Startup"}</div></div>
          <div><div className="text-muted-foreground">To</div><div className="font-medium">proof_of_Build Platform</div></div>
          <div><div className="text-muted-foreground">Project</div><div>{projectTitle}</div></div>
          <div><div className="text-muted-foreground">Milestone</div><div>{milestoneTitle}</div></div>
          <div><div className="text-muted-foreground">Builder paid</div><div>{builderName}</div></div>
          <div><div className="text-muted-foreground">Due date</div><div>{new Date(invoice.due_date).toLocaleDateString()}</div></div>
        </div>
        <div className="rounded-md border-t pt-2 space-y-1 text-xs">
          <div className="flex justify-between"><span>Base amount</span><span className="font-mono">${Number(invoice.base_amount).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Platform fee</span><span className="font-mono">${Number(invoice.commission_amount).toFixed(2)}</span></div>
          <div className="flex justify-between text-base font-semibold pt-1 border-t"><span>Total due</span><span className="font-mono">${Number(invoice.commission_amount).toFixed(2)}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}
