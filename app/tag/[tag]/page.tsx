"use client";

import { useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTagPosts, useTrendingTags } from "@/lib/hooks";
import PostCard from "@/components/feed/PostCard";
import type { PostProps, PostType } from "@/components/feed/PostCard/types";
import { getTimeAgoCompact } from "@/lib/utils/time";

// Loading skeleton
function PostSkeleton() {
  return (
    <div className="bg-surface rounded-2xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full bg-skeleton" />
        <div className="flex-1">
          <div className="h-4 bg-skeleton rounded w-32 mb-2" />
          <div className="h-3 bg-skeleton rounded w-24" />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-skeleton rounded w-full" />
        <div className="h-4 bg-skeleton rounded w-5/6" />
        <div className="h-4 bg-skeleton rounded w-4/6" />
      </div>
      <div className="h-48 bg-skeleton rounded-xl" />
    </div>
  );
}

// Helper function to transform post data for PostCard
function transformPostForCard(post: {
  id: string;
  author_id: string;
  type: string;
  title: string | null;
  content: string | null;
  content_warning: string | null;
  created_at: string;
  media: { id: string; media_url: string; media_type: "image" | "video"; caption: string | null; position: number }[];
  admires_count: number;
  reactions_count?: number;
  comments_count: number;
  relays_count: number;
  user_has_admired: boolean;
  user_has_saved: boolean;
  user_has_relayed: boolean;
  user_reaction_type?: string | null;
  hashtags?: string[];
  author?: { username?: string; display_name?: string | null; avatar_url?: string | null };
}) {
  const typeLabels: Record<string, string> = {
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

  return {
    id: post.id,
    authorId: post.author_id,
    author: {
      name: post.author?.display_name || post.author?.username || "Unknown",
      handle: `@${post.author?.username || "unknown"}`,
      avatar: post.author?.avatar_url || "/default-avatar.png",
    },
    type: post.type as PostType,
    typeLabel: typeLabels[post.type] || "shared",
    timeAgo: getTimeAgoCompact(post.created_at),
    createdAt: post.created_at,
    title: post.title || undefined,
    content: post.content || "",
    contentWarning: post.content_warning || undefined,
    media: post.media,
    stats: {
      admires: post.admires_count || 0,
      reactions: post.reactions_count || post.admires_count || 0,
      comments: post.comments_count || 0,
      relays: post.relays_count || 0,
    },
    isAdmired: post.user_has_admired,
    reactionType: (post.user_reaction_type as PostProps["reactionType"]) || null,
    isSaved: post.user_has_saved,
    isRelayed: post.user_has_relayed,
    hashtags: post.hashtags || [],
  } as PostProps;
}

export default function TagPage() {
  const params = useParams();
  const tagName = decodeURIComponent(params.tag as string);
  const { user } = useAuth();
  const { posts, loading, error, hasMore, loadMore, tagInfo } = useTagPosts(tagName, user?.id);
  const { tags: relatedTags } = useTrendingTags(8);

  const observerRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

  const handlePostDeleted = useCallback(() => {
    // Refresh would be handled by the hook
  }, []);

  // Filter out the current tag from related tags
  const filteredRelatedTags = relatedTags.filter(
    (t) => t.name.toLowerCase() !== tagName.toLowerCase()
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface border-b border-border-light">
        <div className="max-w-[640px] mx-auto px-4">
          <div className="flex items-center h-[56px] gap-4">
            {/* Back Button */}
            <Link
              href="/explore"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-skeleton/60 text-muted hover:text-ink transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            {/* Tag Info */}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl text-ink truncate">#{tagInfo?.name || tagName}</h1>
              {tagInfo && (
                <p className="font-body text-sm text-muted">
                  {tagInfo.totalPosts.toLocaleString()} {tagInfo.totalPosts === 1 ? "post" : "posts"}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[640px] mx-auto px-4 py-4">
        {/* Related Tags */}
        {filteredRelatedTags.length > 0 && (
          <div className="mb-6">
            <h2 className="font-ui text-xs font-medium text-muted uppercase tracking-wider mb-3">
              Related Tags
            </h2>
            <div className="flex flex-wrap gap-2">
              {filteredRelatedTags.slice(0, 6).map((tag) => (
                <Link
                  key={tag.name}
                  href={`/tag/${encodeURIComponent(tag.name)}`}
                  className="px-3 py-1.5 rounded-full bg-skeleton/70 text-ink font-ui text-sm hover:bg-purple-50 hover:text-accent transition-all"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 mb-4">
            <p className="font-body text-sm text-red-600/90">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && posts.length === 0 && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <PostSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && posts.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-skeleton/60 flex items-center justify-center">
              <svg className="w-7 h-7 text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </div>
            <h3 className="font-display text-xl text-ink mb-2">No posts with #{tagName}</h3>
            <p className="font-body text-sm text-muted max-w-xs mx-auto">
              Be the first to create a post with this tag.
            </p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              Create Post
            </Link>
          </div>
        )}

        {/* Posts */}
        {posts.length > 0 && (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={transformPostForCard(post)}
                onPostDeleted={handlePostDeleted}
                disableRealtimeSubscriptions={true}
              />
            ))}

            {/* Loading More */}
            {loading && posts.length > 0 && (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-[1.5px] border-border-light border-t-ink/60 rounded-full animate-spin" />
              </div>
            )}

            {/* Infinite Scroll Trigger */}
            <div ref={observerRef} className="h-4" />

            {/* End of Feed */}
            {!hasMore && posts.length > 0 && (
              <div className="text-center py-10">
                <div className="inline-block w-8 h-px bg-black/10 mb-3" />
                <p className="font-body text-[13px] text-muted/70">No more posts</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
