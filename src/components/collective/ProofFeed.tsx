import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PROOF_CATEGORIES,
  ProofCategory,
  ProofFeedItem,
  fetchProofFeed,
  fetchUserEngagements,
  fetchEngagementCounts,
  toggleEngagement,
  EngagementCounts,
  UserEngagements,
} from "@/lib/collective";
import { HelpCircle, Rocket, Bookmark } from "lucide-react";
import { ProofFeedCard } from "./CollectiveCards";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const GUIDE_STEPS = [
  {
    title: "Pick a challenge or project",
    body: "Browse open projects and choose one that fits what you can ship.",
  },
  {
    title: "Build and submit your work",
    body: "Add your demo link, repo and a short write-up in the submission form.",
  },
  {
    title: "Get reviewed",
    body: "Your submission is scored automatically and the founder reviews it.",
  },
  {
    title: "Marked complete, posted to the feed",
    body: "Once the founder accepts or completes it, your build shows up here for everyone.",
  },
];

export function ProofFeed() {
  const { user, role } = useAuth();
  const [guide, setGuide] = useState(false);
  const [cat, setCat] = useState<ProofCategory>("All");
  const [items, setItems] = useState<ProofFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<UserEngagements>({
    likes: new Set<string>(),
    saves: new Set<string>(),
  });

  const loadEngagements = useCallback(async () => {
    if (!user) return;
    const data = await fetchUserEngagements(user.id);
    setEngagements(data);
  }, [user]);

  useEffect(() => {
    loadEngagements();
  }, [loadEngagements]);

  const handleLikeToggle = async (submissionId: string) => {
    if (!user) {
      toast.error("Sign in to like proofs");
      return false;
    }
    const isLiked = engagements.likes.has(submissionId);
    setEngagements((prev) => {
      const nextLikes = new Set(prev.likes);
      if (isLiked) nextLikes.delete(submissionId);
      else nextLikes.add(submissionId);
      return { ...prev, likes: nextLikes };
    });

    const res = await toggleEngagement(user.id, "proof", submissionId, "like", isLiked);
    if (!res.success) {
      setEngagements((prev) => {
        const revertLikes = new Set(prev.likes);
        if (isLiked) revertLikes.add(submissionId);
        else revertLikes.delete(submissionId);
        return { ...prev, likes: revertLikes };
      });
      return false;
    }
    return true;
  };

  const handleSaveToggle = async (submissionId: string) => {
    if (!user) {
      toast.error("Sign in to save proofs");
      return false;
    }
    const isSaved = engagements.saves.has(submissionId);
    setEngagements((prev) => {
      const nextSaves = new Set(prev.saves);
      if (isSaved) nextSaves.delete(submissionId);
      else nextSaves.add(submissionId);
      return { ...prev, saves: nextSaves };
    });

    const res = await toggleEngagement(user.id, "proof", submissionId, "save", isSaved);
    if (!res.success) {
      setEngagements((prev) => {
        const revertSaves = new Set(prev.saves);
        if (isSaved) revertSaves.add(submissionId);
        else revertSaves.delete(submissionId);
        return { ...prev, saves: revertSaves };
      });
      return false;
    }
    return true;
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchProofFeed(cat).then((rows) => {
      if (!active) return;
      setItems(rows);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [cat]);

  return (
    <div className="space-y-4">
      {/* Banner / Guide - ONLY for builder accounts */}
      {role === "builder" && (
        <Card className="border-dashed bg-card/60">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Shipped something? Put it on the feed.</h2>
              <p className="text-xs text-muted-foreground">
                Completed builds appear here automatically once your work is marked complete.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/browse">
                  <Rocket className="mr-2 h-4 w-4" /> Post a completed build
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setGuide((g) => !g)}>
                <HelpCircle className="mr-2 h-4 w-4" /> How it works
              </Button>
            </div>
          </CardContent>
          {guide && (
            <CardContent className="border-t pt-4">
              <ol className="space-y-3 text-sm">
                {GUIDE_STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block font-medium">{s.title}</span>
                      <span className="block text-muted-foreground">{s.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link to="/browse">Find a challenge</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/submissions">My submissions</Link>
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Category selector for Proof feed */}
      <div className="flex flex-wrap gap-2">
        {PROOF_CATEGORIES.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={cat === c ? "default" : "outline"}
            onClick={() => setCat(c)}
            className="rounded-full text-xs h-7 px-3"
          >
            {c}
          </Button>
        ))}
      </div>

      {/* Cards list using standard ProofFeedCard */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No proof yet in this category. Completed builds show up here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <ProofFeedCard
              key={it.submission_id}
              item={it}
              isLiked={engagements.likes.has(it.submission_id)}
              isSaved={engagements.saves.has(it.submission_id)}
              onLikeToggle={() => handleLikeToggle(it.submission_id)}
              onSaveToggle={() => handleSaveToggle(it.submission_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
