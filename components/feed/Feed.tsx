"use client";

import { useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useInView } from "react-intersection-observer";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useFeed } from "@/lib/hooks/useFeed";
import PostCard from "./PostCard";
import PostSkeleton from "./PostSkeleton";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { PostCardErrorFallback } from "@/components/ui/ErrorFallbacks";
import type { Post } from "@/lib/types";

// PERFORMANCE: Moved outside component to prevent recreation on every render
const TYPE_LABELS: Record<string, string> = {
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
  return TYPE_LABELS[type] || "shared something";
}

// PERFORMANCE: Transform post data once, memoized by post ID
function transformPostForCard(post: Post) {
  return {
    id: post.id,
    authorId: post.author_id,
    author: {
      name: post.author.display_name || post.author.username,
      handle: `@${post.author.username}`,
      avatar: post.author.avatar_url || "/defaultprofile.png",
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
    community: post.community ? {
      slug: post.community.slug,
      name: post.community.name,
      avatar_url: post.community.avatar_url,
    } : undefined,
    collaborators: (post.collaborators || []).map(c => ({
      ...c,
      status: c.status as 'pending' | 'accepted' | 'declined',
    })),
    mentions: post.mentions || [],
    hashtags: post.hashtags || [],
    styling: post.styling || null,
    post_location: post.post_location || null,
    metadata: post.metadata || null,
    spotify_track: post.spotify_track || null,
  };
}

function FeedFrame({ children }: { children: ReactNode }) {
  return (
    <div className="home-feed-modern w-full max-w-[580px] mx-auto py-6 px-4 md:py-12 md:px-6">
      {children}
      <style jsx global>{`
        .home-feed-modern .post {
          border-radius: 22px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          background: linear-gradient(180deg, #ffffff 0%, #ffffff 72%, #fdfbff 100%);
          box-shadow: 0 8px 22px rgba(15, 15, 15, 0.04);
          margin-bottom: 1.3rem;
          padding: 1.6rem 1.65rem;
          transition: box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease;
        }

        .home-feed-modern .post:hover {
          border-color: rgba(142, 68, 173, 0.16);
          box-shadow: 0 16px 34px rgba(142, 68, 173, 0.12);
          transform: translateY(-1px);
        }

        .home-feed-modern .author-header {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          column-gap: 0.75rem;
          margin-bottom: 1.05rem;
        }

        .home-feed-modern .author-avatar {
          border-width: 1px;
          border-color: rgba(0, 0, 0, 0.06);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
        }

        .home-feed-modern .author-info {
          min-width: 0;
        }

        .home-feed-modern .author-name-line {
          row-gap: 2px;
        }

        .home-feed-modern .post-time,
        .home-feed-modern .post-type-label,
        .home-feed-modern .posted-by-label,
        .home-feed-modern .posted-by-author {
          color: rgba(30, 30, 30, 0.6);
        }

        .home-feed-modern .unified-post-title {
          margin-bottom: 0.65rem;
          letter-spacing: -0.01em;
        }

        .home-feed-modern .unified-media-grid {
          gap: 6px;
          border-radius: 16px;
        }

        .home-feed-modern .unified-media-item {
          border-radius: 10px;
        }

        .home-feed-modern .actions {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          column-gap: 0.55rem;
          margin-top: 1.05rem;
          padding-top: 0.95rem;
          border-top-color: rgba(0, 0, 0, 0.07);
        }

        .home-feed-modern .actions-left,
        .home-feed-modern .actions-right {
          gap: 0.35rem;
        }

        .home-feed-modern .actions-left {
          min-width: 0;
          flex-wrap: wrap;
        }

        .home-feed-modern .action-btn {
          gap: 0.4rem;
          padding: 0.5rem 0.65rem;
          border-radius: 999px;
          border: 1px solid transparent;
          line-height: 1;
        }

        .home-feed-modern .action-btn svg {
          width: 1.04rem;
          height: 1.04rem;
        }

        .home-feed-modern .action-btn:hover {
          border-color: rgba(142, 68, 173, 0.18);
          background: rgba(142, 68, 173, 0.08);
        }

        .home-feed-modern .reaction-picker-trigger > span:first-child {
          border-radius: 999px;
          background: radial-gradient(circle at 25% 20%, rgba(142, 68, 173, 0.1), rgba(255, 0, 127, 0.04));
          box-shadow: inset 0 0 0 1px rgba(142, 68, 173, 0.08);
        }

        .home-feed-modern .reaction-picker-trigger.active > span:first-child {
          box-shadow: inset 0 0 0 1px rgba(142, 68, 173, 0.2);
        }

        .home-feed-modern .action-count {
          font-variant-numeric: tabular-nums;
        }

        .home-feed-modern .post-menu-btn {
          width: 34px;
          height: 34px;
          border: 1px solid transparent;
          margin-top: -1px;
        }

        .home-feed-modern .post-menu-btn:hover {
          border-color: rgba(0, 0, 0, 0.08);
        }

        .home-feed-modern .actions-right .action-btn {
          width: 2.1rem;
          height: 2.1rem;
          padding: 0;
          justify-content: center;
          border-color: rgba(0, 0, 0, 0.05);
          background: rgba(0, 0, 0, 0.015);
        }

        .home-feed-modern .actions-right .action-btn:hover {
          background: rgba(142, 68, 173, 0.09);
        }

        .home-feed-modern .actions-right .action-btn .action-count {
          display: none;
        }

        .home-feed-modern .mentions-display {
          padding-top: 0.15rem;
          padding-bottom: 0.05rem;
        }

        .home-feed-modern .hashtags-display {
          padding-top: 0.2rem;
          padding-bottom: 0.1rem;
        }

        .home-feed-modern .hashtag-link {
          border: 1px solid rgba(142, 68, 173, 0.1);
        }

        @media (max-width: 640px) {
          .home-feed-modern .post {
            border-radius: 18px;
            padding: 1.2rem;
            margin-bottom: 1rem;
          }

          .home-feed-modern .author-header {
            column-gap: 0.65rem;
          }

          .home-feed-modern .actions-left,
          .home-feed-modern .actions-right {
            gap: 0.25rem;
          }

          .home-feed-modern .action-btn {
            padding: 0.45rem 0.55rem;
          }

          .home-feed-modern .actions-right .action-btn {
            width: 2rem;
            height: 2rem;
          }
        }

        @media (hover: none) and (pointer: coarse) {
          .home-feed-modern .post:hover {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}

export default function Feed() {
  const { user, loading: authLoading } = useAuth();
  const { subscribeToDeletes } = useModal();

  // Use the optimized useFeed hook with AbortController and stable channels
  const {
    posts: feedPosts,
    loading: postsLoading,
    error,
    pagination,
    loadMore,
    refresh,
  } = useFeed(user?.id, { pageSize: 10 });

  // Local state for filtering deleted posts
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Intersection observer for infinite scroll
  const { ref: bottomRef, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  });

  // Load more when scrolling
  useEffect(() => {
    if (inView && pagination.hasMore && !postsLoading) {
      loadMore();
    }
  }, [inView, pagination.hasMore, postsLoading, loadMore]);

  // Subscribe to deletes
  useEffect(() => {
    const unsubPosts = subscribeToDeletes((id) => {
      setDeletedIds(prev => new Set(prev).add(id));
    });
    return () => { unsubPosts(); };
  }, [subscribeToDeletes]);

  // PERFORMANCE: Memoize filtered posts - only recalculate when feedPosts or deletedIds change
  const posts = useMemo(
    () => feedPosts.filter(p => !deletedIds.has(p.id)),
    [feedPosts, deletedIds]
  );

  // PERFORMANCE: Memoize transformed posts - prevents object recreation on every render
  const transformedPosts = useMemo(
    () => posts.map(post => ({
      original: post,
      transformed: transformPostForCard(post),
    })),
    [posts]
  );

  const handlePostDeleted = useCallback((postId: string) => {
    setDeletedIds(prev => new Set(prev).add(postId));
  }, []);

  // Show skeletons while loading (only on initial load)
  if (authLoading || (postsLoading && posts.length === 0)) {
    return (
      <FeedFrame>
        {[...Array(3)].map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </FeedFrame>
    );
  }

  if (error) {
    return (
      <FeedFrame>
        <div className="text-center">
          <p className="font-body text-red-500 mb-4">{error}</p>
          <button
            onClick={() => refresh()}
            className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      </FeedFrame>
    );
  }

  if (posts.length === 0) {
    return (
      <FeedFrame>
        <div className="text-center">
          <h2 className="font-display text-2xl text-ink mb-4">
            The canvas awaits
          </h2>
          <p className="font-body text-muted italic mb-6">
            No posts yet. Be the first to share your creative voice.
          </p>
          <Link
            href="/create"
            className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-white"
          >
            Create Something
          </Link>
        </div>
      </FeedFrame>
    );
  }

  return (
    <FeedFrame>
      {/* PERFORMANCE: Using memoized transformed posts */}
      {transformedPosts.map(({ original, transformed }) => (
        <ErrorBoundary
          key={original.id}
          section={`PostCard:${original.id}`}
          fallback={({ reset }) => <PostCardErrorFallback onRetry={reset} />}
        >
          <PostCard
            post={transformed}
            onPostDeleted={handlePostDeleted}
            disableRealtimeSubscriptions={true} // PERFORMANCE: Disable per-card subscriptions in feed
          />
        </ErrorBoundary>
      ))}

      {/* Infinite scroll trigger */}
      <div ref={bottomRef} className="h-4" />

      {/* Loading more indicator */}
      {postsLoading && posts.length > 0 && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-purple-600 rounded-full animate-spin" />
        </div>
      )}

      {/* End of feed */}
      {!pagination.hasMore && posts.length > 0 && (
        <div className="text-center py-8">
          <p className="font-body text-muted text-sm italic">
            You&apos;ve reached the end of the feed
          </p>
        </div>
      )}
    </FeedFrame>
  );
}
