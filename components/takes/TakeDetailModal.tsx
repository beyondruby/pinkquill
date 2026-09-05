"use client";

import { useState, useEffect, useRef } from "react";
import { getTimeAgo } from "@/lib/utils/time";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTakeComments, useTakeReactionCounts, TakeReactionType, Take } from "@/lib/hooks/useTakes";
import { deleteOwnTake } from "@/lib/content-client";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import TakeReactionPicker from "@/components/takes/TakeReactionPicker";
import TakeCommentItem from "@/components/takes/TakeCommentItem";
import TakeStage from "@/components/takes/TakeStage";
import PostTags from "@/components/feed/PostTags";
import { PostDetailHeader, PostDetailActions, Discussion, getDetailTone, type DetailPost } from "@/components/feed/PostDetail";
import { NavIcon } from "@/components/layout/navigation";
import { supabase } from "@/lib/supabase";
import { CommentIcon, icons } from "@/components/ui/Icons";
import { DEFAULT_AVATAR } from "@/lib/utils/image";
import "./takes.css";

export interface TakeUpdate {
  takeId: string;
  field: "reactions" | "comments" | "relays" | "saves";
  isActive: boolean;
  countChange: number;
  reactionType?: TakeReactionType | null;
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
  const [userReaction, setUserReaction] = useState<TakeReactionType | null>(null);
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

  const { comments, loading: commentsLoading, addComment, toggleLike, deleteComment } = useTakeComments(take?.id || "", user?.id);
  const { counts: reactionCounts } = useTakeReactionCounts(take?.id || "");

  const takeUrl = typeof window !== 'undefined' && take ? `${window.location.origin}/take/${take.id}` : '';
  const isOwner = user && take?.author_id && user.id === take.author_id;

