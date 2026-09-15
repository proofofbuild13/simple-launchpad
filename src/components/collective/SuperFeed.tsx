import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Layers,
  Search,
  MessageCircle,
  Radio,
  Sparkles,
  ExternalLink,
  Bookmark,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchProofFeed,
  fetchRoomPosts,
  fetchProfileNames,
  fetchActiveCommunityChallenge,
  fetchCommunitySubmissionCount,
  fetchUserEngagements,
  fetchEngagementCounts,
  toggleEngagement,
  EngagementCounts,
  UserEngagements,
  ProofFeedItem,
  ROOMS,
} from "@/lib/collective";
import {
  ProjectFeedCard,
  RoomFeedCard,
  ProofFeedCard,
  WeeklyChallengeFeedCard,
  CollectivePerspective,
} from "./CollectiveCards";

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

interface ProofFeedItemWrapper extends BaseFeedItem {
  _type: "proof";
  data: ProofFeedItem;
}

interface RoomFeedItem extends BaseFeedItem {
  _type: "room";
  data: any;
  authorName: string;
  authorAvatar: string | null;
  replyCount: number;
}

interface ChallengeFeedItem extends BaseFeedItem {
  _type: "challenge";
  data: any;
  count: number;
}

type UnifiedItem = ProjectFeedItem | ProofFeedItemWrapper | RoomFeedItem | ChallengeFeedItem;

const OPEN_STATUSES = ["open", "open_for_submissions", "reviewing_submissions", "hiring_in_progress"];

interface SuperFeedProps {
  perspective?: CollectivePerspective;
  contentType?: "all" | "project" | "room" | "proof" | "challenge";
  onSwitchTab?: (tab: string) => void;
}

