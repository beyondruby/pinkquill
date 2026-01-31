"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import type { PinnedPost, CommunityPinnedPost } from "../types";

const MAX_PINNED_POSTS = 6;

// ============================================================================
// usePinnedPosts - Manage pinned posts for a user's profile
// ============================================================================

interface UsePinnedPostsReturn {
  pinnedPostIds: string[];
  loading: boolean;
  isPinned: (postId: string) => boolean;
  canPin: boolean;
  pinPost: (postId: string) => Promise<boolean>;
  unpinPost: (postId: string) => Promise<boolean>;
  reorderPins: (postIds: string[]) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function usePinnedPosts(userId?: string): UsePinnedPostsReturn {
  const [pinnedPosts, setPinnedPosts] = useState<PinnedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPinnedPosts = useCallback(async () => {
    if (!userId) {
      setPinnedPosts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("pinned_posts")
        .select("*")
        .eq("user_id", userId)
        .order("position", { ascending: true });

      if (error) throw error;
      setPinnedPosts(data || []);
    } catch (err) {
      console.error("[usePinnedPosts] Error fetching:", err);
      setPinnedPosts([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPinnedPosts();
  }, [fetchPinnedPosts]);

  const pinnedPostIds = pinnedPosts.map((p) => p.post_id);

  const isPinned = useCallback(
    (postId: string) => pinnedPostIds.includes(postId),
    [pinnedPostIds]
  );

  const canPin = pinnedPosts.length < MAX_PINNED_POSTS;

  const pinPost = useCallback(
    async (postId: string): Promise<boolean> => {
      if (!userId) return false;
      if (pinnedPosts.length >= MAX_PINNED_POSTS) return false;
      if (isPinned(postId)) return true;

      try {
        // Get next position
        const nextPosition = pinnedPosts.length;

        const { error } = await supabase.from("pinned_posts").insert({
          user_id: userId,
          post_id: postId,
          position: nextPosition,
        });

        if (error) throw error;

        // Update local state
        setPinnedPosts((prev) => [
          ...prev,
          {
            id: "", // Will be set on refetch
            user_id: userId,
            post_id: postId,
            position: nextPosition,
            pinned_at: new Date().toISOString(),
          },
        ]);

        return true;
      } catch (err) {
        console.error("[usePinnedPosts] Error pinning:", err);
        return false;
      }
    },
    [userId, pinnedPosts, isPinned]
  );

  const unpinPost = useCallback(
    async (postId: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        const { error } = await supabase
          .from("pinned_posts")
          .delete()
          .eq("user_id", userId)
          .eq("post_id", postId);

        if (error) throw error;

        // Update local state and reorder positions
        const remaining = pinnedPosts
          .filter((p) => p.post_id !== postId)
          .map((p, idx) => ({ ...p, position: idx }));

        setPinnedPosts(remaining);

        // Update positions in database
        for (const pin of remaining) {
          await supabase
            .from("pinned_posts")
            .update({ position: pin.position })
            .eq("id", pin.id);
        }

        return true;
      } catch (err) {
        console.error("[usePinnedPosts] Error unpinning:", err);
        return false;
      }
    },
    [userId, pinnedPosts]
  );

  const reorderPins = useCallback(
    async (postIds: string[]): Promise<boolean> => {
      if (!userId) return false;

      try {
        // Update positions based on new order
        for (let i = 0; i < postIds.length; i++) {
          const pin = pinnedPosts.find((p) => p.post_id === postIds[i]);
          if (pin) {
            await supabase
              .from("pinned_posts")
              .update({ position: i })
              .eq("id", pin.id);
          }
        }

        await fetchPinnedPosts();
        return true;
      } catch (err) {
        console.error("[usePinnedPosts] Error reordering:", err);
        return false;
      }
    },
    [userId, pinnedPosts, fetchPinnedPosts]
  );

  return {
    pinnedPostIds,
    loading,
    isPinned,
    canPin,
    pinPost,
    unpinPost,
    reorderPins,
    refetch: fetchPinnedPosts,
  };
}

// ============================================================================
// useCommunityPinnedPosts - Manage pinned posts for a community
// ============================================================================

interface UseCommunityPinnedPostsReturn {
  pinnedPostIds: string[];
  loading: boolean;
  isPinned: (postId: string) => boolean;
  canPin: boolean;
  pinPost: (postId: string, pinnedBy: string) => Promise<boolean>;
  unpinPost: (postId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useCommunityPinnedPosts(
  communityId?: string
): UseCommunityPinnedPostsReturn {
  const [pinnedPosts, setPinnedPosts] = useState<CommunityPinnedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPinnedPosts = useCallback(async () => {
    if (!communityId) {
      setPinnedPosts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("community_pinned_posts")
        .select("*")
        .eq("community_id", communityId)
        .order("position", { ascending: true });

      if (error) throw error;
      setPinnedPosts(data || []);
    } catch (err) {
      console.error("[useCommunityPinnedPosts] Error fetching:", err);
      setPinnedPosts([]);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    fetchPinnedPosts();
  }, [fetchPinnedPosts]);

  const pinnedPostIds = pinnedPosts.map((p) => p.post_id);

  const isPinned = useCallback(
    (postId: string) => pinnedPostIds.includes(postId),
    [pinnedPostIds]
  );

  const canPin = pinnedPosts.length < MAX_PINNED_POSTS;

  const pinPost = useCallback(
    async (postId: string, pinnedBy: string): Promise<boolean> => {
      if (!communityId) return false;
      if (pinnedPosts.length >= MAX_PINNED_POSTS) return false;
      if (isPinned(postId)) return true;

      try {
        const nextPosition = pinnedPosts.length;

        const { error } = await supabase.from("community_pinned_posts").insert({
          community_id: communityId,
          post_id: postId,
          pinned_by: pinnedBy,
          position: nextPosition,
        });

        if (error) throw error;

        setPinnedPosts((prev) => [
          ...prev,
          {
            id: "",
            community_id: communityId,
            post_id: postId,
            pinned_by: pinnedBy,
            position: nextPosition,
            pinned_at: new Date().toISOString(),
          },
        ]);

        return true;
      } catch (err) {
        console.error("[useCommunityPinnedPosts] Error pinning:", err);
        return false;
      }
    },
    [communityId, pinnedPosts, isPinned]
  );

  const unpinPost = useCallback(
    async (postId: string): Promise<boolean> => {
      if (!communityId) return false;

      try {
        const { error } = await supabase
          .from("community_pinned_posts")
          .delete()
          .eq("community_id", communityId)
          .eq("post_id", postId);

        if (error) throw error;

        const remaining = pinnedPosts
          .filter((p) => p.post_id !== postId)
          .map((p, idx) => ({ ...p, position: idx }));

        setPinnedPosts(remaining);

        // Update positions
        for (const pin of remaining) {
          await supabase
            .from("community_pinned_posts")
            .update({ position: pin.position })
            .eq("id", pin.id);
        }

        return true;
      } catch (err) {
        console.error("[useCommunityPinnedPosts] Error unpinning:", err);
        return false;
      }
    },
    [communityId, pinnedPosts]
  );

  return {
    pinnedPostIds,
    loading,
    isPinned,
    canPin,
    pinPost,
    unpinPost,
    refetch: fetchPinnedPosts,
  };
}
