"use client";

import { PostDetailHeader, PostDetailBody, PostDetailActions, Discussion, getDetailTone, type DetailPost } from "./PostDetail";
import { NavIcon } from "@/components/layout/navigation";
import { useState, useEffect, useCallback, memo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { removeSelfAsCollaborator } from "@/lib/hooks.legacy";
import { useComments } from "@/lib/hooks/useComments";
import { useToggleSave, useToggleRelay, useToggleReaction, useReactionCounts, useUserReaction, useBlock } from "@/lib/hooks/useInteractions";
import { createNotification } from "@/lib/hooks/useNotifications";
import type { ReactionType } from "@/lib/types";
import { showToast } from "@/lib/utils/toast";
import type { PostUpdate } from "@/components/providers/ModalProvider";

const ShareModal = dynamic(() => import("@/components/ui/ShareModal"), { ssr: false });
const ReportModal = dynamic(() => import("@/components/ui/ReportModal"), { ssr: false });
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import { supabase } from "@/lib/supabase";
import { deleteOwnPost } from "@/lib/content-client";
import { icons, CommentIcon } from "@/components/ui/Icons";
import PostTags from "@/components/feed/PostTags";
import { PostStyling, JournalMetadata, SpotifyTrack, CommunityFlair } from "@/lib/types";

// Convert number to Roman numeral
interface TaggedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface CollaboratorUser {
  role?: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface Author {
  name: string;
  handle: string;
  avatar: string;
}

interface MediaItem {
  id: string;
  media_url: string;
  media_type: "image" | "video" | "audio";
  caption: string | null;
  position: number;
}

interface Post {
  id: string;
  authorId?: string;
  author: Author;
  type: "poem" | "journal" | "thought" | "visual" | "audio" | "video" | "essay" | "blog" | "story" | "letter" | "quote";
  typeLabel: string;
  timeAgo: string;
  createdAt?: string;
  title?: string;
  content: string;
  contentWarning?: string;
  media?: MediaItem[];
  image?: string;
  stats: {
    admires: number;
    comments: number;
    relays: number;
  };
  isAdmired?: boolean;
  isSaved?: boolean;
  isRelayed?: boolean;
  mentions?: TaggedUser[];
  hashtags?: string[];
  collaborators?: CollaboratorUser[];
  // Creative styling
  styling?: PostStyling | null;
  post_location?: string | null;
  metadata?: JournalMetadata | null;
  spotify_track?: SpotifyTrack | null;
  // Community + flair
  community?: { slug: string; name: string; avatar_url?: string | null } | null;
  flair?: CommunityFlair | null;
}

// Format date as "January 2, 2026"
// Format mood label
interface PostDetailModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onPostUpdate?: (update: PostUpdate) => void;
  onPostDeleted?: (postId: string) => void;
  // Community moderation props for comments
  canModerateDeleteComments?: boolean;
  onModeratorDeleteComment?: (commentId: string, reason?: string) => Promise<void>;
}

function PostDetailModalComponent({
  post,
  isOpen,
  onClose,
  onPostUpdate,
  onPostDeleted,
  canModerateDeleteComments,
  onModeratorDeleteComment,
}: PostDetailModalProps) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { openModal: openAuthModal } = useAuthModal();
  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isRelayed, setIsRelayed] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [showRemoveCollabConfirm, setShowRemoveCollabConfirm] = useState(false);
  const [removingCollab, setRemovingCollab] = useState(false);
  const [showContent, setShowContent] = useState(true);

  const { blockUser } = useBlock();

  const { comments, loading: commentsLoading, addComment, toggleLike, deleteComment, fetchReplies } = useComments(post?.id || "", user?.id);
  const { toggle: toggleSave } = useToggleSave();
  const { toggle: toggleRelay } = useToggleRelay();

  // Reaction system hooks
  const { react: toggleReaction, removeReaction } = useToggleReaction();
  const { counts: reactionCounts } = useReactionCounts(post?.id || "");
  const { reaction: userReaction, setReaction: setUserReaction } = useUserReaction(post?.id || "", user?.id);

  const visualMediaList = (post?.media || []).filter((m) => m.media_type !== "audio");
  const postUrl = typeof window !== 'undefined' && post ? `${window.location.origin}/post/${post.id}` : '';
  const isOwner = user && post?.authorId && user.id === post.authorId;
  const isAcceptedCollaborator = !!(
    user &&
    post?.collaborators?.some(
      (c) =>
        c.user?.id === user.id &&
        // Modal `CollaboratorUser` doesn't have `status`, but the data flowing in
        // via `fetchCollaboratedPosts` does — only "accepted" collaborators end up
        // on a user's profile, so absence of `status` is treated as accepted too.
        ((c as { status?: string }).status === undefined || (c as { status?: string }).status === "accepted")
    ) &&
    post?.authorId !== user.id
  );

  // Sync state when post changes
  useEffect(() => {
    if (post) {
      setIsSaved(post.isSaved || false);
      setIsRelayed(post.isRelayed || false);
      setRelayCount(post.stats.relays);
      setCurrentMediaIndex(0);
      setShowContent(!post.contentWarning);
    }
  }, [post?.id, post?.isSaved, post?.isRelayed, post?.stats.relays, post?.contentWarning]);

  const handleDelete = useCallback(async () => {
    if (!post || !user) return;

    setDeleting(true);
    try {
      await deleteOwnPost(post.id);

      setShowDeleteConfirm(false);
      onClose();
      // Notify parent to remove post from list
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (err) {
      console.error("Failed to delete post:", err);
      setDeleting(false);
    }
  }, [post, user, onClose, onPostDeleted]);

  const handleEdit = useCallback(() => {
    if (!post) return;
    onClose();
    router.push(`/create?edit=${post.id}`);
  }, [post, onClose, router]);

  const handleReport = useCallback(async (reason: string, details?: string) => {
    if (!user || !post) return;

    setReportSubmitting(true);
    try {
      // Look up community_id and author_id from the post
      const { data: postData } = await supabase
        .from("posts")
        .select("community_id, author_id")
        .eq("id", post.id)
        .single();

      const reportData: Record<string, unknown> = {
        reported_post_id: post.id,
        reported_user_id: postData?.author_id || post.authorId || null,
        reporter_id: user.id,
        reason: details ? `${reason}: ${details}` : reason,
        type: "post",
      };
      if (postData?.community_id) {
        reportData.community_id = postData.community_id;
      }

      const { error } = await supabase.from("reports").insert(reportData);

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
  }, [user, post]);

  const handleBlock = useCallback(async () => {
    if (!user || !post?.authorId) return;

    setIsBlocking(true);
    try {
      await blockUser(user.id, post.authorId);
      setShowBlockConfirm(false);
      onClose();
    } catch (err) {
      console.error("Failed to block user:", err);
    } finally {
      setIsBlocking(false);
    }
  }, [user, post?.authorId, blockUser, onClose]);

  const handleRemoveSelfAsCollaborator = useCallback(async () => {
    if (!user || !post?.id || !post?.authorId || !isAcceptedCollaborator) return;

    setRemovingCollab(true);
    const result = await removeSelfAsCollaborator(post.id, user.id, post.authorId);
    if (result.success) {
      setShowRemoveCollabConfirm(false);
      showToast.success(
        "Removed from collaboration",
        "This post no longer appears on your profile."
      );
      onClose();
    } else {
      showToast.error(
        "Couldn't remove you from this post",
        "Please try again."
      );
    }
    setRemovingCollab(false);
  }, [user, post?.id, post?.authorId, isAcceptedCollaborator, onClose]);

  const postMenuItems: ActionMenuItem[] = isOwner
    ? [
        {
          label: "Edit",
          onSelect: handleEdit,
          icon: icons.edit,
        },
        {
          label: "Delete",
          onSelect: () => setShowDeleteConfirm(true),
          icon: icons.trash,
          tone: "danger",
        },
      ]
    : user
      ? [
          ...(isAcceptedCollaborator
            ? [
                {
                  label: "Remove me as collaborator",
                  onSelect: () => setShowRemoveCollabConfirm(true),
                  icon: (
                    <svg
                      className="w-4 h-4"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 8a4 4 0 11-8 0 4 4 0 018 0zM2 20v-1a5 5 0 015-5h2a5 5 0 015 5v1M16 11h6" />
                    </svg>
                  ),
                  tone: "warning" as const,
                },
              ]
            : []),
          {
            label: "Block",
            onSelect: () => setShowBlockConfirm(true),
            icon: icons.block,
            dividerBefore: isAcceptedCollaborator,
          },
          {
            label: "Report",
            onSelect: () => setShowReportModal(true),
            icon: icons.flag,
            tone: "danger",
          },
        ]
      : [];

  // Reaction handlers - memoized with useCallback to prevent unnecessary re-renders
  const handleReaction = useCallback(async (reactionType: ReactionType) => {
    if (!user || !post) {
      openAuthModal();
      return;
    }

    const isSameReaction = userReaction === reactionType;

    // Optimistic update
    if (isSameReaction) {
      setUserReaction(null);
    } else {
      setUserReaction(reactionType);
    }

    // Database update (real-time subscription will update counts)
    await toggleReaction(post.id, user.id, reactionType, userReaction);

    // Create notification for reaction (use actual reaction type)
    if (!isSameReaction && post.authorId && post.authorId !== user.id) {
      await createNotification(post.authorId, user.id, reactionType, post.id);
    }

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "reactions",
      isActive: !isSameReaction,
      countChange: isSameReaction ? -1 : (userReaction ? 0 : 1),
      reactionType: isSameReaction ? null : reactionType,
    });
  }, [user, post, openAuthModal, userReaction, setUserReaction, toggleReaction, onPostUpdate]);

  const handleRemoveReaction = useCallback(async () => {
    if (!user || !post) {
      openAuthModal();
      return;
    }
    if (!userReaction) return;

    // Optimistic update
    setUserReaction(null);

    // Database update
    await removeReaction(post.id, user.id);

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "reactions",
      isActive: false,
      countChange: -1,
      reactionType: null,
    });
  }, [user, post, openAuthModal, userReaction, setUserReaction, removeReaction, onPostUpdate]);

  const handleSave = useCallback(async () => {
    if (!user || !post) {
      openAuthModal();
      return;
    }

    const newIsSaved = !isSaved;

    // Optimistic update
    setIsSaved(newIsSaved);

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "saves",
      isActive: newIsSaved,
      countChange: 0,
    });

    // Database update
    await toggleSave(post.id, user.id, isSaved);

    // Create notification when saving (not when unsaving)
    if (newIsSaved && post.authorId && post.authorId !== user.id) {
      await createNotification(post.authorId, user.id, 'save', post.id);
    }
  }, [user, post, openAuthModal, isSaved, onPostUpdate, toggleSave]);

  const handleRelay = useCallback(async () => {
    if (!user || !post) {
      openAuthModal();
      return;
    }
    // Can't relay your own posts
    if (user.id === post.authorId) return;

    const newIsRelayed = !isRelayed;
    const countChange = newIsRelayed ? 1 : -1;

    // Optimistic update
    setIsRelayed(newIsRelayed);
    setRelayCount((prev) => Math.max(0, prev + countChange));

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "relays",
      isActive: newIsRelayed,
      countChange,
    });

    // Database update
    await toggleRelay(post.id, user.id, isRelayed);

    // Create notification for relay
    if (newIsRelayed && post.authorId && post.authorId !== user.id) {
      await createNotification(post.authorId, user.id, "relay", post.id);
    }
  }, [user, post, openAuthModal, isRelayed, onPostUpdate, toggleRelay]);

  const handleAddComment = useCallback(async () => {
    if (!user || !post) {
      openAuthModal();
      return;
    }
    if (!commentText.trim()) return;

    setSubmitting(true);
    const result = await addComment(user.id, commentText.trim());
    if (result.success) {
      setCommentText("");
      // Create notification for comment
      if (post.authorId && post.authorId !== user.id) {
        await createNotification(post.authorId, user.id, 'comment', post.id, commentText.trim());
      }
    }
    setSubmitting(false);
  }, [user, post, openAuthModal, commentText, addComment]);

  const handleCommentLike = useCallback((commentId: string, isLiked: boolean) => {
    if (!user) {
      openAuthModal();
      return;
    }
    toggleLike(commentId, user.id, isLiked);
  }, [user, openAuthModal, toggleLike]);

  const handleCommentReply = useCallback(async (parentId: string, content: string) => {
    if (!user) {
      openAuthModal();
      return { success: false };
    }
    return await addComment(user.id, content, parentId);
  }, [user, openAuthModal, addComment]);

  const handleCommentDelete = useCallback((commentId: string) => {
    deleteComment(commentId);
  }, [deleteComment]);

  if (!post) return null;

  const tone = getDetailTone(post.styling);
  const detail: DetailPost = {
    id: post.id,
    authorId: post.authorId,
    author: post.author,
    type: post.type,
    timeAgo: post.timeAgo,
    createdAt: post.createdAt,
    title: post.title,
    content: post.content,
    contentWarning: post.contentWarning,
    media: post.media || [],
    image: post.image,
    mentions: post.mentions,
    hashtags: post.hashtags,
    collaborators: post.collaborators,
    styling: post.styling,
    post_location: post.post_location,
    metadata: post.metadata,
    spotify_track: post.spotify_track,
    flair: post.flair,
  };
  const dialogLabel = post.title ? `${post.title} by ${post.author.name}` : `Post by ${post.author.name}`;

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel={dialogLabel}>
      <div className={`pq-detail-modal ${showComments ? "pq-detail-modal--conversation" : ""}`}>
        <div className="pq-detail-modal__work">
          <PostDetailHeader
            post={detail}
            tone={tone}
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
                    items={postMenuItems}
                    buttonClassName="pq-icon-button"
                    widthClassName="w-56"
                    buttonAriaLabel="Post options menu"
                    portal
                  />
                )}
                <button type="button" onClick={onClose} className="pq-icon-button pq-detail-modal__show-md" aria-label="Close">
                  <NavIcon name="close" />
                </button>
              </>
            }
          />

          <PostDetailBody
            post={detail}
            tone={tone}
            headingLevel="h2"
            mediaIndex={currentMediaIndex}
            onMediaIndexChange={setCurrentMediaIndex}
            revealed={showContent}
            onReveal={() => setShowContent(true)}
          />

          <div className="pq-detail__tags">
            <PostTags collaborators={post.collaborators} mentions={post.mentions} hashtags={post.hashtags} onNavigate={onClose} />
          </div>

          <PostDetailActions
            signedIn={!!user}
            isOwner={!!isOwner}
            userReaction={userReaction}
            reactionCounts={reactionCounts}
            onReact={handleReaction}
            onRemoveReaction={handleRemoveReaction}
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
            comments={comments}
            loading={commentsLoading}
            currentUserId={user?.id}
            currentUserAvatar={profile?.avatar_url}
            signedIn={!!user}
            signInHref="/login"
            value={commentText}
            onValueChange={setCommentText}
            onSubmit={handleAddComment}
            submitting={submitting}
            onLike={handleCommentLike}
            onReply={handleCommentReply}
            onLoadReplies={fetchReplies}
            onDelete={handleCommentDelete}
            canModerateDelete={canModerateDeleteComments}
            onModeratorDelete={onModeratorDeleteComment}
            headerLeading={
              <button type="button" onClick={() => setShowComments(false)} className="pq-icon-button pq-detail-modal__hide-md -ml-2" aria-label="Back to the post">
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
      url={postUrl}
      title={post.title || post.content.substring(0, 150)}
      description={post.content}
      type={post.type}
      authorName={post.author.name}
      authorUsername={post.author.handle}
      authorAvatar={post.author.avatar}
      imageUrl={visualMediaList.length > 0 ? visualMediaList[0].media_url : ""}
    />

    <ConfirmationModal
      isOpen={showDeleteConfirm}
      onClose={() => setShowDeleteConfirm(false)}
      onConfirm={handleDelete}
      title="Erase this from your studio?"
      description="The post, its admires, and the conversation around it will fade for good. This page won't remember it."
      confirmText="Erase it"
      isDanger
      loading={deleting}
    />

    <ConfirmationModal
      isOpen={showRemoveCollabConfirm}
      onClose={() => !removingCollab && setShowRemoveCollabConfirm(false)}
      onConfirm={handleRemoveSelfAsCollaborator}
      title="Remove yourself from this collab?"
      description={`This post will no longer appear on your profile, and @${post.author.handle.replace('@', '')} will be notified. The post itself will stay published.`}
      confirmText="Remove me"
      cancelText="Cancel"
      isDanger
      loading={removingCollab}
    />

    <ConfirmationModal
      isOpen={showBlockConfirm}
      onClose={() => !isBlocking && setShowBlockConfirm(false)}
      onConfirm={handleBlock}
      title={`Block @${post.author.handle.replace('@', '')}?`}
      description="Their posts leave your feed and yours leave theirs. They won't be able to follow you or message you, and they won't be told."
      confirmText="Block"
      isDanger
      loading={isBlocking}
    />

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

// Memoize to prevent re-renders when parent state changes but modal props are the same
const PostDetailModal = memo(PostDetailModalComponent);
export default PostDetailModal;
