"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import type { ReactionType, ReactionCounts } from "../types";

// ============================================================================
// useToggleAdmire - Simple admire toggle
// ============================================================================

export function useToggleAdmire() {
  const toggle = async (postId: string, userId: string, isAdmired: boolean) => {
    if (isAdmired) {
      const { error } = await supabase.from("admires").delete().eq("post_id", postId).eq("user_id", userId);
      if (error) {
        console.error("[useToggleAdmire] Failed to remove admire:", error.message);
        throw error;
      }
    } else {
      const { error } = await supabase.from("admires").insert({
        post_id: postId,
        user_id: userId,
      });
      if (error) {
        console.error("[useToggleAdmire] Failed to add admire:", error.message);
        throw error;
      }
    }
  };

  return { toggle };
}

// ============================================================================
// useToggleSave - Save/unsave posts
// ============================================================================

export function useToggleSave() {
  const toggle = async (postId: string, userId: string, isSaved: boolean) => {
    if (isSaved) {
      const { error } = await supabase.from("saves").delete().eq("post_id", postId).eq("user_id", userId);
      if (error) {
        console.error("[useToggleSave] Failed to unsave:", error.message);
        throw error;
      }
    } else {
      const { error } = await supabase.from("saves").insert({
        post_id: postId,
        user_id: userId,
      });
      if (error) {
        console.error("[useToggleSave] Failed to save:", error.message);
        throw error;
      }
    }
  };

  return { toggle };
}

// ============================================================================
// useToggleRelay - Repost functionality
// ============================================================================

export function useToggleRelay() {
  const toggle = async (postId: string, userId: string, isRelayed: boolean) => {
    if (isRelayed) {
      const { error } = await supabase.from("relays").delete().eq("post_id", postId).eq("user_id", userId);
      if (error) {
        console.error("[useToggleRelay] Failed to remove relay:", error.message);
        throw error;
      }
    } else {
      const { error } = await supabase.from("relays").insert({
        post_id: postId,
        user_id: userId,
      });
      if (error) {
        console.error("[useToggleRelay] Failed to add relay:", error.message);
        throw error;
      }
    }
  };

  return { toggle };
}

// ============================================================================
// useToggleReaction - Multi-reaction system
// ============================================================================

interface ReactResult {
  success: boolean;
  removed?: boolean;
  changed?: boolean;
  added?: boolean;
  error?: unknown;
}

export function useToggleReaction() {
  const react = async (
    postId: string,
    userId: string,
    reactionType: ReactionType,
    currentReaction: ReactionType | null
  ): Promise<ReactResult> => {
    try {
      if (currentReaction === reactionType) {
        // Same reaction clicked - remove it
        const { error } = await supabase
          .from("reactions")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (error) {
          // Fallback to admires if reactions table doesn't exist
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            return reactWithAdmires(postId, userId, reactionType, currentReaction);
          }
          throw error;
        }
        return { success: true, removed: true };
      } else if (currentReaction) {
        // Different reaction - update it
        const { error } = await supabase
          .from("reactions")
          .update({ reaction_type: reactionType })
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            return reactWithAdmires(postId, userId, reactionType, currentReaction);
          }
          throw error;
        }
        return { success: true, changed: true };
      } else {
        // No current reaction - insert new
        const { error } = await supabase.from("reactions").insert({
          post_id: postId,
          user_id: userId,
          reaction_type: reactionType,
        });

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            return reactWithAdmires(postId, userId, reactionType, currentReaction);
          }
          throw error;
        }
        return { success: true, added: true };
      }
    } catch (err) {
      console.error("[useToggleReaction] Error:", err);
      return { success: false, error: err };
    }
  };

  // Fallback using admires table (only supports admire reaction)
  const reactWithAdmires = async (
    postId: string,
    userId: string,
    reactionType: ReactionType,
    currentReaction: ReactionType | null
  ): Promise<ReactResult> => {
    if (reactionType !== "admire") {
      return { success: false, error: "Only admire is supported in fallback mode" };
    }

    try {
      if (currentReaction === "admire") {
        const { error } = await supabase.from("admires").delete().eq("post_id", postId).eq("user_id", userId);
        if (error) throw error;
        return { success: true, removed: true };
      } else {
        const { error } = await supabase.from("admires").insert({
          post_id: postId,
          user_id: userId,
        });
        if (error) throw error;
        return { success: true, added: true };
      }
    } catch (err) {
      console.error("[useToggleReaction] Fallback Error:", err);
      return { success: false, error: err };
    }
  };

  const removeReaction = async (postId: string, userId: string): Promise<ReactResult> => {
    try {
      const { error } = await supabase
        .from("reactions")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          const { error: fallbackError } = await supabase.from("admires").delete().eq("post_id", postId).eq("user_id", userId);
          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }
      return { success: true };
    } catch (err) {
      console.error("[useToggleReaction] Remove Error:", err);
      return { success: false, error: err };
    }
  };

  const getReaction = async (postId: string, userId: string): Promise<ReactionType | null> => {
    try {
      const { data, error } = await supabase
        .from("reactions")
        .select("reaction_type")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          const { data: admireData } = await supabase
            .from("admires")
            .select("post_id")
            .eq("post_id", postId)
            .eq("user_id", userId)
            .maybeSingle();
          return admireData ? "admire" : null;
        }
        throw error;
      }
      return data?.reaction_type || null;
    } catch {
      return null;
    }
  };

  return { react, removeReaction, getReaction };
}

