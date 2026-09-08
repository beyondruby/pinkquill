"use client";

/**
 * One comment row for posts AND takes (Phase 2). Threading is one level:
 * replies render under the top-level comment; a reply to a reply carries
 * `reply_to` and shows "@name" so the conversation still reads correctly.
 */

import React, { useState, useRef, useEffect, memo } from "react";
import { getTimeAgoCompact as getTimeAgo } from "@/lib/utils/time";
import Link from "next/link";
import Image from "next/image";
import type { Comment } from "@/lib/types";
import type { EngagementKind } from "@/lib/engagement/store";
import { useBlock } from "@/lib/hooks/useInteractions";
import { supabase } from "@/lib/supabase";
import ReportModal from "@/components/ui/ReportModal";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { actionToast } from "@/lib/utils/toast";
import ActionMenu from "@/components/ui/ActionMenu";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Loading";
import { COMMENT_MAX_LENGTH } from "@/lib/hooks/useComments";
import CommentComposer from "./CommentComposer";

export interface CommentItemProps {
  comment: Comment;
  /** "post" (default) or "take" — decides the report target column. */
  kind?: EngagementKind;
  /** Id of the post/take the comment belongs to (for reports). */
  contentId?: string;
  currentUserId?: string;
  /** Viewer owns the post/take → may delete any comment on it. */
  canDeleteAny?: boolean;
  onLike: (commentId: string) => void;
  onReply: (
    parentId: string,
    content: string,
    replyToUserId: string | null
  ) => Promise<{ success: boolean; error?: string } | void>;
  onLoadReplies?: (commentId: string, options?: { more?: boolean }) => Promise<unknown>;
  onDelete?: (commentId: string) => void;
  onBlock?: (userId: string) => void;
  isReply?: boolean;
  /** The top-level comment (flat threading). */
  topLevelParentId?: string;
  /** Author of the top-level comment — replies to them need no "@name". */
  topLevelAuthorId?: string;
  // Community moderation
  canModerateDelete?: boolean;
  onModeratorDelete?: (commentId: string, reason?: string) => Promise<void>;
}

// Render plain text, turning @handles into profile links. Text segments are
// React children (escaped by React), never innerHTML.
function renderContentWithMentions(content: string, commentId: string): React.ReactNode {
  const mentionRegex = /(^|[^\w@.])@([a-zA-Z0-9_]{2,30})\b/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(content)) !== null) {
    const start = match.index + match[1].length;
    if (start > lastIndex) parts.push(<React.Fragment key={`t-${commentId}-${lastIndex}`}>{content.slice(lastIndex, start)}</React.Fragment>);
    const username = match[2];
    parts.push(
      <Link
        key={`m-${commentId}-${start}`}
        href={`/studio/${username}`}
        className="text-purple-primary font-medium hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        @{username}
      </Link>
    );
    lastIndex = start + username.length + 1;
  }
  if (lastIndex < content.length) parts.push(<React.Fragment key={`t-${commentId}-${lastIndex}`}>{content.slice(lastIndex)}</React.Fragment>);
  return parts.length > 0 ? parts : content;
}

