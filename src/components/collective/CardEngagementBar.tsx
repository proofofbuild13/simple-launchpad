import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface CardEngagementBarProps {
  /** Target permalink or link to share. Defaults to window.location.href */
  shareUrl?: string;
  /** Share title for Web Share API */
  shareTitle?: string;
  /** Initial or current like count */
  initialLikes?: number;
  /** Initial or current comment/reply count */
  commentCount?: number;
  /** Backwards compatibility alias for commentCount */
  replyCount?: number;
  /** Whether the current viewer has liked the item */
  isLiked?: boolean;
  /** Whether the current viewer has saved the item */
  isSaved?: boolean;
  /** Callback to trigger like toggle (optimistically handled internally too) */
  onLikeToggle?: (nextLiked: boolean) => Promise<boolean | void> | void;
  /** Callback to trigger save toggle (optimistically handled internally too) */
  onSaveToggle?: (nextSaved: boolean) => Promise<boolean | void> | void;
  /** Callback for comment click (e.g. opens room reply or thread). If undefined, acts as visible stub. */
  onComment?: () => void;
  /** Backwards compatibility alias for onComment */
  onReply?: () => void;
  /** Custom notification or label if comment is stubbed */
  commentStubMessage?: string;
  /** Extra container styling */
  className?: string;
  /** Whether to render the hairline border divider (default: true) */
  showDivider?: boolean;
}

export function CardEngagementBar({
  shareUrl,
  shareTitle = "Check this out on ProofBuild",
  initialLikes = 0,
  commentCount,
  replyCount,
  isLiked = false,
  isSaved = false,
  onLikeToggle,
  onSaveToggle,
  onComment,
  onReply,
  commentStubMessage = "Comments for this item are coming soon.",
  className,
  showDivider = true,
}: CardEngagementBarProps) {
  const effectiveCommentCount = commentCount ?? replyCount;
  const effectiveCommentHandler = onComment ?? onReply;
  const [liked, setLiked] = useState(isLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [saved, setSaved] = useState(isSaved);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    setLiked(isLiked);
  }, [isLiked]);

  useEffect(() => {
    setLikes(initialLikes);
  }, [initialLikes]);

  useEffect(() => {
    setSaved(isSaved);
  }, [isSaved]);

  const handleLike = async () => {
    if (likeBusy) return;
    const next = !liked;
    setLiked(next);
    setLikes((c) => Math.max(0, c + (next ? 1 : -1)));
    setLikeBusy(true);

    try {
      const res = await onLikeToggle?.(next);
      if (res === false) {
        // Revert on failure
        setLiked(!next);
        setLikes((c) => Math.max(0, c + (!next ? 1 : -1)));
      }
    } catch {
      setLiked(!next);
      setLikes((c) => Math.max(0, c + (!next ? 1 : -1)));
      toast.error("Could not update like");
    } finally {
      setLikeBusy(false);
    }
  };

  const handleSave = async () => {
    if (saveBusy) return;
    const next = !saved;
    setSaved(next);
    setSaveBusy(true);

    try {
      const res = await onSaveToggle?.(next);
      if (res === false) {
        setSaved(!next);
      } else {
        toast.success(next ? "Saved to your list" : "Removed from saved");
      }
    } catch {
      setSaved(!next);
      toast.error("Could not update saved status");
    } finally {
      setSaveBusy(false);
    }
  };

  const handleComment = () => {
    if (effectiveCommentHandler) {
      effectiveCommentHandler();
    } else {
      toast.info(commentStubMessage);
    }
  };

  const handleShare = async () => {
    const url = shareUrl || window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          url,
        });
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between text-muted-foreground",
        showDivider && "border-t border-border/50 pt-2.5 mt-3",
        className
      )}
    >
      <div className="flex items-center gap-1">
        {/* Like */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-normal gap-1.5 hover:text-rose-500 hover:bg-rose-500/10 group"
          aria-label="Like"
          onClick={handleLike}
          disabled={likeBusy}
        >
          <Heart
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-150 group-active:scale-125",
              liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground group-hover:text-rose-500"
            )}
          />
          <span className={cn("tabular-nums text-xs", liked && "text-rose-500 font-medium")}>
            {likes > 0 ? likes : "Like"}
          </span>
        </Button>

        {/* Comment */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-normal gap-1.5 hover:text-foreground hover:bg-muted group"
          aria-label="Comment"
          onClick={handleComment}
        >
          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="tabular-nums text-xs">
            {effectiveCommentCount != null && effectiveCommentCount > 0 ? effectiveCommentCount : "Comment"}
          </span>
        </Button>
      </div>

      <div className="flex items-center gap-0.5">
        {/* Save */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-normal gap-1.5 hover:text-primary hover:bg-primary/10 group"
          aria-label="Save"
          onClick={handleSave}
          disabled={saveBusy}
        >
          <Bookmark
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-150 group-active:scale-125",
              saved ? "fill-primary text-primary" : "text-muted-foreground group-hover:text-primary"
            )}
          />
          <span className={cn("hidden sm:inline text-xs", saved && "text-primary font-medium")}>
            {saved ? "Saved" : "Save"}
          </span>
        </Button>

        {/* Share */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-normal gap-1.5 hover:text-foreground hover:bg-muted group"
          aria-label="Share"
          onClick={handleShare}
        >
          <Share2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="hidden sm:inline text-xs">Share</span>
        </Button>
      </div>
    </div>
  );
}
