"use client";

// Reactions moved to lib/engagement (Phase 1, docs/engagement/02-plan.md).
import { supabase } from "../supabase";

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

  // One RPC does the whole cleanup (block row, follows both ways, their
  // engagement on my content and mine on theirs, pending notifications).
  const blockUser = async (blockerId: string, blockedId: string) => {
    try {
      const { error: blockError } = await supabase.rpc("block_user", { p_blocked: blockedId });
      if (blockError) {
        console.error("Failed to block user:", blockError);
        return { success: false, error: blockError };
      }
      return { success: true, followsRemoved: true };
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
