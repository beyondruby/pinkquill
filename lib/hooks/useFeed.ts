"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabase";
import type { Post, PostMedia, PaginationState, RelayedPost, ReactionType, AggregateCount, PostAuthor } from "../types";
import { getAggregateCount } from "../types";
import { categorizeError } from "../utils/retry";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// useFeed - Main feed hook with pagination
// ============================================================================

interface UseFeedOptions {
  pageSize?: number;
  communityId?: string;
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
 * 1. Uses posts_with_stats view for pre-computed counts
 * 2. All blocking/visibility logic handled by RLS (no client-side filtering)
 * 3. Proper pagination with .range()
 * 4. Single query for posts + counts (no N+1)
 * 5. AbortController for request cancellation
 * 6. Stable realtime channel names (no connection leaks)
 */
export function useFeed(userId?: string, options: UseFeedOptions = {}): UseFeedReturn {
  const { pageSize = DEFAULT_PAGE_SIZE, communityId } = options;

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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Track userId for realtime callbacks
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const fetchPosts = useCallback(
    async (page: number, append: boolean = false) => {
      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        if (!append) {
          setLoading(true);
        }
        setError(null);

        const from = page * pageSize;
        const to = from + pageSize - 1;

        // Build the query - RLS handles all visibility/blocking logic
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
            community:communities (
              id,
              slug,
              name,
              avatar_url
            ),
            admires:admires(count),
            comments:comments(count),
            relays:relays(count)
          `,
            { count: "exact" }
          )
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .range(from, to);

        // Filter by community if specified
        if (communityId) {
          query = query.eq("community_id", communityId);
        }

        const { data: postsData, error: queryError, count: totalCount } = await query;

        // Check if request was aborted or component unmounted
        if (abortController.signal.aborted || !mountedRef.current) return;

        if (queryError) {
          throw queryError;
        }

        // Get post IDs for batch fetching user interactions
        const postIds = (postsData || []).map((p) => p.id);

        // Batch fetch ALL auxiliary data in a single Promise.all for efficiency
        // This prevents waterfall delays by running all queries concurrently
        let userAdmires = new Set<string>();
        let userSaves = new Set<string>();
        let userRelays = new Set<string>();
        let userReactions = new Map<string, string>();
        let collaboratorsByPost = new Map<string, any[]>();
        let mentionsByPost = new Map<string, any[]>();
        let hashtagsByPost = new Map<string, string[]>();

        if (postIds.length > 0) {
          // Build all queries - executed concurrently for efficiency
          const baseQueries = [
            // Collaborators
            supabase
              .from("post_collaborators")
              .select(
                `
                post_id,
                status,
                role,
                user:profiles!post_collaborators_user_id_fkey (
                  id,
                  username,
                  display_name,
                  avatar_url
                )
              `
              )
              .in("post_id", postIds)
              .eq("status", "accepted"),
            // Mentions
            supabase
              .from("post_mentions")
              .select(
                `
                post_id,
                user:profiles!post_mentions_user_id_fkey (
                  id,
                  username,
                  display_name,
                  avatar_url
                )
              `
              )
              .in("post_id", postIds),
            // Tags
            supabase
              .from("post_tags")
              .select(
                `
                post_id,
                tag:tags(name)
              `
              )
              .in("post_id", postIds),
          ];

          // Add user interaction queries if logged in
          const userQueries = userId
            ? [
                supabase.from("admires").select("post_id").eq("user_id", userId).in("post_id", postIds),
                supabase.from("saves").select("post_id").eq("user_id", userId).in("post_id", postIds),
                supabase.from("relays").select("post_id").eq("user_id", userId).in("post_id", postIds),
                supabase
                  .from("reactions")
                  .select("post_id, reaction_type")
                  .eq("user_id", userId)
                  .in("post_id", postIds),
              ]
            : [];

          // Execute all queries concurrently
          const results = await Promise.all([...baseQueries, ...userQueries]);

          // Check abort after await
          if (abortController.signal.aborted || !mountedRef.current) return;

          // Process base results (collaborators, mentions, tags)
          const collaboratorsResult = results[0];
          const mentionsResult = results[1];
          const tagsResult = results[2];

          // Process collaborators
          (collaboratorsResult.data || []).forEach((c: any) => {
            if (!collaboratorsByPost.has(c.post_id)) {
              collaboratorsByPost.set(c.post_id, []);
            }
            collaboratorsByPost.get(c.post_id)!.push({
              status: c.status,
              role: c.role,
              user: c.user,
            });
          });

          // Process mentions
          (mentionsResult.data || []).forEach((m: any) => {
            if (!mentionsByPost.has(m.post_id)) {
              mentionsByPost.set(m.post_id, []);
            }
            mentionsByPost.get(m.post_id)!.push({ user: m.user });
          });

          // Process tags
          (tagsResult.data || []).forEach((t: any) => {
            const tagName = t.tag?.name;
            if (tagName) {
              if (!hashtagsByPost.has(t.post_id)) {
                hashtagsByPost.set(t.post_id, []);
              }
              hashtagsByPost.get(t.post_id)!.push(tagName);
            }
          });

          // Process user interactions if logged in (results[3-6])
          if (userId && results.length === 7) {
            const admiresResult = results[3];
            const savesResult = results[4];
            const relaysResult = results[5];
            const reactionsResult = results[6];
            userAdmires = new Set((admiresResult.data || []).map((a: any) => a.post_id));
            userSaves = new Set((savesResult.data || []).map((s: any) => s.post_id));
            userRelays = new Set((relaysResult.data || []).map((r: any) => r.post_id));
            (reactionsResult.data || []).forEach((r: any) => {
              userReactions.set(r.post_id, r.reaction_type);
            });
          }
        }

        // Transform posts with all data
        const transformedPosts: Post[] = (postsData || []).map((post) => ({
          id: post.id,
          author_id: post.author_id,
          type: post.type,
          title: post.title,
          content: post.content,
          visibility: post.visibility,
          status: post.status,
          content_warning: post.content_warning,
          created_at: post.created_at,
          community_id: post.community_id,
          // Creative styling fields
          styling: post.styling || null,
          post_location: post.post_location || null,
          metadata: post.metadata || null,
          spotify_track: post.spotify_track || null,
          author: post.author,
          media: (post.media || []).sort((a: PostMedia, b: PostMedia) => a.position - b.position),
          community: post.community,
          // Extract counts from aggregation
          admires_count: getAggregateCount(post.admires as AggregateCount[] | null),
          comments_count: getAggregateCount(post.comments as AggregateCount[] | null),
          relays_count: getAggregateCount(post.relays as AggregateCount[] | null),
          reactions_count: 0, // Will be computed from reactions if needed
          // User flags
          user_has_admired: userAdmires.has(post.id),
          user_has_saved: userSaves.has(post.id),
          user_has_relayed: userRelays.has(post.id),
          user_reaction_type: (userReactions.get(post.id) as ReactionType | undefined) || null,
          // Collaborators and mentions
          collaborators: collaboratorsByPost.get(post.id) || [],
          mentions: mentionsByPost.get(post.id) || [],
          hashtags: hashtagsByPost.get(post.id) || [],
        }));

        // Final abort/mount check before state update
        if (abortController.signal.aborted || !mountedRef.current) return;

        // Update state
        if (append) {
          setPosts((prev) => [...prev, ...transformedPosts]);
        } else {
          setPosts(transformedPosts);
        }

        setPagination({
          page,
          pageSize,
          hasMore: transformedPosts.length === pageSize,
          total: totalCount || undefined,
        });
      } catch (err: any) {
        // Ignore abort errors - they're expected when cancelling requests
        if (err?.name === "AbortError" || abortController.signal.aborted) {
          return;
        }

        const categorized = categorizeError(err);
        console.error("[useFeed] Error:", categorized.message);
        if (mountedRef.current) {
          setError(categorized.userMessage);
        }
      } finally {
        // Only update loading state if this is still the active request
        if (!abortController.signal.aborted && mountedRef.current) {
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
    fetchPosts(0);

    return () => {
      mountedRef.current = false;
      // Abort any in-flight request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchPosts]);

  // Real-time subscriptions for interactions
  // CRITICAL: Use stable channel name to prevent connection leaks
  useEffect(() => {
    // Clean up previous channel if it exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Stable channel name - NO Date.now() to prevent connection leaks
    const channelName = `feed-interactions-${userId || "anon"}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admires" },
        (payload) => {
          const newData = payload.new as { post_id?: string; user_id?: string } | null;
          const oldData = payload.old as { post_id?: string; user_id?: string } | null;
          const postId = newData?.post_id || oldData?.post_id;
          if (!postId) return;

          setPosts((current) =>
            current.map((post) => {
              if (post.id !== postId) return post;

              if (payload.eventType === "INSERT") {
                return {
                  ...post,
                  admires_count: post.admires_count + 1,
                  user_has_admired: newData?.user_id === userIdRef.current ? true : post.user_has_admired,
                };
              } else if (payload.eventType === "DELETE") {
                return {
                  ...post,
                  admires_count: Math.max(0, post.admires_count - 1),
                  user_has_admired: oldData?.user_id === userIdRef.current ? false : post.user_has_admired,
                };
              }
              return post;
            })
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relays" },
        (payload) => {
          const newData = payload.new as { post_id?: string; user_id?: string } | null;
          const oldData = payload.old as { post_id?: string; user_id?: string } | null;
          const postId = newData?.post_id || oldData?.post_id;
          if (!postId) return;

          setPosts((current) =>
            current.map((post) => {
              if (post.id !== postId) return post;

              if (payload.eventType === "INSERT") {
                return {
                  ...post,
                  relays_count: post.relays_count + 1,
                  user_has_relayed: newData?.user_id === userIdRef.current ? true : post.user_has_relayed,
                };
              } else if (payload.eventType === "DELETE") {
                return {
                  ...post,
                  relays_count: Math.max(0, post.relays_count - 1),
                  user_has_relayed: oldData?.user_id === userIdRef.current ? false : post.user_has_relayed,
                };
              }
              return post;
            })
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

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

    try {
      setLoading(true);
      setError(null);

      // Get saved post IDs with timestamps
      const { data: savedData, error: savedError } = await supabase
        .from("saves")
        .select("post_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

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
      const [postsResult, userAdmiresResult, userRelaysResult] = await Promise.all([
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
            admires:admires(count),
            comments:comments(count),
            relays:relays(count)
          `
          )
          .in("id", postIds),
        supabase.from("admires").select("post_id").eq("user_id", userId).in("post_id", postIds),
        supabase.from("relays").select("post_id").eq("user_id", userId).in("post_id", postIds),
      ]);

      if (abortController.signal.aborted || !mountedRef.current) return;
      if (postsResult.error) throw postsResult.error;
      if (!postsResult.data) {
        setPosts([]);
        return;
      }

      const userAdmires = new Set((userAdmiresResult.data || []).map((a) => a.post_id));
      const userRelays = new Set((userRelaysResult.data || []).map((r) => r.post_id));

      // Transform posts
      const postsWithStats = postsResult.data.map((post) => ({
        ...post,
        media: (post.media || []).sort((a: PostMedia, b: PostMedia) => a.position - b.position),
        admires_count: getAggregateCount(post.admires as AggregateCount[] | null),
        comments_count: getAggregateCount(post.comments as AggregateCount[] | null),
        relays_count: getAggregateCount(post.relays as AggregateCount[] | null),
        reactions_count: 0,
        user_has_admired: userAdmires.has(post.id),
        user_has_saved: true,
        user_has_relayed: userRelays.has(post.id),
        user_reaction_type: null,
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
    } catch (err: any) {
      if (err?.name === "AbortError" || abortController.signal.aborted) return;
      console.error("[useSavedPosts] Error:", err);
      if (mountedRef.current) {
        setError("Failed to load saved posts");
      }
    } finally {
      if (!abortController.signal.aborted && mountedRef.current) {
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

export function useRelays(username: string) {
  const [relays, setRelays] = useState<RelayedPost[]>([]);
  const [loading, setLoading] = useState(true);

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

      try {
        setLoading(true);

        // Get user's profile id
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username)
          .single();

        if (abortController.signal.aborted || !mountedRef.current) return;
        if (profileError || !profileData) {
          setRelays([]);
          return;
        }

        // Fetch relays with post data
        const { data: relaysData, error: relaysError } = await supabase
          .from("relays")
          .select(
            `
            created_at,
            post:posts (
              id,
              author_id,
              type,
              title,
              content,
              visibility,
              created_at,
              author:profiles!posts_author_id_fkey (
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
              )
            )
          `
          )
          .eq("user_id", profileData.id)
          .order("created_at", { ascending: false });

        if (abortController.signal.aborted || !mountedRef.current) return;
        if (relaysError || !relaysData || relaysData.length === 0) {
          setRelays([]);
          return;
        }

        // Type for relay post data from the query
        interface RelayPostData {
          id: string;
          author_id: string;
          type: string;
          title: string | null;
          content: string;
          visibility: string;
          created_at: string;
          author: {
            username: string;
            display_name: string | null;
            avatar_url: string | null;
          };
          media: {
            id: string;
            media_url: string;
            media_type: string;
            caption: string | null;
            position: number;
          }[];
        }

        // Helper to extract post data - handles both object and array return types from Supabase
        const getPostData = (post: unknown): RelayPostData | null => {
          if (!post) return null;
          if (Array.isArray(post)) return post[0] as RelayPostData;
          return post as RelayPostData;
        };

        const postIds = relaysData
          .map((r) => getPostData(r.post)?.id)
          .filter((id): id is string => !!id);

        if (postIds.length === 0) {
          setRelays([]);
          return;
        }

        // Batch fetch counts concurrently
        const [admiresResult, commentsResult, relaysCountResult] = await Promise.all([
          supabase.from("admires").select("post_id").in("post_id", postIds),
          supabase.from("comments").select("post_id").in("post_id", postIds),
          supabase.from("relays").select("post_id").in("post_id", postIds),
        ]);

        if (abortController.signal.aborted || !mountedRef.current) return;

        const admiresCounts: Record<string, number> = {};
        const commentsCounts: Record<string, number> = {};
        const relaysCounts: Record<string, number> = {};

        (admiresResult.data || []).forEach((a) => {
          admiresCounts[a.post_id] = (admiresCounts[a.post_id] || 0) + 1;
        });
        (commentsResult.data || []).forEach((c) => {
          commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
        });
        (relaysCountResult.data || []).forEach((r) => {
          relaysCounts[r.post_id] = (relaysCounts[r.post_id] || 0) + 1;
        });

        const processedRelays = relaysData
          .map((relay) => {
            const post = getPostData(relay.post);
            if (!post) return null;
            return {
              ...post,
              media: (post.media || []).sort((a, b) => a.position - b.position) as PostMedia[],
              relayed_at: relay.created_at,
              original_author: post.author as PostAuthor,
              admires_count: admiresCounts[post.id] || 0,
              comments_count: commentsCounts[post.id] || 0,
              relays_count: relaysCounts[post.id] || 0,
              reactions_count: 0,
              user_has_admired: false,
              user_has_saved: false,
              user_has_relayed: false,
              user_reaction_type: null,
            };
          })
          .filter((relay): relay is NonNullable<typeof relay> => relay !== null);

        if (abortController.signal.aborted || !mountedRef.current) return;
        setRelays(processedRelays as RelayedPost[]);
      } catch (err: any) {
        if (err?.name === "AbortError" || abortControllerRef.current?.signal.aborted) return;
        console.error("[useRelays] Error:", err);
      } finally {
        if (!abortControllerRef.current?.signal.aborted && mountedRef.current) {
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
  }, [username]);

  return { relays, loading };
}

// ============================================================================
// LEGACY EXPORT - usePosts (for backwards compatibility)
// ============================================================================

/**
 * @deprecated Use useFeed instead. This is kept for backwards compatibility.
 */
export function usePosts(userId?: string) {
  const { posts, loading, error, refresh } = useFeed(userId);
  return { posts, loading, error, refetch: refresh };
}
