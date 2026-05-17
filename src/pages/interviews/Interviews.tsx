import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_COLOR: Record<string, string> = {
  invited: "bg-blue-500/15 text-blue-600",
  confirmed: "bg-emerald-500/15 text-emerald-600",
  declined: "bg-destructive/15 text-destructive",
  rescheduled: "bg-amber-500/15 text-amber-600",
  completed: "bg-primary/15 text-primary",
  cancelled: "bg-muted text-muted-foreground",
};

export default function Interviews() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("interviews")
      .select("*, projects(title)")
      .or(`founder_id.eq.${user.id},builder_id.eq.${user.id}`)
      .order("scheduled_at", { ascending: true });
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const respond = async (id: string, status: string) => {
    await supabase.from("interviews").update({ status, builder_responded_at: new Date().toISOString() }).eq("id", id);
    toast.success(`Interview ${status}`);
    load();
  };

  const markCompleted = async (id: string) => {
    await supabase.from("interviews").update({ status: "completed", outcome: "completed" }).eq("id", id);
    toast.success("Marked completed");
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold">Interviews</h1>
      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No interviews scheduled.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {items.map((i) => (
            <Card key={i.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{i.projects?.title}</CardTitle>
                    <p className="text-xs text-muted-foreground capitalize mt-1">{i.type.replace("_", " ")}</p>
                  </div>
                  <Badge className={STATUS_COLOR[i.status]} variant="outline">{i.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {i.scheduled_at && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(i.scheduled_at), "PPp")}
                  </div>
                )}
                {i.context_message && <p className="text-foreground/80">{i.context_message}</p>}
                <div className="flex gap-2 flex-wrap pt-2">
                  {i.meeting_url && (
                    <a href={i.meeting_url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5 mr-2" />Join</Button>
                    </a>
                  )}
                  {role === "builder" && i.status === "invited" && (
                    <>
                      <Button size="sm" onClick={() => respond(i.id, "confirmed")}>Accept</Button>
                      <Button size="sm" variant="ghost" onClick={() => respond(i.id, "declined")}>Decline</Button>
                    </>
                  )}
                  {role === "startup" && (i.status === "confirmed" || i.status === "invited") && (
                    <Button size="sm" variant="secondary" onClick={() => markCompleted(i.id)}>Mark completed</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
