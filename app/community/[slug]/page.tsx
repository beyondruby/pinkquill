"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getTimeAgo } from "@/lib/utils/time";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DEFAULT_AVATAR } from "@/lib/utils/image";
import { getPostTypePhrase } from "@/lib/feed-view/post-type-theme";
import { Spinner } from "@/components/ui/Loading";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useCommunity, useCommunityPosts, useCommunityModeration } from "@/lib/hooks.legacy";
import { useCommunityPinnedPosts } from "@/lib/hooks/usePinnedPosts";
import type { Post } from "@/lib/types";
import { useTrackCommunityView } from "@/lib/hooks/useTracking";
import PostCard from "@/components/feed/PostCard";

import TimeRangeDropdown from "@/components/communities/TimeRangeDropdown";
import type { TopTimeRange } from "@/lib/types";
import "@/components/communities/communities.css";

type SortOption = 'newest' | 'hot' | 'top';

function transformPost(post: Post) {
  return {
    id: post.id,
    authorId: post.author_id,
    author: {
      name: post.author.display_name || post.author.username,
      handle: `@${post.author.username}`,
      avatar: post.author.avatar_url || DEFAULT_AVATAR,
    },
    type: post.type,
    typeLabel: getPostTypePhrase(post.type),
    timeAgo: getTimeAgo(post.created_at),
    createdAt: post.created_at,
    title: post.title || undefined,
    content: post.content,
    contentWarning: post.content_warning || undefined,
    media: post.media || [],
    stats: {
      admires: post.admires_count,
      reactions: post.reactions_count,
      comments: post.comments_count,
      relays: post.relays_count,
    },
    isAdmired: post.user_has_admired,
    reactionType: post.user_reaction_type,
    isSaved: post.user_has_saved,
    isRelayed: post.user_has_relayed,
    // Community & flair data
    community: post.community ? {
      slug: post.community.slug,
      name: post.community.name,
      avatar_url: post.community.avatar_url,
    } : undefined,
    flair: post.flair || undefined,
    // Creative styling
    styling: post.styling,
    post_location: post.post_location,
    metadata: post.metadata,
    spotify_track: post.spotify_track,
    // Collaborators, mentions, hashtags
    collaborators: post.collaborators?.map(c => ({
      ...c,
      status: c.status as "pending" | "accepted" | "declined",
    })),
    mentions: post.mentions,
    hashtags: post.hashtags,
  };
}

