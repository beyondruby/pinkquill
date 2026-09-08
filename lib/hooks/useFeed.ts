"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabase";
import type { Post, PostMedia, PaginationState, RelayedPost, PostAuthor, PostType, PostVisibility } from "../types";
import { categorizeError, retryWithBackoff, isRetryableError, isAbortError } from "../utils/retry";
import { enrichPost, fetchUserPostFlags, POST_RELATIONS_SELECT, POST_COUNTS_SELECT, type UserPostFlags } from "@/lib/posts/enrich";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE_SIZE = 20;
const MAX_FEED_POSTS = 200;

// ============================================================================
// useFeed - Main feed hook with pagination
// ============================================================================

interface UseFeedOptions {
  pageSize?: number;
  communityId?: string;
  enabled?: boolean;
}

interface UseFeedReturn {
  posts: Post[];
  loading: boolean;
  error: string | null;
  pagination: PaginationState;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Optimized feed hook that fetches posts with server-side filtering
 *
 * Key improvements:
 * 1. Aggregate counts fetched inline with the posts query
 * 2. All blocking/visibility logic handled by RLS (no client-side filtering)
 * 3. Proper pagination with .range()
 * 4. Single query for posts + counts (no N+1)
 * 5. AbortController for request cancellation
 * 6. Stable realtime channel names (no connection leaks)
 */
export function useFeed(userId?: string, options: UseFeedOptions = {}): UseFeedReturn {
  const { pageSize = DEFAULT_PAGE_SIZE, communityId, enabled = true } = options;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 0,
    pageSize,
    hasMore: true,
  });

  // Refs for managing async operations
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchingRef = useRef(false);
  const requestIdRef = useRef(0);

  const fetchPosts = useCallback(
    async (page: number, append: boolean = false) => {
      if (fetchingRef.current) {
        if (append) return;
        abortControllerRef.current?.abort();
      }

      fetchingRef.current = true;

      // Create new AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const signal = abortController.signal;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      try {
        setLoading(true);
        setError(null);

        const from = page * pageSize;
        const to = from + pageSize - 1;

        // Build query lazily so transient failures can be retried safely.
        const runPostsQuery = () => {
          let query = supabase
            .from("posts")
            .select(
              `
              *,
              styling,
              post_location,
              metadata,
              author:profiles!posts_author_id_fkey (
                id,
                username,
                display_name,
                avatar_url,
                is_verified,
                is_private
              ),
              media:post_media (
                id,
                media_url,
                media_type,
                caption,
                position
              ),
              collaborators:post_collaborators (
                status,
                role,
                user:profiles!post_collaborators_user_id_fkey (
                  id,
                  username,
                  display_name,
                  avatar_url
                )
              ),
              mentions:post_mentions (
                user:profiles!post_mentions_user_id_fkey (
                  id,
                  username,
                  display_name,
                  avatar_url
                )
              ),
              tags:post_tags (
                tag:tags(name)
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
              ),
              reactions_count,
              comments_count,
              relays_count,
              reaction_counts
            `
            )
            .eq("status", "published")
            .order("created_at", { ascending: false })
            .abortSignal(signal)
            .range(from, to);

          if (communityId) {
            query = query.eq("community_id", communityId);
          }

          return query;
        };

        const { data: postsData, error: queryError, count: totalCount } = await retryWithBackoff(runPostsQuery, {
          attempts: 3,
          shouldRetry: isRetryableError,
        });

        // Check if request was aborted or component unmounted
        if (abortController.signal.aborted || !mountedRef.current) return;

        if (queryError) {
          throw queryError;
        }

        // Get post IDs for batch fetching user interactions
        const postIds = (postsData || []).map((p) => p.id);

        // Viewer flags + row → Post through the shared enrichment helper.
        const flags = await fetchUserPostFlags(userId, postIds, signal);
        if (abortController.signal.aborted || !mountedRef.current) return;
        const typedPosts: Post[] = (postsData || []).map((row) => enrichPost(row, flags));
        if (append) {
          setPosts((prev) => {
            const combined = [...prev, ...typedPosts];
            if (combined.length > MAX_FEED_POSTS) {
              return combined.slice(combined.length - MAX_FEED_POSTS);
            }
            return combined;
          });
        } else {
          setPosts(typedPosts);
        }

        setPagination({
          page,
          pageSize,
          hasMore: typedPosts.length === pageSize,
          total: totalCount || undefined,
        });
      } catch (err: unknown) {
        // Ignore abort errors - they're expected when cancelling requests
        if (isAbortError(err) || abortController.signal.aborted) {
          return;
        }

        const categorized = categorizeError(err as Error);
        console.error("[useFeed] Error:", categorized.message);
        if (mountedRef.current) {
          setError(categorized.userMessage);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          fetchingRef.current = false;
        }
        if (mountedRef.current && requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [userId, pageSize, communityId]
  );

  // Load more posts
  const loadMore = useCallback(async () => {
    if (!pagination.hasMore || loading) return;
    await fetchPosts(pagination.page + 1, true);
  }, [fetchPosts, pagination.hasMore, pagination.page, loading]);

  // Refresh posts
  const refresh = useCallback(async () => {
    await fetchPosts(0, false);
  }, [fetchPosts]);

  // Initial fetch and cleanup
  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      fetchPosts(0);
    } else {
      // CRITICAL: when the hook is disabled (e.g., auth still resolving),
      // the loading state initialized to `true` would otherwise stay true
      // forever, leaving the feed skeleton on screen indefinitely.
      setLoading(false);
    }

    return () => {
      mountedRef.current = false;
      // Abort any in-flight request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      fetchingRef.current = false;
    };
  }, [fetchPosts, enabled]);

  // Refresh feed counts when the tab regains focus. The user's own
  // interactions update optimistically via interaction hooks; this catches
  // changes from other users without subscribing to reactions/relays
  // for every visible post in real-time (which produced massive realtime
  // egress). A 30s minimum gap prevents thrash if the user alt-tabs rapidly.
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const MIN_REFETCH_GAP_MS = 30_000;
    let lastRefetchAt = Date.now();

    const maybeRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (!mountedRef.current) return;
      const now = Date.now();
      if (now - lastRefetchAt < MIN_REFETCH_GAP_MS) return;
      lastRefetchAt = now;
      void fetchPosts(0, false);
    };

    document.addEventListener("visibilitychange", maybeRefresh);
    window.addEventListener("focus", maybeRefresh);
    return () => {
      document.removeEventListener("visibilitychange", maybeRefresh);
      window.removeEventListener("focus", maybeRefresh);
    };
  }, [enabled, fetchPosts]);

  return { posts, loading, error, pagination, loadMore, refresh };
}