  // Sync state when take changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (take) {
      setIsSaved(take.is_saved || false);
      setIsRelayed(take.is_relayed || false);
      setRelayCount(take.relays_count || 0);
      setUserReaction(take.user_reaction_type || null);
      setShowContent(!take.content_warning);
    }
  }, [take?.id, take?.is_saved, take?.is_relayed, take?.relays_count, take?.reactions_count, take?.user_reaction_type, take?.content_warning]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Fetch hashtags, collaborators, and mentions when take changes
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!take?.id) {
        setHashtags([]);
        setCollaborators([]);
        setMentions([]);
        return;
      }

      // Fetch all metadata in parallel
      const [tagsRes, collabRes, mentionsRes] = await Promise.all([
        supabase.from("take_tags").select("tag").eq("take_id", take.id),
        supabase.from("take_collaborators").select("role, user_id").eq("take_id", take.id).eq("status", "accepted"),
        supabase.from("take_mentions").select("user_id").eq("take_id", take.id),
      ]);

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

        setMentions(profiles || []);
      } else {
        setMentions([]);
      }
    };

    fetchMetadata();
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
      setDeleting(false);
    }
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user || !take) return;

    setReportSubmitting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        take_id: take.id,
        reporter_id: user.id,
        reason: reason,
        details: details || null,
        type: "take",
      });

      if (error) {
        console.error("Error submitting report:", error);
        setReportSubmitting(false);
        return;
      }

      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
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

  // Reaction handler
  const handleReaction = async (reactionType: TakeReactionType) => {
    if (!user) return;

    const isSameReaction = userReaction === reactionType;

    // Optimistic update
    if (isSameReaction) {
      setUserReaction(null);
    } else {
      setUserReaction(reactionType);
    }

    try {
      if (isSameReaction) {
        await supabase.from("take_reactions").delete()
          .eq("take_id", take.id)
          .eq("user_id", user.id);
      } else if (userReaction) {
        await supabase.from("take_reactions")
          .update({ reaction_type: reactionType })
          .eq("take_id", take.id)
          .eq("user_id", user.id);
      } else {
        await supabase.from("take_reactions").insert({
          take_id: take.id,
          user_id: user.id,
          reaction_type: reactionType,
        });
      }
    } catch {
      // Revert on error
      setUserReaction(take.user_reaction_type);
    }

    onTakeUpdate?.({
      takeId: take.id,
      field: "reactions",
      isActive: !isSameReaction,
      countChange: isSameReaction ? -1 : (userReaction ? 0 : 1),
      reactionType: isSameReaction ? null : reactionType,
    });
  };

  const handleRemoveReaction = async () => {
    if (!user || !userReaction) return;

    setUserReaction(null);

    try {
      await supabase.from("take_reactions").delete()
        .eq("take_id", take.id)
        .eq("user_id", user.id);
    } catch {
      setUserReaction(take.user_reaction_type);
    }

    onTakeUpdate?.({
      takeId: take.id,
      field: "reactions",
      isActive: false,
      countChange: -1,
      reactionType: null,
    });
  };

  const handleSave = async () => {
    if (!user) return;

    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);

    try {
      if (newIsSaved) {
        await supabase.from("take_saves").insert({
          take_id: take.id,
          user_id: user.id,
        });
      } else {
        await supabase.from("take_saves").delete()
          .eq("take_id", take.id)
          .eq("user_id", user.id);
      }
    } catch {
      setIsSaved(!newIsSaved);
    }

    onTakeUpdate?.({
      takeId: take.id,
      field: "saves",
      isActive: newIsSaved,
      countChange: 0,
    });
  };

  const handleRelay = async () => {
    if (!user || take.author_id === user.id) return;

    const newIsRelayed = !isRelayed;
    const countChange = newIsRelayed ? 1 : -1;

    setIsRelayed(newIsRelayed);
    setRelayCount(prev => Math.max(0, prev + countChange));

    try {
      if (newIsRelayed) {
        await supabase.from("take_relays").insert({
          take_id: take.id,
          user_id: user.id,
        });
      } else {
        await supabase.from("take_relays").delete()
          .eq("take_id", take.id)
          .eq("user_id", user.id);
      }
    } catch {
      setIsRelayed(!newIsRelayed);
      setRelayCount(prev => prev - countChange);
    }

    onTakeUpdate?.({
      takeId: take.id,
      field: "relays",
      isActive: newIsRelayed,
      countChange,
    });
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user) return;

    setSubmitting(true);
    const result = await addComment(commentText.trim());
    if (result) {
      setCommentText("");
    }
    setSubmitting(false);
  };

  const handleCommentLike = (commentId: string) => {
    if (!user) return;
    toggleLike(commentId);
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

  const authorName = take.author.display_name || take.author.username;
  const detail: DetailPost = {
    id: take.id,
    authorId: take.author_id,
    author: { name: authorName, handle: `@${take.author.username}`, avatar: take.author.avatar_url || DEFAULT_AVATAR },
    type: "take",
    timeAgo: getTimeAgo(take.created_at),
    createdAt: take.created_at,
    content: take.caption || "",
    media: [],
  };
  const tone = getDetailTone(null);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} ariaLabel={`Take by ${authorName}`}>
        <div className={`pq-detail-modal ${showComments ? "pq-detail-modal--conversation" : ""}`}>
          <div className="pq-detail-modal__work">
            <PostDetailHeader
              post={detail}
              tone={tone}
              typeLabel="shared a take"
              onNavigate={onClose}
              leading={
                <button type="button" onClick={onClose} className="pq-icon-button pq-detail-modal__hide-md -ml-2" aria-label="Back">
                  <NavIcon name="back" />
                </button>
              }
              trailing={
                <>
                  <button
                    type="button"
                    onClick={() => setShowComments((open) => !open)}
                    className="pq-chip pq-detail-modal__show-md"
                    aria-pressed={showComments}
                    aria-label={`Conversation, ${comments.length} comments`}
                  >
                    <CommentIcon size="sm" />
                    <span>Conversation</span>
                    {comments.length > 0 && <span className="pq-tab__count">{comments.length}</span>}
                  </button>
                  {user && (
                    <ActionMenu
                      items={takeMenuItems}
                      buttonClassName="pq-icon-button"
                      widthClassName="w-56"
                      buttonAriaLabel="Take options menu"
                      portal
                    />
                  )}
                  <button type="button" onClick={onClose} className="pq-icon-button pq-detail-modal__show-md" aria-label="Close">
                    <NavIcon name="close" />
                  </button>
                </>
              }
            />

            <div className="pq-take-detail">
              <TakeStage
                videoRef={videoRef}
                src={take.video_url}
                poster={take.thumbnail_url}
                isPlaying={isPlaying}
                onTogglePlay={handleVideoClick}
                isMuted={isMuted}
                onToggleMute={toggleMute}
                duration={take.duration}
                contentWarning={take.content_warning}
                revealed={showContent}
                onReveal={() => setShowContent(true)}
              />
              <div className="pq-take-detail__text">
                {take.caption && <p className="pq-detail__text pq-take-detail__caption">{take.caption}</p>}
                <div className="pq-detail__tags">
                  <PostTags hashtags={hashtags} collaborators={collaborators} mentions={mentions} onNavigate={onClose} />
                </div>
              </div>
            </div>

            <PostDetailActions
              signedIn={!!user}
              isOwner={!!isOwner}
              reactionControl={
                <TakeReactionPicker
                  currentReaction={userReaction}
                  reactionCounts={reactionCounts}
                  onReact={handleReaction}
                  onRemoveReaction={handleRemoveReaction}
                  disabled={!user}
                  compact
                />
              }
              commentCount={comments.length}
              onComment={() => setShowComments(true)}
              relayCount={relayCount}
              isRelayed={isRelayed}
              onRelay={handleRelay}
              onShare={() => setShowShareModal(true)}
              isSaved={isSaved}
              onSave={handleSave}
            />
          </div>

          <div className="pq-detail-modal__panel">
            <Discussion
              count={comments.length}
              thread={comments.map((comment) => (
                <TakeCommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={user?.id}
                  onLike={handleCommentLike}
                  onReply={async (content, parentId) => addComment(content, parentId)}
                  onDelete={handleCommentDelete}
                  onModalClose={onClose}
                />
              ))}
              loading={commentsLoading}
              currentUserId={user?.id}
              currentUserAvatar={profile?.avatar_url}
              signedIn={!!user}
              signInHref="/login"
              value={commentText}
              onValueChange={setCommentText}
              onSubmit={handleAddComment}
              submitting={submitting}
              headerLeading={
                <button type="button" onClick={() => setShowComments(false)} className="pq-icon-button pq-detail-modal__hide-md -ml-2" aria-label="Back to the take">
                  <NavIcon name="back" />
                </button>
              }
              headerTrailing={
                <button type="button" onClick={() => setShowComments(false)} className="pq-icon-button pq-detail-modal__show-md" aria-label="Hide conversation">
                  <NavIcon name="close" />
                </button>
              }
            />
          </div>
        </div>
      </Modal>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={takeUrl}
        title={take.caption || "Take"}
        description={take.caption || "Check out this take"}
        type="take"
        authorName={authorName}
        authorUsername={take.author.username}
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete this take?"
        description="This can't be undone. The take, its comments and reactions are removed for good."
        confirmText="Delete"
        isDanger
        loading={deleting}
      />

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        submitting={reportSubmitting}
        submitted={reportSubmitted}
      />
    </>
  );
}
