import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Send, Bot, User as UserIcon, Check, Clock, ExternalLink,
  Loader2, RotateCcw, Sparkles, ArrowRight, Trophy, Search, Users,
  MessageSquare, Rocket, MailCheck, ClipboardCheck, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Part =
  | { type: "text"; text: string }
  | { type: "project_preview"; project: any }
  | { type: "project_posted"; project_id: string; title: string }
  | { type: "builders"; builders: any[] }
  | { type: "broaden_prompt" }
  | { type: "invites_sent"; count: number }
  | { type: "evaluation_pinged"; submission_id: string }
  | { type: "shortlist"; shortlist: any[] };

type Message = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string | null;
  parts: Part[];
  created_at: string;
};

type Thread = {
  id: string;
  founder_id: string;
  status: string;
  project_id: string | null;
  current_stage: number;
  stats: any;
};

const STAGES = ["Parse brief", "Draft project", "Match builders", "Send invitations", "Evaluate submissions", "Shortlist"];

const STARTERS = [
  "I need a full-stack dev to build an MVP SaaS dashboard with real-time analytics, user auth, and Stripe payments. React + Node. 3 months.",
  "Looking for a mobile dev to build a React Native delivery tracking app with live GPS, push notifications, and a driver portal. 6 weeks.",
  "Need a data engineer to build an ETL pipeline from Shopify + GA4 into BigQuery with automated daily reports. 4 weeks.",
];

