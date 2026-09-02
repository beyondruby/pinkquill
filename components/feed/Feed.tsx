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
import { StreamFeed } from "./StreamView";
import { GalleryFeed } from "./GalleryView";
import { getPostTypePhrase } from "@/lib/feed-view/post-type-theme";
import { FeedViewMenu } from "./FeedViewMenu";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { PostCardErrorFallback } from "@/components/ui/ErrorFallbacks";
import type { Post } from "@/lib/types";
import type { FeedViewId } from "@/lib/feed-view/registry";
import { getTimeAgo } from "@/lib/utils/time";
import { Spinner } from "@/components/ui/Loading";

// Conversational phrase ("wrote a poem") — used by the DM share card. Single
// source of truth: lib/feed-view/post-type-theme.ts.
function getTypeLabel(type: string): string {
  return getPostTypePhrase(type);
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
// views (Stream, Gallery) use plain max-width containers and own all visual
// treatment via components/feed/StreamView.tsx and GalleryView.tsx.
const VIEW_CONTAINER_CLASS: Record<FeedViewId, string> = {
  classic: "home-feed-modern w-full max-w-[580px] mx-auto pt-6 pb-6 px-4 md:pt-8 md:pb-12 md:px-6",
  compact: "w-full max-w-[780px] mx-auto pt-6 pb-6 px-3 md:pt-8 md:pb-10 md:px-6",
  grid: "w-full max-w-[1240px] mx-auto pt-5 pb-6 px-3 md:pt-8 md:pb-10 md:px-5",
};

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

  // Auto-recovery: if the first page is still loading after 12s, retry once.
  // useFeed aborts the in-flight request when refresh() runs, so this never
  // stacks a second load on top of the first; one retry is enough because
  // the underlying request already has its own 25s timeout.
  const loadingStartRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  useEffect(() => {
    if (postsLoading && feedPosts.length === 0) {
      if (!loadingStartRef.current) {
        loadingStartRef.current = Date.now();
      }
      const timer = setTimeout(() => {
        if (retryCountRef.current < 1) {
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

  // PERFORMANCE: Memoize filtered posts - only recalculate when feedPosts or
  // deletedIds change.
  const posts = useMemo(
    () => feedPosts.filter((p) => !deletedIds.has(p.id)),
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
        <FeedViewMenu />
        <FeedFrame viewId={viewId}>
          {viewId === "classic"
            ? [...Array(3)].map((_, i) => <PostSkeleton key={i} />)
            : [...Array(viewId === "compact" ? 6 : 8)].map((_, i) => {
                const skClass =
                  viewId === "compact"
                    ? "h-32 rounded-2xl bg-skeleton animate-pulse"
                    : viewId === "grid"
                      ? // Varying spans approximate the bento mosaic
                        [
                          "col-span-2 row-span-2 sm:col-span-3 lg:col-span-4 lg:row-span-2",
                          "col-span-2 row-span-2 sm:col-span-3 lg:col-span-3 lg:row-span-3",
                          "col-span-2 row-span-1 sm:col-span-2 lg:col-span-3 lg:row-span-1",
                          "col-span-2 row-span-2 sm:col-span-4 lg:col-span-5 lg:row-span-2",
                        ][i % 4] + " rounded-2xl bg-skeleton animate-pulse"
                      : ["md:col-span-7", "md:col-span-5", "md:col-span-6", "md:col-span-6"][
                          i % 4
                        ] + " h-72 rounded-2xl bg-skeleton animate-pulse";
                return <div key={i} className={skClass} />;
              })}
        </FeedFrame>
      </>
    );
  }

  if (error) {
    return (
      <>
        <FeedViewMenu />
        <FeedFrame viewId={viewId}>
          <div className="text-center col-span-full md:col-span-12">
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
        <FeedViewMenu />
        <FeedFrame viewId={viewId}>
          <div className="text-center col-span-full md:col-span-12">
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
      <FeedViewMenu />
      <FeedFrame viewId={viewId}>
        {/* PERFORMANCE: Using memoized transformed posts */}
        {viewId === "classic" ? (
          transformedPosts.map(({ original, transformed }) => (
            <ErrorBoundary
              key={original.id}
              section={`PostCard:${original.id}`}
              fallback={({ reset }) => <PostCardErrorFallback onRetry={reset} />}
            >
              <PostCard
                post={transformed}
                onPostDeleted={handlePostDeleted}
                disableRealtimeSubscriptions={true}
              />
            </ErrorBoundary>
          ))
        ) : viewId === "compact" ? (
          <StreamFeed items={transformedPosts} onPostDeleted={handlePostDeleted} />
        ) : (
          <GalleryFeed items={transformedPosts} />
        )}

        {/* Infinite scroll trigger */}
        <div ref={bottomRef} className="h-4 col-span-full md:col-span-12" />

        {postsLoading && posts.length > 0 && (
          <div className="flex justify-center py-8 col-span-full md:col-span-12">
            <Spinner size="xl" className="text-purple-primary" />
          </div>
        )}

        {!pagination.hasMore && posts.length > 0 && (
          <div className="text-center py-8 col-span-full md:col-span-12">
            <p className="font-body text-muted text-sm italic">
              You&apos;ve reached the end of the feed
            </p>
          </div>
        )}
      </FeedFrame>
    </>
  );
}
