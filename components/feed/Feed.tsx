"use client";

import { useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useInView } from "react-intersection-observer";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useFeedView } from "@/components/providers/FeedViewProvider";
import { useFeed } from "@/lib/hooks/useFeed";
import PostCard from "./PostCard";
import PostSkeleton from "./PostSkeleton";
import { CompactPostCard, GridPostCard, MagazinePostCard } from "./AlternateCards";
import { FeedViewSwitcher } from "./FeedViewSwitcher";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { PostCardErrorFallback } from "@/components/ui/ErrorFallbacks";
import type { Post } from "@/lib/types";
import type { FeedViewId } from "@/lib/feed-view/registry";
import { getTimeAgo } from "@/lib/utils/time";

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
    flair: post.flair || undefined,
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

// Per-view container styling. The Classic view keeps the original modern
// post styling via the `home-feed-modern` class + injected <style jsx>. Other
// views use Tailwind utility containers and let their own card components
// own all visual treatment.
const VIEW_CONTAINER_CLASS: Record<FeedViewId, string> = {
  classic: "home-feed-modern w-full max-w-[580px] mx-auto pb-6 px-4 md:pb-12 md:px-6",
  compact: "w-full max-w-[680px] mx-auto pb-6 px-4 md:pb-10 md:px-6 flex flex-col gap-2",
  grid: "w-full max-w-[1280px] mx-auto pb-6 px-4 md:pb-10 md:px-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4",
  magazine: "w-full max-w-[1100px] mx-auto pb-6 px-4 md:pb-10 md:px-6 columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]",
};

// Outer width of the toggle bar matches each view's container so the switcher
// sits cleanly above the feed in all layouts.
const VIEW_BAR_WRAP_CLASS: Record<FeedViewId, string> = {
  classic: "w-full max-w-[580px] mx-auto",
  compact: "w-full max-w-[680px] mx-auto",
  grid: "w-full max-w-[1280px] mx-auto",
  magazine: "w-full max-w-[1100px] mx-auto",
};

function FeedViewBar({ viewId }: { viewId: FeedViewId }) {
  return (
    <div className={`${VIEW_BAR_WRAP_CLASS[viewId]} px-4 md:px-6 pt-4 md:pt-8 pb-3 flex items-center justify-end`}>
      <FeedViewSwitcher />
    </div>
  );
}

