import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Users,
  Clock,
  Briefcase,
  Loader2,
  AlertTriangle,
  Sparkles,
  MessageCircle,
  Radio,
  Layers,
  Rocket,
  ArrowRight,
  Send,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ROOMS,
  fetchProofFeed,
  fetchRoomPosts,
  fetchProfileNames,
  fetchActiveCommunityChallenge,
  fetchCommunitySubmissionCount,
  submitToCommunityChallenge,
  ProofFeedItem,
} from "@/lib/collective";
import { engagementBadgeClass, engagementLabel, formatCtcRange } from "@/lib/engagement";
import { CardEngagementBar } from "./CardEngagementBar";

// ── types ────────────────────────────────────────────────────────────
type FeedType = "project" | "proof" | "room" | "challenge";

interface BaseFeedItem {
  _id: string;
  _type: FeedType;
  _created: string;
}

interface ProjectFeedItem extends BaseFeedItem {
  _type: "project";
  data: any;
}

interface ProofFeedFeedItem extends BaseFeedItem {
  _type: "proof";
  data: ProofFeedItem;
}

interface RoomFeedItem extends BaseFeedItem {
  _type: "room";
  data: any;
  authorName: string;
  authorAvatar: string | null;
}

interface ChallengeFeedItem extends BaseFeedItem {
  _type: "challenge";
  data: any;
  count: number;
}

type UnifiedItem = ProjectFeedItem | ProofFeedFeedItem | RoomFeedItem | ChallengeFeedItem;

const OPEN_STATUSES = ["open", "open_for_submissions", "reviewing_submissions", "hiring_in_progress"];

// ── helpers ──────────────────────────────────────────────────────────
const typeColor: Record<FeedType, string> = {
  project: "bg-blue-500/10 text-blue-700 border-blue-500/25",
  proof: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
  room: "bg-violet-500/10 text-violet-700 border-violet-500/25",
  challenge: "bg-amber-500/10 text-amber-700 border-amber-500/25",
};

const typeIcon: Record<FeedType, React.ElementType> = {
  project: Layers,
  proof: Radio,
  room: MessageCircle,
  challenge: Sparkles,
};

const typeLabel: Record<FeedType, string> = {
  project: "Project",
  proof: "Proof",
  room: "Room",
  challenge: "Challenge",
};

// ── card sub-components ──────────────────────────────────────────────

