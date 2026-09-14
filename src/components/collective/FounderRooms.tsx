import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { CornerDownRight, Rocket, Loader2, Pencil, Trash2, X, Check, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ROOMS,
  ROOM_FILTERS,
  createRoomPost,
  deleteRoomPost,
  fetchProfileNames,
  fetchRoomPosts,
  updateRoomPost,
  fetchUserEngagements,
  toggleEngagement,
  UserEngagements,
} from "@/lib/collective";
import { CardEngagementBar } from "./CardEngagementBar";
import { CollectivePerspective } from "./CollectiveCards";

export function FounderRooms({
  perspective = "builder",
}: {
  perspective?: CollectivePerspective;
}) {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<string>("all");
  const [postRoom, setPostRoom] = useState<string>(ROOMS[0].id);
  const [posts, setPosts] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, { name: string; avatar: string | null }>>({});
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const [engagements, setEngagements] = useState<UserEngagements>({
    likes: new Set<string>(),
    saves: new Set<string>(),
  });

  const loadEngagements = useCallback(async () => {
    if (!user) return;
    const data = await fetchUserEngagements(user.id);
    setEngagements(data);
  }, [user]);

  useEffect(() => {
    loadEngagements();
  }, [loadEngagements]);

  const load = async (roomId: string) => {
    const rows = await fetchRoomPosts(roomId);
    setPosts(rows);
    setNames(await fetchProfileNames([...new Set(rows.map((r) => r.author_id))] as string[]));
  };

  useEffect(() => {
    load(room);
  }, [room]);

  const handleLikeToggle = async (postId: string) => {
    if (!user) {
      toast.error("Sign in to like posts");
      return false;
    }
    const isLiked = engagements.likes.has(postId);
    setEngagements((prev) => {
      const next = new Set(prev.likes);
      if (isLiked) next.delete(postId);
      else next.add(postId);
      return { ...prev, likes: next };
    });

    const res = await toggleEngagement(user.id, "room_post", postId, "like", isLiked);
    if (!res.success) {
      setEngagements((prev) => {
        const revert = new Set(prev.likes);
        if (isLiked) revert.add(postId);
        else revert.delete(postId);
        return { ...prev, likes: revert };
      });
      return false;
    }
    return true;
  };

  const handleSaveToggle = async (postId: string) => {
    if (!user) {
      toast.error("Sign in to save posts");
      return false;
    }
    const isSaved = engagements.saves.has(postId);
    setEngagements((prev) => {
      const next = new Set(prev.saves);
      if (isSaved) next.delete(postId);
      else next.add(postId);
      return { ...prev, saves: next };
    });

    const res = await toggleEngagement(user.id, "room_post", postId, "save", isSaved);
    if (!res.success) {
      setEngagements((prev) => {
        const revert = new Set(prev.saves);
        if (isSaved) revert.add(postId);
        else revert.delete(postId);
        return { ...prev, saves: revert };
      });
      return false;
    }
    return true;
  };

  const post = async (content: string, parentId: string | null) => {
    if (!content.trim()) return;
    setBusy(true);
    const targetRoom = parentId
      ? posts.find((p) => p.id === parentId)?.room_id ?? (room === "all" ? postRoom : room)
      : (room === "all" ? postRoom : room);
    const created = await createRoomPost(targetRoom, content.trim(), parentId);
    setBusy(false);
    if (!created) {
      toast.error("Could not post. Try again.");
      return;
    }
    setDraft("");
    setReplyDraft("");
    setReplyTo(null);
    load(room);
  };

  const saveEdit = async (id: string) => {
    if (!editDraft.trim()) return;
    setBusy(true);
    const { error } = await updateRoomPost(id, editDraft.trim());
    setBusy(false);
    if (error) {
      toast.error("Could not save changes.");
      return;
    }
    setEditingId(null);
    setEditDraft("");
    load(room);
  };

  const removePost = async (id: string) => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    const { error } = await deleteRoomPost(id);
    if (error) {
      toast.error("Could not delete.");
      return;
    }
    toast.success("Deleted");
    load(room);
  };

  const roots = posts.filter((p) => !p.parent_id);
  const repliesOf = (id: string) => posts.filter((p) => p.parent_id === id);

  return (
    <div className="space-y-6">
      {/* Horizontal room buttons at the top */}
      <div className="flex flex-wrap items-center gap-2">
        {ROOM_FILTERS.map((r) => (
          <Button
            key={r.id}
            size="sm"
            variant={room === r.id ? "default" : "outline"}
            className="rounded-full shrink-0 text-xs h-7 px-3"
            onClick={() => setRoom(r.id)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {/* Post creation composer - show ONLY for startup accounts */}
        {role === "startup" && (
          <Card className="border shadow-sm">
            <CardContent className="p-4 space-y-3">
              {room === "all" && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Room:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ROOMS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setPostRoom(r.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          postRoom === r.id
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Textarea
                placeholder={
                  room === "all"
                    ? `Share something with the ${ROOMS.find((r) => r.id === postRoom)?.label ?? "DeFi"} room…`
                    : `Share something with the ${ROOMS.find((r) => r.id === room)?.label} room…`
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="text-xs"
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {room !== "all" && (
                    <span>
                      Posting to{" "}
                      <span className="font-medium text-foreground">
                        {ROOMS.find((r) => r.id === room)?.label}
                      </span>
                    </span>
                  )}
                </div>
                <Button size="sm" className="h-8 text-xs" disabled={busy || !draft.trim()} onClick={() => post(draft, null)}>
                  {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />} Post
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {roots.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No posts yet. Start the conversation in this room.
            </CardContent>
          </Card>
        )}

        {roots.map((p) => {
          const author = names[p.author_id];
          const mine = p.author_id === user?.id;
          const replyCount = repliesOf(p.id).length;
          return (
            <Card key={p.id} className="transition-all duration-200 hover:shadow-md hover:border-violet-500/30">
              <CardContent className="p-5 space-y-3">
                {/* Header: avatar + name + room badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={author?.avatar ?? undefined} />
                      <AvatarFallback>{(author?.name ?? "M")[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-medium">{author?.name ?? "Member"}</div>
                        {p.room_id && (
                          <Badge variant="secondary" className="text-[11px] font-normal px-2 py-0">
                            {ROOMS.find((r) => r.id === p.room_id)?.label ?? p.room_id}
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {mine && editingId !== p.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label="Edit post"
                        onClick={() => {
                          setEditingId(p.id);
                          setEditDraft(p.content);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        aria-label="Delete post"
                        onClick={() => removePost(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Content / edit form */}
                {editingId === p.id ? (
                  <div className="space-y-2 mt-1">
                    <Textarea
                      rows={3}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 text-xs" disabled={busy} onClick={() => saveEdit(p.id)}>
                        <Check className="h-4 w-4 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap text-foreground/90">{p.content}</p>
                )}

                {/* Convert to challenge */}
                {mine && role === "startup" && (
                  <button
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    onClick={() =>
                      navigate("/projects/new", {
                        state: {
                          prefill: {
                            short_description: p.content.slice(0, 160),
                            description: p.content,
                            category: ROOMS.find((r) => r.id === (p.room_id || room))?.label,
                          },
                        },
                      })
                    }
                  >
                    <Rocket className="h-3 w-3" /> Turn into project / bounty
                  </button>
                )}

                {/* Primary CTA Row per perspective */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 font-medium text-xs bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                    onClick={() => setReplyTo(replyTo === p.id ? null : p.id)}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {perspective === "builder" ? "Join conversation" : "Reply to thread"}
                  </Button>
                </div>

                {/* Replies */}
                {repliesOf(p.id).length > 0 && (
                  <div className="pl-6 border-l space-y-3 pt-2">
                    {repliesOf(p.id).map((r) => {
                      const repAuthor = names[r.author_id];
                      const repMine = r.author_id === user?.id;
                      return (
                        <div key={r.id} className="text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">
                              {repAuthor?.name ?? "Member"}
                            </span>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span>{new Date(r.created_at).toLocaleDateString()}</span>
                              {repMine && (
                                <button
                                  className="text-destructive hover:underline"
                                  onClick={() => removePost(r.id)}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-muted-foreground whitespace-pre-wrap">{r.content}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply box */}
                {replyTo === p.id && (
                  <div className="space-y-2 pt-2 border-t">
                    <Textarea
                      placeholder="Write a reply…"
                      rows={2}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={busy || !replyDraft.trim()}
                        onClick={() => post(replyDraft, p.id)}
                      >
                        <CornerDownRight className="h-3 w-3 mr-1" /> Reply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => {
                          setReplyTo(null);
                          setReplyDraft("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Hairline Divider & Engagement Bar (below primary CTA) */}
                <CardEngagementBar
                  shareUrl={`${window.location.origin}/collective?tab=rooms`}
                  shareTitle={`Discussion in ${ROOMS.find((r) => r.id === p.room_id)?.label ?? "Founder Room"}`}
                  initialLikes={p.like_count ?? 0}
                  commentCount={replyCount}
                  isLiked={engagements.likes.has(p.id)}
                  isSaved={engagements.saves.has(p.id)}
                  onLikeToggle={() => handleLikeToggle(p.id)}
                  onSaveToggle={() => handleSaveToggle(p.id)}
                  onReply={() => setReplyTo(replyTo === p.id ? null : p.id)}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