export default function CommunityFeedPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { setModerationContext } = useModal();
  const { community, tags, rules } = useCommunity(slug, user?.id);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [timeRange, setTimeRange] = useState<TopTimeRange>('week');

  // Track community views
  useTrackCommunityView(community?.id);

  const { posts, pinnedPosts, loading, refetch } = useCommunityPosts(
    community?.id || '',
    user?.id,
    sortBy,
    { timeRange: sortBy === 'top' ? timeRange : undefined }
  );

  // Pin/unpin functionality for admins/moderators
  const {
    isPinned,
    canPin,
    pinPost,
    unpinPost,
    refetch: refetchPins
  } = useCommunityPinnedPosts(community?.id);

  // Moderation functionality
  const {
    deletePost,
    deleteComment,
    hasPermission,
  } = useCommunityModeration(community?.id || '');

  // State for delete permissions
  const [canDeletePosts, setCanDeletePosts] = useState(false);
  const [canDeleteComments, setCanDeleteComments] = useState(false);

  // Check delete permissions on mount and when user/community changes
  useEffect(() => {
    const checkPermissions = async () => {
      if (user?.id && community?.id) {
        const [canDeletePostsPerm, canDeleteCommentsPerm] = await Promise.all([
          hasPermission(user.id, 'can_delete_posts'),
          hasPermission(user.id, 'can_delete_comments'),
        ]);
        setCanDeletePosts(canDeletePostsPerm);
        setCanDeleteComments(canDeleteCommentsPerm);
      } else {
        setCanDeletePosts(false);
        setCanDeleteComments(false);
      }
    };
    checkPermissions();
  }, [user?.id, community?.id, hasPermission]);

  // Handler for moderator comment deletion
  const handleModeratorDeleteComment = useCallback(async (commentId: string, reason?: string) => {
    const result = await deleteComment(commentId, undefined, reason);
    if (!result.success) {
      throw new Error(result.error as string);
    }
  }, [deleteComment]);

  // Set moderation context for the modal when permissions are available
  useEffect(() => {
    if (canDeleteComments) {
      setModerationContext({
        canModerateDeleteComments: true,
        onModeratorDeleteComment: handleModeratorDeleteComment,
      });
    } else {
      setModerationContext(null);
    }

    // Cleanup on unmount
    return () => {
      setModerationContext(null);
    };
  }, [canDeleteComments, handleModeratorDeleteComment, setModerationContext]);

  // Handler for moderator post deletion
  const handleModeratorDeletePost = useCallback(async (postId: string, reason?: string) => {
    const result = await deletePost(postId, reason);
    if (result.success) {
      refetch();
    } else {
      throw new Error(result.error as string);
    }
  }, [deletePost, refetch]);

  // Handle pin/unpin and refresh the posts list
  // Must be above the early return to respect rules of hooks
  const handlePin = useCallback(async (postId: string) => {
    if (!user?.id) return;
    const success = await pinPost(postId, user.id);
    if (success) {
      refetch();
      refetchPins();
    }
  }, [user, pinPost, refetch, refetchPins]);

  const handleUnpin = useCallback(async (postId: string) => {
    const success = await unpinPost(postId);
    if (success) {
      refetch();
      refetchPins();
    }
  }, [unpinPost, refetch, refetchPins]);

  if (!community) return null;

  const canPost = Boolean(community.is_member && community.user_status === "active");
  const canInteract = canPost;
  const isStaff = community.user_role === "admin" || community.user_role === "moderator";
  const base = `/community/${community.slug}`;
  const cardProps = {
    canModerateDelete: canDeletePosts,
    onModeratorDelete: handleModeratorDeletePost,
    disableRealtimeSubscriptions: true,
    readOnly: !canInteract,
  };

  return (
    <div className="pq-community-layout">
      <div className="pq-community-main">
        {community.is_member && community.welcome_message && (
          <div className="pq-welcome" role="note">
            <div>
              <strong>Welcome</strong>
              {community.welcome_message}
            </div>
          </div>
        )}

        <div className="pq-community-sort">
          <div className="pq-community-sort__left">
            <div className="pq-segmented" role="radiogroup" aria-label="Sort posts">
              {([
                { id: "newest" as SortOption, label: "Newest" },
                { id: "hot" as SortOption, label: "Lively" },
                { id: "top" as SortOption, label: "Top" },
              ]).map((option) => (
                <button key={option.id} type="button" role="radio" aria-checked={sortBy === option.id} className="pq-segmented__option" onClick={() => setSortBy(option.id)}>
                  {option.label}
                </button>
              ))}
            </div>
            {sortBy === "top" && <TimeRangeDropdown value={timeRange} onChange={setTimeRange} />}
          </div>
          <button type="button" className="pq-icon-button" onClick={() => refetch()} aria-label="Refresh posts" title="Refresh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-[18px] h-[18px]">
              <path d="M4 4v5h5M20 20v-5h-5" />
              <path d="M19.4 9A8 8 0 0 0 5.6 6.2L4 9M4.6 15a8 8 0 0 0 13.8 2.8L20 15" />
            </svg>
          </button>
        </div>

        {pinnedPosts.length > 0 && (
          <section className="pq-pinned" aria-labelledby="community-pinned">
            <h2 id="community-pinned" className="pq-pinned__label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17v5M8 7V3h8v4l2 5H6l2-5z" /></svg>
              Pinned by the moderators
            </h2>
            {pinnedPosts.map((post) => (
              <PostCard key={post.id} post={transformPost(post)} isPinned onUnpin={isStaff ? handleUnpin : undefined} {...cardProps} />
            ))}
          </section>
        )}

        {loading ? (
          <div className="pq-feed-state" role="status" aria-label="Loading posts"><Spinner size="lg" /></div>
        ) : posts.length > 0 ? (
          <div className="pq-feed-list">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={transformPost(post)}
                isPinned={isPinned(post.id)}
                onPin={isStaff && canPin && !isPinned(post.id) ? handlePin : undefined}
                onUnpin={isStaff && isPinned(post.id) ? handleUnpin : undefined}
                {...cardProps}
              />
            ))}
          </div>
        ) : (
          <div className="pq-feed-state pq-feed-state--card">
            <p className="pq-feed-state__title">{pinnedPosts.length > 0 || sortBy === "top" ? "Nothing more here" : "Nothing shared here yet"}</p>
            <p className="pq-feed-state__text">
              {sortBy === "top"
                ? "Nothing was shared in this window. Try a longer one, or the newest posts."
                : canPost
                  ? "You're a member. Be the first to share something with the room."
                  : community.is_member
                    ? "Posts will appear here once members start sharing."
                    : "Join to share your work here."}
            </p>
            {canPost && (
              <div className="pq-feed-state__actions">
                <Link href={`/create?community=${community.slug}`} className="pq-button pq-button--md pq-button--primary">Share something</Link>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="pq-community-aside" aria-label="About this community">
        {tags && tags.length > 0 && (
          <div className="pq-side-card">
            <h2 className="pq-side-card__title">What it&rsquo;s about</h2>
            <div className="pq-chip-row">
              {tags.filter((t) => t.tag_type !== "type").slice(0, 12).map((tag) => (
                <span key={tag.id} className="pq-chip">{tag.tag}</span>
              ))}
            </div>
          </div>
        )}

        <div className="pq-side-card">
          <h2 className="pq-side-card__title">Rules</h2>
          {rules && rules.length > 0 ? (
            <ol className="pq-side-card__list">
              {rules.slice(0, 5).map((rule) => (
                <li key={rule.id}>
                  <span>{rule.rule_number}</span>
                  <span>{rule.title}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="pq-side-card__text">This community hasn&rsquo;t written rules yet. Pinkquill&rsquo;s guidelines still apply.</p>
          )}
          <Link href={`${base}/about`} className="pq-side-card__link">
            About and all rules
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-4 h-4 ml-1"><path d="M9 6l6 6-6 6" /></svg>
          </Link>
        </div>
      </aside>
    </div>
  );
}
