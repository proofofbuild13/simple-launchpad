import { BUILDER_PROFILE_PUBLIC_COLUMNS } from "@/lib/builderProfileFields";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2,
  Star,
  Bookmark,
  BookmarkX,
  Send,
  MessageSquare,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { MessageButton } from "@/components/messaging/MessageButton";
import { InviteToProjectModal } from "@/components/workflow/InviteToProjectModal";

export default function SavedBuilders() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [builders, setBuilders] = useState<any[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<any>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: saved } = await supabase
      .from("saved_builders")
      .select("id, builder_id, created_at")
      .eq("founder_id", user.id)
      .order("created_at", { ascending: false });

    if (saved && saved.length > 0) {
      const builderIds = saved.map((s: any) => s.builder_id);
      const { data: profiles } = await supabase
        .from("builder_profiles")
        .select(BUILDER_PROFILE_PUBLIC_COLUMNS)
        .in("id", builderIds);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      setBuilders(
        saved.map((s: any) => ({
          ...s,
          profile: profileMap.get(s.builder_id),
        }))
      );
    } else {
      setBuilders([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const unsave = async (savedId: string) => {
    await supabase.from("saved_builders").delete().eq("id", savedId);
    toast.success("Builder removed from saved");
    setBuilders((prev) => prev.filter((b) => b.id !== savedId));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Saved Builders</h1>
          <p className="text-sm text-muted-foreground">
            {builders.length} builder{builders.length !== 1 ? "s" : ""} saved
          </p>
        </div>
        <Link to="/marketplace">
          <Button variant="outline">Browse marketplace</Button>
        </Link>
      </div>

      {builders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No saved builders yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Browse the marketplace to discover talented builders.
            </p>
            <Link to="/marketplace">
              <Button className="mt-4">Explore builders</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {builders.map((item) => {
            const p = item.profile;
            if (!p) return null;
            const initials = (p.full_name ?? "B").slice(0, 1).toUpperCase();
            return (
              <Card key={item.id} className="group hover:border-primary/40 transition-colors">
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <Link to={`/builders/${p.id}`}>
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={p.avatar_url} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/builders/${p.id}`}>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm truncate hover:text-primary transition-colors">
                            {p.full_name}
                          </h3>
                          {p.verified && <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                        </div>
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">{p.title ?? "Builder"}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {p.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {p.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {Number(p.rating ?? 0).toFixed(1)}
                        </span>
                        {p.available && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px]">
                            Available
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {p.skills && p.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {p.skills.slice(0, 4).map((s: string) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                      {p.skills.length > 4 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{p.skills.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground mt-3">
                    Saved {new Date(item.created_at).toLocaleDateString()}
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <MessageButton recipientId={p.id} variant="outline" size="sm" className="flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setInviteTarget(p);
                        setInviteOpen(true);
                      }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Invite
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => unsave(item.id)}
                    >
                      <BookmarkX className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {inviteTarget && (
        <InviteToProjectModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          builderId={inviteTarget.id}
          builderName={inviteTarget.full_name}
        />
      )}
    </div>
  );
}
