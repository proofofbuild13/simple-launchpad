import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function MySubmissions() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const navigate = useNavigate();

  const loadSubmissions = async () => {
    if (!user) return;
    if (role === "builder") {
      const { data } = await supabase.from("submissions").select("*, projects(id, title), ai_submission_evaluations(total_score, recommendation)").eq("builder_id", user.id).order("created_at", { ascending: false });
      setItems(data ?? []);
    } else {
      const { data } = await supabase.from("submissions").select("*, projects!inner(id, title, founder_id), ai_submission_evaluations(total_score, recommendation)").eq("projects.founder_id", user.id).order("created_at", { ascending: false });
      setItems(data ?? []);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [user, role]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this submission? This action cannot be undone.")) return;
    
    const { error } = await supabase.from("submissions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    
    toast.success("Submission deleted");
    setItems((prev) => prev.filter((s) => s.id !== id));
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/submissions/${id}/edit`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{role === "builder" ? "My submissions" : "Submissions on my projects"}</h1>
      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nothing here yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {items.map((s) => (
            <Link key={s.id} to={`/submissions/${s.id}`} className="block">
              <Card className="hover:border-primary/50 transition">
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{s.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">on {s.projects?.title}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const ev = s.ai_submission_evaluations?.[0];
                      if (!ev) return null;
                      const rec = ev.recommendation;
                      const cls =
                        rec === "shortlist"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : rec === "pass"
                          ? "bg-destructive/15 text-destructive border-destructive/30"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
                      return (
                        <Badge className={`${cls} border gap-1`} variant="outline">
                          <Sparkles className="h-3 w-3" /> AI {ev.total_score}/100
                        </Badge>
                      );
                    })()}
                    {s.score != null && <Badge variant="secondary">Score {s.score}</Badge>}
                    <Badge variant="outline">{s.status}</Badge>
                    
                    
                    {role === "builder" && (
                      <div className="flex items-center gap-1 ml-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => handleEdit(e, s.id)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDelete(e, s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
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
