"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { TakeComment } from "@/lib/hooks/useTakes";
import { useBlock } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import ReportModal from "@/components/ui/ReportModal";
import { icons } from "@/components/ui/Icons";
import ActionMenu from "@/components/ui/ActionMenu";

interface TakeCommentItemProps {
  comment: TakeComment;
  currentUserId?: string;
  onLike: (commentId: string) => void;
  onReply: (content: string, parentId: string) => Promise<TakeComment | null>;
  onDelete?: (commentId: string) => void;
  onBlock?: (userId: string) => void;
  onModalClose?: () => void;
  isReply?: boolean;
  topLevelParentId?: string; // The top-level comment ID for flat threading
}

// Parse @mentions in comment content and render as clickable links
function renderContentWithMentions(content: string, onModalClose?: () => void): React.ReactNode {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    const username = match[1];
    parts.push(
      <Link
        key={match.index}
        href={`/studio/${username}`}
        onClick={(e) => {
          e.stopPropagation();
          onModalClose?.();
        }}
        className="text-purple-primary font-medium hover:underline"
      >
        @{username}
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
}

export default function TakeCommentItem({
  comment,
  currentUserId,
  onLike,
  onReply,
  onDelete,
  onBlock,
  onModalClose,
  isReply = false,
  topLevelParentId,
}: TakeCommentItemProps) {
  const [showReplies, setShowReplies] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // For flat threading: when replying to a reply, use the top-level parent ID
  const effectiveParentId = isReply ? (topLevelParentId || comment.id) : comment.id;

  // Auto-populate @username when opening reply on a nested comment
  const handleOpenReply = () => {
    if (!showReplyInput) {
      if (isReply) {
        setReplyText(`@${comment.author.username} `);
      } else {
        setReplyText("");
      }
    }
    setShowReplyInput(!showReplyInput);
  };
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const { blockUser } = useBlock();

  const isOwner = currentUserId === comment.user_id;

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
        type: "take_comment",
      });
      setReportSubmitted(true);
      setTimeout(() => {
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
    onLike(comment.id);
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim() || !currentUserId) return;

    setSubmitting(true);
    // Use effectiveParentId to maintain flat threading structure
    await onReply(replyText.trim(), effectiveParentId);
    setReplyText("");
    setShowReplyInput(false);
    // Only show replies for top-level comments
    if (!isReply) {
      setShowReplies(true);
    }
    setSubmitting(false);
  };

  const handleDelete = () => {
    if (onDelete && isOwner) {
      onDelete(comment.id);
    }
  };

  return (
    <div className={`${isReply ? "ml-11 mt-3" : ""}`}>
      <div className="flex gap-3 group">
        <Link href={`/studio/${comment.author.username}`} onClick={onModalClose} className="flex-shrink-0">
          <img
            src={comment.author.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
            alt={comment.author.display_name || comment.author.username}
            className={`rounded-full object-cover hover:scale-110 transition-transform ${isReply ? "w-7 h-7" : "w-9 h-9"}`}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="bg-skeleton/60 rounded-2xl px-4 py-2.5 relative">
            <div className="flex items-center gap-2 mb-0.5">
              <Link
                href={`/studio/${comment.author.username}`}
                onClick={onModalClose}
                className="font-ui text-[0.85rem] font-medium text-ink hover:text-accent transition-colors"
              >
                {comment.author.display_name || comment.author.username}
              </Link>
              <span className="font-ui text-[0.7rem] text-muted">
                {getTimeAgo(comment.created_at)}
              </span>

              {/* 3-dot Menu */}
              {currentUserId && (
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
                        icon: icons.trash,
                      },
                      {
                        label: `Block @${comment.author.username}`,
                        onSelect: () => setShowBlockConfirm(true),
                        hidden: isOwner,
                        tone: "warning",
                        dividerBefore: true,
                        sectionLabel: "Safety",
                        icon: icons.block,
                      },
                      {
                        label: "Report comment",
                        onSelect: () => setShowReportModal(true),
                        hidden: isOwner,
                        tone: "danger",
                        icon: icons.flag,
                      },
                    ]}
                  />
                </div>
              )}
            </div>
            <p className="font-body text-[0.9rem] text-ink leading-relaxed">
              {renderContentWithMentions(comment.content, onModalClose)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 mt-1.5 ml-2">
            <button
              onClick={handleLike}
              disabled={!currentUserId}
              className={`flex items-center gap-1 font-ui text-[0.75rem] transition-colors ${
                comment.is_liked
                  ? "text-pink-vivid"
                  : "text-muted hover:text-pink-vivid"
              } ${!currentUserId ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill={comment.is_liked ? "currentColor" : "none"}
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
            <div className="flex gap-2 mt-3 ml-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !submitting && handleSubmitReply()}
                placeholder="Write a reply..."
                disabled={submitting}
                autoFocus
                className="flex-1 px-3 py-2 rounded-full bg-skeleton/60 border-none outline-none font-body text-[0.85rem] text-ink placeholder:text-muted/50 focus:bg-surface focus:ring-2 focus:ring-purple-primary/20 transition-all"
              />
              <button
                onClick={handleSubmitReply}
                disabled={submitting || !replyText.trim()}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-[0.8rem] font-medium disabled:opacity-50 hover:scale-105 transition-all"
              >
                {submitting ? "..." : "Reply"}
              </button>
            </div>
          )}

          {/* View Replies Toggle */}
          {!isReply && comment.replies && comment.replies.length > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
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
              {showReplies ? "Hide" : "View"} {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
            </button>
          )}

          {/* Nested Replies */}
          {showReplies && comment.replies && comment.replies.length > 0 && (
            <div className="mt-2">
              {comment.replies.map((reply) => (
                <TakeCommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  onLike={onLike}
                  onReply={onReply}
                  onDelete={onDelete}
                  onBlock={onBlock}
                  onModalClose={onModalClose}
                  isReply
                  topLevelParentId={comment.id} // Pass the top-level comment ID for flat threading
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
    </div>
  );
}