// ============================================================================
// useReactionCounts - Get reaction counts for a post
// ============================================================================

interface UseReactionCountsOptions {
  /** Enable real-time subscription for live updates. Default false to avoid per-post channel overhead in feeds. */
  enableRealtime?: boolean;
  /** Skip initial fetch (useful when initial data is already provided by parent). */
  skipInitialFetch?: boolean;
  /** Initial counts from parent data to avoid immediate N+1 fetches. */
  initialCounts?: ReactionCounts;
}

export function useReactionCounts(postId: string, options?: UseReactionCountsOptions) {
  const {
    enableRealtime = false,
    skipInitialFetch = false,
    initialCounts,
  } = options || {};

  const [counts, setCounts] = useState<ReactionCounts>(initialCounts || {
    admire: 0,
    snap: 0,
    ovation: 0,
    support: 0,
    inspired: 0,
    applaud: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(!skipInitialFetch);
  const mountedRef = useRef(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!postId) {
      setLoading(false);
      return;
    }

    if (!mountedRef.current) return;

    try {
      // Use server-side aggregation for efficiency
      const { data, error } = await supabase.rpc("get_reaction_counts", {
        p_post_id: postId,
      });

      if (!mountedRef.current) return;

      if (error) {
        // Fallback to client-side counting if RPC not available
        if (error.code === "42883" || error.message?.includes("does not exist")) {
          const { data: reactions, error: selectError } = await supabase
            .from("reactions")
            .select("reaction_type")
            .eq("post_id", postId);

          if (!mountedRef.current) return;

          if (selectError) {
            // Final fallback to admires table
            if (selectError.code === "42P01" || selectError.message?.includes("does not exist")) {
              const { count } = await supabase
                .from("admires")
                .select("*", { count: "exact", head: true })
                .eq("post_id", postId);

              if (!mountedRef.current) return;

              setCounts({
                admire: count || 0,
                snap: 0,
                ovation: 0,
                support: 0,
                inspired: 0,
                applaud: 0,
                total: count || 0,
              });
              return;
            }
            throw selectError;
          }

          // Client-side counting fallback
          const fallbackCounts: ReactionCounts = {
            admire: 0, snap: 0, ovation: 0, support: 0, inspired: 0, applaud: 0, total: 0,
          };
          reactions?.forEach((r) => {
            const type = r.reaction_type as ReactionType;
            if (type in fallbackCounts) {
              fallbackCounts[type]++;
              fallbackCounts.total++;
            }
          });
          setCounts(fallbackCounts);
          return;
        }
        throw error;
      }

      // Use aggregated data from RPC
      const row = data?.[0];
      setCounts({
        admire: Number(row?.admire_count) || 0,
        snap: Number(row?.snap_count) || 0,
        ovation: Number(row?.ovation_count) || 0,
        support: Number(row?.support_count) || 0,
        inspired: Number(row?.inspired_count) || 0,
        applaud: Number(row?.applaud_count) || 0,
        total: Number(row?.total_count) || 0,
      });
    } catch (err) {
      console.warn("[useReactionCounts] Error:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [postId]);

  // Keep ref updated with latest fetchCounts
  const fetchCountsRef = useRef(fetchCounts);
  useEffect(() => {
    fetchCountsRef.current = fetchCounts;
  }, [fetchCounts]);

  // Keep local counts in sync if parent-provided initial counts change.
  useEffect(() => {
    if (!initialCounts) return;
    setCounts(initialCounts);
  }, [
    initialCounts,
    initialCounts?.admire,
    initialCounts?.snap,
    initialCounts?.ovation,
    initialCounts?.support,
    initialCounts?.inspired,
    initialCounts?.applaud,
    initialCounts?.total,
  ]);

  // Initial fetch
  useEffect(() => {
    if (!postId || skipInitialFetch) {
      setLoading(false);
      return;
    }
    fetchCounts();
  }, [postId, fetchCounts, skipInitialFetch]);

  // Real-time subscription - only depends on postId to prevent recreation
  // PERFORMANCE: Only create subscription when enableRealtime is true (e.g., in post detail modal)
  useEffect(() => {
    mountedRef.current = true;

    // Always clean up previous channel first, regardless of early return
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!postId) {
      return () => {
        mountedRef.current = false;
      };
    }

    // Skip subscription unless explicitly enabled (default off to avoid per-post channel overhead)
    if (!enableRealtime) {
      return () => {
        mountedRef.current = false;
      };
    }

    const channel = supabase
      .channel(`reactions:${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reactions",
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchCountsRef.current();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [postId, enableRealtime]);

  return { counts, loading, refetch: fetchCounts };
}

// ============================================================================
// useUserReaction - Get user's reaction for a post with real-time updates
// ============================================================================

interface UseUserReactionOptions {
  /** Enable real-time subscription for live updates. Default false to avoid per-post channel overhead in feeds. */
  enableRealtime?: boolean;
  /** Skip initial fetch (useful when parent already provides current reaction). */
  skipInitialFetch?: boolean;
  /** Initial reaction from parent-provided data. */
  initialReaction?: ReactionType | null;
}

export function useUserReaction(postId: string, userId?: string, options?: UseUserReactionOptions) {
  const {
    enableRealtime = false,
    skipInitialFetch = false,
    initialReaction = null,
  } = options || {};

  const [reaction, setReaction] = useState<ReactionType | null>(initialReaction);
  const [loading, setLoading] = useState(!skipInitialFetch && !!userId);
  const mountedRef = useRef(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchReaction = useCallback(async () => {
    if (!postId || !userId) {
      setLoading(false);
      return;
    }

    if (!mountedRef.current) return;

    try {
      const { data, error } = await supabase
        .from("reactions")
        .select("reaction_type")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          const { data: admireData } = await supabase
            .from("admires")
            .select("post_id")
            .eq("post_id", postId)
            .eq("user_id", userId)
            .maybeSingle();

          if (!mountedRef.current) return;

          setReaction(admireData ? "admire" : null);
          return;
        }
        throw error;
      }

      setReaction(data?.reaction_type || null);
    } catch (err) {
      console.warn("[useUserReaction] Error:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [postId, userId]);

  // Keep local reaction in sync if parent-provided initial value changes.
  useEffect(() => {
    setReaction(initialReaction);
  }, [initialReaction]);

  // Initial fetch
  useEffect(() => {
    if (!postId || skipInitialFetch) {
      setLoading(false);
      return;
    }
    fetchReaction();
  }, [postId, fetchReaction, skipInitialFetch]);

  // Real-time subscription - only depends on postId and userId to prevent recreation
  // PERFORMANCE: Only create subscription when enableRealtime is true (e.g., in post detail modal)
  useEffect(() => {
    mountedRef.current = true;

    if (!postId || !userId) return;

    // Skip subscription unless explicitly enabled (default off to avoid per-post channel overhead)
    if (!enableRealtime) {
      return () => {
        mountedRef.current = false;
      };
    }

    // Clean up previous channel if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`user_reaction:${postId}:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reactions",
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          if (!mountedRef.current) return;

          if (payload.eventType === "DELETE") {
            const old = payload.old as { user_id?: string };
            if (old.user_id === userId) {
              setReaction(null);
            }
          } else if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const newData = payload.new as { user_id?: string; reaction_type?: string };
            if (newData.user_id === userId) {
              setReaction(newData.reaction_type as ReactionType);
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [postId, userId, enableRealtime]);

  return { reaction, loading, setReaction, refetch: fetchReaction };
}

// ============================================================================
// useBlock - Block/unblock functionality
// ============================================================================

export function useBlock() {
  const checkIsBlocked = async (blockerId: string, blockedId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("blocks")
        .select("id")
        .eq("blocker_id", blockerId)
        .eq("blocked_id", blockedId)
        .maybeSingle();

      if (error) {
        console.error("[useBlock.checkIsBlocked] Error:", error.message);
        return false; // Fail safe - assume not blocked on error
      }
      return !!data;
    } catch (err) {
      console.error("[useBlock.checkIsBlocked] Unexpected error:", err);
      return false;
    }
  };

  const checkIsBlockedEitherWay = async (userId1: string, userId2: string): Promise<boolean> => {
    try {
      // Check both directions separately to avoid SQL injection from string interpolation
      const [result1, result2] = await Promise.all([
        supabase
          .from("blocks")
          .select("id")
          .eq("blocker_id", userId1)
          .eq("blocked_id", userId2)
          .maybeSingle(),
        supabase
          .from("blocks")
          .select("id")
          .eq("blocker_id", userId2)
          .eq("blocked_id", userId1)
          .maybeSingle(),
      ]);

      if (result1.error || result2.error) {
        console.error("[useBlock.checkIsBlockedEitherWay] Error:", result1.error?.message || result2.error?.message);
        return false; // Fail safe - assume not blocked on error
      }

      return !!(result1.data || result2.data);
    } catch (err) {
      console.error("[useBlock.checkIsBlockedEitherWay] Unexpected error:", err);
      return false;
    }
  };

  const blockUser = async (blockerId: string, blockedId: string) => {
    try {
      // Insert the block record
      const { error: blockError } = await supabase.from("blocks").insert({
        blocker_id: blockerId,
        blocked_id: blockedId,
      });

      if (blockError) {
        console.error("Failed to block user:", blockError);
        return { success: false, error: blockError };
      }

      // Remove mutual follows - retry once if failed
      const removeFollows = async (attempt: number = 1): Promise<{ success: boolean; errors: string[] }> => {
        const errors: string[] = [];
        const [followRemove1, followRemove2] = await Promise.all([
          supabase.from("follows").delete().eq("follower_id", blockerId).eq("following_id", blockedId),
          supabase.from("follows").delete().eq("follower_id", blockedId).eq("following_id", blockerId),
        ]);

        if (followRemove1.error) {
          errors.push(`blocker->blocked: ${followRemove1.error.message}`);
        }
        if (followRemove2.error) {
          errors.push(`blocked->blocker: ${followRemove2.error.message}`);
        }

        // Retry once if there were errors
        if (errors.length > 0 && attempt === 1) {
          console.warn("Follow removal failed, retrying:", errors);
          return removeFollows(2);
        }

        return { success: errors.length === 0, errors };
      };

      const followResult = await removeFollows();
      if (!followResult.success) {
        console.warn("Failed to remove follows after retry:", followResult.errors);
        // Still return success for block - follows can be cleaned up later
        // But include warning in result
      }

      return { success: true, followsRemoved: followResult.success };
    } catch (err) {
      console.error("Unexpected error in blockUser:", err);
      return { success: false, error: err };
    }
  };

  const unblockUser = async (blockerId: string, blockedId: string) => {
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", blockerId)
      .eq("blocked_id", blockedId);

    if (error) {
      console.error("Failed to unblock user:", error);
      return { success: false, error };
    }

    return { success: true };
  };

  const getBlockedUsers = async (userId: string) => {
    const { data, error } = await supabase
      .from("blocks")
      .select(
        `
        blocked_id,
        blocked:profiles!blocks_blocked_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .eq("blocker_id", userId);

    if (error) {
      console.error("Failed to get blocked users:", error);
      return [];
    }

    return data?.map((d) => d.blocked) || [];
  };

  return { checkIsBlocked, checkIsBlockedEitherWay, blockUser, unblockUser, getBlockedUsers };
}
