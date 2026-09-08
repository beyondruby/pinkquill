"use client";

import { useState, useEffect, useRef } from "react";
import { getTimeAgo } from "@/lib/utils/time";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { TakeReactionType, Take } from "@/lib/hooks/useTakes";
import { useComments } from "@/lib/hooks/useComments";
import { actionToast } from "@/lib/utils/toast";
import { useReaction } from "@/lib/engagement/reactions";
import { deleteOwnTake } from "@/lib/content-client";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import ReactionPicker from "@/components/feed/ReactionPicker";
import CommentItem from "@/components/feed/CommentItem";
import CommentComposer from "@/components/feed/CommentComposer";
import { CommentSkeleton } from "@/components/ui/Skeleton";
import PostTags from "@/components/feed/PostTags";
import { supabase } from "@/lib/supabase";
import { submitReport } from "@/lib/reports";
import { CommentIcon, icons } from "@/components/ui/Icons";

// Reactions no longer travel on this bus — every take surface reads
// lib/engagement/store.ts directly (Phase 1).
export interface TakeUpdate {
  takeId: string;
  field: "comments" | "relays" | "saves";
  isActive: boolean;
  countChange: number;
}

interface TakeDetailModalProps {
  take: Take | null;
  isOpen: boolean;
  onClose: () => void;
  onTakeUpdate?: (update: TakeUpdate) => void;
  onTakeDeleted?: (takeId: string) => void;
}

