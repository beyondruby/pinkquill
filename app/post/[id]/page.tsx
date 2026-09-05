"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useComments } from "@/lib/hooks/useComments";
import { useToggleSave, useToggleRelay, useToggleReaction, useReactionCounts, useUserReaction, useBlock } from "@/lib/hooks/useInteractions";
import { createNotification } from "@/lib/hooks/useNotifications";
import type { ReactionType } from "@/lib/types";
import { deleteOwnPost } from "@/lib/content-client";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import AppShell from "@/components/layout/AppShell";
import { PageFrame } from "@/components/layout/PageFrame";
import PostTags from "@/components/feed/PostTags";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { ModalErrorFallback } from "@/components/ui/ErrorFallbacks";
import { icons } from "@/components/ui/Icons";
import { NavIcon } from "@/components/layout/navigation";
import { PostDetailHeader, PostDetailBody, PostDetailActions, Discussion, getDetailTone, type DetailPost } from "@/components/feed/PostDetail";
import { DEFAULT_AVATAR } from "@/lib/utils/image";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import Loading from "@/components/ui/Loading";
import type { PostStyling } from "@/lib/types";
import { getTimeAgo } from "@/lib/utils/time";

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
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface MediaItem {
  id: string;
  media_url: string;
  media_type: "image" | "video" | "audio";
  caption: string | null;
  position: number;
}

interface JournalMetadata {
  weather?: string;
  temperature?: string;
  mood?: string;
  timeOfDay?: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string;
  previewUrl?: string;
  externalUrl: string;
}

interface Post {
  id: string;
  author_id: string;
  status?: string | null;
  type: string;
  title: string | null;
  content: string;
  content_warning: string | null;
  created_at: string;
  author: Author;
  media: MediaItem[];
  mentions?: TaggedUser[];
  hashtags?: string[];
  collaborators?: CollaboratorUser[];
  post_location?: string | null;
  metadata?: JournalMetadata | null;
  spotify_track?: SpotifyTrack | null;
  styling?: PostStyling | null;
  flair?: { id: string; community_id: string; name: string; color: string; emoji: string | null; position: number; created_at: string } | null;
  community?: { id: string; slug: string; name: string; avatar_url: string | null } | null;
}

interface MentionRow {
  user: TaggedUser | TaggedUser[] | null;
}

interface TagRow {
  tag: { name?: string | null } | Array<{ name?: string | null }> | null;
}