function TypePill({ type }: { type: FeedType }) {
  const Icon = typeIcon[type];
  return (
    <Badge
      variant="outline"
      className={`text-[10px] gap-1 px-2 py-0 font-medium shrink-0 ${typeColor[type]}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {typeLabel[type]}
    </Badge>
  );
}

// ─────────────────────────── Project card ───────────────────────────
function ProjectCard({
  item,
  subCount,
  subLoading,
  subError,
  savedIds,
  onSaveToggle,
}: {
  item: any;
  subCount: number;
  subLoading: boolean;
  subError: boolean;
  savedIds: Set<string>;
  onSaveToggle: (id: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const h2b = item.engagement_type === "hire_to_build";
  const closed = item.deadline && new Date(item.deadline) < new Date();

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/p/${item.id}`);
    toast.success("Link copied");
  };

  return (
    <Card
      className={`hover:border-primary/40 transition-all duration-200 hover:shadow-md ${
        h2b ? "border-l-4 border-l-emerald-500" : ""
      }`}
    >
      <CardContent className="p-5 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <TypePill type="project" />
            {h2b ? (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                <Briefcase className="h-3 w-3 mr-1" />{formatCtcRange(item)}
              </Badge>
            ) : (
              item.budget && <Badge variant="secondary">${item.budget}</Badge>
            )}
          </div>
          <CardEngagementBar
            shareUrl={`${window.location.origin}/projects/${item.id}`}
            initialSaved={savedIds.has(item.id)}
            onSaveToggle={() => onSaveToggle(item.id)}
            className="shrink-0"
          />
        </div>

        {/* Title + description */}
        <div>
          <Link to={`/projects/${item.id}`} className="group">
            <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
              {item.title}
            </h3>
          </Link>
          {item.short_description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.short_description}</p>
          )}
        </div>

        {/* Meta badges */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <Badge variant="outline" className={engagementBadgeClass(item.engagement_type)}>
            {engagementLabel(item.engagement_type)}
          </Badge>
          {item.category && <Badge variant="outline">{item.category}</Badge>}
          {!h2b && item.difficulty && <Badge variant="outline">{item.difficulty}</Badge>}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {subLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : subError ? (
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> —
              </span>
            ) : (
              <>{subCount} {h2b ? "applicants" : "submissions"}</>
            )}
          </span>
          {!h2b && item.deadline && (
            <span className={`flex items-center gap-1 ${closed ? "text-destructive" : ""}`}>
              <Clock className="h-3 w-3" />
              {closed ? "Closed" : formatDistanceToNow(new Date(item.deadline), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* CTA */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => navigate(`/projects/${item.id}/submit`)}
            disabled={!!closed}
          >
            <Send className="h-3.5 w-3.5" />
            {h2b ? "Apply" : "Submit"}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/projects/${item.id}`}>
              View <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Proof card ─────────────────────────────
function ProofCard({ item }: { item: ProofFeedItem }) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={item.builder_avatar ?? undefined} alt={item.builder_name} />
              <AvatarFallback>{item.builder_name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <TypePill type="proof" />
                <span className="font-medium text-sm">{item.builder_name}</span>
                <span className="text-xs text-muted-foreground">shipped</span>
                {item.category && (
                  <Badge variant="outline" className="text-[10px] uppercase">{item.category}</Badge>
                )}
              </div>
              <h3 className="mt-1 font-semibold leading-tight text-sm">{item.project_title}</h3>
            </div>
          </div>
          <CardEngagementBar
            shareUrl={`${window.location.origin}/submissions/${item.submission_id}`}
            className="shrink-0"
          />
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {item.summary || item.submission_title}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{new Date(item.created_at).toLocaleDateString()}</span>
          <Link to={`/submissions/${item.submission_id}`} className="text-foreground hover:underline">
            View submission →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Room card ──────────────────────────────
function RoomCard({ item }: { item: RoomFeedItem }) {
  const roomLabel = ROOMS.find((r) => r.id === item.data.room_id)?.label ?? item.data.room_id;
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={item.authorAvatar ?? undefined} />
              <AvatarFallback>{(item.authorName ?? "M")[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <TypePill type="room" />
                <span className="font-medium text-sm">{item.authorName}</span>
                {roomLabel && (
                  <Badge variant="secondary" className="text-[10px] px-2 py-0">
                    {roomLabel}
                  </Badge>
                )}
              </div>
              <p className="text-sm mt-1 line-clamp-3 whitespace-pre-wrap">{item.data.content}</p>
            </div>
          </div>
          <CardEngagementBar className="shrink-0" />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-11">
          <span>{new Date(item.data.created_at).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Challenge card ──────────────────────────
function ChallengeCard({ item }: { item: ChallengeFeedItem }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const { error } = await submitToCommunityChallenge(item.data.id, title.trim(), url.trim());
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success("Build submitted!");
    setOpen(false);
    setTitle(""); setUrl("");
  };

  return (
    <Card className="border-amber-500/30 hover:shadow-sm transition-shadow">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <TypePill type="challenge" />
            <Badge variant="outline">Reputation only</Badge>
          </div>
          <CardEngagementBar className="shrink-0" />
        </div>

        <div>
          <h3 className="font-semibold leading-tight">{item.data.title}</h3>
          {item.data.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.data.description}</p>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ends {new Date(item.data.end_date).toLocaleDateString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {item.count} submissions
          </span>
        </div>

        {open ? (
          <div className="space-y-2">
            <Input placeholder="Build title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Demo / repo link" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy || !title.trim()} onClick={submit}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Rocket className="h-3.5 w-3.5" />Submit your build
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── filter tabs ──────────────────────────────────────────────────────
const FILTERS: { value: FeedType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "project", label: "Projects" },
  { value: "proof", label: "Proof" },
  { value: "room", label: "Rooms" },
  { value: "challenge", label: "Challenges" },
];

// ── main component ───────────────────────────────────────────────────
export function SuperFeed() {
  const { user } = useAuth();
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FeedType | "all">("all");
  const [subCounts, setSubCounts] = useState<Record<string, number>>({});
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const toggleSave = async (projectId: string) => {
    if (!user) { toast.error("Sign in to save"); return; }
    if (savedIds.has(projectId)) {
      await supabase.from("saved_projects").delete().eq("user_id", user.id).eq("project_id", projectId);
      setSavedIds((prev) => { const s = new Set(prev); s.delete(projectId); return s; });
    } else {
      await supabase.from("saved_projects").insert({ user_id: user.id, project_id: projectId });
      setSavedIds((prev) => new Set([...prev, projectId]));
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    (async () => {
      const [proofRows, roomRows, challenge, projects] = await Promise.all([
        fetchProofFeed("All"),
        fetchRoomPosts("all"),
        fetchActiveCommunityChallenge(),
        supabase
          .from("projects")
          .select("*")
          .eq("visibility", "public")
          .in("status", OPEN_STATUSES)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(30)
          .then((r) => r.data ?? []),
      ]);

      if (!mounted) return;

      // Fetch profile names for room posts
      const authorIds = [...new Set(roomRows.map((r: any) => r.author_id))] as string[];
      const nameMap = authorIds.length ? await fetchProfileNames(authorIds) : {};

      // Build unified items
      const unified: UnifiedItem[] = [];

      // Projects
      projects.forEach((p: any) => {
        unified.push({ _id: `project-${p.id}`, _type: "project", _created: p.created_at, data: p });
      });

      // Proof feed
      proofRows.forEach((it) => {
        unified.push({ _id: `proof-${it.submission_id}`, _type: "proof", _created: it.created_at, data: it });
      });

      // Room posts (only root level)
      roomRows
        .filter((r: any) => !r.parent_id)
        .forEach((r: any) => {
          const author = nameMap[r.author_id];
          unified.push({
            _id: `room-${r.id}`,
            _type: "room",
            _created: r.created_at,
            data: r,
            authorName: author?.name ?? "Member",
            authorAvatar: author?.avatar ?? null,
          });
        });

      // Weekly challenge (pin to top)
      if (challenge) {
        const count = await fetchCommunitySubmissionCount(challenge.id);
        unified.push({
          _id: `challenge-${challenge.id}`,
          _type: "challenge",
          _created: challenge.start_date,
          data: challenge,
          count,
        });
      }

      // Sort by created_at desc (challenge always floats top)
      unified.sort((a, b) => {
        if (a._type === "challenge") return -1;
        if (b._type === "challenge") return 1;
        return new Date(b._created).getTime() - new Date(a._created).getTime();
      });

      setItems(unified);
      setLoading(false);

      // Fetch sub counts & saved
      const pIds = projects.map((p: any) => p.id);
      if (pIds.length) {
        setSubLoading(true);
        setSubError(false);
        try {
          const { data: subs, error } = await supabase.rpc("get_project_submission_counts", { _ids: pIds });
          if (error) throw error;
          const map: Record<string, number> = {};
          (subs ?? []).forEach((s: any) => { map[s.project_id] = Number(s.count) || 0; });
          if (mounted) setSubCounts(map);
        } catch {
          if (mounted) setSubError(true);
        } finally {
          if (mounted) setSubLoading(false);
        }

        if (user) {
          const { data: saved } = await supabase
            .from("saved_projects").select("project_id").eq("user_id", user.id).in("project_id", pIds);
          if (mounted) setSavedIds(new Set((saved ?? []).map((s: any) => s.project_id)));
        }
      }
    })();

    return () => { mounted = false; };
  }, [user]);

  const filtered = items.filter((it) => {
    if (filter !== "all" && it._type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (it._type === "project") return it.data.title?.toLowerCase().includes(q);
      if (it._type === "proof") return it.data.project_title?.toLowerCase().includes(q) || it.data.builder_name?.toLowerCase().includes(q);
      if (it._type === "room") return it.data.content?.toLowerCase().includes(q);
      if (it._type === "challenge") return it.data.title?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Hero bar */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-transparent to-transparent p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Super Feed</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            All projects, proof, rooms and challenges — in one place.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild size="sm">
            <Link to="/browse"><Layers className="h-3.5 w-3.5 mr-1.5" />Browse projects</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/collective?tab=rooms"><MessageCircle className="h-3.5 w-3.5 mr-1.5" />Founder rooms</Link>
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search feed…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <div className="flex flex-wrap gap-1.5 ml-auto">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              className="rounded-full h-7 px-3 text-xs"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nothing here yet. Try a different filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => {
            if (it._type === "project") {
              return (
                <ProjectCard
                  key={it._id}
                  item={it.data}
                  subCount={subCounts[it.data.id] ?? 0}
                  subLoading={subLoading}
                  subError={subError}
                  savedIds={savedIds}
                  onSaveToggle={toggleSave}
                />
              );
            }
            if (it._type === "proof") return <ProofCard key={it._id} item={it.data} />;
            if (it._type === "room") return <RoomCard key={it._id} item={it as RoomFeedItem} />;
            if (it._type === "challenge") return <ChallengeCard key={it._id} item={it as ChallengeFeedItem} />;
            return null;
          })}
        </div>
      )}
    </div>
  );
}
