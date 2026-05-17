import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const OPEN_STATUSES = ["open", "open_for_submissions", "reviewing_submissions", "hiring_in_progress"];

export default function BrowseProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("visibility", "public")
        .in("status", OPEN_STATUSES)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      const list = data ?? [];
      setProjects(list);
      if (list.length) {
        const ids = list.map((p) => p.id);
        const { data: subs } = await supabase
          .from("submissions").select("project_id").in("project_id", ids);
        const map: Record<string, number> = {};
        (subs ?? []).forEach((s: any) => { map[s.project_id] = (map[s.project_id] ?? 0) + 1; });
        setCounts(map);
        if (user) {
          const { data: saved } = await supabase
            .from("saved_projects").select("project_id").eq("user_id", user.id).in("project_id", ids);
          setSavedIds(new Set((saved ?? []).map((s: any) => s.project_id)));
        }
      }
    })();
  }, [user]);

  const toggleSave = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast.error("Sign in to save"); return; }
    if (savedIds.has(projectId)) {
      const { error } = await supabase.from("saved_projects").delete().eq("user_id", user.id).eq("project_id", projectId);
      if (error) { console.error("Remove save error:", error); toast.error("Failed to remove save"); return; }
      const next = new Set(savedIds); next.delete(projectId); setSavedIds(next);
      toast.success("Removed from saved");
    } else {
      const { error } = await supabase.from("saved_projects").insert({ user_id: user.id, project_id: projectId });
      if (error) { console.error("Save error:", error); toast.error(error.message || "Failed to save project"); return; }
      const next = new Set(savedIds); next.add(projectId); setSavedIds(next);
      toast.success("Project saved");
    }
  };

  const handleShare = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const link = `${window.location.origin}/p/${projectId}`;
    navigator.clipboard.writeText(link);
    toast.success("Share link copied to clipboard");
  };

  const filtered = projects.filter((p) =>
    (cat === "all" || p.category === cat) &&
    (q === "" || p.title?.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Browse projects</h1>
        <p className="text-sm text-muted-foreground">Pick a challenge. Submit your build. Get hired.</p>
      </div>
      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Search projects..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {["AI", "SaaS", "Mobile", "Web", "No-code", "Marketing", "Data"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No matching projects.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const closed = p.deadline && new Date(p.deadline) < new Date();
            return (
              <Link key={p.id} to={`/projects/${p.id}`}>
                <Card className="hover:border-primary/50 transition h-full">
                  <CardContent className="pt-5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm">{p.title}</h3>
                      <div className="flex items-center gap-1">
                        {p.budget && <Badge variant="secondary">${p.budget}</Badge>}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleShare(e, p.id)}>
                          <Share2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => toggleSave(e, p.id)}>
                          <Bookmark className={`h-4 w-4 ${savedIds.has(p.id) ? "fill-current text-primary" : "text-muted-foreground"}`} />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.short_description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 flex-wrap">
                      {p.category && <Badge variant="outline">{p.category}</Badge>}
                      {p.difficulty && <Badge variant="outline">{p.difficulty}</Badge>}
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {counts[p.id] ?? 0} submissions</span>
                      {p.deadline && (
                        <span className={`flex items-center gap-1 ${closed ? "text-destructive" : ""}`}>
                          <Clock className="h-3 w-3" /> {closed ? "Closed" : formatDistanceToNow(new Date(p.deadline), { addSuffix: true })}
                        </span>
                      )}
                      {p.status && p.status !== "open" && (
                        <Badge variant="outline" className="text-[10px]">{p.status.replace(/_/g, " ")}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
