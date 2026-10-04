import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { getFounderAgentError } from "@/lib/founderAgentClient";

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

const STAGE_DETAILS = [
  { label: "Parse brief", desc: "Extract requirements & project scope" },
  { label: "Draft project", desc: "Generate project brief & deliverables" },
  { label: "Match builders", desc: "Scan builder network & proof scores" },
  { label: "Send invitations", desc: "Dispatch invites to top-matching talent" },
  { label: "Evaluate submissions", desc: "Assess submitted evidence and business fit" },
  { label: "Shortlist", desc: "Select finalists for interview & award" },
];

const STARTERS = [
  "I need a full-stack dev to build an MVP SaaS dashboard with real-time analytics, user auth, and Stripe payments. React + Node. 3 months.",
  "Looking for a mobile dev to build a React Native delivery tracking app with live GPS, push notifications, and a driver portal. 6 weeks.",
  "Need a data engineer to build an ETL pipeline from Shopify + GA4 into BigQuery with automated daily reports. 4 weeks.",
];

export default function FounderAgent() {
  const { user, role, roleLoading } = useAuth();
  const userId = user?.id;
  const { threadId: routeThreadId } = useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(true);
  const [mobileTab, setMobileTab] = useState<"chat" | "stages">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const refreshTimer = useRef<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationRemaining, setEvaluationRemaining] = useState(0);
  const scope = `${userId ?? ""}:${routeThreadId ?? ""}:${role ?? ""}:${roleLoading ? "loading" : "ready"}:${loadAttempt}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const operationRef = useRef<{ scope: string; token: symbol } | null>(null);
  const refreshSequence = useRef(0);
  const evaluationRef = useRef<{ scope: string; running: boolean; queued: boolean } | null>(null);
  const readOnly = thread?.status === "archived";
  const ready = !!thread && (!routeThreadId || routeThreadId === thread.id) && !loadingThread;

  // Read failures must not be mistaken for a missing chat.
  useEffect(() => {
    let mounted = true;
    scopeRef.current = scope;
    const cleanup = () => { mounted = false; if (scopeRef.current === scope) scopeRef.current = ""; };
    operationRef.current = null;
    evaluationRef.current = null;
    refreshSequence.current++;
    setBusy(null);
    setSending(false);
    setEvaluating(false);
    setEvaluationRemaining(0);
    setEvaluationError(null);
    setInput("");
    setMessages([]);
    setThread(null);
    setLoadError(null);
    if (!userId || roleLoading || role !== "startup") {
      setLoadingThread(!!roleLoading);
      return cleanup;
    }
    setLoadingThread(true);
    (async () => {
      try {
      let t: Thread | null = null;
      if (routeThreadId) {
        const { data, error } = await supabase
          .from("agent_threads")
          .select("*")
          .eq("id", routeThreadId)
          .eq("founder_id", userId)
          .maybeSingle();
        if (!mounted) return;
        if (error) throw error;
        t = (data as Thread | null) ?? null;
        if (!t) throw new Error("This agent chat could not be found or is no longer available.");
      } else {
        const { data: existing, error } = await supabase
          .from("agent_threads")
          .select("*")
          .eq("founder_id", userId)
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!mounted) return;
        if (error) throw error;
        t = existing as Thread | null;
        if (!t) {
          const { data: created, error: createError } = await supabase
            .from("agent_threads")
            .insert({ founder_id: userId, status: "active", current_stage: 0, stats: {} })
            .select("*")
            .single();
          if (!mounted) return;
          if (createError) throw createError;
          t = created as Thread;
        }
        if (!t) throw new Error("Couldn't start an agent chat.");
        navigate(`/agent/${t.id}`, { replace: true });
        return;
      }

      if (!mounted || !t) return;
      const { data: msgs, error: messageError } = await supabase
        .from("agent_messages")
        .select("*")
        .eq("thread_id", t.id)
        .order("created_at", { ascending: true });
      if (!mounted) return;
      if (messageError) throw messageError;
      setThread(t);
      setMessages((msgs ?? []) as Message[]);
      setLoadingThread(false);
      } catch (error) {
        const failure = await getFounderAgentError(error);
        if (!mounted) return;
        setLoadError(failure.message);
        setLoadingThread(false);
      }
    })();
    return cleanup;
  }, [userId, role, roleLoading, routeThreadId, navigate, loadAttempt]);

  async function reloadThread(id: string, requestScope: string) {
    const sequence = ++refreshSequence.current;
    const [threadResult, messageResult] = await Promise.all([
      supabase.from("agent_threads").select("*").eq("id", id).eq("founder_id", userId).single(),
      supabase.from("agent_messages").select("*").eq("thread_id", id).order("created_at", { ascending: true }),
    ]);
    if (scopeRef.current !== requestScope || sequence !== refreshSequence.current) return;
    if (threadResult.error) throw threadResult.error;
    if (messageResult.error) throw messageResult.error;
    if (threadResult.data) setThread(threadResult.data as Thread);
    setMessages((messageResult.data ?? []) as Message[]);
  }

  // Realtime: thread + messages
  useEffect(() => {
    if (!thread || role !== "startup" || roleLoading) return;
    let mounted = true;
    const id = thread.id;
    const chan = supabase
      .channel(`agent_thread_${thread.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "agent_messages", filter: `thread_id=eq.${thread.id}` },
        () => {
          if (!mounted || scopeRef.current !== scope) return;
          void reloadThread(id, scope).catch(async (error) => {
            const failure = await getFounderAgentError(error);
            if (mounted && scopeRef.current === scope) setLoadError(failure.message);
          });
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "agent_threads", filter: `id=eq.${thread.id}` },
        (payload) => { if (mounted && scopeRef.current === scope) setThread(payload.new as Thread); })
      .subscribe();
    return () => { mounted = false; void supabase.removeChannel(chan); };
  }, [thread?.id, role, roleLoading, scope]);

  // Catch up after time away and serialize bursts of new submissions.
  async function syncEvaluations(id: string, requestScope: string) {
    if (scopeRef.current !== requestScope) return;
    const running = evaluationRef.current;
    if (running?.scope === requestScope && running.running) { running.queued = true; return; }
    const work = { scope: requestScope, running: true, queued: false };
    evaluationRef.current = work;
    setEvaluating(true);
    setEvaluationError(null);
    try {
      let passes = 0;
      let continuePending = false;
      do {
        work.queued = false;
        const { data, error } = await supabase.functions.invoke("founder-agent", {
          body: { thread_id: id, intent: "sync_evaluations" },
        });
        if (error || data?.error) throw await getFounderAgentError(error, data);
        if (scopeRef.current !== requestScope || evaluationRef.current !== work) return;
        const remaining = Math.max(0, Number(data?.remaining ?? 0) || 0);
        const failed = Number(data?.failed ?? 0) > 0 || !!data?.evaluation_errors?.length;
        setEvaluationRemaining(remaining);
        if (failed) {
          const details = (data?.evaluation_errors ?? []).map((failure: { message?: string }) => failure.message).filter(Boolean).slice(0, 2).join(" ");
          setEvaluationError(`Some submissions couldn't be evaluated. ${details ? `${details} ` : ""}Refresh evaluations to retry.`);
        }
        continuePending = !failed && remaining > 0 && Number(data?.evaluated ?? 0) > 0;
        await reloadThread(id, requestScope);
        passes++;
        if (failed) break;
      } while ((work.queued || continuePending) && passes < 3 && scopeRef.current === requestScope);
    } catch (error) {
      const failure = await getFounderAgentError(error);
      if (scopeRef.current === requestScope) setEvaluationError(failure.message);
    } finally {
      if (evaluationRef.current === work) {
        work.running = false;
        if (scopeRef.current === requestScope) setEvaluating(false);
      }
    }
  }

  // Evaluations are recovered even if submissions arrived while this chat was closed.
  useEffect(() => {
    if (!thread?.project_id || thread.status !== "active" || role !== "startup" || roleLoading) return;
    const pid = thread.project_id;
    const id = thread.id;
    let mounted = true;
    void syncEvaluations(id, scope);
    const chan = supabase
      .channel(`agent_subs_${pid}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "submissions", filter: `project_id=eq.${pid}` },
        () => { if (mounted) void syncEvaluations(id, scope); })
      .subscribe();
    return () => { mounted = false; void supabase.removeChannel(chan); };
  }, [thread?.id, thread?.project_id, thread?.status, role, roleLoading, scope]);

  // Realtime: evaluation rows → just refresh stats (debounced), no chat appends.
  useEffect(() => {
    if (!thread?.project_id || thread.status !== "active" || role !== "startup" || roleLoading) return;
    const pid = thread.project_id;
    const id = thread.id;
    const chan = supabase
      .channel(`agent_evals_${pid}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "ai_submission_evaluations", filter: `project_id=eq.${pid}` },
        () => {
          if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
          refreshTimer.current = window.setTimeout(async () => {
            if (scopeRef.current !== scope) return;
            try {
              const { data, error } = await supabase.functions.invoke("founder-agent", { body: { thread_id: id, intent: "refresh_stats" } });
              if (error || data?.error) throw await getFounderAgentError(error, data);
              await reloadThread(id, scope);
            } catch (error) {
              const failure = await getFounderAgentError(error);
              if (scopeRef.current === scope) setEvaluationError(failure.message);
            }
          }, 2000);
        })
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
  }, [thread?.id, thread?.project_id, thread?.status, role, roleLoading, scope]);

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

  function beginOperation(intent: string) {
    if (!ready || role !== "startup" || roleLoading || (readOnly && intent !== "reset") || operationRef.current) return null;
    const operation = { scope, token: Symbol(intent) };
    operationRef.current = operation;
    setBusy(intent);
    return operation;
  }

  function finishOperation(operation: { scope: string; token: symbol }) {
    if (operationRef.current === operation) {
      operationRef.current = null;
      if (scopeRef.current === operation.scope) { setBusy(null); setSending(false); }
    }
  }

  async function invokeAgent(intent: string, payload: any = {}) {
    if (intent === "sync_evaluations") {
      if (ready && thread && !readOnly) await syncEvaluations(thread.id, scope);
      return;
    }
    const operation = beginOperation(intent);
    if (!operation || !thread) return;
    try {
      const { data, error } = await supabase.functions.invoke("founder-agent", {
        body: { thread_id: thread.id, intent, ...payload },
      });
      if (error || data?.error) throw await getFounderAgentError(error, data);
      await reloadThread(thread.id, operation.scope);
    } catch (error) {
      const failure = await getFounderAgentError(error);
      if (scopeRef.current === operation.scope) toast.error(failure.message);
    } finally { finishOperation(operation); }
  }

  async function send() {
    const text = input.trim();
    if (!text || !thread) return;
    const operation = beginOperation("chat");
    if (!operation) return;
    setInput("");
    setSending(true);
    let accepted = false;
    try {
      const { data, error } = await supabase.functions.invoke("founder-agent", {
        body: { thread_id: thread.id, intent: "chat", message: text },
      });
      if (error || data?.error) throw await getFounderAgentError(error, data);
      accepted = true;
      await reloadThread(thread.id, operation.scope);
    } catch (error) {
      const failure = await getFounderAgentError(error);
      if (scopeRef.current === operation.scope) {
        toast.error(failure.message);
        if (!accepted) setInput(text);
      }
    } finally { finishOperation(operation); }
  }

  async function resetThread() {
    if (!thread || operationRef.current || !ready) return;
    const ok = readOnly || window.confirm("Start a new agent session? Current chat will be archived.");
    if (!ok) return;
    const operation = beginOperation("reset");
    if (!operation) return;
    try {
      const { data, error } = await supabase.functions.invoke("founder-agent", {
        body: { thread_id: thread.id, intent: "reset" },
      });
      if (error || data?.error) throw await getFounderAgentError(error, data);
      if (!data?.thread_id) throw new Error("Couldn't start a new session. Please try again.");
      if (scopeRef.current === operation.scope) navigate(`/agent/${data.thread_id}`, { replace: true });
    } catch (error) {
      const failure = await getFounderAgentError(error);
      if (scopeRef.current === operation.scope) toast.error(failure.message);
    } finally { finishOperation(operation); }
  }

  function quickAction(intent: string, payload?: any) {
    void invokeAgent(intent, payload);
  }
  const actionBusy = readOnly || !ready ? "unavailable" : busy;

  if (roleLoading) return <div className="p-6"><Skeleton className="h-32" /></div>;
  if (role !== "startup") {
    return <div className="p-6"><Card className="p-6">The agent is available to startups only.</Card></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8.5rem)] md:h-[calc(100vh-6rem)] lg:grid lg:grid-cols-[1fr_320px] gap-4 min-h-0">
      {/* ── Chat Card ── */}
      <Card
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden border shadow-xs bg-card",
          mobileTab === "stages" && "hidden lg:flex"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2.5 border-b px-3 sm:px-5 py-2.5 sm:py-3 shrink-0 bg-card">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold tracking-tight truncate leading-tight">
                  Founder Agent
                </h1>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-medium px-2 py-0.5 h-4.5 cursor-pointer lg:cursor-default"
                  onClick={() => setMobileTab("stages")}
                  title="Click to view stages"
                >
                  {stageLabel(stage, busy ?? undefined)}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate hidden sm:block mt-0.5">
                Conversational project posting & candidate evaluation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 sm:px-3 text-xs font-medium"
              title="Restart walkthrough"
              onClick={async () => {
                if (user?.id) {
                  await supabase.from("agent_ui_state").upsert(
                    { user_id: user.id, walkthrough_dismissed: false },
                    { onConflict: "user_id" }
                  );
                }
                window.dispatchEvent(new CustomEvent("founder-agent:restart-walkthrough"));
              }}
            >
              <Sparkles className="h-3.5 w-3.5 sm:mr-1.5 text-primary shrink-0" />
              <span className="hidden sm:inline">Walkthrough</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 sm:px-3 text-xs font-medium"
              title="New session"
              onClick={resetThread}
              disabled={!!busy || !ready}
            >
              <RotateCcw className="h-3.5 w-3.5 sm:mr-1.5 shrink-0" />
              <span className="hidden sm:inline">New session</span>
            </Button>
          </div>
        </div>

        {/* Mobile View Switcher Tab Bar */}
        <div className="lg:hidden border-b bg-muted/30 px-3 py-1.5 shrink-0">
          <div className="grid grid-cols-2 p-0.5 rounded-lg bg-muted/80 border text-xs w-full">
            <button
              type="button"
              onClick={() => setMobileTab("chat")}
              className={cn(
                "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md font-medium transition-all text-xs",
                mobileTab === "chat"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("stages")}
              className={cn(
                "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md font-medium transition-all text-xs",
                mobileTab === "stages"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Rocket className="h-3.5 w-3.5" />
              <span>Stages ({stage}/6)</span>
            </button>
          </div>
        </div>

        {/* Mobile quick stage ticker */}
        <button
          type="button"
          onClick={() => setMobileTab("stages")}
          className="lg:hidden flex items-center justify-between px-3 py-1.5 border-b bg-card/60 hover:bg-muted/40 transition-colors text-xs"
        >
          <div className="flex items-center gap-2 truncate">
            <div className="flex h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="font-semibold text-foreground shrink-0">Stage {stage}/6:</span>
            <span className="text-muted-foreground truncate">{stageLabel(stage)}</span>
          </div>
          <span className="text-[11px] font-medium text-primary shrink-0 flex items-center gap-0.5 ml-2">
            Details <ArrowRight className="h-3 w-3" />
          </span>
        </button>

        {/* Messages scroll area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 space-y-4">
          <Walkthrough userId={user?.id} />
          {readOnly && <div role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">This session is archived. Start a new session to continue.</div>}
          {loadError && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm">
            <p>{loadError}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setLoadAttempt((n) => n + 1)}>Retry loading chat</Button>
          </div>}
          {evaluationError && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm">Evaluation update failed: {evaluationError}</div>}
          {evaluating && <div role="status" className="text-xs text-muted-foreground">Checking pending submission evaluations…</div>}
          {!evaluating && evaluationRemaining > 0 && <div role="status" className="text-xs text-muted-foreground">{evaluationRemaining} submission(s) still need evaluation. Use Refresh evaluations to continue.</div>}
          {loadingThread ? (
            <div className="space-y-3"><Skeleton className="h-16 w-2/3" /><Skeleton className="h-16 w-1/2 ml-auto" /></div>
          ) : messages.length === 0 && !loadError ? (
            <Intro onPick={(t) => { setInput(t); taRef.current?.focus(); }} />
          ) : (
            messages.map((m, idx) => (
              <MessageRow
                key={m.id}
                msg={m}
                isLatestPreview={idx === latestPreviewIdx}
                isLatestBuilders={idx === latestBuildersIdx}
                awaiting={readOnly ? null : awaiting}
                onAction={invokeAgent}
                busy={actionBusy}
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
          {thread?.project_id && !readOnly && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button size="sm" variant="outline" disabled={!!actionBusy} onClick={() => quickAction("fetch_shortlist")}>
                <Trophy className="h-3 w-3 mr-1" /> Show shortlist
              </Button>
              <Button size="sm" variant="outline" disabled={!!actionBusy} onClick={() => quickAction("broaden_match")}>
                <Search className="h-3 w-3 mr-1" /> Broaden match
              </Button>
              <Button size="sm" variant="outline" disabled={!!actionBusy} onClick={() => quickAction("status")}>
                <Users className="h-3 w-3 mr-1" /> Status
              </Button>
              <Button size="sm" variant="outline" disabled={evaluating || !!actionBusy} onClick={() => quickAction("sync_evaluations")}>
                <RotateCcw className="h-3 w-3 mr-1" /> Refresh evaluations
              </Button>
            </div>
          )}
        </div>

        {/* Input box */}
        <div className="border-t p-2.5 sm:p-3 bg-card shrink-0">
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
              className="resize-none min-h-[52px] sm:min-h-[58px] text-sm"
              disabled={!!actionBusy}
              aria-label="Message the startup agent"
            />
            <Button
              onClick={send}
              disabled={!input.trim() || !!actionBusy}
              aria-label="Send message"
              size="icon"
              className="h-[52px] sm:h-[58px] w-11 sm:w-12 shrink-0"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Separate Section for Agent Stages ── */}
      <div
        className={cn(
          "space-y-4 overflow-y-auto min-h-0",
          mobileTab === "chat" ? "hidden lg:block" : "flex-1 block"
        )}
      >
        {/* On mobile: view switcher at top of stages view */}
        <div className="lg:hidden border-b bg-muted/30 p-1 rounded-lg border text-xs grid grid-cols-2 mb-3">
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md font-medium transition-all text-xs",
              mobileTab === "chat"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("stages")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md font-medium transition-all text-xs",
              mobileTab === "stages"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Rocket className="h-3.5 w-3.5" />
            <span>Stages ({stage}/6)</span>
          </button>
        </div>

        <StagesSidebar
          stage={stage}
          stats={stats}
          project_id={thread?.project_id ?? null}
          busy={actionBusy}
          quickAction={quickAction}
          onReturnToChat={() => setMobileTab("chat")}
        />
      </div>
    </div>
  );
}

