import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type EngagementBarProps = {
  /** URL to copy when Share is clicked. Falls back to current page if omitted. */
  shareUrl?: string;
  /** Initial like count (display only). */
  initialLikes?: number;
  /** Initial reply count (display only). */
  replyCount?: number;
  /** Whether the item is already saved by the current user. */
  initialSaved?: boolean;
  /** Called when save is toggled. Return false/throw to revert optimistic update. */
  onSaveToggle?: (saved: boolean) => Promise<boolean | void> | void;
  /** Called when Reply is clicked (e.g. scroll to textarea, open modal). */
  onReply?: () => void;
  /** Extra class names on the bar container. */
  className?: string;
};

export function CardEngagementBar({
  shareUrl,
  initialLikes = 0,
  replyCount,
  initialSaved = false,
  onSaveToggle,
  onReply,
  className,
}: EngagementBarProps) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(initialLikes);
  const [saved, setSaved] = useState(initialSaved);
  const [saveBusy, setSaveBusy] = useState(false);

  const handleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikes((c) => c + (next ? 1 : -1));
  };

  const handleSave = async () => {
    if (saveBusy) return;
    const next = !saved;
    setSaved(next);
    setSaveBusy(true);
    try {
      const result = await onSaveToggle?.(next);
      if (result === false) {
        // revert
        setSaved(!next);
      } else {
        toast.success(next ? "Saved" : "Removed from saved");
      }
    } catch {
      setSaved(!next);
      toast.error("Could not update save");
    } finally {
      setSaveBusy(false);
    }
  };

  const handleShare = () => {
    const url = shareUrl ?? window.location.href;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied to clipboard"));
  };

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {/* Like */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 group"
        aria-label="Like"
        onClick={handleLike}
      >
        <Heart
          className={cn(
            "h-3.5 w-3.5 transition-all duration-150 group-hover:scale-110",
            liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground",
          )}
        />
      </Button>
      {likes > 0 && (
        <span className="text-[11px] text-muted-foreground tabular-nums -ml-0.5 mr-1">{likes}</span>
      )}

      {/* Reply */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 group"
        aria-label="Reply"
        onClick={onReply}
      >
        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
      </Button>
      {replyCount != null && replyCount > 0 && (
        <span className="text-[11px] text-muted-foreground tabular-nums -ml-0.5 mr-1">
          {replyCount}
        </span>
      )}

      {/* Share */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 group"
        aria-label="Share"
        onClick={handleShare}
      >
        <Share2 className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
      </Button>

      {/* Save */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 group"
        aria-label={saved ? "Unsave" : "Save"}
        onClick={handleSave}
        disabled={saveBusy}
      >
        <Bookmark
          className={cn(
            "h-3.5 w-3.5 transition-all duration-150 group-hover:scale-110",
            saved ? "fill-primary text-primary" : "text-muted-foreground",
          )}
        />
      </Button>
    </div>
  );
}
