import { useEffect, useRef, useState } from "react";
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
import { getFounderAgentError } from "@/lib/founderAgentClient";

type ThreadRow = {
  id: string;
  status: string;
  updated_at: string;
  created_at: string;
};

type ThreadWithTitle = ThreadRow & { title: string };

async function fetchTitles(threadIds: string[]): Promise<Record<string, string>> {
  if (threadIds.length === 0) return {};
  const { data, error } = await supabase
    .from("agent_messages")
    .select("thread_id, content, role, created_at")
    .in("thread_id", threadIds)
    .eq("role", "user")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const m of (data ?? []) as any[]) {
    if (!map[m.thread_id] && typeof m.content === "string" && m.content.trim()) {
      map[m.thread_id] = m.content.trim().slice(0, 42);
    }
  }
  return map;
}

export function AgentHistoryList() {
  const { user, role, roleLoading } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const { threadId } = useParams();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [threads, setThreads] = useState<ThreadWithTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sequence = useRef(0);
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const createRef = useRef(false);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function load() {
    if (!userId || role !== "startup" || roleLoading) return;
    const requestSequence = ++sequence.current;
    setLoading(true);
    try {
    const { data, error } = await supabase
      .from("agent_threads")
      .select("id, status, updated_at, created_at")
      .eq("founder_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    const rows = (data ?? []) as ThreadRow[];
    const titles = await fetchTitles(rows.map((r) => r.id));
    if (requestSequence !== sequence.current || currentUser.current !== userId) return;
    setThreads(
      rows.map((r) => ({
        ...r,
        title: titles[r.id] || `New chat · ${new Date(r.created_at).toLocaleDateString()}`,
      }))
    );
    setLoadError(null);
    } catch (error) {
      const failure = await getFounderAgentError(error);
      if (requestSequence === sequence.current && currentUser.current === userId) setLoadError(failure.message);
    } finally {
      if (requestSequence === sequence.current && currentUser.current === userId) setLoading(false);
    }
  }

  useEffect(() => {
    setThreads([]);
    setLoadError(null);
    if (!userId || role !== "startup" || roleLoading) { setLoading(false); return; }
    void load();
    let refreshTimer: number | undefined;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void load(), 100);
    };
    const channel = supabase
      .channel(`agent_threads_sidebar_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_threads", filter: `founder_id=eq.${userId}` },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_messages" },
        refresh
      )
      .subscribe();
    return () => {
      sequence.current++;
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role, roleLoading]);

  async function newChat() {
    if (!userId || role !== "startup" || roleLoading || createRef.current) return;
    createRef.current = true;
    setCreating(true);
    try {
    const { data, error } = await supabase
      .from("agent_threads")
      .insert({ founder_id: userId, status: "active", current_stage: 0, stats: {} })
      .select("id")
      .single();
    if (error) throw error;
    if (!data) throw new Error("Couldn't create a new chat");
    if (mountedRef.current && currentUser.current === userId) navigate(`/agent/${data.id}`);
    } catch (error) {
      const failure = await getFounderAgentError(error);
      if (mountedRef.current && currentUser.current === userId) toast.error(failure.message);
    } finally {
      createRef.current = false;
      if (mountedRef.current && currentUser.current === userId) setCreating(false);
    }
  }

  if (collapsed || role !== "startup" || roleLoading) return null;

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

      {loadError && <SidebarMenuSubItem>
        <button type="button" className="px-2 py-1.5 text-xs text-destructive" onClick={() => void load()} title={loadError}>Couldn't load chats. Retry</button>
      </SidebarMenuSubItem>}

      {!loading && !loadError && threads.length === 0 && (
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
