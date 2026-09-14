import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CalendarDays,
  Users,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Sparkles,
  Clock,
  Flame,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { CardEngagementBar } from "./CardEngagementBar";
import {
  createCommunityChallenge,
  deleteCommunityChallenge,
  fetchActiveCommunityChallenge,
  fetchCommunitySubmissionCount,
  submitToCommunityChallenge,
  updateCommunityChallenge,
  fetchUserEngagements,
  toggleEngagement,
  UserEngagements,
} from "@/lib/collective";
import { CollectivePerspective } from "./CollectiveCards";
import { differenceInDays } from "date-fns";

export function WeeklyChallengeCard({
  perspective = "builder",
}: {
  perspective?: CollectivePerspective;
}) {
  const { role, user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [challenge, setChallenge] = useState<any>(null);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStart, setNewStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [newEnd, setNewEnd] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );

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

  const refresh = async () => {
    const c = await fetchActiveCommunityChallenge();
    setChallenge(c);
    if (c) setCount(await fetchCommunitySubmissionCount(c.id));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleLikeToggle = async () => {
    if (!user || !challenge) {
      toast.error("Sign in to like challenges");
      return false;
    }
    const isLiked = engagements.likes.has(challenge.id);
    setEngagements((prev) => {
      const next = new Set(prev.likes);
      if (isLiked) next.delete(challenge.id);
      else next.add(challenge.id);
      return { ...prev, likes: next };
    });

    const res = await toggleEngagement(user.id, "challenge", challenge.id, "like", isLiked);
    if (!res.success) {
      setEngagements((prev) => {
        const revert = new Set(prev.likes);
        if (isLiked) revert.add(challenge.id);
        else revert.delete(challenge.id);
        return { ...prev, likes: revert };
      });
      return false;
    }
    return true;
  };

  const handleSaveToggle = async () => {
    if (!user || !challenge) {
      toast.error("Sign in to save challenges");
      return false;
    }
    const isSaved = engagements.saves.has(challenge.id);
    setEngagements((prev) => {
      const next = new Set(prev.saves);
      if (isSaved) next.delete(challenge.id);
      else next.add(challenge.id);
      return { ...prev, saves: next };
    });

    const res = await toggleEngagement(user.id, "challenge", challenge.id, "save", isSaved);
    if (!res.success) {
      setEngagements((prev) => {
        const revert = new Set(prev.saves);
        if (isSaved) revert.add(challenge.id);
        else revert.delete(challenge.id);
        return { ...prev, saves: revert };
      });
      return false;
    }
    return true;
  };

  const create = async () => {
    if (!newTitle.trim() || !newStart || !newEnd) return;
    setBusy(true);
    const { error } = await createCommunityChallenge({
      title: newTitle.trim(),
      description: newDesc.trim(),
      start_date: newStart,
      end_date: newEnd,
    });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Challenge posted");
    setCreating(false);
    setNewTitle("");
    setNewDesc("");
    refresh();
  };

  const startEdit = () => {
    setNewTitle(challenge.title ?? "");
    setNewDesc(challenge.description ?? "");
    setNewStart(challenge.start_date);
    setNewEnd(challenge.end_date);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!newTitle.trim()) return;
    setBusy(true);
    const { error } = await updateCommunityChallenge(challenge.id, {
      title: newTitle.trim(),
      description: newDesc.trim(),
      start_date: newStart,
      end_date: newEnd,
    });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Challenge updated");
    setEditing(false);
    refresh();
  };

  const removeChallenge = async () => {
    if (!window.confirm("Delete this challenge? This cannot be undone.")) return;
    const { error } = await deleteCommunityChallenge(challenge.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Challenge deleted");
    setChallenge(null);
    refresh();
  };

  const createBlock = creating ? (
    <div className="space-y-2 pt-2 border-t border-amber-500/20">
      <Input
        placeholder="Challenge title"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        className="h-8 text-xs bg-background"
      />
      <Textarea
        placeholder="What should builders ship this week?"
        rows={2}
        value={newDesc}
        onChange={(e) => setNewDesc(e.target.value)}
        className="text-xs bg-background"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="h-8 text-xs bg-background" />
        <Input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="h-8 text-xs bg-background" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-8 text-xs" disabled={busy || !newTitle.trim()} onClick={create}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Post challenge
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCreating(false)}>
          Cancel
        </Button>
      </div>
    </div>
  ) : (
    <Button variant="outline" className="w-full h-8 text-xs border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10" onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4 mr-2" /> New weekly challenge
    </Button>
  );

  if (!challenge) {
    return (
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-50/60 via-amber-50/20 to-transparent dark:from-amber-950/20 dark:via-amber-950/10 dark:to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <Sparkles className="h-4 w-4 text-amber-600" />
            Weekly community challenge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>No challenge running this week. Check back soon.</p>
          {role === "startup" && createBlock}
        </CardContent>
      </Card>
    );
  }

  const daysLeft = challenge?.end_date
    ? Math.max(0, differenceInDays(new Date(challenge.end_date), new Date()))
    : 0;

  const submit = async () => {
    if (!title.trim()) return;
    const { error } = await submitToCommunityChallenge(challenge.id, title.trim(), url.trim());
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Build submitted!");
    setOpen(false);
    setTitle("");
    setUrl("");
    refresh();
  };

  return (
    <Card className="border-amber-500/40 bg-gradient-to-br from-amber-50/70 via-amber-50/30 to-transparent dark:from-amber-950/25 dark:via-amber-950/10 dark:to-transparent shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 text-xs font-semibold gap-1">
              <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              Weekly challenge
            </Badge>
            <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 text-[11px]">
              Reputation only
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-medium gap-1">
              <Clock className="h-3 w-3" />
              {daysLeft === 0 ? "Ending today" : `${daysLeft} days left`}
            </Badge>

            {challenge.created_by === user?.id && !editing && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label="Edit challenge"
                  onClick={startEdit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  aria-label="Delete challenge"
                  onClick={removeChallenge}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <div className="space-y-2">
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-8 text-xs bg-background" />
            <Textarea rows={2} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="text-xs bg-background" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="h-8 text-xs bg-background" />
              <Input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="h-8 text-xs bg-background" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-xs" disabled={busy || !newTitle.trim()} onClick={saveEdit}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save changes
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="font-semibold leading-tight text-base">{challenge.title}</h3>
            {challenge.description && (
              <p className="text-xs text-muted-foreground mt-1">{challenge.description}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-amber-800 dark:text-amber-300">
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            {count} {count === 1 ? "entry" : "entries"}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            ends {new Date(challenge.end_date).toLocaleDateString()}
          </span>
        </div>

        {/* Primary CTA Row per perspective */}
        {open ? (
          <div className="space-y-2 rounded-lg bg-background/80 p-3 border border-amber-500/30">
            <Input placeholder="Build title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs bg-background" />
            <Input placeholder="Link (repo or demo)" value={url} onChange={(e) => setUrl(e.target.value)} className="h-8 text-xs bg-background" />
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={submit}>Submit</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div>
            {perspective === "builder" ? (
              <Button className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-sm" onClick={() => setOpen(true)}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Enter challenge
              </Button>
            ) : (
              <Button variant="outline" className="w-full h-8 text-xs border-amber-500/30 text-amber-800 dark:text-amber-300" onClick={() => toast.info(`${count} builders have submitted entries.`)}>
                <Users className="h-3.5 w-3.5 mr-1.5" />
                View entries ({count})
              </Button>
            )}
          </div>
        )}

        {role === "startup" && createBlock}

        {/* Hairline Divider & Engagement Bar (below primary CTA) */}
        <CardEngagementBar
          shareUrl={`${window.location.origin}/collective?tab=weekly`}
          shareTitle={`Weekly Challenge: ${challenge.title}`}
          initialLikes={challenge.like_count ?? 0}
          isLiked={engagements.likes.has(challenge.id)}
          isSaved={engagements.saves.has(challenge.id)}
          onLikeToggle={handleLikeToggle}
          onSaveToggle={handleSaveToggle}
        />
      </CardContent>
    </Card>
  );
}