interface CollaboratorRow {
  role?: string | null;
  user: CollaboratorUser["user"] | CollaboratorUser["user"][] | null;
}

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = params.id as string;
  const commentIdFromUrl = searchParams.get('comment');
  const mediaFailedFromUrl = searchParams.get("media_failed");
  const { user, profile } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isRelayed, setIsRelayed] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [showContent, setShowContent] = useState(true);

  const { blockUser } = useBlock();
  const commentInputRef = useRef<HTMLInputElement>(null);

  const { toggle: toggleSave } = useToggleSave();
  const { toggle: toggleRelay } = useToggleRelay();
  const { comments, loading: commentsLoading, addComment, toggleLike, deleteComment, fetchReplies } = useComments(postId, user?.id);

  // Reaction system hooks
  const { react: toggleReaction, removeReaction } = useToggleReaction();
  const { counts: reactionCounts } = useReactionCounts(postId);
  const { reaction: userReaction, setReaction: setUserReaction } = useUserReaction(postId, user?.id);

  // Scroll to comment when navigating from notification
  useEffect(() => {
    if (commentIdFromUrl && !commentsLoading && comments.length > 0) {
      // Wait a bit for DOM to render
      const timeoutId = setTimeout(() => {
        const commentElement = document.getElementById(`comment-${commentIdFromUrl}`);
        if (commentElement) {
          commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight effect
          commentElement.classList.add('highlight-comment');
          setTimeout(() => {
            commentElement.classList.remove('highlight-comment');
          }, 2000);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [commentIdFromUrl, commentsLoading, comments.length]);

  // Single fetch function for all data
  const fetchData = useCallback(async () => {
    if (!postId) {
      setError("No post ID");
      setLoading(false);
      return;
    }

    try {
      // Fetch post
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select(`
          *,
          author:profiles!posts_author_id_fkey (
            username,
            display_name,
            avatar_url
          ),
          media:post_media (
            id,
            media_url,
            media_type,
            caption,
            position
          ),
          community:communities (
            id,
            slug,
            name,
            avatar_url
          ),
          flair:community_flairs (
            id,
            community_id,
            name,
            color,
            emoji,
            position,
            created_at
          )
        `)
        .eq("id", postId)
        .single();

      if (postError) {
        setError("Post not found");
        setLoading(false);
        return;
      }

      if (!postData) {
        setError("Post not found");
        setLoading(false);
        return;
      }

      // SECURITY CHECK: Blocking (Highest Priority - Rule Set 1)
      // If User A blocks User B, User B CANNOT see User A's posts (even via direct link)
      const isOwner = user?.id === postData.author_id;
      const postStatus = postData.status || "published";
      let hasCollaborationAccess = false;

      // Only the author and invited collaborators can view unpublished drafts via direct URL.
      if (postStatus !== "published" && !isOwner) {
        if (!user) {
          setError("Post not found");
          setLoading(false);
          return;
        }

        const { data: collaboration } = await supabase
          .from("post_collaborators")
          .select("status")
          .eq("post_id", postId)
          .eq("user_id", user.id)
          .maybeSingle();

        const canViewUnpublished =
          collaboration?.status === "pending" || collaboration?.status === "accepted";

        if (!canViewUnpublished) {
          setError("Post not found");
          setLoading(false);
          return;
        }

        hasCollaborationAccess = true;
      }

      // Blocks are enforced by the posts read policy (Phase 6): a blocked
      // viewer never receives the row, so no client-side check is needed.

      // SECURITY CHECK: Enforce visibility rules (Rule Set 2, 3, 4)
      const visibility = postData.visibility;

      if (visibility === "private") {
        // Private posts: only the author can see
        if (!isOwner && !hasCollaborationAccess) {
          setError("This post is private");
          setLoading(false);
          return;
        }
      } else if (visibility === "followers") {
        // Followers-only posts: only the author or their followers can see
        if (!isOwner && !hasCollaborationAccess) {
          if (!user) {
            // Not logged in - can't see followers-only content
            setError("You must be logged in to view this post");
            setLoading(false);
            return;
          }

          // Check if the current user follows the post author
          const { count: followCount } = await supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", user.id)
            .eq("following_id", postData.author_id);

          if (!followCount || followCount === 0) {
            setError("This post is only visible to followers");
            setLoading(false);
            return;
          }
        }
      }

      // SECURITY CHECK: Private account check
      // If the author has a private account, only approved followers can see their posts
      if (!isOwner && !hasCollaborationAccess) {
        const { data: authorProfile } = await supabase
          .from("profiles")
          .select("is_private")
          .eq("id", postData.author_id)
          .single();

        if (authorProfile?.is_private) {
          if (!user) {
            setError("This post is from a private account");
            setLoading(false);
            return;
          }

          // Check if user is an accepted follower
          const { count: followCount } = await supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", user.id)
            .eq("following_id", postData.author_id);

          if (!followCount || followCount === 0) {
            setError("This post is from a private account");
            setLoading(false);
            return;
          }
        }
      }

      // Fetch mentions, hashtags, collaborators, relays, and saves in parallel
      const mentionsPromise = supabase
        .from("post_mentions")
        .select(`
          user:profiles!post_mentions_user_id_fkey (
            id, username, display_name, avatar_url
          )
        `)
        .eq("post_id", postId);

      const tagsPromise = supabase
        .from("post_tags")
        .select("tag:tags(name)")
        .eq("post_id", postId);

      const collabPromise = supabase
        .from("post_collaborators")
        .select(`
          role,
          user:profiles!post_collaborators_user_id_fkey (
            id, username, display_name, avatar_url
          )
        `)
        .eq("post_id", postId)
        .eq("status", "accepted");

      const relaysPromise = supabase.from("relays").select("user_id").eq("post_id", postId);

      const savePromise = user
        ? supabase
            .from("saves")
            .select("user_id")
            .eq("post_id", postId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [mentionsRes, tagsRes, collabRes, relaysResult, saveResult] = await Promise.all([
        mentionsPromise, tagsPromise, collabPromise, relaysPromise, savePromise,
      ]);

      const mentions: TaggedUser[] = mentionsRes.data
        ? (mentionsRes.data as MentionRow[])
            .map((m) => {
              const u = Array.isArray(m.user) ? m.user[0] : m.user;
              return u as TaggedUser | null;
            })
            .filter((u): u is TaggedUser => u !== null && u !== undefined)
        : [];

      const hashtags: string[] = tagsRes.data
        ? (tagsRes.data as TagRow[])
            .map((t) => {
              const tag = Array.isArray(t.tag) ? t.tag[0] : t.tag;
              return tag?.name;
            })
            .filter((name): name is string => !!name)
        : [];

      const collaborators: CollaboratorUser[] = collabRes.data
        ? (collabRes.data as CollaboratorRow[])
            .map((c) => {
              const u = Array.isArray(c.user) ? c.user[0] : c.user;
              return u ? { role: c.role, user: u } as CollaboratorUser : null;
            })
            .filter((c): c is CollaboratorUser => c !== null)
        : [];

      const normalizedFlair = Array.isArray(postData.flair) ? postData.flair[0] : postData.flair;
      const normalizedCommunity = Array.isArray(postData.community) ? postData.community[0] : postData.community;
      setPost({ ...postData, flair: normalizedFlair || null, community: normalizedCommunity || null, mentions, hashtags, collaborators });
      setShowContent(!postData.content_warning);

      // Process relays
      setRelayCount(relaysResult.data?.length || 0);

      if (user) {
        const userRelayed = relaysResult.data?.some((r: { user_id: string }) => r.user_id === user.id) || false;
        setIsRelayed(userRelayed);
        setIsSaved(!!saveResult.data);
      }

      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load post");
      setLoading(false);
    }
  }, [postId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reaction handlers
  const handleReaction = async (reactionType: ReactionType) => {
    if (!user || !post) return;

    const isSameReaction = userReaction === reactionType;

    // Optimistic update
    if (isSameReaction) {
      setUserReaction(null);
    } else {
      setUserReaction(reactionType);
    }

    // Database update (real-time subscription will update counts)
    await toggleReaction(post.id, user.id, reactionType, userReaction);

    // Create notification for reaction
    if (!isSameReaction && post.author_id !== user.id) {
      await createNotification(post.author_id, user.id, reactionType, post.id);
    }
  };

  const handleRemoveReaction = async () => {
    if (!user || !post || !userReaction) return;

    // Optimistic update
    setUserReaction(null);

    // Database update
    await removeReaction(post.id, user.id);
  };

  const handleSave = async () => {
    if (!user || !post) return;

    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);

    await toggleSave(post.id, user.id, !newIsSaved);
  };

  const handleRelay = async () => {
    if (!user || !post) return;
    // Can't relay your own posts
    if (user.id === post.author_id) return;

    const newIsRelayed = !isRelayed;
    setIsRelayed(newIsRelayed);
    setRelayCount(prev => newIsRelayed ? prev + 1 : Math.max(0, prev - 1));

    await toggleRelay(post.id, user.id, !newIsRelayed);

    if (newIsRelayed && post.author_id !== user.id) {
      await createNotification(post.author_id, user.id, "relay", post.id);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user || !post) return;

    setSubmitting(true);
    const result = await addComment(user.id, commentText.trim());
    if (result.success) {
      setCommentText("");
      if (post.author_id !== user.id) {
        await createNotification(post.author_id, user.id, "comment", post.id, commentText.trim());
      }
    }
    setSubmitting(false);
  };

  const handleCommentLike = (commentId: string, isLiked: boolean) => {
    if (!user) return;
    toggleLike(commentId, user.id, isLiked);
  };

  const handleCommentReply = async (parentId: string, content: string) => {
    if (!user) return { success: false };
    return await addComment(user.id, content, parentId);
  };

  const handleCommentDelete = (commentId: string) => {
    deleteComment(commentId);
  };

  const isOwner = user && post && user.id === post.author_id;

  const handleDelete = async () => {
    if (!post || !user) return;

    setDeleting(true);
    try {
      await deleteOwnPost(post.id);

      // Navigate back to home
      router.push("/");
    } catch (err) {
      console.error("Failed to delete post:", err);
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    if (!post) return;
    // Navigate to create page with post ID for editing
    router.push(`/create?edit=${post.id}`);
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user || !post) return;

    setReportSubmitting(true);
    try {
      // Look up community_id from the post
      const { data: postMeta } = await supabase
        .from("posts")
        .select("community_id")
        .eq("id", post.id)
        .single();

      const reportData: Record<string, unknown> = {
        reported_post_id: post.id,
        reported_user_id: post.author_id,
        reporter_id: user.id,
        reason: details ? `${reason}: ${details}` : reason,
        type: "post",
      };
      if (postMeta?.community_id) {
        reportData.community_id = postMeta.community_id;
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
  };

  const handleBlock = async () => {
    if (!user || !post) return;

    setIsBlocking(true);
    try {
      await blockUser(user.id, post.author_id);
      setShowBlockConfirm(false);
      router.push("/");
    } catch (err) {
      console.error("Failed to block user:", err);
    } finally {
      setIsBlocking(false);
    }
  };

  const postUrl = typeof window !== 'undefined' ? `${window.location.origin}/post/${postId}` : `/post/${postId}`;
  const postMenuItems: ActionMenuItem[] = [
    {
      label: "Share post",
      description: "Open sharing options",
      onSelect: () => setShowShareModal(true),
      icon: icons.share,
    },
    {
      label: "Copy post link",
      description: "Copy a direct URL",
      onSelect: () => navigator.clipboard.writeText(postUrl),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
    {
      label: "Edit post",
      description: "Update this work",
      onSelect: handleEdit,
      hidden: !isOwner,
      sectionLabel: "Author",
      icon: icons.edit,
    },
    {
      label: "Delete post",
      description: "Remove this post permanently",
      onSelect: () => setShowDeleteConfirm(true),
      hidden: !isOwner,
      tone: "danger",
      dividerBefore: true,
      icon: icons.trash,
    },
    {
      label: `Block @${post?.author.username || "user"}`,
      description: "Stop seeing and receiving interactions",
      onSelect: () => setShowBlockConfirm(true),
      hidden: !user || !!isOwner,
      sectionLabel: "Safety",
      dividerBefore: true,
      tone: "warning",
      icon: icons.block,
    },
    {
      label: "Report post",
      description: "Send this post to moderation",
      onSelect: () => setShowReportModal(true),
      hidden: !user || !!isOwner,
      tone: "danger",
      icon: icons.flag,
    },
  ];

  // Loading state
  if (loading) {
    return (
      <AppShell>
        <PageFrame width="narrow">
          <div className="flex justify-center py-20">
            <Loading text="Unfolding the page" />
          </div>
        </PageFrame>
      </AppShell>
    );
  }

  // Error state
  if (error || !post) {
    return (
      <AppShell>
        <PageFrame width="narrow">
          <div className="pq-feed-state pq-feed-state--card" role="alert">
            <h1 className="pq-feed-state__title">This post isn&rsquo;t here</h1>
            <p className="pq-feed-state__text">It may have been removed, or the link may be wrong.</p>
            <div className="pq-feed-state__actions">
              <Link href="/" className="pq-button pq-button--md pq-button--secondary">Back to Home</Link>
              <Link href="/explore" className="pq-button pq-button--md pq-button--primary">Explore</Link>
            </div>
          </div>
        </PageFrame>
      </AppShell>
    );
  }

  const failedMediaCount = mediaFailedFromUrl ? Number(mediaFailedFromUrl) : 0;
  const hasFailedMediaNotice = Number.isFinite(failedMediaCount) && failedMediaCount > 0;
  const visualMedia = (post.media || []).filter((m) => m.media_type !== "audio");
  const tone = getDetailTone(post.styling);
  const detail: DetailPost = {
    id: post.id,
    authorId: post.author_id,
    author: {
      name: post.author.display_name || post.author.username,
      handle: `@${post.author.username}`,
      avatar: post.author.avatar_url || DEFAULT_AVATAR,
    },
    type: post.type,
    timeAgo: getTimeAgo(post.created_at),
    createdAt: post.created_at,
    title: post.title || undefined,
    content: post.content,
    contentWarning: post.content_warning || undefined,
    media: post.media || [],
    mentions: post.mentions,
    hashtags: post.hashtags,
    collaborators: post.collaborators,
    styling: post.styling,
    post_location: post.post_location,
    metadata: post.metadata,
    spotify_track: post.spotify_track,
    flair: post.flair,
  };

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };

  const focusConversation = () => {
    const input = commentInputRef.current;
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      document.querySelector(".pq-discussion")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <ErrorBoundary
      section="PostDetail"
      fallback={({ reset }) => <ModalErrorFallback onRetry={reset} />}
    >
      <AppShell>
        <PageFrame width="wide">
          <button type="button" onClick={goBack} className="pq-detail__back pq-button pq-button--sm pq-button--ghost">
            <NavIcon name="back" className="w-4 h-4" />
            Back
          </button>

          <div className="pq-detail">
            <article className="pq-detail__card" aria-label={post.title ? `${post.title} by ${detail.author.name}` : `Post by ${detail.author.name}`}>
              <PostDetailHeader
                post={detail}
                tone={tone}
                trailing={user ? (
                  <ActionMenu
                    label="Post actions"
                    items={postMenuItems}
                    buttonClassName="pq-icon-button"
                    widthClassName="w-64"
                    buttonAriaLabel="Post actions"
                    portal
                  />
                ) : undefined}
              />

              <PostDetailBody
                post={detail}
                tone={tone}
                headingLevel="h1"
                mediaIndex={currentMediaIndex}
                onMediaIndexChange={setCurrentMediaIndex}
                revealed={showContent}
                onReveal={() => setShowContent(true)}
                notice={hasFailedMediaNotice ? (
                  <p className="pq-detail__notice" role="status">
                    {failedMediaCount} media file{failedMediaCount === 1 ? "" : "s"} failed to upload when this post was published.
                  </p>
                ) : undefined}
              />

              <div className="pq-detail__tags">
                <PostTags collaborators={post.collaborators} mentions={post.mentions} hashtags={post.hashtags} />
              </div>

              <PostDetailActions
                signedIn={!!user}
                isOwner={!!isOwner}
                userReaction={userReaction}
                reactionCounts={reactionCounts}
                onReact={handleReaction}
                onRemoveReaction={handleRemoveReaction}
                commentCount={comments.length}
                onComment={focusConversation}
                relayCount={relayCount}
                isRelayed={isRelayed}
                onRelay={handleRelay}
                onShare={() => setShowShareModal(true)}
                isSaved={isSaved}
                onSave={handleSave}
              />
            </article>

            <Discussion
              ref={commentInputRef}
              comments={comments}
              loading={commentsLoading}
              currentUserId={user?.id}
              currentUserAvatar={profile?.avatar_url}
              signedIn={!!user}
              signInHref={`/login?redirect=${encodeURIComponent(`/post/${postId}`)}`}
              value={commentText}
              onValueChange={setCommentText}
              onSubmit={handleAddComment}
              submitting={submitting}
              onLike={handleCommentLike}
              onReply={handleCommentReply}
              onLoadReplies={fetchReplies}
              onDelete={handleCommentDelete}
            />
          </div>
        </PageFrame>
      </AppShell>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={postUrl}
        title={post.title || post.content.substring(0, 100)}
        description={post.content.substring(0, 200)}
        type={post.type}
        authorName={detail.author.name}
        authorUsername={post.author.username}
        authorAvatar={post.author.avatar_url || ""}
        imageUrl={visualMedia.length > 0 ? visualMedia[0].media_url : ""}
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
        isOpen={showBlockConfirm}
        onClose={() => !isBlocking && setShowBlockConfirm(false)}
        onConfirm={handleBlock}
        title={`Block @${post.author.username}?`}
        description="They won't be able to see your posts, follow you, or message you. They won't be notified."
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
    </ErrorBoundary>
  );
}