// ============================================================================
// useSavedPosts - Fetch user's saved posts
// ============================================================================

interface UseSavedPostsReturn {
  posts: Post[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSavedPosts(userId?: string): UseSavedPostsReturn {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchSavedPosts = useCallback(async () => {
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    try {
      setLoading(true);
      setError(null);

      // Get saved post IDs with timestamps
      const { data: savedData, error: savedError } = await supabase
        .from("saves")
        .select("post_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .abortSignal(signal);

      if (abortController.signal.aborted || !mountedRef.current) return;
      if (savedError) throw savedError;
      if (!savedData || savedData.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const postIds = savedData.map((s) => s.post_id);
      const savedTimestamps = new Map(savedData.map((s) => [s.post_id, s.created_at]));

      // Fetch posts and user interactions concurrently
      const [postsResult] = await Promise.all([
        supabase
          .from("posts")
          .select(
            `
            *,
            author:profiles!posts_author_id_fkey (
              id,
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
            ),
            reactions_count,
            comments_count,
            relays_count,
            reaction_counts
          `
          )
          .in("id", postIds)
          .abortSignal(signal),
      ]);

      if (abortController.signal.aborted || !mountedRef.current) return;
      if (postsResult.error) throw postsResult.error;
      if (!postsResult.data) {
        setPosts([]);
        return;
      }

      // Viewer flags through the shared helper (reactions included); every
      // post here is saved by definition.
      const viewerFlags = await fetchUserPostFlags(userId, postIds, signal);
      if (abortController.signal.aborted || !mountedRef.current) return;
      const savedFlags: UserPostFlags = {
        ...viewerFlags,
        saves: new Set(postsResult.data.map((p) => p.id)),
      };

      // Transform posts
      const postsWithStats = postsResult.data.map((post) => ({
        ...enrichPost(post, savedFlags),
        saved_at: savedTimestamps.get(post.id),
      }));

      // Sort by saved timestamp
      postsWithStats.sort((a, b) => {
        const timeA = new Date(a.saved_at || 0).getTime();
        const timeB = new Date(b.saved_at || 0).getTime();
        return timeB - timeA;
      });

      if (abortController.signal.aborted || !mountedRef.current) return;
      setPosts(postsWithStats as Post[]);
    } catch (err: unknown) {
      if (isAbortError(err) || abortController.signal.aborted) return;
      console.error("[useSavedPosts] Error:", err);
      if (mountedRef.current) {
        setError("Failed to load saved posts");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchSavedPosts();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchSavedPosts]);

  return { posts, loading, error, refetch: fetchSavedPosts };
}

// ============================================================================
// useRelays - Fetch relayed posts for a user
// ============================================================================

export function useRelays(username: string, viewerId?: string) {
  const [relays, setRelays] = useState<RelayedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refetch = useCallback(() => setAttempt((a) => a + 1), []);

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    const fetchRelays = async () => {
      if (!username) {
        setRelays([]);
        setLoading(false);
        return;
      }

      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const signal = abortController.signal;

      try {
        setLoading(true);
        setError(null);

        // Get user's profile id
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username)
          .abortSignal(signal)
          .single();

        if (abortController.signal.aborted || !mountedRef.current) return;
        // A failed lookup is an error, not an empty profile (P-20).
        if (profileError && profileError.code !== "PGRST116") throw profileError;
        if (!profileData) {
          setRelays([]);
          return;
        }

        // The relay rows, then the posts through the same select + enrichment
        // every other list uses. The old hand-built mapping never selected the
        // counter columns (every relayed post read 0 reactions / 0 comments)
        // and hard-coded the viewer's flags (P-3).
        const { data: relayRows, error: relaysError } = await supabase
          .from("relays")
          .select("post_id, created_at")
          .eq("user_id", profileData.id)
          .order("created_at", { ascending: false })
          .abortSignal(signal);

        if (abortController.signal.aborted || !mountedRef.current) return;
        if (relaysError) throw relaysError;
        if (!relayRows || relayRows.length === 0) {
          setRelays([]);
          return;
        }

        const postIds = relayRows.map((r) => r.post_id);
        const relayedAt = new Map(relayRows.map((r) => [r.post_id, r.created_at]));

        const { data: postsData, error: postsError } = await supabase
          .from("posts")
          .select(`
            *,
            author:profiles!posts_author_id_fkey (
              id,
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
            ),
            ${POST_RELATIONS_SELECT},
            ${POST_COUNTS_SELECT}
          `)
          .in("id", postIds)
          .abortSignal(signal);

        if (abortController.signal.aborted || !mountedRef.current) return;
        if (postsError) throw postsError;

        const flags = await fetchUserPostFlags(viewerId, postIds, signal);
        if (abortController.signal.aborted || !mountedRef.current) return;

        const byId = new Map((postsData || []).map((row) => [row.id as string, row]));
        const processedRelays: RelayedPost[] = postIds
          .map((id) => byId.get(id))
          .filter((row): row is NonNullable<typeof row> => !!row)
          .map((row) => {
            const post = enrichPost(row, flags);
            return {
              ...post,
              relayed_at: relayedAt.get(post.id) ?? post.created_at,
              original_author: post.author,
            };
          });

        if (abortController.signal.aborted || !mountedRef.current) return;
        setRelays(processedRelays);
      } catch (err: unknown) {
        if (isAbortError(err) || abortController.signal.aborted) return;
        console.error("[useRelays] Error:", err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to fetch relays");
        }
      } finally {
        // Only the run that still owns the controller may clear `loading`.
        if (mountedRef.current && abortControllerRef.current === abortController) {
          setLoading(false);
        }
      }
    };

    fetchRelays();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [username, viewerId, attempt]);

  return { relays, loading, error, refetch };
}
