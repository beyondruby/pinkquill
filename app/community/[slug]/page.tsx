"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useCommunity, useCommunityPosts, useCommunityPinnedPosts, useCommunityModeration, Post } from "@/lib/hooks";
import { useTrackCommunityView } from "@/lib/hooks/useTracking";
import PostCard from "@/components/feed/PostCard";

import TimeRangeDropdown from "@/components/communities/TimeRangeDropdown";
import type { TopTimeRange } from "@/lib/types";

type SortOption = 'newest' | 'hot' | 'top';

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    poem: "wrote a poem",
    journal: "wrote in their journal",
    thought: "shared a thought",
    visual: "shared a visual story",
    audio: "recorded a voice note",
    video: "shared a video",
    essay: "wrote an essay",
    blog: "published a blog post",
    story: "shared a story",
    letter: "wrote a letter",
    quote: "shared a quote",
  };
  return labels[type] || "shared";
}

function transformPost(post: Post) {
  return {
    id: post.id,
    authorId: post.author_id,
    author: {
      name: post.author.display_name || post.author.username,
      handle: `@${post.author.username}`,
      avatar:
        post.author.avatar_url ||
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80",
    },
    type: post.type,
    typeLabel: getTypeLabel(post.type),
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
  const { community, tags } = useCommunity(slug, user?.id);
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

  const canPost = community.is_member && community.user_status === 'active';
  const isAdmin = community.user_role === 'admin' || community.user_role === 'moderator';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Feed */}
      <div className="lg:col-span-2">
        {/* Sort Options - Enhanced */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-white/80 backdrop-blur-sm rounded-xl border border-purple-primary/10">
              <button
                onClick={() => setSortBy('newest')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-ui text-sm font-medium transition-all duration-200 ${
                  sortBy === 'newest'
                    ? 'bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-md'
                    : 'text-muted hover:text-ink hover:bg-purple-primary/5'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Newest
              </button>
              <button
                onClick={() => setSortBy('hot')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-ui text-sm font-medium transition-all duration-200 ${
                  sortBy === 'hot'
                    ? 'bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-md'
                    : 'text-muted hover:text-ink hover:bg-purple-primary/5'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
                Hot
              </button>
              <button
                onClick={() => setSortBy('top')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-ui text-sm font-medium transition-all duration-200 ${
                  sortBy === 'top'
                    ? 'bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-md'
                    : 'text-muted hover:text-ink hover:bg-purple-primary/5'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Top
              </button>
            </div>

            {/* Time Range Dropdown - only show when Top is selected */}
            {sortBy === 'top' && (
              <TimeRangeDropdown
                value={timeRange}
                onChange={setTimeRange}
              />
            )}
          </div>

          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg text-muted hover:text-purple-primary hover:bg-purple-primary/5 transition-all"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Pinned Posts - Enhanced */}
        {pinnedPosts.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-primary/10 via-pink-vivid/10 to-orange-warm/10 border border-purple-primary/10">
                <svg className="w-4 h-4 text-purple-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/>
                </svg>
                <span className="font-ui text-xs font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent uppercase tracking-wider">
                  Pinned
                </span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-purple-primary/20 via-pink-vivid/10 to-transparent" />
            </div>
            <div className="space-y-4">
              {pinnedPosts.map((post) => (
                <div key={post.id} className="relative">
                  {/* Pin indicator */}
                  <div className="absolute top-1 left-4 z-10">
                    <svg className="w-4 h-4 text-purple-primary drop-shadow-sm" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/>
                    </svg>
                  </div>
                  <div>
                    <PostCard
                      post={transformPost(post)}
                      canModerateDelete={canDeletePosts}
                      onModeratorDelete={handleModeratorDeletePost}
                      isPinned={true}
                      onUnpin={isAdmin ? handleUnpin : undefined}
                      disableRealtimeSubscriptions={true}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-purple-primary/20 border-t-purple-primary animate-spin" />
              <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-r-pink-vivid/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <p className="font-ui text-sm text-muted">Loading posts...</p>
          </div>
        ) : posts.length > 0 ? (
          <div className="space-y-5">
            {posts.map((post) => (
              <div key={post.id}>
                <PostCard
                  post={transformPost(post)}
                  canModerateDelete={canDeletePosts}
                  onModeratorDelete={handleModeratorDeletePost}
                  isPinned={isPinned(post.id)}
                  onPin={isAdmin && canPin && !isPinned(post.id) ? handlePin : undefined}
                  onUnpin={isAdmin && isPinned(post.id) ? handleUnpin : undefined}
                  disableRealtimeSubscriptions={true}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-primary/5 via-pink-vivid/3 to-orange-warm/5 border border-purple-primary/10 p-10 text-center">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-purple-primary/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-pink-vivid/10 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
              <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-primary/10 via-pink-vivid/10 to-orange-warm/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-purple-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <h3 className="font-display text-xl font-bold text-ink mb-2">No posts yet</h3>
              <p className="font-body text-muted mb-6 max-w-sm mx-auto">
                Be the first to share something with this community!
              </p>
              {canPost && (
                <Link
                  href={`/create?community=${community.slug}`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui font-semibold shadow-lg shadow-purple-primary/25 hover:shadow-xl hover:shadow-pink-vivid/30 hover:-translate-y-0.5 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create First Post
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="hidden lg:block">
        <div className="sticky top-16 space-y-5">
          {/* About Card - Combined with members */}
          <div className="relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm border border-purple-primary/10 p-5">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-primary/5 to-transparent rounded-bl-full" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-ui text-sm font-bold text-ink uppercase tracking-wide">About</h3>
              </div>

              {/* Members Count */}
              <Link
                href={`/community/${community.slug}/members`}
                className="flex items-center gap-2 mb-4 pb-4 border-b border-ink/5 group"
              >
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 animate-ping opacity-40" />
                </div>
                <span className="font-ui text-sm text-ink/70 group-hover:text-purple-primary transition-colors">
                  {community.member_count || 0} members
                </span>
              </Link>

              {/* Tags */}
              {tags && tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className={`px-2.5 py-1 rounded-full text-xs font-ui font-medium ${
                        tag.tag_type === 'genre'
                          ? 'bg-purple-primary/10 text-purple-primary'
                          : tag.tag_type === 'theme'
                          ? 'bg-pink-vivid/10 text-pink-vivid'
                          : tag.tag_type === 'type'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-ink/5 text-ink/60'
                      }`}
                    >
                      {tag.tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Meta info */}
              <div className="space-y-3 mb-4">
                {community.created_at && (
                  <div className="flex items-center gap-3 text-ink/50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-ui text-sm">
                      Created {new Date(community.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-ink/50">
                  {community.privacy === 'private' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="font-ui text-sm">Invite-only</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                      </svg>
                      <span className="font-ui text-sm">Open to everyone</span>
                    </>
                  )}
                </div>
              </div>

              <Link
                href={`/community/${community.slug}/about`}
                className="inline-flex items-center gap-2 font-ui text-sm font-medium text-purple-primary hover:text-pink-vivid transition-colors group"
              >
                Learn more
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Community Guidelines Quick Link */}
          <Link
            href={`/community/${community.slug}/about`}
            className="group block relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-primary/5 via-pink-vivid/5 to-orange-warm/5 border border-purple-primary/10 p-5 hover:border-purple-primary/20 transition-all"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-primary/0 via-pink-vivid/5 to-purple-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

            <div className="relative flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-primary/20 to-pink-vivid/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-ui text-sm font-semibold text-ink group-hover:text-purple-primary transition-colors">
                  Community Guidelines
                </p>
                <p className="font-ui text-xs text-muted mt-0.5">
                  View rules and guidelines
                </p>
              </div>
              <svg className="w-5 h-5 text-muted group-hover:text-purple-primary group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
