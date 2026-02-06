"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import type { Post, PostMedia, AggregateCount } from "../types";
import { getAggregateCount } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export interface TrendingTag {
  name: string;
  post_count: number;
  recent_posts: number; // Posts in last 7 days
}

interface UseTagPostsReturn {
  posts: Post[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  tagInfo: {
    name: string;
    totalPosts: number;
  } | null;
}

interface UseTrendingTagsReturn {
  tags: TrendingTag[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// useTrendingTags - Fetch real trending tags from database
// ============================================================================

export function useTrendingTags(limit: number = 10): UseTrendingTagsReturn {
  const [tags, setTags] = useState<TrendingTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchedRef = useRef(false);

  const fetchTrendingTags = useCallback(async () => {
    // Prevent duplicate fetches on initial load
    if (fetchedRef.current && tags.length > 0) {
      setLoading(false);
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      // Use server-side RPC function for aggregation instead of fetching raw rows
      const { data, error: rpcError } = await supabase.rpc("get_trending_tags", {
        tag_limit: limit,
      });

      if (!mountedRef.current) return;
      if (rpcError) throw rpcError;

      const sortedTags: TrendingTag[] = (data || []).map(
        (row: { name: string; post_count: number; recent_posts: number }) => ({
          name: row.name,
          post_count: Number(row.post_count),
          recent_posts: Number(row.recent_posts),
        })
      );

      if (!mountedRef.current) return;
      setTags(sortedTags);
      fetchedRef.current = true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[useTrendingTags] Error:", err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch trending tags");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [limit, tags.length]);

  useEffect(() => {
    mountedRef.current = true;
    fetchTrendingTags();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTrendingTags]);

  return { tags, loading, error, refetch: fetchTrendingTags };
}

// ============================================================================
// useTagPosts - Fetch posts for a specific tag
// ============================================================================

const PAGE_SIZE = 20;

export function useTagPosts(tagName: string, userId?: string): UseTagPostsReturn {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [tagInfo, setTagInfo] = useState<{ name: string; totalPosts: number } | null>(null);

  const pageRef = useRef(0);
  const fetchingRef = useRef(false);

  const fetchPosts = useCallback(async (page: number, append: boolean = false) => {
    if (!tagName || fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      if (!append) {
        setLoading(true);
      }
      setError(null);

      // First, get the tag ID
      const { data: tagData, error: tagError } = await supabase
        .from("tags")
        .select("id, name")
        .ilike("name", tagName)
        .single();

      if (tagError || !tagData) {
        setTagInfo(null);
        setPosts([]);
        setHasMore(false);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      // Get total post count for this tag
      const { count: totalCount } = await supabase
        .from("post_tags")
        .select("post_id", { count: "exact", head: true })
        .eq("tag_id", tagData.id);

      setTagInfo({ name: tagData.name, totalPosts: totalCount || 0 });

      // Get post IDs for this tag with pagination
      const { data: postTagData, error: postTagError } = await supabase
        .from("post_tags")
        .select("post_id")
        .eq("tag_id", tagData.id)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (postTagError) throw postTagError;

      const postIds = (postTagData || []).map((pt) => pt.post_id);

      if (postIds.length === 0) {
        if (!append) {
          setPosts([]);
        }
        setHasMore(false);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      // Fetch the actual posts
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(`
          *,
          author:profiles!posts_author_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            is_verified
          ),
          media:post_media (
            id,
            media_url,
            media_type,
            caption,
            position
          ),
          admires:admires(count),
          comments:comments(count),
          relays:relays(count)
        `)
        .in("id", postIds)
        .eq("status", "published")
        .eq("visibility", "public")
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      // Get user interactions if logged in
      let userAdmires = new Set<string>();
      let userSaves = new Set<string>();
      let userRelays = new Set<string>();

      if (userId && postIds.length > 0) {
        const [admiresResult, savesResult, relaysResult] = await Promise.all([
          supabase.from("admires").select("post_id").eq("user_id", userId).in("post_id", postIds),
          supabase.from("saves").select("post_id").eq("user_id", userId).in("post_id", postIds),
          supabase.from("relays").select("post_id").eq("user_id", userId).in("post_id", postIds),
        ]);

        userAdmires = new Set((admiresResult.data || []).map((a) => a.post_id));
        userSaves = new Set((savesResult.data || []).map((s) => s.post_id));
        userRelays = new Set((relaysResult.data || []).map((r) => r.post_id));
      }

      // Fetch tags for each post
      const { data: allPostTags } = await supabase
        .from("post_tags")
        .select(`
          post_id,
          tags (name)
        `)
        .in("post_id", postIds);

      const tagsByPost = new Map<string, string[]>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (allPostTags || []).forEach((pt: any) => {
        const tags = Array.isArray(pt.tags) ? pt.tags[0] : pt.tags;
        const tagName = tags?.name;
        if (tagName) {
          const existing = tagsByPost.get(pt.post_id) || [];
          existing.push(tagName);
          tagsByPost.set(pt.post_id, existing);
        }
      });

      // Transform posts
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
        author: post.author,
        media: (post.media || []).sort((a: PostMedia, b: PostMedia) => a.position - b.position),
        admires_count: getAggregateCount(post.admires as AggregateCount[] | null),
        comments_count: getAggregateCount(post.comments as AggregateCount[] | null),
        relays_count: getAggregateCount(post.relays as AggregateCount[] | null),
        reactions_count: 0,
        user_has_admired: userAdmires.has(post.id),
        user_has_saved: userSaves.has(post.id),
        user_has_relayed: userRelays.has(post.id),
        user_reaction_type: null,
        community_id: post.community_id || null,
        hashtags: tagsByPost.get(post.id) || [],
      }));

      if (append) {
        setPosts((prev) => [...prev, ...transformedPosts]);
      } else {
        setPosts(transformedPosts);
      }

      setHasMore(postIds.length === PAGE_SIZE);
      pageRef.current = page;
    } catch (err) {
      console.error("[useTagPosts] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch posts");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [tagName, userId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || fetchingRef.current) return;
    await fetchPosts(pageRef.current + 1, true);
  }, [fetchPosts, hasMore]);

  useEffect(() => {
    pageRef.current = 0;
    setPosts([]);
    setHasMore(true);
    fetchPosts(0);
  }, [tagName, fetchPosts]);

  return { posts, loading, error, hasMore, loadMore, tagInfo };
}

// ============================================================================
// usePopularTags - Get tags sorted by all-time popularity
// ============================================================================

export function usePopularTags(limit: number = 20) {
  const [tags, setTags] = useState<TrendingTag[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const fetchPopularTags = async () => {
      // Prevent duplicate fetches
      if (fetchedRef.current) return;

      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        // Use server-side RPC function for aggregation
        const { data, error } = await supabase.rpc("get_popular_tags", {
          tag_limit: limit,
        });

        if (!mountedRef.current) return;
        if (error) throw error;

        const sortedTags: TrendingTag[] = (data || []).map(
          (row: { name: string; post_count: number }) => ({
            name: row.name,
            post_count: Number(row.post_count),
            recent_posts: 0,
          })
        );

        if (!mountedRef.current) return;
        setTags(sortedTags);
        fetchedRef.current = true;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("[usePopularTags] Error:", err);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchPopularTags();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [limit]);

  return { tags, loading };
}