function FeedFrame({
  viewId,
  children,
}: {
  viewId: FeedViewId;
  children: ReactNode;
}) {
  const containerClass = VIEW_CONTAINER_CLASS[viewId];
  return (
    <div className={containerClass}>
      {children}
      <style jsx global>{`
        .home-feed-modern .post {
          border-radius: 22px;
          border: 1px solid var(--color-border-light);
          background: linear-gradient(
            180deg,
            var(--color-surface) 0%,
            var(--color-surface) 72%,
            color-mix(in oklab, var(--color-surface) 94%, var(--color-accent) 6%) 100%
          );
          box-shadow: 0 8px 22px rgba(15, 15, 15, 0.04);
          margin-bottom: 1.3rem;
          transition: box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease;
        }

        .home-feed-modern .post:hover {
          border-color: color-mix(in oklab, var(--color-accent) 24%, transparent);
          box-shadow: 0 16px 34px color-mix(in oklab, var(--color-accent) 14%, transparent);
          transform: translateY(-1px);
        }

        .home-feed-modern .author-header {
          margin-bottom: 1.05rem;
        }

        .home-feed-modern .author-avatar {
          border-width: 1px;
          border-color: var(--color-border-light);
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
          color: var(--color-muted);
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
          margin-top: 1.05rem;
          padding-top: 0.95rem;
          border-top-color: var(--color-border-light);
        }

        .home-feed-modern .actions-left,
        .home-feed-modern .actions-right {
          gap: 0.35rem;
        }

        .home-feed-modern .action-btn {
          gap: 0.4rem;
          padding: 0.5rem 0.65rem;
          border-radius: 999px;
          border: 1px solid transparent;
          line-height: 1;
        }

        .home-feed-modern .action-btn:hover {
          border-color: color-mix(in oklab, var(--color-accent) 22%, transparent);
          background: color-mix(in oklab, var(--color-accent) 10%, transparent);
        }

        .home-feed-modern .action-count {
          font-variant-numeric: tabular-nums;
        }

        .home-feed-modern .post-menu-btn {
          width: 34px;
          height: 34px;
          border: 1px solid transparent;
        }

        .home-feed-modern .post-menu-btn:hover {
          border-color: var(--color-border-strong);
        }

        @media (max-width: 640px) {
          .home-feed-modern .post {
            border-radius: 18px;
            padding: 1.2rem;
            margin-bottom: 1rem;
          }

          .home-feed-modern .actions-left,
          .home-feed-modern .actions-right {
            gap: 0.25rem;
          }

          .home-feed-modern .action-btn {
            padding: 0.45rem 0.55rem;
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
  const { viewId } = useFeedView();

  // Use the optimized useFeed hook with AbortController and stable channels
  const {
    posts: feedPosts,
    loading: postsLoading,
    error,
    pagination,
    loadMore,
    refresh,
  } = useFeed(user?.id, { pageSize: 10, enabled: !authLoading });

  // Local state for filtering deleted posts (cleared on refresh since fresh data is accurate)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Wrap refresh to clear deletedIds since fresh server data reflects accurate state
  const handleRefresh = useCallback(() => {
    setDeletedIds(new Set());
    refresh();
  }, [refresh]);

  // Auto-recovery: if loading is stuck for >12s, force a retry
  const loadingStartRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  useEffect(() => {
    if (postsLoading && feedPosts.length === 0) {
      if (!loadingStartRef.current) {
        loadingStartRef.current = Date.now();
      }
      const timer = setTimeout(() => {
        if (retryCountRef.current < 2) {
          retryCountRef.current += 1;
          console.warn(`[Feed] Loading stuck for >12s, auto-retrying (attempt ${retryCountRef.current})`);
          handleRefresh();
        }
      }, 12000);
      return () => clearTimeout(timer);
    } else {
      loadingStartRef.current = null;
      retryCountRef.current = 0;
    }
  }, [postsLoading, feedPosts.length, handleRefresh]);

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

  // Show skeletons while loading (only on initial load). Classic view uses
  // the rich PostSkeleton; other views show simple placeholder boxes sized
  // to their layout, since their cards are smaller.
  if (authLoading || (postsLoading && posts.length === 0)) {
    return (
      <>
        <FeedViewBar viewId={viewId} />
        <FeedFrame viewId={viewId}>
          {viewId === "classic"
            ? [...Array(3)].map((_, i) => <PostSkeleton key={i} />)
            : [...Array(viewId === "compact" ? 6 : 8)].map((_, i) => (
                <div
                  key={i}
                  className={
                    viewId === "compact"
                      ? "h-24 rounded-xl bg-skeleton animate-pulse"
                      : viewId === "grid"
                      ? "aspect-square rounded-2xl bg-skeleton animate-pulse"
                      : "h-64 rounded-2xl bg-skeleton animate-pulse mb-4 break-inside-avoid"
                  }
                />
              ))}
        </FeedFrame>
      </>
    );
  }

  if (error) {
    return (
      <>
        <FeedViewBar viewId={viewId} />
        <FeedFrame viewId={viewId}>
          <div className="text-center col-span-full [column-span:all]">
            <p className="font-body text-red-500 mb-4">{error}</p>
            <button
              onClick={() => handleRefresh()}
              className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-sm font-medium text-on-accent hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        </FeedFrame>
      </>
    );
  }

  if (posts.length === 0) {
    return (
      <>
        <FeedViewBar viewId={viewId} />
        <FeedFrame viewId={viewId}>
          <div className="text-center col-span-full [column-span:all]">
            <h2 className="font-display text-2xl text-ink mb-4">
              The canvas awaits
            </h2>
            <p className="font-body text-muted italic mb-6">
              No posts yet. Be the first to share your creative voice.
            </p>
            <Link
              href="/create"
              className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-on-accent"
            >
              Create Something
            </Link>
          </div>
        </FeedFrame>
      </>
    );
  }

  return (
    <>
      <FeedViewBar viewId={viewId} />
      <FeedFrame viewId={viewId}>
        {/* PERFORMANCE: Using memoized transformed posts */}
        {transformedPosts.map(({ original, transformed }) => (
          <ErrorBoundary
            key={original.id}
            section={`PostCard:${original.id}`}
            fallback={({ reset }) => <PostCardErrorFallback onRetry={reset} />}
          >
            {viewId === "classic" ? (
              <PostCard
                post={transformed}
                onPostDeleted={handlePostDeleted}
                disableRealtimeSubscriptions={true}
              />
            ) : viewId === "compact" ? (
              <CompactPostCard post={transformed} />
            ) : viewId === "grid" ? (
              <GridPostCard post={transformed} />
            ) : (
              <MagazinePostCard post={transformed} />
            )}
          </ErrorBoundary>
        ))}

        {/* Infinite scroll trigger — full-width row in grid/magazine layouts */}
        <div ref={bottomRef} className="h-4 col-span-full [column-span:all]" />

        {postsLoading && posts.length > 0 && (
          <div className="flex justify-center py-8 col-span-full [column-span:all]">
            <div className="w-8 h-8 border-3 border-border-strong border-t-purple-primary rounded-full animate-spin" />
          </div>
        )}

        {!pagination.hasMore && posts.length > 0 && (
          <div className="text-center py-8 col-span-full [column-span:all]">
            <p className="font-body text-muted text-sm italic">
              You&apos;ve reached the end of the feed
            </p>
          </div>
        )}
      </FeedFrame>
    </>
  );
}
