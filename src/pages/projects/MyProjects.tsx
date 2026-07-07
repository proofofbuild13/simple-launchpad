import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreVertical, PlusCircle, Pencil, Archive, RefreshCw, Trash2, XCircle, Inbox, Trophy } from "lucide-react";
import { toast } from "sonner";

export default function MyProjects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; info: any } | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("projects").select("*").eq("founder_id", user.id)
      .order("created_at", { ascending: false });
    const list = data ?? [];
    setProjects(list);
    if (list.length) {
      const { data: counts } = await supabase.rpc("get_project_submission_counts", {
        _ids: list.map((p) => p.id),
      });
      const map: Record<string, number> = {};
      (counts ?? []).forEach((c: any) => { map[c.project_id] = Number(c.count) || 0; });
      setSubmissionCounts(map);
    } else {
      setSubmissionCounts({});
    }
  };
  useEffect(() => { load(); }, [user]);

  const setStatus = async (id: string, status: string, extra: any = {}) => {
    const { error } = await supabase.from("projects").update({
      status, ...extra, updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Project updated");
    load();
  };

  const askDelete = async (p: any) => {
    const { data } = await supabase.rpc("can_delete_project", { _project_id: p.id });
    setConfirmDelete({ id: p.id, info: data });
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    if (!confirmDelete.info?.can_delete) {
      toast.error("Cannot delete: project has active contracts, payments or disputes.");
      setConfirmDelete(null);
      return;
    }
    const { error } = await supabase.from("projects").delete().eq("id", confirmDelete.id);
    if (error) return toast.error(error.message);
    toast.success("Project deleted");
    setConfirmDelete(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My projects</h1>
        <Link to="/projects/new"><Button><PlusCircle className="h-4 w-4 mr-2" />Post a project</Button></Link>
      </div>
      {projects.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No projects yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/projects/${p.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/projects/${p.id}`);
                }
              }}
              className="hover:border-primary/50 hover:shadow-md transition h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm hover:underline">{p.title}</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/projects/${p.id}/edit`)}>
                          <Pencil className="h-4 w-4 mr-2" />Edit
                        </DropdownMenuItem>
                        {p.status !== "closed" && (
                          <DropdownMenuItem onClick={() => setStatus(p.id, "closed")}>
                            <XCircle className="h-4 w-4 mr-2" />Close submissions
                          </DropdownMenuItem>
                        )}
                        {p.status !== "archived" ? (
                          <DropdownMenuItem onClick={() => setStatus(p.id, "archived", { archived_at: new Date().toISOString() })}>
                            <Archive className="h-4 w-4 mr-2" />Archive
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setStatus(p.id, "open", { archived_at: null })}>
                            <RefreshCw className="h-4 w-4 mr-2" />Reopen
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => askDelete(p)}>
                          <Trash2 className="h-4 w-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">{(p.status ?? "").replace(/_/g, " ")}</Badge>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.short_description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                  <span>{p.category}</span>
                  {p.budget && <span className="font-medium text-foreground">${p.budget}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDelete?.info?.can_delete ? "Delete project?" : "Cannot delete"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.info?.can_delete
                ? (confirmDelete.info.has_submissions
                    ? "This project has submissions. Consider archiving to preserve history. Deleting is permanent."
                    : "This will permanently remove the project.")
                : "This project has active contracts, payments or disputes. Archive it instead."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {confirmDelete?.info?.can_delete && (
              <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
