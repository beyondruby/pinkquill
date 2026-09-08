"use client";

import { useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useFeedView } from "@/components/providers/FeedViewProvider";
import { useFeed } from "@/lib/hooks/useFeed";
import PostCard from "./PostCard";
import PostSkeleton from "./PostSkeleton";
import { StreamFeed } from "./StreamView";
import { GalleryFeed } from "./GalleryView";
import { FeedViewMenu } from "./FeedViewMenu";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { PostCardErrorFallback } from "@/components/ui/ErrorFallbacks";
import type { Post } from "@/lib/types";
import type { FeedViewId } from "@/lib/feed-view/registry";
import { Spinner } from "@/components/ui/Loading";
import { toPostProps } from "@/lib/posts/toPostProps";


// One row → card mapper for every list (lib/posts/toPostProps.ts).
function transformPostForCard(post: Post) {
  return toPostProps(post);
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
          line-height: 1;
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
            padding: 8px 10px;
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
  const { subscribeToDeletes, subscribeToAuthorBlocks } = useModal();
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
  const [blockedAuthorIds, setBlockedAuthorIds] = useState<Set<string>>(new Set());

  // Wrap refresh to clear deletedIds since fresh server data reflects accurate state
  const handleRefresh = useCallback(() => {
    setDeletedIds(new Set());
    setBlockedAuthorIds(new Set());
    refresh();
  }, [refresh]);

  // Auto-recovery: if the first page is still loading after 12s, retry once.
  // useFeed aborts the in-flight request when refresh() runs, so this never
  // stacks a second load on top of the first; one retry is enough because
  // the underlying request already has its own 25s timeout.
  const loadingStartRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  // Shown under the skeletons once the auto-retry has fired (F-31): the
  // retry used to be invisible, so a slow first load looked frozen.
  const [autoRetrying, setAutoRetrying] = useState(false);
  useEffect(() => {
    if (postsLoading && feedPosts.length === 0) {
      if (!loadingStartRef.current) {
        loadingStartRef.current = Date.now();
      }
      const timer = setTimeout(() => {
        if (retryCountRef.current < 1) {
          retryCountRef.current += 1;
          console.warn(`[Feed] Loading stuck for >12s, auto-retrying (attempt ${retryCountRef.current})`);
          setAutoRetrying(true);
          handleRefresh();
        }
      }, 12000);
      return () => {
        clearTimeout(timer);
        // Runs when the load settles (deps change): hide the note again.
        setAutoRetrying(false);
      };
    } else {
      loadingStartRef.current = null;
      retryCountRef.current = 0;
    }
  }, [postsLoading, feedPosts.length, handleRefresh]);

  // Infinite scroll: observe the sentinel div at the bottom of the list.
  const [bottomEl, setBottomEl] = useState<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!bottomEl || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0, rootMargin: "100px" }
    );
    observer.observe(bottomEl);
    return () => observer.disconnect();
  }, [bottomEl]);

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
    const unsubBlocks = subscribeToAuthorBlocks((authorId) => {
      setBlockedAuthorIds(prev => new Set(prev).add(authorId));
    });
    return () => { unsubPosts(); unsubBlocks(); };
  }, [subscribeToDeletes, subscribeToAuthorBlocks]);

  // PERFORMANCE: Memoize filtered posts - only recalculate when feedPosts or
  // deletedIds change.
  const posts = useMemo(
    () => feedPosts.filter((p) => !deletedIds.has(p.id) && !blockedAuthorIds.has(p.author_id)),
    [feedPosts, deletedIds, blockedAuthorIds]
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
          {autoRetrying && (
            <p className="col-span-full md:col-span-12 text-center font-body text-sm text-muted">
              Still loading — trying again…
            </p>
          )}
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
               
              />
            </ErrorBoundary>
          ))
        ) : viewId === "compact" ? (
          <StreamFeed items={transformedPosts} onPostDeleted={handlePostDeleted} />
        ) : (
          <GalleryFeed items={transformedPosts} />
        )}

        {/* Infinite scroll trigger */}
        <div ref={setBottomEl} className="h-4 col-span-full md:col-span-12" />

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
