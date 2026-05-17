import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Shield className="h-6 w-6" /> Admin panel</h1>
        <p className="text-sm text-muted-foreground">Platform KPIs, moderation, users, disputes.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {["Users", "Projects", "Submissions", "Active contracts", "Revenue", "Open disputes"].map((l) => (
          <Card key={l}><CardHeader><CardTitle className="text-sm text-muted-foreground">{l}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">—</p></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Coming soon</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Moderation queue, user management, dispute resolution and revenue analytics will land here.</CardContent>
      </Card>
    </div>
  );
}
