import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bookmark, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function SavedProjects() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("saved_projects")
      .select("id, saved_at, project_id, projects(*)")
      .eq("user_id", user.id)
      .order("saved_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const unsave = async (id: string) => {
    await supabase.from("saved_projects").delete().eq("id", id);
    toast.success("Removed");
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Saved projects</h1>
        <p className="text-sm text-muted-foreground">Projects you bookmarked for later.</p>
      </div>
      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nothing saved yet. Browse projects and tap the bookmark icon.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((row) => {
            const p = row.projects;
            if (!p) return null;
            return (
              <Card key={row.id} className="hover:border-primary/50 transition">
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/projects/${p.id}`} className="font-semibold text-sm hover:underline">{p.title}</Link>
                    {p.budget && <Badge variant="secondary">${p.budget}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.short_description}</p>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-2">
                    {p.status && <Badge variant="outline" className="text-[10px]">{p.status.replace(/_/g, " ")}</Badge>}
                    {p.deadline && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(p.deadline), { addSuffix: true })}</span>
                    )}
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button size="sm" variant="ghost" onClick={() => unsave(row.id)}>
                      <Bookmark className="h-4 w-4 mr-1 fill-current" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
