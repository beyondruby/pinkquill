/**
 * Shared query helpers for Supabase
 * Centralizes common query patterns to reduce code duplication
 */

import { supabase } from "./supabase";
import type { ReactionType } from "./types";

// ============================================================================
// USER INTERACTIONS - Batch fetch user's interactions with posts
// ============================================================================

export interface UserInteractions {
  admires: Set<string>;
  saves: Set<string>;
  relays: Set<string>;
  reactions: Map<string, ReactionType>;
}

/**
 * Batch fetch user's interactions (admires, saves, relays, reactions) for a list of posts
 * Returns Sets/Maps for easy O(1) lookups
 */
export async function fetchUserInteractions(
  userId: string,
  postIds: string[]
): Promise<UserInteractions> {
  if (!userId || postIds.length === 0) {
    return {
      admires: new Set(),
      saves: new Set(),
      relays: new Set(),
      reactions: new Map(),
    };
  }

  const [admiresResult, savesResult, relaysResult, reactionsResult] = await Promise.all([
    supabase.from("admires").select("post_id").eq("user_id", userId).in("post_id", postIds),
    supabase.from("saves").select("post_id").eq("user_id", userId).in("post_id", postIds),
    supabase.from("relays").select("post_id").eq("user_id", userId).in("post_id", postIds),
    supabase.from("reactions").select("post_id, reaction_type").eq("user_id", userId).in("post_id", postIds),
  ]);

  const admires = new Set((admiresResult.data || []).map((a) => a.post_id));
  const saves = new Set((savesResult.data || []).map((s) => s.post_id));
  const relays = new Set((relaysResult.data || []).map((r) => r.post_id));
  const reactions = new Map<string, ReactionType>();

  (reactionsResult.data || []).forEach((r) => {
    reactions.set(r.post_id, r.reaction_type as ReactionType);
  });

  return { admires, saves, relays, reactions };
}

// ============================================================================
// POST METADATA - Batch fetch collaborators, mentions, and hashtags
// ============================================================================

export interface PostCollaboratorData {
  status: string;
  role: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface PostMentionData {
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface PostMetadataResult {
  collaboratorsByPost: Map<string, PostCollaboratorData[]>;
  mentionsByPost: Map<string, PostMentionData[]>;
  hashtagsByPost: Map<string, string[]>;
}

/**
 * Batch fetch collaborators, mentions, and hashtags for a list of posts
 */
export async function fetchPostMetadata(postIds: string[]): Promise<PostMetadataResult> {
  if (postIds.length === 0) {
    return {
      collaboratorsByPost: new Map(),
      mentionsByPost: new Map(),
      hashtagsByPost: new Map(),
    };
  }

  const [collaboratorsResult, mentionsResult, tagsResult] = await Promise.all([
    supabase
      .from("post_collaborators")
      .select(`
        post_id,
        status,
        role,
        user:profiles!post_collaborators_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .in("post_id", postIds)
      .eq("status", "accepted"),
    supabase
      .from("post_mentions")
      .select(`
        post_id,
        user:profiles!post_mentions_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .in("post_id", postIds),
    supabase
      .from("post_tags")
      .select(`
        post_id,
        tag:tags(name)
      `)
      .in("post_id", postIds),
  ]);

  const collaboratorsByPost = new Map<string, PostCollaboratorData[]>();
  const mentionsByPost = new Map<string, PostMentionData[]>();
  const hashtagsByPost = new Map<string, string[]>();

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

  // Process hashtags
  (tagsResult.data || []).forEach((t: any) => {
    const tagName = t.tag?.name;
    if (tagName) {
      if (!hashtagsByPost.has(t.post_id)) {
        hashtagsByPost.set(t.post_id, []);
      }
      hashtagsByPost.get(t.post_id)!.push(tagName);
    }
  });

  return { collaboratorsByPost, mentionsByPost, hashtagsByPost };
}

// ============================================================================
// BLOCK CHECKING - Check if users have blocked each other
// ============================================================================

/**
 * Check if either user has blocked the other (bilateral check)
 * Returns true if there's a block in either direction
 */
export async function checkBilateralBlock(userId1: string, userId2: string): Promise<boolean> {
  if (!userId1 || !userId2 || userId1 === userId2) {
    return false;
  }

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
}

/**
 * Get all users blocked by a user and users who blocked that user
 */
export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  if (!userId) {
    return new Set();
  }

  const [blockedByResult, iBlockedResult] = await Promise.all([
    supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
  ]);

  const blockedUserIds = new Set<string>();
  (blockedByResult.data || []).forEach((b) => blockedUserIds.add(b.blocker_id));
  (iBlockedResult.data || []).forEach((b) => blockedUserIds.add(b.blocked_id));

  return blockedUserIds;
}

// ============================================================================
// FOLLOW COUNTS - Fetch follower/following counts
// ============================================================================

export interface FollowCounts {
  followers: number;
  following: number;
}

/**
 * Fetch follower and following counts for a user
 */
export async function fetchFollowCounts(userId: string): Promise<FollowCounts> {
  if (!userId) {
    return { followers: 0, following: 0 };
  }

  const [followersResult, followingResult] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId)
      .eq("status", "accepted"),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId)
      .eq("status", "accepted"),
  ]);

  return {
    followers: followersResult.count || 0,
    following: followingResult.count || 0,
  };
}