export default function TakeDetailModal({
  take,
  isOpen,
  onClose,
  onTakeUpdate,
  onTakeDeleted,
}: TakeDetailModalProps) {
  const { user, profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isRelayed, setIsRelayed] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [showContent, setShowContent] = useState(true);
  const [collaborators, setCollaborators] = useState<Array<{
    role?: string | null;
    user: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  }>>([]);
  const [mentions, setMentions] = useState<Array<{
    id: string; username: string; display_name: string | null; avatar_url: string | null;
  }>>([]);

  const {
    comments,
    loading: commentsLoading,
    hasMore: hasMoreComments,
    loadingMore: loadingMoreComments,
    loadMore: loadMoreComments,
    addComment,
    toggleLike,
    deleteComment,
    fetchReplies,
  } = useComments("take", take?.id || "", { authorId: take?.author_id, live: true });
  const reaction = useReaction("take", take?.id || "", {
    seed: take ? { total: take.reactions_count, mine: take.user_reaction_type, counts: take.reaction_counts } : undefined,
    authorId: take?.author_id,
    refreshOnFocus: true,
    loadCounts: true,
    loadComments: true,
    live: true,
  });
  const commentsCount = reaction.comments;

  const takeUrl = typeof window !== 'undefined' && take ? `${window.location.origin}/take/${take.id}` : '';
  const isOwner = user && take?.author_id && user.id === take.author_id;

  // Sync state when take changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (take) {
      setIsSaved(take.is_saved || false);
      setIsRelayed(take.is_relayed || false);
      setRelayCount(take.relays_count || 0);
      setShowContent(!take.content_warning);
    }
  }, [take?.id, take?.is_saved, take?.is_relayed, take?.relays_count, take?.content_warning]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Fetch hashtags, collaborators, and mentions when take changes. Each run
  // starts from empty and stops writing once a newer take is selected, so a
  // slow or failed request never leaves the previous take's tags on screen
  // (V-29).
  useEffect(() => {
    let cancelled = false;
    const fetchMetadata = async () => {
      setHashtags([]);
      setCollaborators([]);
      setMentions([]);
      if (!take?.id) return;

      // Fetch all metadata in parallel
      const [tagsRes, collabRes, mentionsRes] = await Promise.all([
        supabase.from("take_tags").select("tag").eq("take_id", take.id),
        supabase.from("take_collaborators").select("role, user_id").eq("take_id", take.id).eq("status", "accepted"),
        supabase.from("take_mentions").select("user_id").eq("take_id", take.id),
      ]);
      if (cancelled) return;

      // Set hashtags
      if (tagsRes.data) {
        setHashtags(tagsRes.data.map(t => t.tag));
      }

      // Fetch collaborator profiles
      if (collabRes.data && collabRes.data.length > 0) {
        const userIds = collabRes.data.map(c => c.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);

        if (cancelled) return;
        if (profiles) {
          const profileMap = new Map(profiles.map(p => [p.id, p]));
          setCollaborators(collabRes.data.map(c => ({
            role: c.role,
            user: profileMap.get(c.user_id) || { id: c.user_id, username: "unknown", display_name: null, avatar_url: null },
          })));
        }
      } else {
        setCollaborators([]);
      }

      // Fetch mention profiles
      if (mentionsRes.data && mentionsRes.data.length > 0) {
        const userIds = mentionsRes.data.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);

        if (cancelled) return;
        setMentions(profiles || []);
      } else {
        setMentions([]);
      }
    };

    fetchMetadata();
    return () => {
      cancelled = true;
    };
  }, [take?.id]);

  // Auto-play when modal opens (only if no content warning or user accepted it)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen && videoRef.current && showContent) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isOpen, take?.id, showContent]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDelete = async () => {
    if (!take || !user) return;

    setDeleting(true);
    try {
      await deleteOwnTake(take.id);

      setShowDeleteConfirm(false);
      onClose();
      if (onTakeDeleted) {
        onTakeDeleted(take.id);
      }
    } catch (err) {
      console.error("Failed to delete take:", err);
      actionToast.genericError("delete take");
      setDeleting(false);
    }
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user || !take) return;

    setReportSubmitting(true);
    try {
      const ok = await submitReport(
        { type: "take", takeId: take.id, reportedUserId: take.author_id },
        user.id,
        reason,
        details,
      );

      if (!ok) {
        actionToast.reportError();
        setReportSubmitting(false);
        return;
      }

      setReportSubmitted(true);
      actionToast.reportSubmitted();
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
      actionToast.reportError();
    }
    setReportSubmitting(false);
  };

  const takeMenuItems: ActionMenuItem[] = isOwner
    ? [
        {
          label: "Delete",
          onSelect: () => setShowDeleteConfirm(true),
          icon: icons.trash,
          tone: "danger",
        },
      ]
    : user
      ? [
          {
            label: "Report",
            onSelect: () => setShowReportModal(true),
            icon: icons.flag,
            tone: "danger",
          },
        ]
      : [];

  if (!take) return null;

  // Reaction handlers — the store owns optimistic update, RPC, revert, toast.
  const handleReaction = async (reactionType: TakeReactionType) => {
    await reaction.react(reactionType);
  };

  const handleRemoveReaction = async () => {
    await reaction.unreact();
  };

  const handleSave = async () => {
    if (!user) return;

    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);

    try {
      const { error } = newIsSaved
        ? await supabase.from("take_saves").insert({ take_id: take.id, user_id: user.id })
        : await supabase.from("take_saves").delete().eq("take_id", take.id).eq("user_id", user.id);
      if (error) throw error;
      onTakeUpdate?.({ takeId: take.id, field: "saves", isActive: newIsSaved, countChange: 0 });
    } catch {
      setIsSaved(!newIsSaved);
      actionToast.genericError(newIsSaved ? "save take" : "unsave take");
    }
  };

  const handleRelay = async () => {
    if (!user || take.author_id === user.id) return;

    const newIsRelayed = !isRelayed;
    const countChange = newIsRelayed ? 1 : -1;

    setIsRelayed(newIsRelayed);
    setRelayCount(prev => Math.max(0, prev + countChange));

    try {
      const { error } = newIsRelayed
        ? await supabase.from("take_relays").insert({ take_id: take.id, user_id: user.id })
        : await supabase.from("take_relays").delete().eq("take_id", take.id).eq("user_id", user.id);
      if (error) throw error;
      onTakeUpdate?.({ takeId: take.id, field: "relays", isActive: newIsRelayed, countChange });
    } catch {
      setIsRelayed(!newIsRelayed);
      setRelayCount(prev => prev - countChange);
      actionToast.genericError(newIsRelayed ? "relay take" : "remove relay");
    }
  };

  const handleAddComment = async () => {
    const text = commentText.trim();
    if (!text || !user || submitting) return;

    setSubmitting(true);
    setCommentText("");
    const result = await addComment(text);
    if (!result.success) {
      setCommentText(text);
      actionToast.genericError("post comment");
    }
    setSubmitting(false);
  };

  const handleCommentLike = (commentId: string) => {
    if (!user) return;
    void toggleLike(commentId);
  };

  const handleCommentDelete = (commentId: string) => {
    deleteComment(commentId);
  };

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className={`flex h-full ${showComments ? "" : ""}`}>
          {/* Main Content Area */}
          <div
            className={`flex flex-col overflow-y-auto p-10 ${
              showComments ? "flex-1 border-r border-border-light" : "flex-1"
            }`}
          >
            {/* Author Header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border-light">
              <Link href={`/studio/${take.author.username}`} onClick={onClose}>
                <img
                  src={take.author.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                  alt={take.author.display_name || take.author.username}
                  className="w-14 h-14 rounded-full object-cover border-[3px] border-white shadow-lg hover:scale-110 transition-transform"
                />
              </Link>
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/studio/${take.author.username}`}
                    onClick={onClose}
                    className="font-ui text-[1.1rem] font-medium text-ink hover:text-accent transition-colors"
                  >
                    {take.author.display_name || take.author.username}
                  </Link>
                  <span className="font-ui text-[0.9rem] font-light text-muted">
                    shared a take
                  </span>
                </div>
                <span className="font-ui text-[0.85rem] text-muted">
                  {getTimeAgo(take.created_at)}
                </span>
              </div>
              <button
                onClick={() => setShowComments(!showComments)}
                className="view-discussion-btn"
              >
                <CommentIcon className="shrink-0" />
                <span>Discussion</span>
                <span className="badge">
                  {commentsCount}
                </span>
              </button>

              {/* Take Options Menu */}
              {(isOwner || user) && (
                <ActionMenu
                  items={takeMenuItems}
                  buttonClassName="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-skeleton/60 transition-colors"
                  widthClassName="w-40"
                  buttonAriaLabel="Take options menu"
                />
              )}
            </div>

            {/* Post Content */}
            <div className="flex-1">
              {/* Caption */}
              {take.caption && (
                <p className="font-body text-[1.1rem] text-ink leading-relaxed mb-6">
                  {take.caption}
                </p>
              )}

              {/* Tags */}
              <PostTags
                hashtags={hashtags}
                collaborators={collaborators}
                mentions={mentions}
                kind="take"
                contentId={take.id}
                currentUserId={user?.id}
                onNavigate={onClose}
              />

              {/* Video Player */}
              <div className="mt-2">
                <div className="relative group rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
                  <div className="relative bg-black">
                    <video
                      ref={videoRef}
                      src={take.video_url}
                      poster={take.thumbnail_url || undefined}
                      className={`w-full object-contain cursor-pointer ${take.content_warning && !showContent ? 'blur-xl' : ''}`}
                      style={{ maxHeight: '480px' }}
                      loop
                      playsInline
                      muted={isMuted}
                      onClick={handleVideoClick}
                    />

                    {/* Content Warning Overlay */}
                    {take.content_warning && !showContent && (
                      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60">
                        <div className="flex flex-col items-center gap-4 p-6 max-w-[300px] text-center">
                          <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-ui text-base font-semibold text-white mb-1">Content Warning</h3>
                            <p className="font-ui text-sm text-white/70">{take.content_warning}</p>
                          </div>
                          <button
                            onClick={() => setShowContent(true)}
                            className="px-6 py-2.5 rounded-full font-ui text-sm font-medium text-white bg-surface/20 hover:bg-surface/30 transition-colors"
                          >
                            Show Content
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Play/Pause Overlay */}
                    {!isPlaying && showContent && (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                        onClick={handleVideoClick}
                      >
                        <div className="w-20 h-20 rounded-full bg-surface/95 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex items-center justify-center text-purple-primary hover:scale-110 transition-transform">
                          {icons.play}
                        </div>
                      </div>
                    )}

                    {/* Video Controls Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-between">
                        {/* Duration Badge */}
                        <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white font-ui text-[0.8rem]">
                          {Math.floor(take.duration / 60)}:{String(Math.floor(take.duration % 60)).padStart(2, '0')}
                        </div>

                        {/* Mute Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMute();
                          }}
                          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                        >
                          {isMuted ? icons.volumeOff : icons.volumeOn}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-auto pt-6 border-t border-border-light flex-wrap">
              {/* Reaction Picker */}
              <ReactionPicker
                variant="pill"
                kind="take"
                id={take.id}
                currentReaction={reaction.mine}
                reactionCounts={reaction.counts}
                countsLoaded={reaction.countsLoaded}
                onOpen={reaction.loadCounts}
                onReact={handleReaction}
                onRemoveReaction={handleRemoveReaction}
                disabled={!user}
              />

              {/* Comment Button */}
              <button
                onClick={() => setShowComments(true)}
                aria-label={commentsCount > 0 ? `Show comments, ${commentsCount.toLocaleString()}` : "Show comments"}
                className="engage-pill text-ink hover:bg-subtle transition-colors"
              >
                <CommentIcon className="shrink-0" />
                {commentsCount > 0 && <span className="engage-pill-count">{commentsCount.toLocaleString()}</span>}
              </button>

              {/* Relay Button */}
              <button
                onClick={handleRelay}
                disabled={!user || take.author_id === user?.id}
                aria-label={isRelayed ? `Remove relay (${relayCount} relays)` : `Relay take (${relayCount} relays)`}
                aria-pressed={isRelayed}
                className={`engage-pill transition-colors ${
                  isRelayed
                    ? "text-green-600"
                    : "text-ink hover:bg-subtle"
                } ${(!user || take.author_id === user?.id) ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {icons.relay}
                {relayCount > 0 && <span className="engage-pill-count">{relayCount.toLocaleString()}</span>}
              </button>

              <div className="flex-1" />

              {/* Share Button */}
              <button
                onClick={() => setShowShareModal(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-ink hover:bg-subtle transition-colors"
              >
                {icons.share}
              </button>

              {/* Save/Bookmark Button */}
              <button
                onClick={handleSave}
                disabled={!user}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isSaved
                    ? "text-ink"
                    : "text-ink hover:bg-subtle"
                } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isSaved ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                ) : (
                  icons.bookmark
                )}
              </button>
            </div>
          </div>

          {/* Comments Panel */}
          {showComments && (
            <div className="discussion-panel">
              {/* Comments Header */}
              <div className="p-5 border-b border-border-light bg-surface/60 flex justify-between items-center">
                <span className="font-ui text-[0.8rem] font-medium text-muted">
                  Discussion
                </span>
                <button
                  onClick={() => setShowComments(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-pink-vivid hover:rotate-90 transition-colors"
                >
                  {icons.close}
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-6">
                {commentsLoading ? (
                  <div className="space-y-1" aria-busy="true" aria-label="Loading comments">
                    <CommentSkeleton />
                    <CommentSkeleton />
                    <CommentSkeleton />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center text-purple-primary">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 7l3.5-3.5H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v15z" />
                      </svg>
                    </div>
                    <p className="font-ui text-[0.95rem] text-ink mb-1">No comments yet</p>
                    <p className="font-body text-sm text-muted">Be the first to share what you think.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        kind="take"
                        contentId={take.id}
                        currentUserId={user?.id}
                        canDeleteAny={!!isOwner}
                        onLike={handleCommentLike}
                        onReply={(parentId, content, replyToUserId) => addComment(content, { parentId, replyToUserId })}
                        onLoadReplies={fetchReplies}
                        onDelete={handleCommentDelete}
                      />
                    ))}
                    {hasMoreComments && (
                      <button
                        onClick={() => void loadMoreComments()}
                        disabled={loadingMoreComments}
                        className="w-full py-2 rounded-full font-ui text-[0.8rem] text-purple-primary hover:bg-purple-primary/5 transition-colors disabled:opacity-50"
                      >
                        {loadingMoreComments ? "Loading…" : "Load more comments"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Composer (Phase 6) */}
              {user ? (
                <div className="p-3 md:p-4 bg-surface border-t border-border-light">
                  <CommentComposer
                    value={commentText}
                    onChange={setCommentText}
                    onSubmit={handleAddComment}
                    submitting={submitting}
                    showAvatar
                    avatarUrl={profile?.avatar_url}
                  />
                </div>
              ) : (
                <div className="p-4 bg-surface border-t border-border-light text-center">
                  <p className="font-ui text-[0.9rem] text-muted">
                    <Link href="/login" className="text-purple-primary hover:underline">Sign in</Link> to comment
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Share Modal */}
      {take && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          url={takeUrl}
          title={take.caption || "Take"}
          description={take.caption || "Check out this take"}
          type="video"
          authorName={take.author.display_name || take.author.username}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Take?"
        description="This action cannot be undone. This will permanently delete your take and remove all associated data including comments and reactions."
        confirmText="Delete"
        isDanger
        loading={deleting}
      />

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReport}
          submitting={reportSubmitting}
          submitted={reportSubmitted}
        />
      )}
    </>
  );
}
