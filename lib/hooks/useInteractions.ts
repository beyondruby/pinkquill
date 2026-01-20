"use client";

import { useState, useEffect, useCallback } from "react";
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

export function useReactionCounts(postId: string) {
  const [counts, setCounts] = useState<ReactionCounts>({
    admire: 0,
    snap: 0,
    ovation: 0,
    support: 0,
    inspired: 0,
    applaud: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    try {
      // Try reactions table first
      const { data, error } = await supabase
        .from("reactions")
        .select("reaction_type")
        .eq("post_id", postId);

      if (error) {
        // Fallback to admires table
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          const { count } = await supabase
            .from("admires")
            .select("*", { count: "exact", head: true })
            .eq("post_id", postId);

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
        throw error;
      }

      const newCounts: ReactionCounts = {
        admire: 0,
        snap: 0,
        ovation: 0,
        support: 0,
        inspired: 0,
        applaud: 0,
        total: 0,
      };

      if (data) {
        data.forEach((r) => {
          const type = r.reaction_type as ReactionType;
          if (type in newCounts) {
            newCounts[type]++;
            newCounts.total++;
          }
        });
      }

      setCounts(newCounts);
    } catch (err) {
      console.warn("[useReactionCounts] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchCounts();

    // Real-time subscription
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
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, fetchCounts]);

  return { counts, loading, refetch: fetchCounts };
}

// ============================================================================
// useUserReaction - Get user's reaction for a post with real-time updates
// ============================================================================

export function useUserReaction(postId: string, userId?: string) {
  const [reaction, setReaction] = useState<ReactionType | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReaction = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

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

          setReaction(admireData ? "admire" : null);
          return;
        }
        throw error;
      }

      setReaction(data?.reaction_type || null);
    } catch (err) {
      console.warn("[useUserReaction] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [postId, userId]);

  useEffect(() => {
    fetchReaction();

    if (!userId) return;

    // Real-time subscription
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, userId, fetchReaction]);

  return { reaction, loading, setReaction, refetch: fetchReaction };
}

// ============================================================================
// useBlock - Block/unblock functionality
// ============================================================================

export function useBlock() {
  const checkIsBlocked = async (blockerId: string, blockedId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("blocks")
      .select("id")
      .eq("blocker_id", blockerId)
      .eq("blocked_id", blockedId)
      .maybeSingle();
    return !!data;
  };

  const checkIsBlockedEitherWay = async (userId1: string, userId2: string): Promise<boolean> => {
    // Check both directions separately to avoid SQL injection from string interpolation
    const [{ data: block1 }, { data: block2 }] = await Promise.all([
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
    return !!(block1 || block2);
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

      // Remove mutual follows - handle errors gracefully
      const [followRemove1, followRemove2] = await Promise.all([
        supabase.from("follows").delete().eq("follower_id", blockerId).eq("following_id", blockedId),
        supabase.from("follows").delete().eq("follower_id", blockedId).eq("following_id", blockerId),
      ]);

      // Log errors but don't fail the block operation - the block is the primary action
      if (followRemove1.error) {
        console.error("Failed to remove follow (blocker->blocked):", followRemove1.error);
      }
      if (followRemove2.error) {
        console.error("Failed to remove follow (blocked->blocker):", followRemove2.error);
      }

      return { success: true };
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
