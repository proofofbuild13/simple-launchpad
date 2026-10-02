import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Handshake,
  Bot,
  PlusCircle,
  MessageSquarePlus,
  Zap,
  FolderKanban,
  TrendingUp,
  Users,
  DollarSign,
  ArrowRight,
  Calendar,
  MessageCircle,
  Trophy,
  Loader2,
} from "lucide-react";
import { NotificationBell } from "@/components/layout/NotificationBell";
import {
  fetchStartupStats,
  fetchStartupProjects,
  fetchStartupRooms,
  fetchStartupChallenges,
  createStartupChallenge,
  type StartupStats,
  type StartupProject,
  type StartupRoom,
  type StartupChallenge,
} from "@/lib/startup-control";
import { createRoomPost, ROOMS } from "@/lib/collective";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "open") return "default";
  if (status === "in_review" || status === "review") return "secondary";
  if (status === "completed" || status === "closed") return "outline";
  if (status === "archived") return "destructive";
  return "secondary";
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: any;
  label: string;
  value: string | number;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl border bg-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16 mt-1" />
      ) : (
        <p className="text-3xl font-bold tracking-tight leading-none mt-1">{value}</p>
      )}
    </div>
  );
}

// ── New Room Dialog ───────────────────────────────────────────────────────────

function NewRoomDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [room, setRoom] = useState<string>(ROOMS[0].id);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    const result = await createRoomPost(room, content.trim());
    setBusy(false);
    if (!result) {
      toast.error("Could not create post. Try again.");
      return;
    }
    toast.success("Room post created");
    setContent("");
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New room post</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Room</Label>
            <div className="flex flex-wrap gap-2">
              {ROOMS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoom(r.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    room === r.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="room-content">Post content</Label>
            <Textarea
              id="room-content"
              placeholder="Share something with the community..."
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !content.trim()}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Post
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── New Challenge Dialog ──────────────────────────────────────────────────────

function NewChallengeDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const [form, setForm] = useState({
    title: "",
    description: "",
    start_date: today,
    end_date: nextWeek,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await createStartupChallenge(form);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Challenge created");
    setForm({ title: "", description: "", start_date: today, end_date: nextWeek });
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New weekly challenge</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ch-title">Title</Label>
            <Input
              id="ch-title"
              placeholder="e.g. Build a DeFi dashboard"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-desc">Description</Label>
            <Textarea
              id="ch-desc"
              placeholder="What should builders build? What are the criteria?"
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ch-start">Start date</Label>
              <Input
                id="ch-start"
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-end">End date</Label>
              <Input
                id="ch-end"
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !form.title.trim()}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create challenge
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── AI Agent Panel ────────────────────────────────────────────────────────────

function AgentPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> AI Agent
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Use the AI brief generator to create and refine project briefs, then let the GitHub Analysis Agent score
            incoming submissions automatically.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => { onClose(); navigate("/agent"); }}>
              Open full agent
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── My Projects Tab ───────────────────────────────────────────────────────────

function ProjectsTab({ projects, loading }: { projects: StartupProject[]; loading: boolean }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!projects.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold">No projects yet</p>
          <p className="text-sm text-muted-foreground">Post your first project to start receiving submissions.</p>
          <Button asChild size="sm">
            <Link to="/projects/new">
              <PlusCircle className="h-4 w-4 mr-2" /> New project
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => navigate("/projects")}
          className="w-full text-left border rounded-xl bg-card hover:border-primary/40 hover:shadow-sm transition-all duration-150 p-4 group"
          aria-label={`Open projects page for ${p.title}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors truncate">
                {p.title}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {p.category && <span>{p.category}</span>}
                {p.budget && <span className="font-medium text-foreground">{formatCurrency(p.budget)}</span>}
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {p.submission_count ?? 0}{" "}
                  {(p.submission_count ?? 0) === 1 ? "submission" : "submissions"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={statusVariant(p.status)} className="text-[10px]">
                {statusLabel(p.status)}
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── My Rooms Tab ──────────────────────────────────────────────────────────────

function RoomsTab({ rooms, loading }: { rooms: StartupRoom[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!rooms.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <MessageCircle className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold">No room posts yet</p>
          <p className="text-sm text-muted-foreground">Start a discussion in a founder room to engage builders.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {rooms.map((r) => {
        const roomLabel = ROOMS.find((rm) => rm.id === r.room_id)?.label ?? r.room_id;
        return (
          <Link
            key={r.id}
            to={`/collective?tab=rooms`}
            className="block border rounded-xl bg-card hover:border-primary/40 hover:shadow-sm transition-all duration-150 p-4 group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground/90 line-clamp-2 leading-snug">
                  {r.content}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {roomLabel}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {r.reply_count} {r.reply_count === 1 ? "reply" : "replies"}
                  </span>
                  <span>{formatDate(r.created_at)}</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── My Challenges Tab ─────────────────────────────────────────────────────────

function ChallengesTab({ challenges, loading }: { challenges: StartupChallenge[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!challenges.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <Trophy className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold">No challenges yet</p>
          <p className="text-sm text-muted-foreground">Post a weekly challenge to get builders competing.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {challenges.map((c) => {
        const now = new Date();
        const end = new Date(c.end_date);
        const isActive = c.is_active && end >= now;
        return (
          <div
            key={c.id}
            className="border rounded-xl bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-snug truncate">{c.title}</p>
                {c.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(c.start_date)} — {formatDate(c.end_date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Trophy className="h-3 w-3" />
                    {c.entry_count} {c.entry_count === 1 ? "entry" : "entries"}
                  </span>
                </div>
              </div>
              <Badge
                variant={isActive ? "default" : "outline"}
                className="text-[10px] shrink-0"
              >
                {isActive ? "Active" : "Ended"}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StartupControlPanel() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Profile
  const [profile, setProfile] = useState<{ company_name: string; founder_name: string | null; avatar_url: string | null } | null>(null);

  // Stats
  const [stats, setStats] = useState<StartupStats>({ active_projects: 0, total_submissions: 0, unique_builders: 0, total_spend: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Tabs
  const [tab, setTab] = useState("projects");
  const [projects, setProjects] = useState<StartupProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [rooms, setRooms] = useState<StartupRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [challenges, setChallenges] = useState<StartupChallenge[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);

  // Dialogs
  const [showRoomDialog, setShowRoomDialog] = useState(false);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);

  // Load profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("startup_profiles")
      .select("company_name, founder_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", user.id)
            .maybeSingle()
            .then(({ data: p }) => {
              setProfile({ company_name: data.company_name, founder_name: data.founder_name, avatar_url: p?.avatar_url ?? null });
            });
        }
      });
  }, [user]);

  // Load stats once
  useEffect(() => {
    if (!user) return;
    setStatsLoading(true);
    fetchStartupStats(user.id).then((s) => {
      setStats(s);
      setStatsLoading(false);
    });
  }, [user]);

  // Lazy-load tab content
  const loadProjects = () => {
    if (!user || projectsLoading) return;
    setProjectsLoading(true);
    fetchStartupProjects(user.id).then((rows) => {
      setProjects(rows);
      setProjectsLoading(false);
    });
  };

  const loadRooms = () => {
    if (!user || roomsLoading) return;
    setRoomsLoading(true);
    fetchStartupRooms(user.id).then((rows) => {
      setRooms(rows);
      setRoomsLoading(false);
    });
  };

  const loadChallenges = () => {
    if (!user || challengesLoading) return;
    setChallengesLoading(true);
    fetchStartupChallenges(user.id).then((rows) => {
      setChallenges(rows);
      setChallengesLoading(false);
    });
  };

  // Initial load for default tab
  useEffect(() => {
    if (user) loadProjects();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (value: string) => {
    setTab(value);
    if (value === "projects" && !projects.length) loadProjects();
    if (value === "rooms" && !rooms.length) loadRooms();
    if (value === "challenges" && !challenges.length) loadChallenges();
  };

  const initial = profile?.company_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "S";

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Control panel — {profile?.company_name ?? "Startup"} — ProofBuild</title>
        <meta
          name="description"
          content="Manage your startup's projects, rooms, and challenges on ProofBuild. Track submissions, builder engagement, and deal activity in one place."
        />
      </Helmet>

      <div className="space-y-8 pb-4">
        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-11 w-11 shrink-0 ring-2 ring-border">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-sm font-bold bg-primary/10">{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight truncate">
                {profile?.company_name ?? "Your startup"}
              </h1>
              {profile?.founder_name && (
                <p className="text-xs text-muted-foreground">{profile.founder_name}</p>
              )}
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Deals */}
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-9 w-9"
              title="Deals"
              id="header-deals-btn"
              onClick={() => navigate("/deals")}
            >
              <Handshake className="h-4 w-4" />
            </Button>

            {/* AI Agent */}
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-9 w-9"
              title="AI Agent"
              id="header-agent-btn"
              onClick={() => setShowAgentPanel(true)}
            >
              <Bot className="h-4 w-4" />
            </Button>

            {/* Notification bell */}
            <NotificationBell />
          </div>
        </div>

        {/* ── Quick-create row ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Button
            id="quick-new-project"
            asChild
            className="gap-2 h-11 text-sm font-semibold"
          >
            <Link to="/projects/new">
              <PlusCircle className="h-4 w-4" />
              New project
            </Link>
          </Button>
          <Button
            id="quick-new-room"
            variant="secondary"
            className="gap-2 h-11 text-sm font-semibold"
            onClick={() => setShowRoomDialog(true)}
          >
            <MessageSquarePlus className="h-4 w-4" />
            New room
          </Button>
          <Button
            id="quick-new-challenge"
            variant="secondary"
            className="gap-2 h-11 text-sm font-semibold col-span-2 sm:col-span-1"
            onClick={() => setShowChallengeDialog(true)}
          >
            <Zap className="h-4 w-4" />
            New challenge
          </Button>
        </div>

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={FolderKanban}
            label="Active projects"
            value={stats.active_projects}
            loading={statsLoading}
          />
          <StatCard
            icon={TrendingUp}
            label="Total submissions"
            value={stats.total_submissions}
            loading={statsLoading}
          />
          <StatCard
            icon={Users}
            label="Builders engaged"
            value={stats.unique_builders}
            loading={statsLoading}
          />
          <StatCard
            icon={DollarSign}
            label="Total spend"
            value={statsLoading ? "—" : formatCurrency(stats.total_spend)}
            loading={statsLoading}
          />
        </div>

        {/* ── Tabbed managed sections ───────────────────────────────────── */}
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="h-10 rounded-full border bg-muted/40 p-1 gap-1 w-full sm:w-fit">
            <TabsTrigger
              value="projects"
              className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm"
              id="tab-my-projects"
            >
              My Projects
            </TabsTrigger>
            <TabsTrigger
              value="rooms"
              className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm"
              id="tab-my-rooms"
            >
              My Rooms
            </TabsTrigger>
            <TabsTrigger
              value="challenges"
              className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm"
              id="tab-my-challenges"
            >
              My Challenges
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4 focus-visible:outline-none">
            <ProjectsTab projects={projects} loading={projectsLoading} />
          </TabsContent>

          <TabsContent value="rooms" className="mt-4 focus-visible:outline-none">
            <RoomsTab rooms={rooms} loading={roomsLoading} />
          </TabsContent>

          <TabsContent value="challenges" className="mt-4 focus-visible:outline-none">
            <ChallengesTab challenges={challenges} loading={challengesLoading} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────── */}
      <NewRoomDialog
        open={showRoomDialog}
        onClose={() => setShowRoomDialog(false)}
        onCreated={() => {
          setRooms([]);
          if (tab === "rooms") loadRooms();
        }}
      />
      <NewChallengeDialog
        open={showChallengeDialog}
        onClose={() => setShowChallengeDialog(false)}
        onCreated={() => {
          setChallenges([]);
          if (tab === "challenges") loadChallenges();
          // Refresh stats (new challenge doesn't affect stats but keep pattern consistent)
        }}
      />
      <AgentPanel open={showAgentPanel} onClose={() => setShowAgentPanel(false)} />
    </>
  );
}
