import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MySubmissions() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      if (role === "builder") {
        const { data } = await supabase.from("submissions").select("*, projects(id, title)").eq("builder_id", user.id).order("created_at", { ascending: false });
        setItems(data ?? []);
      } else {
        const { data } = await supabase.from("submissions").select("*, projects!inner(id, title, founder_id)").eq("projects.founder_id", user.id).order("created_at", { ascending: false });
        setItems(data ?? []);
      }
    })();
  }, [user, role]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{role === "builder" ? "My submissions" : "Submissions on my projects"}</h1>
      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nothing here yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {items.map((s) => (
            <Link key={s.id} to={`/submissions/${s.id}`}>
              <Card className="hover:border-primary/50 transition">
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{s.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">on {s.projects?.title}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.score != null && <Badge variant="secondary">Score {s.score}</Badge>}
                    <Badge variant="outline">{s.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
