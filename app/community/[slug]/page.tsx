"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useCommunityPosts, useCommunityPinnedPosts, Post } from "@/lib/hooks";
import { useTrackCommunityView } from "@/lib/hooks/useTracking";
import PostCard from "@/components/feed/PostCard";

type SortOption = 'newest' | 'top';

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
      comments: post.comments_count,
      relays: post.relays_count,
    },
    isAdmired: post.user_has_admired,
    isSaved: post.user_has_saved,
    isRelayed: post.user_has_relayed,
  };
}

export default function CommunityFeedPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, tags } = useCommunity(slug, user?.id);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Track community views
  useTrackCommunityView(community?.id);

  const { posts, pinnedPosts, loading, refetch } = useCommunityPosts(
    community?.id || '',
    user?.id,
    sortBy
  );

  // Pin/unpin functionality for admins/moderators
  const {
    isPinned,
    canPin,
    pinPost,
    unpinPost,
    refetch: refetchPins
  } = useCommunityPinnedPosts(community?.id);

  if (!community) return null;

  const canPost = community.is_member && community.user_status === 'active';
  const isAdmin = community.user_role === 'admin' || community.user_role === 'moderator';

  // Handle pin/unpin and refresh the posts list
  const handlePin = async (postId: string) => {
    if (!user?.id) return;
    const success = await pinPost(postId, user.id);
    if (success) {
      refetch();
      refetchPins();
    }
  };

  const handleUnpin = async (postId: string) => {
    const success = await unpinPost(postId);
    if (success) {
      refetch();
      refetchPins();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Feed */}
      <div className="lg:col-span-2">
        {/* Sort Options - Enhanced */}
        <div className="flex items-center justify-between mb-6">
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
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-warm/20 to-pink-vivid/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-warm" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.616a1 1 0 01.894-1.79l1.599.8L9 4.323V3a1 1 0 011-1z" />
                </svg>
              </div>
              <h3 className="font-ui text-sm font-semibold text-ink uppercase tracking-wide">Pinned</h3>
            </div>
            <div className="space-y-4">
              {pinnedPosts.map((post) => (
                <div key={post.id} className="relative group/pin">
                  <div className="absolute -left-3 top-6 bottom-6 w-1 bg-gradient-to-b from-orange-warm via-pink-vivid to-purple-primary rounded-full" />
                  {/* Unpin button for admins */}
                  {isAdmin && (
                    <button
                      onClick={() => handleUnpin(post.id)}
                      className="absolute -left-1 top-2 z-10 w-6 h-6 rounded-full bg-white shadow-md border border-purple-primary/20 flex items-center justify-center opacity-0 group-hover/pin:opacity-100 transition-opacity hover:bg-purple-primary hover:text-white text-purple-primary"
                      title="Unpin post"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  <PostCard post={transformPost(post)} />
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
              <div key={post.id} className="relative group/pin">
                {/* Pin button for admins (only if can pin more) */}
                {isAdmin && canPin && !isPinned(post.id) && (
                  <button
                    onClick={() => handlePin(post.id)}
                    className="absolute -left-1 top-4 z-10 w-6 h-6 rounded-full bg-white shadow-md border border-purple-primary/20 flex items-center justify-center opacity-0 group-hover/pin:opacity-100 transition-opacity hover:bg-purple-primary hover:text-white text-purple-primary"
                    title="Pin post"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 4h2c.55 0 1.1.22 1.49.59l.01.01c.39.4.61.95.61 1.52v2c0 .55-.22 1.1-.59 1.49l-.01.01c-.4.39-.95.61-1.52.61h-2l-1 6-3-2-3 2-1-6H6c-.55 0-1.1-.22-1.49-.59l-.01-.01A2.1 2.1 0 014 8.12v-2c0-.55.22-1.1.59-1.49l.01-.01C5 4.22 5.55 4 6.12 4H8V3a1 1 0 112 0v1h4V3a1 1 0 112 0v1zM9 20a1 1 0 102 0v-5.5l1 .67 1-.67V20a1 1 0 102 0v-7l-3 2-3-2v7z"/>
                    </svg>
                  </button>
                )}
                <PostCard post={transformPost(post)} />
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
