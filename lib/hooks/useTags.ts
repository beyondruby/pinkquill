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

  const fetchTrendingTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all post_tags with their tag names from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Fetch tags with post counts
      const { data: tagData, error: tagError } = await supabase
        .from("post_tags")
        .select(`
          tag_id,
          tags!inner (
            id,
            name
          ),
          posts!inner (
            id,
            created_at,
            status,
            visibility
          )
        `)
        .eq("posts.status", "published")
        .eq("posts.visibility", "public")
        .gte("posts.created_at", thirtyDaysAgo.toISOString());

      if (tagError) throw tagError;

      // Count posts per tag
      const tagCounts = new Map<string, { name: string; total: number; recent: number }>();

      (tagData || []).forEach((item: any) => {
        const tagName = item.tags?.name;
        if (!tagName) return;

        const existing = tagCounts.get(tagName) || { name: tagName, total: 0, recent: 0 };
        existing.total += 1;

        // Check if post is from last 7 days
        const postDate = new Date(item.posts?.created_at);
        if (postDate >= sevenDaysAgo) {
          existing.recent += 1;
        }

        tagCounts.set(tagName, existing);
      });

      // Convert to array and sort by recent posts first, then total
      const sortedTags = Array.from(tagCounts.values())
        .map((t) => ({
          name: t.name,
          post_count: t.total,
          recent_posts: t.recent,
        }))
        .sort((a, b) => {
          // Sort by recent posts first, then by total
          if (b.recent_posts !== a.recent_posts) {
            return b.recent_posts - a.recent_posts;
          }
          return b.post_count - a.post_count;
        })
        .slice(0, limit);

      setTags(sortedTags);
    } catch (err) {
      console.error("[useTrendingTags] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch trending tags");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchTrendingTags();
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
      (allPostTags || []).forEach((pt: any) => {
        const tagName = pt.tags?.name;
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

  useEffect(() => {
    const fetchPopularTags = async () => {
      try {
        // Get all tags with their post counts (limited to prevent memory issues)
        const { data, error } = await supabase
          .from("post_tags")
          .select(`
            tag_id,
            tags!inner (name)
          `)
          .limit(10000);

        if (error) throw error;

        // Count occurrences
        const tagCounts = new Map<string, number>();
        (data || []).forEach((item: any) => {
          const tagName = item.tags?.name;
          if (tagName) {
            tagCounts.set(tagName, (tagCounts.get(tagName) || 0) + 1);
          }
        });

        // Sort and limit
        const sortedTags = Array.from(tagCounts.entries())
          .map(([name, count]) => ({ name, post_count: count, recent_posts: 0 }))
          .sort((a, b) => b.post_count - a.post_count)
          .slice(0, limit);

        setTags(sortedTags);
      } catch (err) {
        console.error("[usePopularTags] Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPopularTags();
  }, [limit]);

  return { tags, loading };
}
