import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Clock, Briefcase, Loader2, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { engagementBadgeClass, engagementLabel, formatCtcRange } from "@/lib/engagement";


const OPEN_STATUSES = ["open", "open_for_submissions", "reviewing_submissions", "hiring_in_progress"];

export default function BrowseProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(false);
  const [countsError, setCountsError] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [eng, setEng] = useState("all");

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
        setCountsLoading(true);
        setCountsError(false);
        try {
          const { data: subs, error } = await supabase.rpc("get_project_submission_counts", { _ids: ids });
          if (error) throw error;
          const map: Record<string, number> = {};
          (subs ?? []).forEach((s: any) => { map[s.project_id] = Number(s.count) || 0; });
          setCounts(map);
        } catch (err) {
          setCountsError(true);
          console.error("Failed to load submission counts:", err);
        } finally {
          setCountsLoading(false);
        }
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
    (eng === "all" || (p.engagement_type ?? "project_hire") === eng) &&
    (q === "" || p.title?.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Browse open challenges | proof_of_Build</title>
        <meta name="description" content="Browse open startup challenges on proof_of_Build. Submit working prototypes, win escrow-backed engagements, and get hired by founders." />
        <link rel="canonical" href="https://proofbuild.in/browse" />
        <meta property="og:title" content="Browse open challenges — proof_of_Build" />
        <meta property="og:description" content="Pick a challenge, submit your build, get hired." />
        <meta property="og:url" content="https://proofbuild.in/browse" />
      </Helmet>
      <div>
        <h1 className="text-2xl font-semibold">Browse projects</h1>
        <p className="text-sm text-muted-foreground">Pick a challenge. Submit your build. Get hired — for a project or a full-time role.</p>
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
        <Select value={eng} onValueChange={setEng}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All engagement types</SelectItem>
            <SelectItem value="project_hire">Project Hire</SelectItem>
            <SelectItem value="hire_to_build">Hire to Build (Full-time)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No matching projects.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const closed = p.deadline && new Date(p.deadline) < new Date();
            const h2b = p.engagement_type === "hire_to_build";
            return (
              <Link key={p.id} to={`/projects/${p.id}`}>
                <Card className={`hover:border-primary/50 transition h-full ${h2b ? "border-l-4 border-l-emerald-500" : ""}`}>
                  <CardContent className="pt-5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm">{p.title}</h3>
                      <div className="flex items-center gap-1">
                        {h2b ? (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                            <Briefcase className="h-3 w-3 mr-1" />{formatCtcRange(p)}
                          </Badge>
                        ) : (
                          p.budget && <Badge variant="secondary">${p.budget}</Badge>
                        )}
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
                      <Badge variant="outline" className={engagementBadgeClass(p.engagement_type)}>
                        {engagementLabel(p.engagement_type)}
                      </Badge>
                      {p.category && <Badge variant="outline">{p.category}</Badge>}
                      {h2b && p.location_type && <Badge variant="outline">{p.location_type}</Badge>}
                      {!h2b && p.difficulty && <Badge variant="outline">{p.difficulty}</Badge>}
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {countsLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : countsError ? (
                          <span className="flex items-center gap-1 text-destructive" title="Failed to load count">
                            <AlertTriangle className="h-3 w-3" /> —
                          </span>
                        ) : (
                          <>{counts[p.id] ?? 0} {h2b ? "applicants" : "submissions"}</>
                        )}
                      </span>
                      {!h2b && p.deadline && (
                        <span className={`flex items-center gap-1 ${closed ? "text-destructive" : ""}`}>
                          <Clock className="h-3 w-3" /> {closed ? "Closed" : formatDistanceToNow(new Date(p.deadline), { addSuffix: true })}
                        </span>
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