export function SuperFeed({
  perspective = "builder",
  contentType = "all",
  onSwitchTab,
}: SuperFeedProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subCounts, setSubCounts] = useState<Record<string, number>>({});
  const [subLoading, setSubLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [engagements, setEngagements] = useState<UserEngagements>({
    likes: new Set<string>(),
    saves: new Set<string>(),
  });
  const [counts, setCounts] = useState<EngagementCounts>({ likes: {}, comments: {} });
  const [savedOnly, setSavedOnly] = useState(false);

  // Load user likes & saves from polymorphic engagements table
  const loadEngagements = useCallback(async () => {
    if (!user) return;
    const data = await fetchUserEngagements(user.id);
    setEngagements(data);
  }, [user]);

  useEffect(() => {
    loadEngagements();
  }, [loadEngagements]);

  // Handle Like Toggle
  const handleLikeToggle = async (entityType: any, entityId: string) => {
    if (!user) {
      toast.error("Sign in to like items");
      return false;
    }
    const isLiked = engagements.likes.has(entityId);
    // Optimistic local state
    setEngagements((prev) => {
      const nextLikes = new Set(prev.likes);
      if (isLiked) nextLikes.delete(entityId);
      else nextLikes.add(entityId);
      return { ...prev, likes: nextLikes };
    });

    const res = await toggleEngagement(user.id, entityType, entityId, "like", isLiked);
    if (!res.success) {
      // Revert
      setEngagements((prev) => {
        const revertLikes = new Set(prev.likes);
        if (isLiked) revertLikes.add(entityId);
        else revertLikes.delete(entityId);
        return { ...prev, likes: revertLikes };
      });
      return false;
    }
    return true;
  };

  // Handle Save Toggle
  const handleSaveToggle = async (entityType: any, entityId: string) => {
    if (!user) {
      toast.error("Sign in to save items");
      return false;
    }
    const isSaved = engagements.saves.has(entityId);
    // Optimistic local state
    setEngagements((prev) => {
      const nextSaves = new Set(prev.saves);
      if (isSaved) nextSaves.delete(entityId);
      else nextSaves.add(entityId);
      return { ...prev, saves: nextSaves };
    });

    const res = await toggleEngagement(user.id, entityType, entityId, "save", isSaved);
    if (!res.success) {
      // Revert
      setEngagements((prev) => {
        const revertSaves = new Set(prev.saves);
        if (isSaved) revertSaves.add(entityId);
        else revertSaves.delete(entityId);
        return { ...prev, saves: revertSaves };
      });
      return false;
    }
    return true;
  };

  // Fetch feed content
  const loadFeed = useCallback(async () => {
    setLoading(true);

    try {
      const [proofRows, roomRows, challenge, projects] = await Promise.all([
        contentType === "all" || contentType === "proof" ? fetchProofFeed("All") : Promise.resolve([]),
        contentType === "all" || contentType === "room" ? fetchRoomPosts("all") : Promise.resolve([]),
        contentType === "all" || contentType === "challenge" ? fetchActiveCommunityChallenge() : Promise.resolve(null),
        contentType === "all" || contentType === "project"
          ? supabase
              .from("projects")
              .select("*")
              .eq("visibility", "public")
              .in("status", OPEN_STATUSES)
              .is("archived_at", null)
              .order("created_at", { ascending: false })
              .limit(30)
              .then((r) => r.data ?? [])
          : Promise.resolve([]),
      ]);

      // Calculate room reply counts & get author profiles
      const authorIds = [...new Set(roomRows.map((r: any) => r.author_id))] as string[];
      const nameMap = authorIds.length ? await fetchProfileNames(authorIds) : {};

      const replyCountsMap: Record<string, number> = {};
      roomRows.forEach((r: any) => {
        if (r.parent_id) {
          replyCountsMap[r.parent_id] = (replyCountsMap[r.parent_id] || 0) + 1;
        }
      });

      const unified: UnifiedItem[] = [];

      // 1. Projects
      projects.forEach((p: any) => {
        unified.push({
          _id: `project-${p.id}`,
          _type: "project",
          _created: p.created_at,
          data: p,
        });
      });

      // 2. Proof items
      proofRows.forEach((it) => {
        unified.push({
          _id: `proof-${it.submission_id}`,
          _type: "proof",
          _created: it.created_at,
          data: it,
        });
      });

      // 3. Room posts (roots only)
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
            replyCount: replyCountsMap[r.id] || 0,
          });
        });

      // 4. Weekly Challenge
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

      // Sort by created date, with weekly challenge always pinned to top when active
      unified.sort((a, b) => {
        if (a._type === "challenge") return -1;
        if (b._type === "challenge") return 1;
        return new Date(b._created).getTime() - new Date(a._created).getTime();
      });

      setItems(unified);

      // Like / comment counts for every card in the feed
      const entityIds = unified
        .map((u) => (u._type === "proof" ? (u.data as ProofFeedItem).submission_id : (u.data as any).id))
        .filter(Boolean) as string[];
      fetchEngagementCounts(entityIds).then(setCounts);

      // Fetch submission counts for project items
      const pIds = projects.map((p: any) => p.id);
      if (pIds.length) {
        setSubLoading(true);
        try {
          const { data: subs, error } = await supabase.rpc("get_project_submission_counts", { _ids: pIds });
          if (!error && subs) {
            const map: Record<string, number> = {};
            subs.forEach((s: any) => {
              map[s.project_id] = Number(s.count) || 0;
            });
            setSubCounts(map);
          }
        } catch (err) {
          console.warn("Could not load submission counts:", err);
        } finally {
          setSubLoading(false);
        }
      }
    } catch (error) {
      console.error("Error loading feed:", error);
      toast.error("Could not load feed items");
    } finally {
      setLoading(false);
    }
  }, [contentType]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const entityIdOf = (it: UnifiedItem) =>
    it._type === "proof" ? (it.data as ProofFeedItem).submission_id : (it.data as any).id;

  // Search + saved filtering
  const filtered = items.filter((it) => {
    if (savedOnly && !engagements.saves.has(entityIdOf(it))) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if (it._type === "project") {
      return (
        it.data.title?.toLowerCase().includes(q) ||
        it.data.short_description?.toLowerCase().includes(q) ||
        it.data.category?.toLowerCase().includes(q)
      );
    }
    if (it._type === "proof") {
      return (
        it.data.project_title?.toLowerCase().includes(q) ||
        it.data.builder_name?.toLowerCase().includes(q) ||
        it.data.summary?.toLowerCase().includes(q)
      );
    }
    if (it._type === "room") {
      return (
        it.data.content?.toLowerCase().includes(q) ||
        it.authorName?.toLowerCase().includes(q)
      );
    }
    if (it._type === "challenge") {
      return (
        it.data.title?.toLowerCase().includes(q) ||
        it.data.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Super Feed Header Banner (only in Super Feed view) */}
      {contentType === "all" && (
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Super Feed</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live stream of open projects, founder room discussions, shipped proofs, and challenges.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button asChild size="sm" variant="outline" className="h-8 text-xs">
              <Link to="/browse">
                <Layers className="h-3.5 w-3.5 mr-1.5 text-primary" />
                Browse all projects
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Search Toolbar (NO duplicate chip row: chip row has been completely removed) */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              contentType === "project"
                ? "Search projects by title or skill…"
                : contentType === "room"
                ? "Search founder room topics…"
                : contentType === "proof"
                ? "Search shipped builds…"
                : "Search feed by title, topic, or builder…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-background"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant={savedOnly ? "default" : "outline"}
            className="h-9 text-xs gap-1.5"
            aria-pressed={savedOnly}
            onClick={() => setSavedOnly((v) => !v)}
          >
            <Bookmark className={savedOnly ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
            {savedOnly ? "Showing saved" : "Saved"}
            {engagements.saves.size > 0 && (
              <span className="tabular-nums opacity-70">({engagements.saves.size})</span>
            )}
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </span>
        </div>
      </div>

      {/* Feed List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center space-y-2">
            <p className="text-sm font-medium text-foreground">No items found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {search
                ? "No matching items match your search query. Try clearing the search."
                : "There are no active feed items currently published."}
            </p>
            {search && (
              <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => setSearch("")}>
                Clear search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((it) => {
            // 1. Project Card
            if (it._type === "project") {
              const p = it.data;
              return (
                <ProjectFeedCard
                  key={it._id}
                  item={p}
                  perspective={perspective}
                  submissionCount={subCounts[p.id] ?? 0}
                  subLoading={subLoading}
                  isLiked={engagements.likes.has(p.id)}
                  isSaved={engagements.saves.has(p.id)}
                  onLikeToggle={() => handleLikeToggle("project", p.id)}
                  onSaveToggle={() => handleSaveToggle("project", p.id)}
                />
              );
            }

            // 2. Room Card
            if (it._type === "room") {
              const r = it as RoomFeedItem;
              return (
                <RoomFeedCard
                  key={it._id}
                  item={r.data}
                  authorName={r.authorName}
                  authorAvatar={r.authorAvatar}
                  perspective={perspective}
                  replyCount={r.replyCount}
                  isLiked={engagements.likes.has(r.data.id)}
                  isSaved={engagements.saves.has(r.data.id)}
                  onLikeToggle={() => handleLikeToggle("room_post", r.data.id)}
                  onSaveToggle={() => handleSaveToggle("room_post", r.data.id)}
                  onReply={() => {
                    if (onSwitchTab) {
                      onSwitchTab("rooms");
                    } else {
                      window.location.href = `/collective?tab=rooms`;
                    }
                  }}
                />
              );
            }

            // 3. Proof Card
            if (it._type === "proof") {
              const proof = it.data as ProofFeedItem;
              return (
                <ProofFeedCard
                  key={it._id}
                  item={proof}
                  isLiked={engagements.likes.has(proof.submission_id)}
                  isSaved={engagements.saves.has(proof.submission_id)}
                  onLikeToggle={() => handleLikeToggle("proof", proof.submission_id)}
                  onSaveToggle={() => handleSaveToggle("proof", proof.submission_id)}
                />
              );
            }

            // 4. Weekly Challenge Card
            if (it._type === "challenge") {
              const ch = it as ChallengeFeedItem;
              return (
                <WeeklyChallengeFeedCard
                  key={it._id}
                  item={ch.data}
                  submissionCount={ch.count}
                  perspective={perspective}
                  isLiked={engagements.likes.has(ch.data.id)}
                  isSaved={engagements.saves.has(ch.data.id)}
                  onLikeToggle={() => handleLikeToggle("challenge", ch.data.id)}
                  onSaveToggle={() => handleSaveToggle("challenge", ch.data.id)}
                  onSubmitSuccess={loadFeed}
                />
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
}
