import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { CornerDownRight, Rocket, Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ROOMS,
  createRoomPost,
  deleteRoomPost,
  fetchProfileNames,
  fetchRoomPosts,
  updateRoomPost,
} from "@/lib/collective";

export function FounderRooms() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<string>(ROOMS[0].id);
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
    const created = await createRoomPost(room, content.trim(), parentId);
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
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <div className="flex lg:flex-col gap-2 overflow-x-auto">
        {ROOMS.map((r) => (
          <Button
            key={r.id}
            variant={room === r.id ? "secondary" : "ghost"}
            className="justify-start shrink-0"
            onClick={() => setRoom(r.id)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <Textarea
              placeholder={`Share something with the ${ROOMS.find((r) => r.id === room)?.label} room…`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end">
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
          return (
            <Card key={p.id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={author?.avatar ?? undefined} />
                    <AvatarFallback>{(author?.name ?? "M")[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{author?.name ?? "Member"}</div>
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
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setReplyTo(replyTo === p.id ? null : p.id)}
                      >
                        Reply
                      </button>
                      {mine && role === "startup" && (
                        <button
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          onClick={() =>
                            navigate("/projects/new", {
                              state: {
                                prefill: {
                                  short_description: p.content.slice(0, 160),
                                  description: p.content,
                                  category: ROOMS.find((r) => r.id === room)?.label,
                                },
                              },
                            })
                          }
                        >
                          <Rocket className="h-3 w-3" /> Convert to challenge
                        </button>
                      )}
                      <span className="text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

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