function StagesSidebar({
  stage,
  stats,
  project_id,
  busy,
  quickAction,
  onReturnToChat,
}: {
  stage: number;
  stats: any;
  project_id: string | null;
  busy: string | null;
  quickAction: (intent: string, payload?: any) => void;
  onReturnToChat?: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Stages card */}
      <Card className="p-4 border shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Agent Stages
          </div>
          <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 h-4">
            {Math.max(0, stage - 1)}/6 completed
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3.5">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, ((stage - 1) / 6) * 100))}%` }}
          />
        </div>

        <div className="space-y-2">
          {STAGES.map((label, i) => {
            const n = i + 1;
            const done = n < stage;
            const active = n === stage;
            const meta = STAGE_DETAILS[i];
            return (
              <div
                key={n}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-[13px] transition-colors",
                  active && "border-primary/30 bg-primary/5",
                  done && "text-muted-foreground bg-muted/20",
                  !done && !active && "text-muted-foreground/80"
                )}
              >
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium mt-0.5",
                    done && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                    active && "bg-primary text-primary-foreground font-bold shadow-xs",
                    !done && !active && "border bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-3 w-3 stroke-[3]" /> : n}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn("font-medium leading-tight", active && "text-foreground font-semibold")}>
                      {label}
                    </span>
                    {active && (
                      <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-semibold bg-primary/10 text-primary shrink-0">
                        In Progress
                      </span>
                    )}
                    {done && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                        Done
                      </span>
                    )}
                  </div>
                  {meta && (
                    <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                      {meta.desc}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Live stats */}
      <Card className="p-4 border shadow-xs">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Live Stats
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Matched" value={stats.matched ?? "—"} />
          <Stat label="Invited" value={stats.invited ?? "—"} />
          <Stat label="Submissions" value={stats.submissions ?? "—"} />
          <Stat label="Shortlisted" value={stats.shortlisted ?? "—"} />
        </div>
      </Card>

      {/* Active project */}
      {project_id && (
        <Card className="p-4 border shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Active Project
          </div>
          <Link
            to={`/projects/${project_id}`}
            className="flex items-center justify-between text-sm font-medium text-primary hover:underline group"
          >
            <span>Open project page</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </Card>
      )}

      {/* Quick actions on mobile in stages view */}
      {project_id && busy !== "unavailable" && (
        <Card className="p-4 border shadow-xs lg:hidden">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
            Quick Actions
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => quickAction("fetch_shortlist")}>
              <Trophy className="h-3.5 w-3.5 mr-1 text-primary" /> Show shortlist
            </Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => quickAction("broaden_match")}>
              <Search className="h-3.5 w-3.5 mr-1" /> Broaden match
            </Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => quickAction("status")}>
              <Users className="h-3.5 w-3.5 mr-1" /> Check status
            </Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => quickAction("sync_evaluations")}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Refresh evaluations
            </Button>
          </div>
        </Card>
      )}

      {/* Return to chat button on mobile */}
      {onReturnToChat && (
        <div className="pt-1 pb-4 lg:hidden">
          <Button onClick={onReturnToChat} className="w-full gap-2 h-11 font-semibold">
            <MessageSquare className="h-4 w-4" />
            Return to Agent Chat
          </Button>
        </div>
      )}
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
        <Bot className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted border text-foreground">
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
      {project.requirements && <div className="border-t pt-2"><h4 className="text-xs font-semibold">Requirements</h4><p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{project.requirements}</p></div>}
      {project.deliverables && <div className="border-t pt-2"><h4 className="text-xs font-semibold">Deliverables</h4><p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{project.deliverables}</p></div>}
      {(project.budget_min != null || project.budget_max != null) && <p className="text-xs">Budget: {project.currency || "USD"} {project.budget_min ?? "—"} – {project.budget_max ?? "—"}</p>}
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
  const [open, setOpen] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) { setLoaded(true); setOpen(true); return; }
    (async () => {
      const { data } = await supabase
        .from("agent_ui_state")
        .select("walkthrough_dismissed")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      setOpen(!(data?.walkthrough_dismissed ?? false));
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    const onRestart = () => setOpen(true);
    window.addEventListener("founder-agent:restart-walkthrough", onRestart);
    return () => window.removeEventListener("founder-agent:restart-walkthrough", onRestart);
  }, []);

  if (!loaded || !open) return null;
  const steps = [
    { icon: MessageSquare, title: "Describe your brief", body: "Tell the agent what you need — stack, scope, timeline, budget. It parses a structured draft." },
    { icon: Rocket, title: "Approve & post", body: "Review the project preview card. One click posts it and searches builders by skill overlap." },
    { icon: MailCheck, title: "Send invitations", body: "Approve the matched shortlist to send invites. Builders get notified in real time." },
    { icon: ClipboardCheck, title: "Auto-evaluate submissions", body: "Each submission is scored automatically. Ask for the ranked shortlist any time." },
  ];
  const dismiss = async () => {
    setOpen(false);
    if (userId) {
      await supabase.from("agent_ui_state").upsert(
        { user_id: userId, walkthrough_dismissed: true },
        { onConflict: "user_id" }
      );
    }
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
