import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Users,
  Clock,
  Briefcase,
  Loader2,
  Sparkles,
  MessageCircle,
  Radio,
  Layers,
  ArrowRight,
  Send,
  Calendar,
  Quote,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { CardEngagementBar } from "./CardEngagementBar";
import { ROOMS, submitToCommunityChallenge, ProofFeedItem } from "@/lib/collective";
import { engagementBadgeClass, engagementLabel, formatCtcRange } from "@/lib/engagement";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type CollectivePerspective = "builder" | "founder";

// ─────────────────────────────────────────────────────────────────────
// 1. PROJECT CARD
// ─────────────────────────────────────────────────────────────────────
export interface ProjectCardProps {
  item: any;
  perspective: CollectivePerspective;
  submissionCount?: number;
  subLoading?: boolean;
  isLiked?: boolean;
  isSaved?: boolean;
  likeCount?: number;
  commentCount?: number;
  onLikeToggle?: () => Promise<boolean | void> | void;
  onSaveToggle?: () => Promise<boolean | void> | void;
}

export function ProjectFeedCard({
  item,
  perspective,
  submissionCount = 0,
  subLoading = false,
  isLiked = false,
  isSaved = false,
  likeCount = 0,
  commentCount = 0,
  onLikeToggle,
  onSaveToggle,
}: ProjectCardProps) {
  const navigate = useNavigate();
  const h2b = item.engagement_type === "hire_to_build";
  const closed = item.deadline && new Date(item.deadline) < new Date();

  // Price formatting
  const priceDisplay = h2b
    ? formatCtcRange(item)
    : item.budget
    ? `$${Number(item.budget).toLocaleString()}`
    : "Unspecified";

  return (
    <Card
      className={cn(
        "group relative transition-all duration-200 hover:shadow-md hover:border-primary/40 bg-card",
        h2b && "border-l-4 border-l-emerald-500"
      )}
    >
      <CardContent className="p-5 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Top Row: Category badge (top left), price (top right) */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs font-medium gap-1">
                <Layers className="h-3 w-3" />
                {item.category || "General"}
              </Badge>
              <Badge variant="outline" className={cn("text-[11px]", engagementBadgeClass(item.engagement_type))}>
                {engagementLabel(item.engagement_type)}
              </Badge>
            </div>

            <Badge variant="secondary" className="font-semibold text-xs tracking-tight bg-secondary/80 text-secondary-foreground">
              {h2b && <Briefcase className="h-3 w-3 mr-1 text-emerald-600" />}
              {priceDisplay}
            </Badge>
          </div>

          {/* Title and one-line description */}
          <div>
            <Link to={`/projects/${item.id}`} className="hover:text-primary transition-colors">
              <h3 className="font-semibold text-base leading-snug tracking-tight text-foreground line-clamp-1">
                {item.title}
              </h3>
            </Link>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
              {item.short_description || item.description || "No description provided."}
            </p>
          </div>

          {/* Metadata Row: submission count & deadline */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-0.5">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {subLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span>
                  {submissionCount} {h2b ? "applicants" : "submissions"}
                </span>
              )}
            </span>

            {item.deadline && (
              <span className={cn("inline-flex items-center gap-1", closed && "text-destructive font-medium")}>
                <Clock className="h-3.5 w-3.5" />
                {closed ? "Closed" : formatDistanceToNow(new Date(item.deadline), { addSuffix: true })}
              </span>
            )}
          </div>

          {/* Primary CTA Row per perspective */}
          <div className="flex items-center gap-2 pt-2">
            {perspective === "builder" ? (
              <>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 font-medium text-xs shadow-sm"
                  onClick={() => navigate(`/projects/${item.id}/submit`)}
                  disabled={!!closed}
                >
                  <Send className="h-3.5 w-3.5" />
                  {h2b ? "Apply" : "Submit"}
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <Link to={`/projects/${item.id}`}>
                    Details <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 gap-1.5 font-medium text-xs"
                  onClick={() => navigate(`/projects/${item.id}`)}
                >
                  <Users className="h-3.5 w-3.5" />
                  View submissions
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <Link to={`/projects/${item.id}`}>
                    Project details <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Hairline Divider & Engagement Bar (below primary CTA) */}
        <CardEngagementBar
          shareUrl={`${window.location.origin}/projects/${item.id}`}
          shareTitle={item.title}
          initialLikes={likeCount}
          commentCount={commentCount}
          entityType="project"
          entityId={item.id}
          isLiked={isLiked}
          isSaved={isSaved}
          onLikeToggle={onLikeToggle}
          onSaveToggle={onSaveToggle}
        />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 2. ROOM CARD
// ─────────────────────────────────────────────────────────────────────
export interface RoomCardProps {
  item: any;
  authorName?: string;
  authorAvatar?: string | null;
  perspective: CollectivePerspective;
  replyCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  likeCount?: number;
  commentCount?: number;
  onLikeToggle?: () => Promise<boolean | void> | void;
  onSaveToggle?: () => Promise<boolean | void> | void;
  onReply?: () => void;
}

export function RoomFeedCard({
  item,
  authorName = "Founder",
  authorAvatar,
  perspective,
  replyCount = 0,
  isLiked = false,
  isSaved = false,
  likeCount = 0,
  commentCount = 0,
  onLikeToggle,
  onSaveToggle,
  onReply,
}: RoomCardProps) {
  const roomMeta = ROOMS.find((r) => r.id === item.room_id);
  const roomLabel = roomMeta?.label || item.room_id?.toUpperCase() || "General";

  // Content processing: first sentence/line as title, rest as excerpt
  const content = (item.content || "").trim();
  const lines = content.split("\n").filter(Boolean);
  const titleLine = lines[0] || "Discussion Topic";
  const excerpt = lines.slice(1).join(" ") || content;

  return (
    <Card className="group relative transition-all duration-200 hover:shadow-md hover:border-violet-500/40 bg-card">
      <CardContent className="p-5 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Top Row: "Room" badge + topic tag (DeFi, DAO, Infra, NFT) */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30 text-xs font-semibold gap-1">
                <MessageCircle className="h-3 w-3" />
                Room
              </Badge>
              <Badge variant="secondary" className="text-xs font-medium">
                {roomLabel}
              </Badge>
            </div>

            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </span>
          </div>

          {/* Founder name + question/post title */}
          <div className="flex items-start gap-3">
            <Avatar className="h-9 w-9 shrink-0 border">
              <AvatarImage src={authorAvatar ?? undefined} alt={authorName} />
              <AvatarFallback className="bg-violet-100 text-violet-800 text-xs font-semibold">
                {(authorName || "F")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-muted-foreground block">
                {authorName} asked:
              </span>
              <h3 className="font-semibold text-base leading-snug tracking-tight text-foreground line-clamp-2 mt-0.5">
                {titleLine}
              </h3>
            </div>
          </div>

          {/* Quoted excerpt */}
          <div className="rounded-lg bg-muted/40 border-l-2 border-l-violet-500 p-3 text-xs text-muted-foreground italic flex items-start gap-2">
            <Quote className="h-3.5 w-3.5 text-violet-500/70 shrink-0 mt-0.5" />
            <p className="line-clamp-2 not-italic">{excerpt}</p>
          </div>

          {/* Meta info: Reply count */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium">
              <MessageCircle className="h-3.5 w-3.5" />
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </span>
          </div>

          {/* Primary CTA Row per perspective */}
          <div className="flex items-center gap-2 pt-1">
            {perspective === "builder" ? (
              <Button
                size="sm"
                className="h-8 gap-1.5 font-medium text-xs bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                onClick={onReply}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Join conversation
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 gap-1.5 font-medium text-xs bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                onClick={onReply}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Reply to thread
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" asChild>
              <Link to={`/collective?tab=rooms`}>Browse room</Link>
            </Button>
          </div>
        </div>

        {/* Hairline Divider & Engagement Bar (below primary CTA) */}
        <CardEngagementBar
          shareUrl={`${window.location.origin}/collective?tab=rooms`}
          shareTitle={`Discussion by ${authorName} in ${roomLabel}`}
          initialLikes={likeCount}
          commentCount={commentCount}
          entityType="room_post"
          entityId={item.id}
          isLiked={isLiked}
          isSaved={isSaved}
          onLikeToggle={onLikeToggle}
          onSaveToggle={onSaveToggle}
        />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 3. PROOF FEED CARD
// ─────────────────────────────────────────────────────────────────────
export interface ProofCardProps {
  item: ProofFeedItem;
  isLiked?: boolean;
  isSaved?: boolean;
  likeCount?: number;
  commentCount?: number;
  onLikeToggle?: () => Promise<boolean | void> | void;
  onSaveToggle?: () => Promise<boolean | void> | void;
}

export function ProofFeedCard({
  item,
  isLiked = false,
  isSaved = false,
  likeCount = 0,
  commentCount = 0,
  onLikeToggle,
  onSaveToggle,
}: ProofCardProps) {
  return (
    <Card className="group relative transition-all duration-200 hover:shadow-md hover:border-emerald-500/40 bg-card">
      <CardContent className="p-5 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Top Row: Builder avatar + name + "shipped a proof" label */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9 shrink-0 border">
                <AvatarImage src={item.builder_avatar ?? undefined} alt={item.builder_name} />
                <AvatarFallback className="bg-emerald-100 text-emerald-800 text-xs font-semibold">
                  {(item.builder_name || "B")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm leading-none text-foreground">
                    {item.builder_name}
                  </span>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    shipped a proof
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>

            {item.category && (
              <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wider">
                {item.category}
              </Badge>
            )}
          </div>

          {/* Project title + one-line result description */}
          <div>
            <Link
              to={`/submissions/${item.submission_id}`}
              className="hover:text-primary transition-colors"
            >
              <h3 className="font-semibold text-base leading-snug tracking-tight text-foreground line-clamp-1">
                {item.project_title || item.submission_title}
              </h3>
            </Link>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {item.summary || item.submission_title || "Verified build shipped and approved on ProofBuild."}
            </p>
          </div>

          {/* Link to submission */}
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Link
              to={`/submissions/${item.submission_id}`}
              className="text-foreground hover:text-primary inline-flex items-center gap-1 hover:underline"
            >
              View submission proof <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Hairline Divider & Engagement Bar (Proof feed cards have NO primary CTA) */}
        <CardEngagementBar
          shareUrl={`${window.location.origin}/submissions/${item.submission_id}`}
          shareTitle={`Proof of build by ${item.builder_name}`}
          initialLikes={likeCount}
          commentCount={commentCount}
          entityType="proof"
          entityId={item.submission_id}
          isLiked={isLiked}
          isSaved={isSaved}
          onLikeToggle={onLikeToggle}
          onSaveToggle={onSaveToggle}
        />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 4. WEEKLY CHALLENGE CARD
// ─────────────────────────────────────────────────────────────────────
export interface WeeklyChallengeCardProps {
  item: any;
  submissionCount?: number;
  perspective: CollectivePerspective;
  isLiked?: boolean;
  isSaved?: boolean;
  likeCount?: number;
  commentCount?: number;
  onLikeToggle?: () => Promise<boolean | void> | void;
  onSaveToggle?: () => Promise<boolean | void> | void;
  onSubmitSuccess?: () => void;
}

export function WeeklyChallengeFeedCard({
  item,
  submissionCount = 0,
  perspective,
  isLiked = false,
  isSaved = false,
  likeCount = 0,
  commentCount = 0,
  onLikeToggle,
  onSaveToggle,
  onSubmitSuccess,
}: WeeklyChallengeCardProps) {
  const [openSubmit, setOpenSubmit] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  // Calculate days remaining
  const daysLeft = item?.end_date
    ? Math.max(0, differenceInDays(new Date(item.end_date), new Date()))
    : 0;

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title for your build");
      return;
    }
    setBusy(true);
    const { error } = await submitToCommunityChallenge(item.id, title.trim(), url.trim());
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Challenge build submitted! Keep shipping!");
    setOpenSubmit(false);
    setTitle("");
    setUrl("");
    onSubmitSuccess?.();
  };

  return (
    <Card className="group relative transition-all duration-200 border-amber-500/40 bg-gradient-to-br from-amber-50/80 via-amber-50/40 to-transparent dark:from-amber-950/25 dark:via-amber-950/10 dark:to-transparent shadow-sm hover:border-amber-500/60">
      <CardContent className="p-5 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Top Row: Warm amber badge + days-remaining countdown */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 text-xs font-semibold gap-1">
                <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                Weekly challenge
              </Badge>
              <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 text-[11px]">
                Reputation only
              </Badge>
            </div>

            <Badge variant="secondary" className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-medium gap-1">
              <Clock className="h-3 w-3" />
              {daysLeft === 0 ? "Ending today" : `${daysLeft} days left`}
            </Badge>
          </div>

          {/* Title and Entry Count */}
          <div>
            <h3 className="font-semibold text-lg leading-snug tracking-tight text-foreground">
              {item.title}
            </h3>
            {item.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {item.description}
              </p>
            )}
          </div>

          {/* Meta Row: Entry count & timeline */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-amber-800 dark:text-amber-300">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              {submissionCount} {submissionCount === 1 ? "entry" : "entries"} submitted
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              ends {new Date(item.end_date).toLocaleDateString()}
            </span>
          </div>

          {/* Primary CTA Row per perspective */}
          {openSubmit ? (
            <div className="space-y-2 pt-2 rounded-lg bg-background/80 p-3 border border-amber-500/30">
              <Input
                placeholder="What did you build?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 text-xs bg-background"
              />
              <Input
                placeholder="Link to demo / GitHub repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-8 text-xs bg-background"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
                  disabled={busy || !title.trim()}
                  onClick={handleSubmit}
                >
                  {busy && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                  Submit build
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setOpenSubmit(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              {perspective === "builder" ? (
                <Button
                  size="sm"
                  className="h-8 gap-1.5 font-medium text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                  onClick={() => setOpenSubmit(true)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Enter challenge
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 font-medium text-xs border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10"
                  asChild
                >
                  <Link to="/collective?tab=weekly">
                    <Users className="h-3.5 w-3.5" />
                    View entries ({submissionCount})
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Hairline Divider & Engagement Bar (below primary CTA) */}
        <CardEngagementBar
          shareUrl={`${window.location.origin}/collective?tab=weekly`}
          shareTitle={`Weekly Challenge: ${item.title}`}
          initialLikes={item.like_count ?? 0}
          isLiked={isLiked}
          isSaved={isSaved}
          onLikeToggle={onLikeToggle}
          onSaveToggle={onSaveToggle}
          commentStubMessage="Challenge discussion happens in the Founder rooms."
        />
      </CardContent>
    </Card>
  );
}
