import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Paperclip, Archive } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";

type Conversation = {
  id: string;
  type: string;
  last_message_at: string | null;
  otherUserId?: string;
  otherProfile?: { full_name: string; avatar_url?: string } | null;
  lastMessage?: string;
  unread?: number;
  archived?: boolean;
};

export default function Messages() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(params.get("c"));
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Load conversation list */
  const loadConversations = async () => {
    if (!user) return;
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at, archived")
      .eq("user_id", user.id);
    const ids = (parts ?? []).map((p) => p.conversation_id);
    if (ids.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }
    const { data: convs } = await supabase
      .from("conversations").select("*").in("id", ids)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    const { data: others } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", ids)
      .neq("user_id", user.id);
    const otherIds = Array.from(new Set((others ?? []).map((o) => o.user_id)));
    const profilesMap: Record<string, any> = {};
    if (otherIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, avatar_url").in("id", otherIds);
      (profs ?? []).forEach((p: any) => { profilesMap[p.id] = p; });
    }
    const lastMsgMap: Record<string, any> = {};
    const { data: lastMsgs } = await supabase
      .from("messages_v2").select("conversation_id, content, message_type, created_at")
      .in("conversation_id", ids).order("created_at", { ascending: false });
    (lastMsgs ?? []).forEach((m: any) => {
      if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m;
    });

    const partMap: Record<string, any> = {};
    (parts ?? []).forEach((p) => { partMap[p.conversation_id] = p; });

    const list: Conversation[] = (convs ?? []).map((c) => {
      const otherRow = (others ?? []).find((o) => o.conversation_id === c.id);
      const otherProfile = otherRow ? profilesMap[otherRow.user_id] : null;
      const last = lastMsgMap[c.id];
      const lastRead = partMap[c.id]?.last_read_at;
      const unread = last && (!lastRead || new Date(last.created_at) > new Date(lastRead)) ? 1 : 0;
      return {
        id: c.id,
        type: c.type,
        last_message_at: c.last_message_at,
        otherUserId: otherRow?.user_id,
        otherProfile,
        lastMessage: last?.message_type === "text" ? last.content : last ? "[attachment]" : "",
        unread,
        archived: partMap[c.id]?.archived,
      };
    });
    setConversations(list);
    setLoading(false);
  };

  useEffect(() => { loadConversations(); }, [user]);

  /* Load messages for active conversation */
  const loadMessages = async (cid: string) => {
    const { data } = await supabase
      .from("messages_v2").select("*")
      .eq("conversation_id", cid).order("created_at", { ascending: true });
    setMessages(data ?? []);
    // mark read
    if (user) {
      await supabase.from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", cid).eq("user_id", user.id);
    }
    setTimeout(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight }), 50);
  };

  useEffect(() => {
    if (!activeId) return;
    setParams((p) => { p.set("c", activeId); return p; }, { replace: true });
    loadMessages(activeId);
  }, [activeId]);

  /* Realtime subscription on active conversation */
  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`messages:${activeId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages_v2", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          setMessages((m) => [...m, payload.new]);
          setTimeout(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" }), 50);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId]);

  /* Global realtime to update conversation list */
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("messages-global")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages_v2" },
        () => loadConversations())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const send = async () => {
    if (!user || !activeId || !text.trim()) return;
    setSending(true);
    const { error } = await supabase.from("messages_v2").insert({
      conversation_id: activeId,
      sender_id: user.id,
      message_type: "text",
      content: text.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
  };

  const uploadFile = async (file: File) => {
    if (!user || !activeId) return;
    const path = `${user.id}/${activeId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("message-attachments").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    const { data: signed } = await supabase.storage.from("message-attachments").createSignedUrl(path, 60 * 60 * 24 * 7);
    const isImage = file.type.startsWith("image/");
    await supabase.from("messages_v2").insert({
      conversation_id: activeId,
      sender_id: user.id,
      message_type: isImage ? "image" : "file",
      content: file.name,
      attachment_url: signed?.signedUrl ?? null,
      metadata: { path, mime: file.type, size: file.size },
    });
  };

  const archiveConv = async (cid: string) => {
    if (!user) return;
    await supabase.from("conversation_participants")
      .update({ archived: true }).eq("conversation_id", cid).eq("user_id", user.id);
    toast.success("Archived");
    loadConversations();
  };

  const active = useMemo(() => conversations.find((c) => c.id === activeId), [conversations, activeId]);
  const visible = conversations.filter((c) => !c.archived);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <h1 className="text-2xl font-semibold mb-4">Messages</h1>
      <Card className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[300px_1fr] overflow-hidden">
        {/* Sidebar */}
        <div className="border-r overflow-y-auto">
          {visible.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No conversations yet. Start one from a profile, project, or contract.
            </div>
          ) : visible.map((c) => {
            const initials = (c.otherProfile?.full_name ?? "?").slice(0,1).toUpperCase();
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full flex items-center gap-3 p-3 border-b text-left hover:bg-muted/50 ${activeId === c.id ? "bg-muted" : ""}`}
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={c.otherProfile?.avatar_url} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{c.otherProfile?.full_name ?? "Unknown"}</span>
                    {c.last_message_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(c.last_message_at))}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate">{c.lastMessage}</span>
                    {!!c.unread && <Badge className="h-4 text-[10px] px-1.5">{c.unread}</Badge>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Chat pane */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="border-b px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={active.otherProfile?.avatar_url} />
                    <AvatarFallback>{(active.otherProfile?.full_name ?? "?").slice(0,1)}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm font-medium">{active.otherProfile?.full_name ?? "Conversation"}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => archiveConv(active.id)}>
                  <Archive className="h-4 w-4 mr-1" />Archive
                </Button>
              </div>
              <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {m.message_type === "image" && m.attachment_url && (
                          <a href={m.attachment_url} target="_blank" rel="noreferrer">
                            <img src={m.attachment_url} alt={m.content} className="rounded mb-1 max-h-56" />
                          </a>
                        )}
                        {m.message_type === "file" && m.attachment_url && (
                          <a href={m.attachment_url} target="_blank" rel="noreferrer" className="underline text-xs">
                            📎 {m.content}
                          </a>
                        )}
                        {m.message_type === "text" && (
                          <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                        )}
                        <div className="text-[10px] opacity-70 mt-1">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t p-3 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                />
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  placeholder="Type a message..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
                />
                <Button onClick={send} disabled={sending || !text.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
