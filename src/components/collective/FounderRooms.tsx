import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { CornerDownRight, Rocket, Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ROOMS,
  ROOM_FILTERS,
  createRoomPost,
  deleteRoomPost,
  fetchProfileNames,
  fetchRoomPosts,
  updateRoomPost,
} from "@/lib/collective";
import { CardEngagementBar } from "./CardEngagementBar";

export function FounderRooms() {
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

  const load = async (roomId: string) => {
    const rows = await fetchRoomPosts(roomId);
    setPosts(rows);
    setNames(await fetchProfileNames([...new Set(rows.map((r) => r.author_id))] as string[]));
  };

  useEffect(() => {
    load(room);
  }, [room]);

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
            className="rounded-full shrink-0"
            onClick={() => setRoom(r.id)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        <Card>
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
              <Button size="sm" disabled={busy || !draft.trim()} onClick={() => post(draft, null)}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Post
              </Button>
            </div>
          </CardContent>
        </Card>

        {roots.length === 0 && (
          <p className="text-sm text-muted-foreground">No posts yet. Start the conversation.</p>
        )}

        {roots.map((p) => {
          const author = names[p.author_id];
          const mine = p.author_id === user?.id;
          const replyCount = repliesOf(p.id).length;
          return (
            <Card key={p.id}>
              <CardContent className="p-5 space-y-3">
                {/* Header: avatar + name + room badge + engagement bar */}
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
                  <div className="flex items-center gap-1 shrink-0">
                    <CardEngagementBar
                      replyCount={replyCount}
                      onReply={() => setReplyTo(replyTo === p.id ? null : p.id)}
                    />
                    {mine && editingId !== p.id && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>

                {/* Content / edit form */}
                {editingId === p.id ? (
                  <div className="space-y-2 mt-1">
                    <Textarea
                      rows={3}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => saveEdit(p.id)}>
                        <Check className="h-4 w-4 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{p.content}</p>
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
                    <Rocket className="h-3 w-3" /> Convert to challenge
                  </button>
                )}

                {repliesOf(p.id).map((r) => (
                  <div key={r.id} className="ml-11 flex items-start gap-2 text-sm">
                    <CornerDownRight className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    {editingId === r.id ? (
                      <div className="flex-1 space-y-2">
                        <Textarea
                          rows={2}
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" disabled={busy} onClick={() => saveEdit(r.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <span className="font-medium">{names[r.author_id]?.name ?? "Member"}</span>{" "}
                        <span className="whitespace-pre-wrap">{r.content}</span>
                      </div>
                    )}
                    {r.author_id === user?.id && editingId !== r.id && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          aria-label="Edit reply"
                          onClick={() => {
                            setEditingId(r.id);
                            setEditDraft(r.content);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive"
                          aria-label="Delete reply"
                          onClick={() => removePost(r.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {replyTo === p.id && (
                  <div className="ml-11 space-y-2">
                    <Textarea
                      rows={2}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Write a reply…"
                    />
                    <Button size="sm" disabled={busy} onClick={() => post(replyDraft, p.id)}>
                      Reply
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
