"use client";

import { useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useFeedView } from "@/components/providers/FeedViewProvider";
import { useFeed } from "@/lib/hooks/useFeed";
import PostCard from "./PostCard";
import { FeedSkeletonItems } from "./FeedSkeleton";
import { FEED_CONTAINER_CLASS } from "@/lib/feed-view/layout";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
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
// post styling via the `home-feed-modern` class (rules in post-card.css). Other
// views (Stream, Gallery) use plain max-width containers and own all visual
// treatment via components/feed/StreamView.tsx and GalleryView.tsx.
function FeedFrame({
  viewId,
  children,
}: {
  viewId: FeedViewId;
  children: ReactNode;
}) {
  return (
    <div className={FEED_CONTAINER_CLASS[viewId]}>
      <FeedViewMenu viewId={viewId} />
      {children}
    </div>
  );
}

export default function Feed({ initialViewId }: { initialViewId?: FeedViewId } = {}) {
  const { user, loading: authLoading } = useAuth();
  const { subscribeToDeletes, subscribeToAuthorBlocks } = useModal();
  const { viewId: providerViewId, isReady: viewReady } = useFeedView();
  // Until the provider has read its cookie, use the view the server saw (F-23).
  const viewId = !viewReady && initialViewId ? initialViewId : providerViewId;
  const { openModal: openAuthModal } = useAuthModal();

  // Use the optimized useFeed hook with AbortController and stable channels
  const {
    posts: feedPosts,
    loading: postsLoading,
    error,
    pagination,
    loadMore,
    refresh,
    removePosts,
    restoreScrollY,
  } = useFeed(user?.id, { pageSize: 10, enabled: !authLoading });

  // Back from a post page or a profile: put the list where it was (F-4).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || restoreScrollY === null || feedPosts.length === 0) return;
    // Two things fight this: the router scrolls the new page to the top on
    // its own schedule, and the list is still short while cards mount, so an
    // early scrollTo gets clamped. Keep re-applying until the page is tall
    // enough and the offset sticks (bounded to ~1.5 s). "Restored" is only
    // recorded once a scroll actually applied, so a strict-mode re-run of
    // this effect reschedules instead of giving up.
    const target = restoreScrollY;
    const timers: number[] = [];
    [0, 50, 100, 200, 350, 500, 750, 1000, 1500].forEach((ms) => {
      timers.push(window.setTimeout(() => {
        if (restoredRef.current) return;
        const maxY = document.documentElement.scrollHeight - window.innerHeight;
        if (maxY < target) return; // not tall enough yet; a later tick will try again
        window.scrollTo(0, target);
        if (Math.abs(window.scrollY - target) <= 2) restoredRef.current = true;
      }, ms));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [restoreScrollY, feedPosts.length]);

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
      removePosts((p) => p.id === id);
    });
    const unsubBlocks = subscribeToAuthorBlocks((authorId) => {
      setBlockedAuthorIds(prev => new Set(prev).add(authorId));
      removePosts((p) => p.author_id === authorId);
    });
    return () => { unsubPosts(); unsubBlocks(); };
  }, [subscribeToDeletes, subscribeToAuthorBlocks, removePosts]);

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
    removePosts((p) => p.id === postId);
  }, [removePosts]);

  // Show skeletons while loading (only on initial load). Classic view uses
  // the rich PostSkeleton; other views show simple placeholder boxes sized
  // to their layout, since their cards are smaller.
  if (authLoading || (postsLoading && posts.length === 0)) {
    return (
      <>
        <FeedFrame viewId={viewId}>
          <FeedSkeletonItems viewId={viewId} />
          {autoRetrying && (
            <p className="col-span-full md:col-span-12 text-center font-body text-sm text-muted" role="status" aria-live="polite">
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
        <FeedFrame viewId={viewId}>
          <div className="text-center col-span-full md:col-span-12" role="alert">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="font-display text-xl text-ink mb-2">Couldn’t load the feed</h2>
            <p className="font-body text-muted mb-5">Check your connection and try again.</p>
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
        <FeedFrame viewId={viewId}>
          <div className="text-center col-span-full md:col-span-12">
            <h2 className="font-display text-2xl text-ink mb-4">
              The canvas awaits
            </h2>
            <p className="font-body text-muted italic mb-6">
              No posts yet. Be the first to share your creative voice.
            </p>
            {!user ? (
              <button
                type="button"
                onClick={openAuthModal}
                className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-on-accent hover:opacity-90 transition-opacity"
              >
                Sign in to create
              </button>
            ) : (
            <Link
              href="/create"
              className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-on-accent"
            >
              Create Something
            </Link>
            )}
          </div>
        </FeedFrame>
      </>
    );
  }

  return (
    <>
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