export default function FounderAgent() {
  const { user, role } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const refreshTimer = useRef<number | null>(null);

  // Load or create active thread
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      setLoadingThread(true);
      const { data: existing } = await supabase
        .from("agent_threads")
        .select("*")
        .eq("founder_id", user.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let t = existing as Thread | null;
      if (!t) {
        const { data: created, error } = await supabase
          .from("agent_threads")
          .insert({ founder_id: user.id, status: "active", current_stage: 0, stats: {} })
          .select("*")
          .single();
        if (error) {
          toast.error("Couldn't start agent thread");
          setLoadingThread(false);
          return;
        }
        t = created as Thread;
      }
      if (!mounted) return;
      setThread(t);
      const { data: msgs } = await supabase
        .from("agent_messages")
        .select("*")
        .eq("thread_id", t.id)
        .order("created_at", { ascending: true });
      if (mounted) setMessages((msgs ?? []) as Message[]);
      setLoadingThread(false);
    })();
    return () => { mounted = false; };
  }, [user]);

  // Realtime: thread + messages
  useEffect(() => {
    if (!thread) return;
    const chan = supabase
      .channel(`agent_thread_${thread.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "agent_messages", filter: `thread_id=eq.${thread.id}` },
        async () => {
          const { data } = await supabase
            .from("agent_messages")
            .select("*")
            .eq("thread_id", thread.id)
            .order("created_at", { ascending: true });
          setMessages((data ?? []) as Message[]);
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "agent_threads", filter: `id=eq.${thread.id}` },
        (payload) => setThread(payload.new as Thread))
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [thread?.id]);

  // Realtime: submissions for the active project → auto-evaluate.
  useEffect(() => {
    if (!thread?.project_id) return;
    const pid = thread.project_id;
    const chan = supabase
      .channel(`agent_subs_${pid}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "submissions", filter: `project_id=eq.${pid}` },
        (payload) => {
          const sid = (payload.new as any)?.id;
          if (sid) void invokeAgent("evaluate_new_submission", { submission_id: sid });
        })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [thread?.project_id]);

  // Realtime: evaluation rows → just refresh stats (debounced), no chat appends.
  useEffect(() => {
    if (!thread?.project_id) return;
    const pid = thread.project_id;
    const chan = supabase
      .channel(`agent_evals_${pid}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "ai_submission_evaluations", filter: `project_id=eq.${pid}` },
        () => {
          if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
          refreshTimer.current = window.setTimeout(() => {
            void invokeAgent("refresh_stats");
          }, 2000);
        })
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
  }, [thread?.project_id]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Keep textarea focused
  useEffect(() => { if (!sending) taRef.current?.focus(); }, [sending, thread?.id]);

  const stats = thread?.stats ?? {};
  const stage = thread?.current_stage ?? 0;
  const awaiting: "post_project" | "send_invites" | null = stats.awaiting ?? null;

  // Index of the latest message that contains a `builders` part (the live one).
  const latestBuildersIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if ((messages[i].parts ?? []).some((p) => p.type === "builders")) return i;
    }
    return -1;
  }, [messages]);

  const latestPreviewIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if ((messages[i].parts ?? []).some((p) => p.type === "project_preview")) return i;
    }
    return -1;
  }, [messages]);

  async function invokeAgent(intent: string, payload: any = {}) {
    if (!thread) return;
    setBusy(intent);
    try {
      const { data, error } = await supabase.functions.invoke("founder-agent", {
        body: { thread_id: thread.id, intent, ...payload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      const [{ data: t }, { data: m }] = await Promise.all([
        supabase.from("agent_threads").select("*").eq("id", thread.id).single(),
        supabase.from("agent_messages").select("*").eq("thread_id", thread.id).order("created_at", { ascending: true }),
      ]);
      if (t) setThread(t as Thread);
      if (m) setMessages(m as Message[]);
    } catch (e: any) {
      if (intent !== "refresh_stats" && intent !== "evaluate_new_submission") {
        toast.error(e?.message ?? "Agent failed");
      }
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || !thread) return;
    setInput("");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("founder-agent", {
        body: { thread_id: thread.id, intent: "chat", message: text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      const [{ data: t }, { data: m }] = await Promise.all([
        supabase.from("agent_threads").select("*").eq("id", thread.id).single(),
        supabase.from("agent_messages").select("*").eq("thread_id", thread.id).order("created_at", { ascending: true }),
      ]);
      if (t) setThread(t as Thread);
      if (m) setMessages(m as Message[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Agent failed");
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  async function resetThread() {
    if (!thread) return;
    const ok = window.confirm("Start a new agent session? Current chat will be archived.");
    if (!ok) return;
    setBusy("reset");
    try {
      const { data } = await supabase.functions.invoke("founder-agent", {
        body: { thread_id: thread.id, intent: "reset" },
      });
      if (data?.thread_id) {
        const { data: t } = await supabase.from("agent_threads").select("*").eq("id", data.thread_id).single();
        setThread(t as Thread);
        setMessages([]);
      }
    } finally {
      setBusy(null);
    }
  }

  function quickAction(intent: string, payload?: any) {
    void invokeAgent(intent, payload);
  }

  if (role && role !== "startup") {
    return <div className="p-6"><Card className="p-6">The agent is available to founders only.</Card></div>;
  }

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b px-5 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--agent-accent,250_60%_67%))] text-white">
            <Bot className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold">Founder agent</h1>
            <p className="text-xs text-muted-foreground">Conversational project posting</p>
          </div>
          <Badge variant="secondary" className="text-[10px]">{stageLabel(stage, busy ?? undefined)}</Badge>
          <Button variant="ghost" size="sm" onClick={async () => {
            if (user?.id) {
              await supabase.from("agent_ui_state").upsert(
                { user_id: user.id, walkthrough_dismissed: false },
                { onConflict: "user_id" }
              );
            }
            window.dispatchEvent(new CustomEvent("founder-agent:restart-walkthrough"));
          }}>
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Restart walkthrough
          </Button>
          <Button variant="ghost" size="sm" onClick={resetThread} disabled={busy === "reset"}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> New session
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Walkthrough userId={user?.id} />
          {loadingThread ? (
            <div className="space-y-3"><Skeleton className="h-16 w-2/3" /><Skeleton className="h-16 w-1/2 ml-auto" /></div>
          ) : messages.length === 0 ? (
            <Intro onPick={(t) => { setInput(t); taRef.current?.focus(); }} />
          ) : (
            messages.map((m, idx) => (
              <MessageRow
                key={m.id}
                msg={m}
                isLatestPreview={idx === latestPreviewIdx}
                isLatestBuilders={idx === latestBuildersIdx}
                awaiting={awaiting}
                onAction={invokeAgent}
                busy={busy}
              />
            ))
          )}
          {sending && (
            <div className="flex items-start gap-3">
              <Avatar role="assistant" />
              <div className="flex items-center gap-1 rounded-2xl border bg-muted/40 px-4 py-3">
                <Dot delay="0" /><Dot delay="0.15s" /><Dot delay="0.3s" />
              </div>
            </div>
          )}

          {/* Quick actions after project is posted */}
          {thread?.project_id && !sending && messages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => quickAction("fetch_shortlist")}>
                <Trophy className="h-3 w-3 mr-1" /> Show shortlist
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => quickAction("broaden_match")}>
                <Search className="h-3 w-3 mr-1" /> Broaden match
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { setInput("What's the status?"); }}>
                <Users className="h-3 w-3 mr-1" /> Status
              </Button>
            </div>
          )}
        </div>

        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              rows={2}
              placeholder="Tell me what you need to build…"
              className="resize-none min-h-[58px]"
              disabled={sending || loadingThread}
            />
            <Button onClick={send} disabled={!input.trim() || sending || loadingThread} size="icon" className="h-[58px] w-12 shrink-0">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-4 overflow-y-auto">
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Agent stages</div>
          <div className="space-y-1.5">
            {STAGES.map((label, i) => {
              const n = i + 1;
              const done = n < stage;
              const active = n === stage;
              return (
                <div key={n} className={cn(
                  "flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-1.5 text-[13px]",
                  active && "border-[hsl(var(--agent-accent,250_60%_67%))]/50 bg-[hsl(var(--agent-accent,250_60%_67%))]/10",
                  done && "text-muted-foreground",
                )}>
                  <div className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium",
                    done && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                    active && "bg-[hsl(var(--agent-accent,250_60%_67%))] text-white",
                    !done && !active && "border bg-muted text-muted-foreground",
                  )}>
                    {done ? <Check className="h-3 w-3" /> : n}
                  </div>
                  <span className={cn(active && "font-medium text-foreground")}>{label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Live stats</div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Matched" value={stats.matched ?? "—"} />
            <Stat label="Invited" value={stats.invited ?? "—"} />
            <Stat label="Submissions" value={stats.submissions ?? "—"} />
            <Stat label="Shortlisted" value={stats.shortlisted ?? "—"} />
          </div>
        </Card>

        {thread?.project_id && (
          <Card className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Active project</div>
            <Link to={`/projects/${thread.project_id}`} className="flex items-center justify-between text-sm hover:underline">
              Open project page <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}

function stageLabel(n: number, busy?: string) {
  if (busy === "approve_post") return "Posting…";
  if (busy === "send_invites") return "Sending…";
  if (busy === "fetch_shortlist") return "Refreshing…";
  if (busy === "broaden_match") return "Broadening…";
  if (n === 0) return "Ready";
  return STAGES[n - 1] ?? "Done";
}

function Intro({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Avatar role="assistant" />
        <div className="space-y-3 max-w-[82%]">
          <div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm leading-relaxed">
            Tell me what you need to build. I'll post the project, find matched builders from the database,
            evaluate submissions automatically, and give you a ranked shortlist — all from this conversation.
          </div>
          <div className="rounded-xl border bg-[hsl(var(--agent-accent,250_60%_67%))]/10 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--agent-accent,250_60%_67%))] mb-2">
              <Sparkles className="h-3 w-3" /> Try one of these
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STARTERS.map((s, i) => (
                <button key={i} onClick={() => onPick(s)} className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-muted transition-colors">
                  {["SaaS MVP", "Mobile app", "Data pipeline"][i]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  if (role === "assistant") {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--agent-accent,250_60%_67%))]/15 text-[hsl(var(--agent-accent,250_60%_67%))]">
        <Bot className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
      <UserIcon className="h-4 w-4" />
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" style={{ animationDelay: delay }} />;
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="text-xl font-semibold leading-tight">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function MessageRow({ msg, isLatestPreview, isLatestBuilders, awaiting, onAction, busy }: {
  msg: Message;
  isLatestPreview: boolean;
  isLatestBuilders: boolean;
  awaiting: "post_project" | "send_invites" | null;
  onAction: (intent: string, payload?: any) => void;
  busy: string | null;
}) {
  const isUser = msg.role === "user";
  const parts = (msg.parts?.length ? msg.parts : [{ type: "text", text: msg.content ?? "" }]) as Part[];

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <Avatar role={isUser ? "user" : "assistant"} />
      <div className={cn("space-y-2 max-w-[82%]", isUser && "items-end flex flex-col")}>
        {parts.map((p, i) => {
          if (p.type === "text") {
            return (
              <div key={i} className={cn(
                "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                isUser ? "bg-primary text-primary-foreground" : "border bg-muted/40 text-foreground",
              )}>
                {renderMarkdownLite(p.text)}
              </div>
            );
          }
          if (p.type === "project_preview") {
            const live = isLatestPreview && awaiting === "post_project";
            return <ProjectPreview key={i} project={p.project} live={live} busy={busy} onAction={onAction} />;
          }
          if (p.type === "project_posted") {
            return (
              <Card key={i} className="border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Project posted: <span className="font-medium">{p.title}</span></div>
                  <Link to={`/projects/${p.project_id}`} className="text-xs text-emerald-700 hover:underline dark:text-emerald-400">Open <ExternalLink className="inline h-3 w-3" /></Link>
                </div>
              </Card>
            );
          }
          if (p.type === "builders") {
            const live = isLatestBuilders && awaiting === "send_invites";
            return <BuildersList key={i} builders={p.builders} live={live} busy={busy} onAction={onAction} />;
          }
          if (p.type === "broaden_prompt") {
            return (
              <Button key={i} size="sm" variant="outline" disabled={!!busy} onClick={() => onAction("broaden_match")}>
                {busy === "broaden_match" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Search className="h-3 w-3 mr-1" />}
                Broaden the search
              </Button>
            );
          }
          if (p.type === "invites_sent") {
            return (
              <Card key={i} className="border-emerald-200 bg-emerald-50/50 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <Check className="mr-2 inline h-4 w-4 text-emerald-600" /> {p.count} invitations sent.
              </Card>
            );
          }
          if (p.type === "shortlist") {
            return <Shortlist key={i} shortlist={p.shortlist} />;
          }
          if (p.type === "evaluation_pinged") {
            return null;
          }
          return null;
        })}
      </div>
    </div>
  );
}

function renderMarkdownLite(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) =>
    seg.startsWith("**") && seg.endsWith("**")
      ? <strong key={i}>{seg.slice(2, -2)}</strong>
      : <span key={i}>{seg}</span>
  );
}

function ProjectPreview({ project, live, busy, onAction }: {
  project: any; live: boolean; busy: string | null;
  onAction: (intent: string, payload?: any) => void;
}) {
  return (
    <Card className="p-4 space-y-2 max-w-full">
      <Badge variant="secondary" className="text-[10px]">{project.category || project.skills?.[0] || "Project"}</Badge>
      <h3 className="text-sm font-semibold">{project.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{project.description || project.short_description}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px] text-muted-foreground">
        <span><Clock className="mr-1 inline h-3 w-3" /> {project.duration || "TBD"}</span>
        <span>· {project.difficulty || "mid"}</span>
        {project.skills?.length ? <span>· {project.skills.slice(0, 4).join(", ")}</span> : null}
      </div>
      {live ? (
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={() => onAction("approve_post")} disabled={!!busy}>
            {busy === "approve_post" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Post this project
          </Button>
        </div>
      ) : (
        <div className="pt-1 text-[11px] text-muted-foreground italic">Snapshot from earlier in this session.</div>
      )}
    </Card>
  );
}

function BuildersList({ builders, live, busy, onAction }: {
  builders: any[]; live: boolean; busy: string | null;
  onAction: (intent: string, payload?: any) => void;
}) {
  const ids = builders.map((b) => b.id);
  const top3 = ids.slice(0, 3);
  return (
    <div className="space-y-2 max-w-full">
      {builders.slice(0, 5).map((b) => (
        <div key={b.id} className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--agent-accent,250_60%_67%))]/15 text-[10px] font-medium text-[hsl(var(--agent-accent,250_60%_67%))]">
            {initials(b.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{b.full_name}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {(b.skills ?? []).slice(0, 2).join(" · ")}{b.experience_level ? ` · ${b.experience_level}` : ""}
            </div>
          </div>
          <Badge variant="secondary" className={cn(
            "text-[10px]",
            b.match_score >= 85
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
          )}>
            {b.match_score}% match
          </Badge>
        </div>
      ))}
      {live ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" disabled={!!busy} onClick={() => onAction("send_invites", { builder_ids: ids })}>
            {busy === "send_invites" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Invite all {ids.length}
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => onAction("send_invites", { builder_ids: top3 })}>
            Top 3 only
          </Button>
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground italic">Snapshot from earlier in this session.</div>
      )}
    </div>
  );
}

function Shortlist({ shortlist }: { shortlist: any[] }) {
  const labels = ["Top pick", "2nd", "3rd", "4th", "5th"];
  const colors = ["bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700"];
  return (
    <div className="space-y-2 max-w-full">
      {shortlist.map((e, i) => {
        const sub = e.submissions ?? {};
        const builder = sub.builder_profiles ?? {};
        const pct = Math.max(0, Math.min(100, Number(e.total_score ?? 0)));
        return (
          <div key={e.submission_id} className="flex items-center gap-2.5 rounded-lg border bg-card p-2.5">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-medium", colors[i] ?? "bg-muted text-muted-foreground")}>
              {initials(builder.full_name ?? "?")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                {builder.full_name ?? "Builder"}
                {e.startup_grade && <Badge variant="outline" className="text-[10px] h-4 px-1">{e.startup_grade}</Badge>}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">{e.summary_verdict}</div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-[hsl(var(--agent-accent,250_60%_67%))]" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <Link to={`/submissions/${sub.id}`} className="shrink-0">
              <Badge variant="secondary" className="text-[10px]">
                <Trophy className="mr-1 h-3 w-3" /> {labels[i] ?? "Pick"}
              </Badge>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

function Walkthrough({ userId }: { userId?: string }) {
  const key = `founder-agent-walkthrough-dismissed:${userId ?? "anon"}`;
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(key) !== "1";
  });
  useEffect(() => {
    const onRestart = () => setOpen(true);
    window.addEventListener("founder-agent:restart-walkthrough", onRestart);
    return () => window.removeEventListener("founder-agent:restart-walkthrough", onRestart);
  }, []);
  if (!open) return null;
  const steps = [
    { icon: MessageSquare, title: "Describe your brief", body: "Tell the agent what you need — stack, scope, timeline, budget. It parses a structured draft." },
    { icon: Rocket, title: "Approve & post", body: "Review the project preview card. One click posts it and searches builders by skill overlap." },
    { icon: MailCheck, title: "Send invitations", body: "Approve the matched shortlist to send invites. Builders get notified in real time." },
    { icon: ClipboardCheck, title: "Auto-evaluate submissions", body: "Each submission is scored automatically. Ask for the ranked shortlist any time." },
  ];
  const dismiss = () => {
    try { window.localStorage.setItem(key, "1"); } catch {}
    setOpen(false);
  };
  return (
    <div className="relative rounded-xl border bg-[hsl(var(--agent-accent,250_60%_67%))]/5 p-4">
      <button
        onClick={dismiss}
        aria-label="Dismiss walkthrough"
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[hsl(var(--agent-accent,250_60%_67%))]" />
        <h2 className="text-sm font-semibold">How this works</h2>
        <span className="text-[11px] text-muted-foreground">A quick tour before you start</span>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={i} className="flex items-start gap-2.5 rounded-lg border bg-background/60 p-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--agent-accent,250_60%_67%))]/15 text-[hsl(var(--agent-accent,250_60%_67%))]">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium leading-tight">
                  <span className="mr-1 text-muted-foreground">{i + 1}.</span>{s.title}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">You'll approve every action before it happens.</p>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismiss}>Got it</Button>
      </div>
    </div>
  );
}
