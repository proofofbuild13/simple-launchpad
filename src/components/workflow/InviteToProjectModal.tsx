import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Send, FolderKanban, Clock, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  builderId: string;
  builderName?: string;
}

export function InviteToProjectModal({ open, onOpenChange, builderId, builderName }: Props) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [existingInvites, setExistingInvites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setLoading(true);
      const [{ data: projs }, { data: invites }] = await Promise.all([
        supabase
          .from("projects")
          .select("id, title, status, category, deadline, created_at")
          .eq("founder_id", user.id)
          .in("status", ["open", "in_progress"])
          .order("created_at", { ascending: false }),
        supabase
          .from("project_invitations")
          .select("project_id")
          .eq("founder_id", user.id)
          .eq("builder_id", builderId)
          .in("status", ["sent", "viewed"]),
      ]);
      setProjects(projs ?? []);
      setExistingInvites(new Set((invites ?? []).map((i: any) => i.project_id)));
      setSelected(null);
      setMessage("");
      setLoading(false);
    })();
  }, [open, user, builderId]);

  const submit = async () => {
    if (!user || !selected) return;
    setSending(true);
    try {
      // Create invitation record
      const { error } = await (supabase as any)
        .from("project_invitations")
        .insert({
          project_id: selected,
          founder_id: user.id,
          builder_id: builderId,
          message: message || null,
          status: "sent",
        });
      if (error) throw error;

      // Get project title for notification
      const project = projects.find((p) => p.id === selected);

      // Notify builder
      await supabase.from("notifications").insert({
        user_id: builderId,
        type: "project_invitation",
        title: "You were invited to join a project",
        body: `You've been invited to "${project?.title}". View and respond to this invitation.`,
        link: `/projects/${selected}`,
      });

      // Log activity
      await supabase.from("admin_audit_logs").insert({
        action_type: "project_invitation_sent",
        actor_id: user.id,
        actor_role: "startup",
        entity_type: "project_invitations",
        entity_id: selected,
        metadata: { builder_id: builderId, project_title: project?.title },
      });

      toast.success(`Invitation sent to ${builderName ?? "builder"}`);
      setExistingInvites((prev) => new Set([...prev, selected]));
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite to Project</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select a project to invite {builderName ?? "this builder"} to join.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No active projects. Post a project first to send invitations.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {projects.map((p) => {
                const alreadyInvited = existingInvites.has(p.id);
                const isSelected = selected === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={alreadyInvited}
                    onClick={() => setSelected(p.id)}
                    className={`w-full text-left rounded-lg border-2 p-3 transition-all ${
                      alreadyInvited
                        ? "opacity-50 cursor-not-allowed border-muted"
                        : isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium text-sm">{p.title}</div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-[10px]">
                              {p.category}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {p.status}
                            </Badge>
                            {p.deadline && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(p.deadline).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {alreadyInvited ? (
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Invited
                        </Badge>
                      ) : isSelected ? (
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <Label>Message (optional)</Label>
              <Textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal note to the invitation..."
              />
            </div>

            <Button className="w-full" onClick={submit} disabled={!selected || sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Invitation
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
