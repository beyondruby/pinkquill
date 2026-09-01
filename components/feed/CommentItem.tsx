"use client";

import React, { useState, useRef, useEffect, memo } from "react";
import { getTimeAgoCompact as getTimeAgo } from "@/lib/utils/time";
import Link from "next/link";
import Image from "next/image";
import type { Comment } from "@/lib/hooks";
import { useBlock } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import ReportModal from "@/components/ui/ReportModal";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { actionToast } from "@/lib/utils/toast";
import ActionMenu from "@/components/ui/ActionMenu";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Loading";

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onLike: (commentId: string, isLiked: boolean) => void;
  onReply: (parentId: string, content: string) => Promise<{ success: boolean; error?: string } | void>;
  onLoadReplies?: (commentId: string) => Promise<unknown>;
  onDelete?: (commentId: string) => void;
  onBlock?: (userId: string) => void;
  isReply?: boolean;
  topLevelParentId?: string; // The top-level comment ID for flat threading
  // Community moderation props
  canModerateDelete?: boolean;
  onModeratorDelete?: (commentId: string, reason?: string) => Promise<void>;
}

// Strip HTML tags to prevent XSS in plain-text comment content
function stripHtmlTags(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Parse @mentions in comment content and render as clickable links
function renderContentWithMentions(content: string, commentId?: string): React.ReactNode {
  // Sanitize content first to prevent XSS injection
  const sanitized = stripHtmlTags(content);
  // Match @username patterns (alphanumeric and underscores)
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(sanitized)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${commentId}-${lastIndex}`} dangerouslySetInnerHTML={{ __html: sanitized.slice(lastIndex, match.index) }} />);
    }
    // Add the mention as a link
    const username = match[1];
    parts.push(
      <Link
        key={`mention-${commentId}-${match.index}`}
        href={`/studio/${username}`}
        className="text-purple-primary font-medium hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        @{username}
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < sanitized.length) {
    parts.push(<span key={`text-${commentId}-${lastIndex}`} dangerouslySetInnerHTML={{ __html: sanitized.slice(lastIndex) }} />);
  }

  return parts.length > 0 ? parts : <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

function CommentItemComponent({
  comment,
  currentUserId,
  onLike,
  onReply,
  onLoadReplies,
  onDelete,
  onBlock,
  isReply = false,
  topLevelParentId,
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

  // For flat threading: when replying to a reply, use the top-level parent ID
  // When replying to a top-level comment, use the comment's own ID
  const effectiveParentId = isReply ? (topLevelParentId || comment.id) : comment.id;

  // Auto-populate @username when opening reply on a nested comment
  const handleOpenReply = () => {
    if (!showReplyInput) {
      // If this is a reply (nested comment), pre-fill with @username
      if (isReply) {
        setReplyText(`@${comment.author.username} `);
      } else {
        setReplyText("");
      }
    }
    setShowReplyInput(!showReplyInput);
  };
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const reportTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { blockUser } = useBlock();

  const isOwner = currentUserId === comment.user_id;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (reportTimeoutRef.current) clearTimeout(reportTimeoutRef.current);
    };
  }, []);

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
      await supabase.from("reports").insert({
        reporter_id: currentUserId,
        reported_user_id: comment.user_id,
        reason: reason + (details ? `: ${details}` : ""),
        type: "comment",
      });
      setReportSubmitted(true);
      reportTimeoutRef.current = setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to report:", err);
    } finally {
      setIsReporting(false);
    }
  };

  const handleLike = () => {
    if (!currentUserId) return;
    onLike(comment.id, comment.user_has_liked);
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim() || !currentUserId || submitting) return;

    setSubmitting(true);
    try {
      // Use effectiveParentId to maintain flat threading structure
      const result = await onReply(effectiveParentId, replyText.trim());
      // onReply may return void (legacy) or { success, error }. Treat
      // missing result as success for backward-compat.
      if (result && result.success === false) {
        actionToast.genericError("post reply");
        return; // keep input populated so user can retry
      }
      setReplyText("");
      setShowReplyInput(false);
      // Auto-expand replies on the parent so the user sees their new reply.
      // For nested replies (flat threading), the parent renders this state
      // change, not the nested CommentItem itself.
      if (!isReply) {
        setShowReplies(true);
        // Make sure pre-existing replies are loaded too, so the user sees
        // the full thread (not just their own new reply in isolation).
        if (!repliesFetchedRef.current && onLoadReplies) {
          repliesFetchedRef.current = true;
          setLoadingReplies(true);
          try {
            await onLoadReplies(comment.id);
          } finally {
            setLoadingReplies(false);
          }
        }
      }
    } catch (err) {
      console.error("[CommentItem] handleSubmitReply error:", err);
      actionToast.genericError("post reply");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (onDelete && isOwner) {
      setShowDeleteConfirm(true);
    }
  };

  const handleConfirmDelete = () => {
    if (onDelete) {
      onDelete(comment.id);
    }
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
      // Also update local state by calling onDelete if available
      if (onDelete) {
        onDelete(comment.id);
      }
    } catch (err) {
      console.error("Failed to delete comment as moderator:", err);
      actionToast.genericError("delete comment");
    } finally {
      setIsModDeleting(false);
    }
  };

  return (
    <div id={`comment-${comment.id}`} className={`${isReply ? "ml-11 mt-3" : ""} transition-colors duration-500`}>
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
          <div className="bg-skeleton/60 rounded-2xl px-4 py-2.5 relative">
            <div className="flex items-center gap-2 mb-0.5">
              <Link
                href={`/studio/${comment.author.username}`}
                className="font-ui text-[0.85rem] font-medium text-ink hover:text-accent transition-colors"
              >
                {comment.author.display_name || comment.author.username}
              </Link>
              <span className="font-ui text-[0.7rem] text-muted">
                {getTimeAgo(comment.created_at)}
              </span>

              {/* 3-dot Menu */}
              {currentUserId && (isOwner || !isOwner) && (
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
                        onSelect: () => navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?comment=${comment.id}`),
                        icon: (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        ),
                      },
                      {
                        label: "Delete comment",
                        onSelect: handleDelete,
                        hidden: !isOwner || !onDelete,
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
            <p className="font-body text-[0.9rem] text-ink leading-relaxed">
              {renderContentWithMentions(comment.content, comment.id)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 mt-1.5 ml-2">
            <button
              onClick={handleLike}
              disabled={!currentUserId}
              className={`flex items-center gap-1 font-ui text-[0.75rem] transition-colors ${
                comment.user_has_liked
                  ? "text-pink-vivid"
                  : "text-muted hover:text-pink-vivid"
              } ${!currentUserId ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill={comment.user_has_liked ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
            </button>

            <button
              onClick={handleOpenReply}
              disabled={!currentUserId}
              className={`font-ui text-[0.75rem] text-muted hover:text-accent transition-colors ${
                !currentUserId ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Reply
            </button>
          </div>

          {/* Reply Input */}
          {showReplyInput && currentUserId && (
            <div className="flex gap-2 mt-3 ml-2 items-stretch">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !submitting && handleSubmitReply()}
                placeholder="Write a reply..."
                disabled={submitting}
                autoFocus
                className="flex-1 min-w-0 h-9 px-3 rounded-full bg-skeleton/60 border-none outline-none font-body text-[0.85rem] text-ink placeholder:text-muted/50 focus:bg-surface focus:ring-2 focus:ring-purple-primary/20 transition-colors"
              />
              <button
                onClick={handleSubmitReply}
                disabled={submitting || !replyText.trim()}
                className="flex-shrink-0 h-9 px-4 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-[0.8rem] font-medium disabled:opacity-50 transition-opacity"
              >
                {submitting ? "..." : "Reply"}
              </button>
            </div>
          )}

          {/* View Replies Toggle */}
          {!isReply && comment.replies_count > 0 && (
            <button
              onClick={async () => {
                const next = !showReplies;
                setShowReplies(next);
                // Lazy-load existing replies the first time the user expands.
                // Without this, only replies added in this session appear,
                // making it look like older replies "disappeared" and new
                // ones "didn't post."
                if (next && !repliesFetchedRef.current && onLoadReplies) {
                  repliesFetchedRef.current = true;
                  setLoadingReplies(true);
                  try {
                    await onLoadReplies(comment.id);
                  } finally {
                    setLoadingReplies(false);
                  }
                }
              }}
              className="flex items-center gap-1.5 mt-2 ml-2 font-ui text-[0.8rem] text-purple-primary hover:text-pink-vivid transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${showReplies ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {showReplies ? "Hide" : "View"} {comment.replies_count}{" "}
              {comment.replies_count === 1 ? "reply" : "replies"}
              {loadingReplies && (
                <Spinner size="xs" className="ml-1 inline-block text-purple-primary" />
              )}
            </button>
          )}

          {/* Nested Replies */}
          {showReplies && comment.replies && comment.replies.length > 0 && (
            <div className="mt-2">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  onLike={onLike}
                  onReply={onReply}
                  onLoadReplies={onLoadReplies}
                  onDelete={onDelete}
                  onBlock={onBlock}
                  isReply
                  topLevelParentId={comment.id} // Pass the top-level comment ID for flat threading
                  canModerateDelete={canModerateDelete}
                  onModeratorDelete={onModeratorDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fadeIn">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full mx-4 animate-scaleIn">
            <h3 className="font-display text-lg font-semibold text-ink mb-2">
              Block @{comment.author.username}?
            </h3>
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

      {/* Report Modal */}
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

      {/* Moderator Delete Confirmation Modal */}
      {showModDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fadeIn">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full mx-4 animate-scaleIn">
            <h3 className="font-display text-lg font-semibold text-ink mb-2">
              Delete Comment (Moderator)
            </h3>
            <p className="font-body text-sm text-muted mb-4">
              You are deleting this comment as a community moderator. This action will be logged.
            </p>
            <div className="mb-4">
              <label className="block font-ui text-sm text-ink mb-2">
                Reason (optional)
              </label>
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Comment?"
        description="This action cannot be undone. Your comment and any replies will be permanently deleted."
        confirmText="Delete"
        isDanger
      />
    </div>
  );
}

// Memoize to prevent unnecessary re-renders in comment threads.
// IMPORTANT: include `replies` array length AND content reference so a newly
// added reply (which mutates the parent's `replies` array) triggers a re-
// render even when `replies_count` happens to match.
const CommentItem = memo(CommentItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.comment.id === nextProps.comment.id &&
    prevProps.comment.content === nextProps.comment.content &&
    prevProps.comment.user_has_liked === nextProps.comment.user_has_liked &&
    prevProps.comment.likes_count === nextProps.comment.likes_count &&
    prevProps.comment.replies_count === nextProps.comment.replies_count &&
    (prevProps.comment.replies?.length ?? 0) === (nextProps.comment.replies?.length ?? 0) &&
    prevProps.comment.replies === nextProps.comment.replies &&
    prevProps.currentUserId === nextProps.currentUserId &&
    prevProps.canModerateDelete === nextProps.canModerateDelete
  );
});

export default CommentItem;
