"use client";

import { useState, useCallback, memo } from "react";
import Modal from "@/components/ui/Modal";
import PostTags from "@/components/feed/PostTags";
import { icons } from "@/components/ui/Icons";
import { getBackgroundStyle } from "@/lib/utils/background";
import type { PostUpdate } from "@/components/providers/ModalProvider";
import type { ModalPost } from "@/components/feed/PostCard/types";
import { getPostPalette } from "./post-detail/palette";
import { usePostDetailActions } from "./post-detail/usePostDetailActions";
import { PostDetailHeader } from "./post-detail/PostDetailHeader";
import { PostBody } from "./post-detail/PostBody";
import { PostMediaGallery } from "./post-detail/PostMediaGallery";
import { ContentWarningOverlay } from "./post-detail/ContentWarningOverlay";
import { DetailActionRow } from "./post-detail/DetailActionRow";
import { DiscussionBody } from "./post-detail/DiscussionBody";
import { PostDetailDialogs } from "./post-detail/PostDetailDialogs";

interface PostDetailModalProps {
  post: ModalPost | null;
  isOpen: boolean;
  onClose: () => void;
  onPostUpdate?: (update: PostUpdate) => void;
  onPostDeleted?: (postId: string) => void;
  onAuthorBlocked?: (authorId: string) => void;
  // Community moderation props for comments
  canModerateDeleteComments?: boolean;
  onModeratorDeleteComment?: (commentId: string, reason?: string) => Promise<void>;
}

/**
 * The post opened over a list. Layout only: the body, gallery, action row,
 * discussion and dialogs are the same modules app/post/[id] renders
 * (profile audit 2e, V-52 / V-4).
 */
function PostDetailModalComponent({
  post,
  isOpen,
  onClose,
  onPostUpdate,
  onPostDeleted,
  onAuthorBlocked,
  canModerateDeleteComments,
  onModeratorDeleteComment,
}: PostDetailModalProps) {
  const [showComments, setShowComments] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const onDeleted = useCallback((postId: string) => { onClose(); onPostDeleted?.(postId); }, [onClose, onPostDeleted]);
  const onBlocked = useCallback((authorId: string) => { onClose(); onAuthorBlocked?.(authorId); }, [onClose, onAuthorBlocked]);

  const actions = usePostDetailActions(post, {
    commentsEnabled: showComments,
    onPostUpdate,
    onDeleted,
    onBlocked,
    onCollabRemoved: onClose,
    onNavigate: onClose,
  });

  if (!post) return null;

  const palette = getPostPalette(post.styling);
  const { hasBackground, hasDarkBg, border } = palette;
  const media = (post.media || []).filter((m) => m.media_type !== "audio");
  const mediaIndex = Math.min(currentMediaIndex, Math.max(0, media.length - 1));

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} ariaLabel={post.title ? `${post.title}, by ${post.author.name}` : `${post.typeLabel} by ${post.author.name}`}>
        <div className="post-detail-modal flex flex-col md:flex-row h-full w-full relative">
          {hasBackground && (
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                ...getBackgroundStyle(post.styling?.background),
                opacity: post.styling?.background?.type === "image" ? (post.styling.background.opacity ?? 1) : 1,
                filter: post.styling?.background?.type === "image" && post.styling.background.blur ? `blur(${post.styling.background.blur}px)` : undefined,
              }}
            />
          )}
          {post.styling?.background?.type === "image" && <div className="absolute inset-0 bg-black/30 rounded-3xl" />}

          <div className={`post-detail-content flex flex-col overflow-y-auto relative z-10 ${showComments ? "hidden md:flex md:flex-1 md:border-r" : "flex-1"} ${border}`}>
            <div className="post-detail-wrapper relative p-4 md:p-6 flex flex-col flex-1">
              <PostDetailHeader
                post={post}
                palette={palette}
                menuItems={actions.menuItems}
                onNavigate={onClose}
                onBack={onClose}
                discussion={{ count: actions.commentsCount, onToggle: () => setShowComments((v) => !v) }}
                className={`mb-4 md:mb-6 pb-4 md:pb-6 border-b ${border}`}
              />

              <div className="flex-1 relative">
                <PostBody post={post} palette={palette} titleAs="h2" />
                {media.length > 0 && (
                  <PostMediaGallery media={media} index={mediaIndex} onIndexChange={setCurrentMediaIndex} title={post.title || undefined} palette={palette} maxHeight={450} />
                )}
                {post.contentWarning && !actions.showContent && (
                  <ContentWarningOverlay warning={post.contentWarning} palette={palette} onShow={actions.revealContent} />
                )}
              </div>

              <PostTags
                collaborators={post.collaborators}
                mentions={post.mentions}
                kind="post"
                contentId={post.id}
                currentUserId={actions.user?.id}
                hashtags={post.hashtags}
                onNavigate={onClose}
              />

              <DetailActionRow
                kind="post"
                contentId={post.id}
                actions={actions}
                onComment={() => setShowComments(true)}
                hasDarkBg={hasDarkBg}
                className={`mt-6 pt-4 md:pt-6 border-t z-20 ${border}`}
              />
            </div>
          </div>

          {showComments && (
            <div className="discussion-panel absolute md:relative inset-0 md:inset-auto w-full md:w-auto bg-elevated z-40">
              <div className="discussion-header p-4 md:p-5 border-b border-border-light bg-elevated/60 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowComments(false)}
                    aria-label="Close comments"
                    className="discussion-close md:hidden w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-ink transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="discussion-title font-ui text-[0.8rem] font-medium text-muted">Discussion</span>
                </div>
                <button
                  onClick={() => setShowComments(false)}
                  aria-label="Close comments"
                  className="discussion-close hidden md:flex w-10 h-10 rounded-full items-center justify-center text-muted hover:text-accent-2 hover:rotate-90 transition-colors"
                >
                  {icons.close}
                </button>
              </div>
              <DiscussionBody
                kind="post"
                contentId={post.id}
                discussion={actions.comments}
                currentUserId={actions.user?.id}
                avatarUrl={actions.profile?.avatar_url}
                canDeleteAny={actions.isOwner}
                canModerateDeleteComments={canModerateDeleteComments}
                onModeratorDeleteComment={onModeratorDeleteComment}
              />
            </div>
          )}
        </div>
      </Modal>

      <PostDetailDialogs post={post} actions={actions} />
    </>
  );
}

// Memoize to prevent re-renders when parent state changes but modal props are the same
const PostDetailModal = memo(PostDetailModalComponent);
export default PostDetailModal;
