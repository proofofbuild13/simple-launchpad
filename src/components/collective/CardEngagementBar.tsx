import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share2, Bookmark, Loader2, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  CollectiveComment,
  EngagementEntityType,
  addComment,
  deleteComment,
  fetchComments,
} from "@/lib/collective";

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
  /** Entity type for the built-in comment thread */
  entityType?: EngagementEntityType;
  /** Entity id for the built-in comment thread */
  entityId?: string;
  /** Callback to trigger like toggle (optimistically handled internally too) */
  onLikeToggle?: (nextLiked: boolean) => Promise<boolean | void> | void;
  /** Callback to trigger save toggle (optimistically handled internally too) */
  onSaveToggle?: (nextSaved: boolean) => Promise<boolean | void> | void;
  /** Callback for comment click. When omitted and entityId is set, the built-in thread opens. */
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
  entityType,
  entityId,
  onLikeToggle,
  onSaveToggle,
  onComment,
  onReply,
  commentStubMessage = "Comments for this item are coming soon.",
  className,
  showDivider = true,
}: CardEngagementBarProps) {
  const { user } = useAuth();
  const threadEnabled = Boolean(entityType && entityId);
  const externalCommentHandler = onComment ?? onReply;
  const [liked, setLiked] = useState(isLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [saved, setSaved] = useState(isSaved);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const [threadOpen, setThreadOpen] = useState(false);
  const [comments, setComments] = useState<CollectiveComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [localCount, setLocalCount] = useState<number | undefined>(commentCount ?? replyCount);

  useEffect(() => {
    setLiked(isLiked);
  }, [isLiked]);

  useEffect(() => {
    setLikes(initialLikes);
  }, [initialLikes]);

  useEffect(() => {
    setSaved(isSaved);
  }, [isSaved]);

  useEffect(() => {
    setLocalCount(commentCount ?? replyCount);
  }, [commentCount, replyCount]);

  const loadComments = useCallback(async () => {
    if (!entityType || !entityId) return;
    setCommentsLoading(true);
    const rows = await fetchComments(entityType, entityId);
    setComments(rows);
    setLocalCount(rows.length);
    setCommentsLoading(false);
  }, [entityType, entityId]);

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
    if (threadEnabled) {
      const next = !threadOpen;
      setThreadOpen(next);
      if (next && comments.length === 0) loadComments();
      return;
    }
    if (externalCommentHandler) {
      externalCommentHandler();
    } else {
      toast.info(commentStubMessage);
    }
  };

  const handlePost = async () => {
    if (!entityType || !entityId) return;
    const body = draft.trim();
    if (!body) return;
    if (!user) {
      toast.error("Sign in to comment");
      return;
    }
    setPosting(true);
    const { error } = await addComment(entityType, entityId, body);
    setPosting(false);
    if (error) {
      toast.error(error);
      return;
    }
    setDraft("");
    await loadComments();
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteComment(id);
    if (error) {
      toast.error(error);
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== id));
    setLocalCount((c) => Math.max(0, (c ?? 1) - 1));
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
    <div className={cn(showDivider && "border-t border-border/50 pt-2.5 mt-3")}>
      <div
        className={cn(
          "flex items-center justify-between text-muted-foreground",
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
            className={cn(
              "h-8 px-2 text-xs font-normal gap-1.5 hover:text-foreground hover:bg-muted group",
              threadOpen && "text-foreground bg-muted"
            )}
            aria-label="Comment"
            aria-expanded={threadEnabled ? threadOpen : undefined}
            onClick={handleComment}
          >
            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="tabular-nums text-xs">
              {localCount != null && localCount > 0 ? localCount : "Comment"}
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

      {/* Inline comment thread */}
      {threadEnabled && threadOpen && (
        <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3">
          {commentsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading comments…
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments yet. Start the conversation.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar className="h-7 w-7 shrink-0 border">
                    <AvatarImage src={c.author_avatar ?? undefined} alt={c.author_name} />
                    <AvatarFallback className="text-[10px] font-semibold">
                      {(c.author_name || "M")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{c.author_name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                      {user?.id === c.user_id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-auto text-muted-foreground hover:text-destructive"
                          aria-label="Delete comment"
                          onClick={() => handleDelete(c.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words mt-0.5">
                      {c.content}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {user ? (
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a comment…"
                rows={2}
                className="text-xs bg-background resize-none"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={posting || !draft.trim()}
                  onClick={handlePost}
                >
                  {posting && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                  Comment
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sign in to join the conversation.</p>
          )}
        </div>
      )}
    </div>
  );
}