function CommentItemComponent({
  comment,
  kind = "post",
  contentId,
  currentUserId,
  canDeleteAny = false,
  onLike,
  onReply,
  onLoadReplies,
  onDelete,
  onBlock,
  isReply = false,
  topLevelParentId,
  topLevelAuthorId,
  canModerateDelete,
  onModeratorDelete,
}: CommentItemProps) {
  const [showReplies, setShowReplies] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const repliesFetchedRef = useRef(false);
  const [showModDeleteModal, setShowModDeleteModal] = useState(false);
  const [modDeleteReason, setModDeleteReason] = useState("");
  const [isModDeleting, setIsModDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const reportTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Like bump (Phase 6): the heart pops when the viewer likes.
  const [likeBump, setLikeBump] = useState(false);
  const likeBumpTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { blockUser } = useBlock();

  const isOwner = currentUserId === comment.user_id;
  const isPending = !!comment.pending;
  const canDelete = !!onDelete && (isOwner || canDeleteAny) && !isPending;

  // Flat threading: a reply always attaches to the top-level comment, and
  // remembers whom it answers.
  const effectiveParentId = isReply ? (topLevelParentId || comment.id) : comment.id;
  const replyToUserId = isReply ? comment.user_id : null;

  // "@name" prefix on a reply that answers someone other than the top-level author.
  const showReplyTarget =
    isReply && !!comment.reply_to && !!comment.reply_to_user_id && comment.reply_to_user_id !== topLevelAuthorId;

  useEffect(() => {
    return () => {
      if (reportTimeoutRef.current) clearTimeout(reportTimeoutRef.current);
      if (likeBumpTimerRef.current) clearTimeout(likeBumpTimerRef.current);
    };
  }, []);

  const handleOpenReply = () => {
    if (!showReplyInput) setReplyText("");
    setShowReplyInput(!showReplyInput);
  };

  const handleBlock = async () => {
    if (!currentUserId || isOwner) return;
    setIsBlocking(true);
    try {
      await blockUser(currentUserId, comment.user_id);
      setShowBlockConfirm(false);
      onBlock?.(comment.user_id);
    } catch (err) {
      console.error("Failed to block user:", err);
    } finally {
      setIsBlocking(false);
    }
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!currentUserId) return;
    setIsReporting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: currentUserId,
        reported_user_id: comment.user_id,
        reason,
        details: details || null,
        // reports_type_check allows user / post / comment / take / community;
        // "take_comment" was rejected, so take-comment reports never landed.
        type: "comment",
        comment_id: comment.id,
        ...(contentId ? (kind === "take" ? { take_id: contentId } : { post_id: contentId }) : {}),
      });
      if (error) throw error;
      setReportSubmitted(true);
      reportTimeoutRef.current = setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to report:", err);
      actionToast.genericError("submit report");
    } finally {
      setIsReporting(false);
    }
  };

  const handleLike = () => {
    if (!currentUserId || isPending) return;
    if (!comment.user_has_liked) {
      setLikeBump(true);
      if (likeBumpTimerRef.current) clearTimeout(likeBumpTimerRef.current);
      likeBumpTimerRef.current = setTimeout(() => setLikeBump(false), 320);
    }
    onLike(comment.id);
  };

  const loadReplies = async (more = false) => {
    if (!onLoadReplies) return;
    setLoadingReplies(true);
    try {
      await onLoadReplies(comment.id, { more });
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleSubmitReply = async () => {
    const text = replyText.trim();
    if (!text || !currentUserId || submitting) return;
    if (text.length > COMMENT_MAX_LENGTH) {
      actionToast.genericError("post reply (too long)");
      return;
    }
    setSubmitting(true);
    try {
      const result = await onReply(effectiveParentId, text, replyToUserId);
      if (result && result.success === false) {
        actionToast.genericError("post reply");
        return; // keep the text so the user can retry
      }
      setReplyText("");
      setShowReplyInput(false);
      if (!isReply) {
        setShowReplies(true);
        if (!repliesFetchedRef.current) {
          repliesFetchedRef.current = true;
          await loadReplies(false);
        }
      }
    } catch (err) {
      console.error("[CommentItem] reply error:", err);
      actionToast.genericError("post reply");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = () => {
    onDelete?.(comment.id);
    setShowDeleteConfirm(false);
  };

  const handleModeratorDelete = async () => {
    if (!onModeratorDelete) return;
    setIsModDeleting(true);
    try {
      await onModeratorDelete(comment.id, modDeleteReason.trim() || undefined);
      setShowModDeleteModal(false);
      setModDeleteReason("");
      actionToast.commentDeleted();
      onDelete?.(comment.id);
    } catch (err) {
      console.error("Failed to delete comment as moderator:", err);
      actionToast.genericError("delete comment");
    } finally {
      setIsModDeleting(false);
    }
  };

  const remainingReplies = Math.max(0, comment.replies_count - (comment.replies?.length ?? 0));

  return (
    <div
      id={`comment-${comment.id}`}
      className={`${isReply ? "ml-11 mt-3" : ""} transition-colors duration-500 ${isPending ? "opacity-60" : ""}`}
    >
      <div className="flex gap-3 group">
        <Link href={`/studio/${comment.author.username}`} className="flex-shrink-0">
          <Image
            src={comment.author.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
            alt={comment.author.display_name || comment.author.username}
            width={36}
            height={36}
            className={`rounded-full object-cover hover:scale-110 transition-transform ${isReply ? "w-7 h-7" : "w-9 h-9"}`}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div data-comment-bubble className="bg-skeleton/60 rounded-2xl px-4 py-2.5 relative">
            <div className="flex items-center gap-2 mb-0.5">
              <Link
                href={`/studio/${comment.author.username}`}
                className="font-ui text-[0.85rem] font-medium text-ink hover:text-accent transition-colors"
              >
                {comment.author.display_name || comment.author.username}
              </Link>
              <span className="font-ui text-[0.7rem] text-muted">
                {isPending ? "Posting…" : getTimeAgo(comment.created_at)}
              </span>

              {currentUserId && !isPending && (
                <div className="relative ml-auto">
                  <ActionMenu
                    label="Comment actions"
                    description={`@${comment.author.username}`}
                    widthClassName="w-64"
                    buttonClassName="w-6 h-6 rounded-full flex items-center justify-center text-muted/50 hover:text-muted hover:bg-skeleton opacity-0 group-hover:opacity-100 transition-all"
                    buttonIconClassName="w-4 h-4"
                    items={[
                      {
                        label: "Copy comment link",
                        onSelect: () =>
                          navigator.clipboard.writeText(
                            `${window.location.origin}${window.location.pathname}?comment=${comment.id}`
                          ),
                        icon: (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        ),
                      },
                      {
                        label: "Delete comment",
                        onSelect: () => setShowDeleteConfirm(true),
                        hidden: !canDelete,
                        tone: "danger",
                        dividerBefore: true,
                        icon: (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        ),
                      },
                      {
                        label: "Delete as mod",
                        onSelect: () => setShowModDeleteModal(true),
                        hidden: !canModerateDelete || !onModeratorDelete,
                        tone: "warning",
                        dividerBefore: true,
                        sectionLabel: "Moderation",
                        icon: (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        ),
                      },
                      {
                        label: `Block @${comment.author.username}`,
                        onSelect: () => setShowBlockConfirm(true),
                        hidden: isOwner,
                        tone: "warning",
                        dividerBefore: true,
                        sectionLabel: "Safety",
                        icon: (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ),
                      },
                      {
                        label: "Report comment",
                        onSelect: () => setShowReportModal(true),
                        hidden: isOwner,
                        tone: "danger",
                        icon: (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                          </svg>
                        ),
                      },
                    ]}
                  />
                </div>
              )}
            </div>
            <p className="font-body text-[0.9rem] text-ink leading-relaxed whitespace-pre-wrap break-words">
              {showReplyTarget && comment.reply_to && (
                <Link
                  href={`/studio/${comment.reply_to.username}`}
                  className="text-purple-primary font-medium hover:underline mr-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  @{comment.reply_to.username}
                </Link>
              )}
              {renderContentWithMentions(comment.content, comment.id)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-1.5 ml-2">
            <button
              onClick={handleLike}
              disabled={!currentUserId || isPending}
              aria-pressed={comment.user_has_liked}
              aria-label={comment.user_has_liked ? "Unlike comment" : "Like comment"}
              className={`flex items-center gap-1 font-ui text-[0.75rem] transition-colors ${
                comment.user_has_liked ? "text-pink-vivid" : "text-muted hover:text-pink-vivid"
              } ${!currentUserId ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <svg className={`w-3.5 h-3.5 ${likeBump ? "animate-pop" : ""}`} fill={comment.user_has_liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {comment.likes_count > 0 && <span className={`tabular-nums ${likeBump ? "animate-pop" : ""}`}>{comment.likes_count}</span>}
            </button>

            <button
              onClick={handleOpenReply}
              data-reply-toggle
              aria-expanded={showReplyInput}
              disabled={!currentUserId || isPending}
              className={`font-ui text-[0.75rem] text-muted hover:text-accent transition-colors ${
                !currentUserId ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Reply
            </button>
          </div>

          {/* Reply composer */}
          {showReplyInput && currentUserId && (
            <div className="mt-3 ml-2">
              <CommentComposer
                size="sm"
                value={replyText}
                onChange={setReplyText}
                onSubmit={handleSubmitReply}
                submitting={submitting}
                autoFocus
                placeholder="Write a reply…"
                replyingTo={{ username: comment.author.username }}
                onCancelReply={() => setShowReplyInput(false)}
                submitLabel="Post reply"
              />
            </div>
          )}

          {/* View / hide replies */}
          {!isReply && comment.replies_count > 0 && (
            <button
              onClick={async () => {
                const next = !showReplies;
                setShowReplies(next);
                if (next && !repliesFetchedRef.current && onLoadReplies) {
                  repliesFetchedRef.current = true;
                  await loadReplies(false);
                }
              }}
              data-replies-toggle
              aria-expanded={showReplies}
              className="flex items-center gap-1.5 mt-2 ml-2 font-ui text-[0.8rem] text-purple-primary hover:text-pink-vivid transition-colors"
            >
              <svg className={`w-3 h-3 transition-transform ${showReplies ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {showReplies ? "Hide" : "View"} {comment.replies_count} {comment.replies_count === 1 ? "reply" : "replies"}
              {loadingReplies && <Spinner size="xs" className="ml-1 inline-block text-purple-primary" />}
            </button>
          )}

          {showReplies && comment.replies && comment.replies.length > 0 && (
            <div className="mt-2">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  kind={kind}
                  contentId={contentId}
                  currentUserId={currentUserId}
                  canDeleteAny={canDeleteAny}
                  onLike={onLike}
                  onReply={onReply}
                  onLoadReplies={onLoadReplies}
                  onDelete={onDelete}
                  onBlock={onBlock}
                  isReply
                  topLevelParentId={comment.id}
                  topLevelAuthorId={comment.user_id}
                  canModerateDelete={canModerateDelete}
                  onModeratorDelete={onModeratorDelete}
                />
              ))}
              {(comment.hasMoreReplies || remainingReplies > 0) && onLoadReplies && (
                <button
                  onClick={() => loadReplies(true)}
                  disabled={loadingReplies}
                  className="ml-11 mt-2 font-ui text-[0.78rem] text-muted hover:text-purple-primary transition-colors disabled:opacity-50"
                >
                  {loadingReplies ? "Loading…" : `View more replies${remainingReplies > 0 ? ` (${remainingReplies})` : ""}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showBlockConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fadeIn">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full mx-4 animate-scaleIn">
            <h3 className="font-display text-lg font-semibold text-ink mb-2">Block @{comment.author.username}?</h3>
            <p className="font-body text-sm text-muted mb-6">
              They won&apos;t be able to see your posts, follow you, or message you. They won&apos;t be notified.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2.5 rounded-full border border-border-light font-ui text-sm font-medium text-ink hover:bg-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                disabled={isBlocking}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white font-ui text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isBlocking ? "Blocking..." : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportSubmitted(false);
          }}
          onSubmit={handleReport}
          submitting={isReporting}
          submitted={reportSubmitted}
        />
      )}

      {showModDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fadeIn">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full mx-4 animate-scaleIn">
            <h3 className="font-display text-lg font-semibold text-ink mb-2">Delete Comment (Moderator)</h3>
            <p className="font-body text-sm text-muted mb-4">
              You are deleting this comment as a community moderator. This action will be logged.
            </p>
            <div className="mb-4">
              <label className="block font-ui text-sm text-ink mb-2">Reason (optional)</label>
              <input
                type="text"
                value={modDeleteReason}
                onChange={(e) => setModDeleteReason(e.target.value)}
                placeholder="e.g., Violates community guidelines"
                className="w-full px-3 py-2 rounded-lg border border-border-light font-body text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModDeleteModal(false);
                  setModDeleteReason("");
                }}
                disabled={isModDeleting}
                className="flex-1"
              >
                Cancel
              </Button>
              <button
                onClick={handleModeratorDelete}
                disabled={isModDeleting}
                className="flex-1 py-2.5 rounded-full bg-orange-500 text-white font-ui text-sm font-medium transition-all duration-150 hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                {isModDeleting ? (
                  <>
                    <Spinner size="xs" className="text-white" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Comment?"
        description={
          isOwner
            ? "This action cannot be undone. Your comment and any replies will be permanently deleted."
            : `This will permanently delete @${comment.author.username}'s comment and any replies to it.`
        }
        confirmText="Delete"
        isDanger
      />
    </div>
  );
}

const CommentItem = memo(CommentItemComponent, (prev, next) => {
  return (
    prev.comment === next.comment &&
    prev.currentUserId === next.currentUserId &&
    prev.canDeleteAny === next.canDeleteAny &&
    prev.canModerateDelete === next.canModerateDelete &&
    prev.onLike === next.onLike &&
    prev.onReply === next.onReply &&
    prev.onDelete === next.onDelete &&
    prev.onLoadReplies === next.onLoadReplies
  );
});

export default CommentItem;
