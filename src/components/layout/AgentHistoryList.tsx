import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ThreadRow = {
  id: string;
  status: string;
  updated_at: string;
  created_at: string;
};

type ThreadWithTitle = ThreadRow & { title: string };

async function fetchTitles(threadIds: string[]): Promise<Record<string, string>> {
  if (threadIds.length === 0) return {};
  const { data } = await supabase
    .from("agent_messages")
    .select("thread_id, content, role, created_at")
    .in("thread_id", threadIds)
    .eq("role", "user")
    .order("created_at", { ascending: true });
  const map: Record<string, string> = {};
  for (const m of (data ?? []) as any[]) {
    if (!map[m.thread_id] && typeof m.content === "string" && m.content.trim()) {
      map[m.thread_id] = m.content.trim().slice(0, 42);
    }
  }
  return map;
}

export function AgentHistoryList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { threadId } = useParams();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [threads, setThreads] = useState<ThreadWithTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("agent_threads")
      .select("id, status, updated_at, created_at")
      .eq("founder_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    const rows = (data ?? []) as ThreadRow[];
    const titles = await fetchTitles(rows.map((r) => r.id));
    setThreads(
      rows.map((r) => ({
        ...r,
        title: titles[r.id] || `New chat · ${new Date(r.created_at).toLocaleDateString()}`,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    void load();
    const channel = supabase
      .channel(`agent_threads_sidebar_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_threads", filter: `founder_id=eq.${user.id}` },
        () => void load()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_messages" },
        () => void load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function newChat() {
    if (!user || creating) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("agent_threads")
      .insert({ founder_id: user.id, status: "active", current_stage: 0, stats: {} })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("Couldn't create a new chat");
      return;
    }
    navigate(`/agent/${data.id}`);
  }

  if (collapsed) return null;

  return (
    <SidebarMenuSub>
      <SidebarMenuSubItem>
        <button
          onClick={newChat}
          disabled={creating}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          New chat
        </button>
      </SidebarMenuSubItem>

      {loading && threads.length === 0 && (
        <SidebarMenuSubItem>
          <span className="px-2 py-1.5 text-xs text-muted-foreground">Loading…</span>
        </SidebarMenuSubItem>
      )}

      {!loading && threads.length === 0 && (
        <SidebarMenuSubItem>
          <span className="px-2 py-1.5 text-xs text-muted-foreground">No chats yet</span>
        </SidebarMenuSubItem>
      )}

      {threads.map((t) => (
        <SidebarMenuSubItem key={t.id}>
          <SidebarMenuSubButton asChild isActive={threadId === t.id}>
            <NavLink to={`/agent/${t.id}`} className={cn("truncate")}>
              <span className="truncate">{t.title}</span>
            </NavLink>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );
}
