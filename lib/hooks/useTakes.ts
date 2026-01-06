"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";

// ============================================================================
// TYPES
// ============================================================================

export type TakeReactionType = 'admire' | 'snap' | 'ovation' | 'support' | 'inspired' | 'applaud';

export interface TakeReactionCounts {
  admire: number;
  snap: number;
  ovation: number;
  support: number;
  inspired: number;
  applaud: number;
  total: number;
}

export interface Take {
  id: string;
  author_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  duration: number;
  visibility: string;
  content_warning: string | null;
  sound_id: string | null;
  view_count: number;
  community_id: string | null;
  created_at: string;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  admires_count: number;
  reactions_count: number;
  comments_count: number;
  saves_count: number;
  relays_count: number;
  is_admired: boolean;
  is_saved: boolean;
  is_relayed: boolean;
  user_reaction_type: TakeReactionType | null;
}

export interface TakeComment {
  id: string;
  take_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  likes_count: number;
  is_liked: boolean;
  replies?: TakeComment[];
}

// ============================================================================
// MAIN FEED HOOK
// ============================================================================

interface UseTakesOptions {
  limit?: number;
  communityId?: string;
  soundId?: string;
  authorId?: string;
}

export function useTakes(userId?: string, options: UseTakesOptions = {}) {
  const { limit = 10, communityId, soundId, authorId } = options;

  const [takes, setTakes] = useState<Take[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const offsetRef = useRef(0);
  const fetchedRef = useRef(false);
  const takesRef = useRef<Take[]>(takes);

  // Keep ref in sync with state
  useEffect(() => {
    takesRef.current = takes;
  }, [takes]);

  const fetchTakes = useCallback(async (reset = true) => {
    try {
      if (reset) {
        setLoading(true);
        offsetRef.current = 0;
      }
      setError(null);

      // Build query
      let query = supabase
        .from("takes")
        .select("*")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .range(offsetRef.current, offsetRef.current + limit - 1);

      if (communityId) query = query.eq("community_id", communityId);
      if (soundId) query = query.eq("sound_id", soundId);
      if (authorId) query = query.eq("author_id", authorId);

      const { data: takesData, error: takesError } = await query;

      if (takesError) throw takesError;
      if (!takesData || takesData.length === 0) {
        if (reset) setTakes([]);
        setHasMore(false);
        return;
      }

      // Get unique author IDs and take IDs
      const authorIds = [...new Set(takesData.map(t => t.author_id))];
      const takeIds = takesData.map(t => t.id);

      // Fetch private accounts for filtering
      const { data: privateAccounts } = await supabase
        .from("profiles")
        .select("id")
        .eq("is_private", true)
        .in("id", authorIds);

      // Fetch user's follows with fallback if status column doesn't exist
      let userFollows: { following_id: string }[] = [];
      if (userId) {
        const { data, error } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId)
          .eq("status", "accepted");

        if (error && (error.code === "42703" || error.message?.includes("status"))) {
          // Status column doesn't exist - fall back to simple query
          const { data: fallbackData } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", userId);
          userFollows = fallbackData || [];
        } else {
          userFollows = data || [];
        }
      }

      const privateAccountIds = new Set((privateAccounts || []).map(p => p.id));
      const followingIds = new Set(userFollows.map(f => f.following_id));

      // Filter out takes from private accounts that the user doesn't follow
      const accessibleTakes = takesData.filter(take => {
        const isOwnTake = userId && take.author_id === userId;
        const isPrivateAccount = privateAccountIds.has(take.author_id);
        const isFollowing = followingIds.has(take.author_id);

        // User can always see their own takes
        if (isOwnTake) return true;

        // If author has private account, must be following
        if (isPrivateAccount && !isFollowing) return false;

        return true;
      });

      // If no accessible takes, return early
      if (accessibleTakes.length === 0) {
        if (reset) setTakes([]);
        setHasMore(takesData.length === limit); // There might be more takes we can't access
        return;
      }

      // Re-calculate IDs based on accessible takes
      const accessibleAuthorIds = [...new Set(accessibleTakes.map(t => t.author_id))];
      const accessibleTakeIds = accessibleTakes.map(t => t.id);

      // Parallel fetch: authors, counts, user interactions
      // Try reactions table first, fall back to admires
      const [
        { data: authors },
        { data: reactions, error: reactionsError },
        { data: comments },
        { data: saves },
        { data: relays },
        { data: userReaction },
        { data: userSaves },
        { data: userRelays },
      ] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", accessibleAuthorIds),
        supabase.from("take_reactions").select("take_id, reaction_type").in("take_id", accessibleTakeIds),
        supabase.from("take_comments").select("take_id").in("take_id", accessibleTakeIds),
        supabase.from("take_saves").select("take_id").in("take_id", accessibleTakeIds),
        supabase.from("take_relays").select("take_id").in("take_id", accessibleTakeIds),
        userId
          ? supabase.from("take_reactions").select("take_id, reaction_type").eq("user_id", userId).in("take_id", accessibleTakeIds)
          : Promise.resolve({ data: [] as { take_id: string; reaction_type: string }[] }),
        userId
          ? supabase.from("take_saves").select("take_id").eq("user_id", userId).in("take_id", accessibleTakeIds)
          : Promise.resolve({ data: [] as { take_id: string }[] }),
        userId
          ? supabase.from("take_relays").select("take_id").eq("user_id", userId).in("take_id", accessibleTakeIds)
          : Promise.resolve({ data: [] as { take_id: string }[] }),
      ]);

      // Fall back to admires table if reactions table doesn't exist
      let reactionsData = reactions;
      let userReactionsData = userReaction;
      const useAdmiresFallback = reactionsError && (reactionsError.code === '42P01' || reactionsError.message?.includes('does not exist'));

      if (useAdmiresFallback) {
        const [{ data: admires }, { data: userAdmires }] = await Promise.all([
          supabase.from("take_admires").select("take_id").in("take_id", accessibleTakeIds),
          userId
            ? supabase.from("take_admires").select("take_id").eq("user_id", userId).in("take_id", accessibleTakeIds)
            : Promise.resolve({ data: [] }),
        ]);
        // Convert to reaction format
        reactionsData = (admires || []).map(a => ({ take_id: a.take_id, reaction_type: 'admire' }));
        userReactionsData = (userAdmires || []).map(a => ({ take_id: a.take_id, reaction_type: 'admire' }));
      }

      // Build lookup maps
      const authorMap = new Map((authors || []).map(a => [a.id, a]));

      const reactionsCount: Record<string, number> = {};
      const commentsCount: Record<string, number> = {};
      const savesCount: Record<string, number> = {};
      const relaysCount: Record<string, number> = {};

      (reactionsData || []).forEach(r => { reactionsCount[r.take_id] = (reactionsCount[r.take_id] || 0) + 1; });
      (comments || []).forEach(c => { commentsCount[c.take_id] = (commentsCount[c.take_id] || 0) + 1; });
      (saves || []).forEach(s => { savesCount[s.take_id] = (savesCount[s.take_id] || 0) + 1; });
      (relays || []).forEach(r => { relaysCount[r.take_id] = (relaysCount[r.take_id] || 0) + 1; });

      // Build user reaction map
      const userReactionMap = new Map<string, TakeReactionType>();
      (userReactionsData || []).forEach(r => {
        userReactionMap.set(r.take_id, r.reaction_type as TakeReactionType);
      });
      const userSaveSet = new Set((userSaves || []).map(s => s.take_id));
      const userRelaySet = new Set((userRelays || []).map(r => r.take_id));

      // Build final takes array
      const processedTakes: Take[] = accessibleTakes.map(take => ({
        ...take,
        author: authorMap.get(take.author_id) || { username: "unknown", display_name: null, avatar_url: null },
        admires_count: reactionsCount[take.id] || 0,
        reactions_count: reactionsCount[take.id] || 0,
        comments_count: commentsCount[take.id] || 0,
        saves_count: savesCount[take.id] || 0,
        relays_count: relaysCount[take.id] || 0,
        is_admired: userReactionMap.has(take.id),
        is_saved: userSaveSet.has(take.id),
        is_relayed: userRelaySet.has(take.id),
        user_reaction_type: userReactionMap.get(take.id) || null,
      }));

      if (reset) {
        setTakes(processedTakes);
      } else {
        setTakes(prev => [...prev, ...processedTakes]);
      }

      setHasMore(takesData.length === limit);
      offsetRef.current += takesData.length;
    } catch (err) {
      console.error("[useTakes] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to load takes");
    } finally {
      setLoading(false);
    }
  }, [limit, communityId, soundId, authorId, userId]);

  const fetchMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchTakes(false);
    }
  }, [fetchTakes, loading, hasMore]);

  // Initial fetch
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchTakes();
    }
  }, [fetchTakes]);

  // Toggle reaction (full reaction system)
  const toggleReaction = useCallback(async (takeId: string, reactionType: TakeReactionType) => {
    if (!userId) return;

    const take = takesRef.current.find(t => t.id === takeId);
    if (!take) return;

    const currentReaction = take.user_reaction_type;
    const isSameReaction = currentReaction === reactionType;

    // Optimistic update
    setTakes(prev => prev.map(t => {
      if (t.id !== takeId) return t;

      if (isSameReaction) {
        // Removing reaction
        return {
          ...t,
          is_admired: false,
          user_reaction_type: null,
          admires_count: Math.max(0, t.admires_count - 1),
          reactions_count: Math.max(0, t.reactions_count - 1),
        };
      } else if (currentReaction) {
        // Changing reaction (count stays same)
        return {
          ...t,
          user_reaction_type: reactionType,
        };
      } else {
        // Adding new reaction
        return {
          ...t,
          is_admired: true,
          user_reaction_type: reactionType,
          admires_count: t.admires_count + 1,
          reactions_count: t.reactions_count + 1,
        };
      }
    }));

    try {
      // Try take_reactions table first
      if (isSameReaction) {
        // Remove reaction
        const { error } = await supabase.from("take_reactions").delete()
          .eq("take_id", takeId).eq("user_id", userId);

        if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
          // Fall back to take_admires
          await supabase.from("take_admires").delete().eq("take_id", takeId).eq("user_id", userId);
        }
      } else if (currentReaction) {
        // Update existing reaction
        const { error } = await supabase.from("take_reactions")
          .update({ reaction_type: reactionType })
          .eq("take_id", takeId).eq("user_id", userId);

        if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
          // take_admires doesn't support different reactions, just keep it
        }
      } else {
        // Insert new reaction
        const { error } = await supabase.from("take_reactions").insert({
          take_id: takeId,
          user_id: userId,
          reaction_type: reactionType,
        });

        if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
          // Fall back to take_admires (only 'admire' type)
          if (reactionType === 'admire') {
            await supabase.from("take_admires").insert({ take_id: takeId, user_id: userId });
          }
        }
      }
    } catch (err) {
      // Revert on error
      setTakes(prev => prev.map(t =>
        t.id === takeId
          ? {
              ...t,
              is_admired: take.is_admired,
              user_reaction_type: take.user_reaction_type,
              admires_count: take.admires_count,
              reactions_count: take.reactions_count,
            }
          : t
      ));
    }
  }, [userId]);

  // Simple toggle admire (for backward compatibility / double-tap)
  const toggleAdmire = useCallback(async (takeId: string) => {
    const take = takesRef.current.find(t => t.id === takeId);
    if (!take) return;

    // If already has any reaction, remove it; otherwise add admire
    if (take.user_reaction_type) {
      await toggleReaction(takeId, take.user_reaction_type);
    } else {
      await toggleReaction(takeId, 'admire');
    }
  }, [toggleReaction]);

  // Toggle save
  const toggleSave = useCallback(async (takeId: string) => {
    if (!userId) return;

    const take = takesRef.current.find(t => t.id === takeId);
    if (!take) return;

    // Optimistic update
    setTakes(prev => prev.map(t =>
      t.id === takeId
        ? { ...t, is_saved: !t.is_saved, saves_count: t.saves_count + (t.is_saved ? -1 : 1) }
        : t
    ));

    try {
      if (take.is_saved) {
        await supabase.from("take_saves").delete().eq("take_id", takeId).eq("user_id", userId);
      } else {
        await supabase.from("take_saves").insert({ take_id: takeId, user_id: userId });
      }
    } catch (err) {
      // Revert on error
      setTakes(prev => prev.map(t =>
        t.id === takeId
          ? { ...t, is_saved: take.is_saved, saves_count: take.saves_count }
          : t
      ));
    }
  }, [userId]);

  // Toggle relay (repost)
  const toggleRelay = useCallback(async (takeId: string) => {
    if (!userId) return;

    const take = takesRef.current.find(t => t.id === takeId);
    if (!take) return;

    // Can't relay your own take
    if (take.author_id === userId) return;

    // Optimistic update
    setTakes(prev => prev.map(t =>
      t.id === takeId
        ? { ...t, is_relayed: !t.is_relayed, relays_count: t.relays_count + (t.is_relayed ? -1 : 1) }
        : t
    ));

    try {
      if (take.is_relayed) {
        await supabase.from("take_relays").delete().eq("take_id", takeId).eq("user_id", userId);
      } else {
        await supabase.from("take_relays").insert({ take_id: takeId, user_id: userId });

        // Create notification for the take author (silent fail)
        if (take.author_id !== userId) {
          supabase.from("notifications").insert({
            user_id: take.author_id,
            actor_id: userId,
            type: "relay",
            take_id: takeId,
          });
        }
      }
    } catch (err) {
      // Revert on error
      setTakes(prev => prev.map(t =>
        t.id === takeId
          ? { ...t, is_relayed: take.is_relayed, relays_count: take.relays_count }
          : t
      ));
    }
  }, [userId]);

  // Delete take
  const deleteTake = useCallback(async (takeId: string) => {
    if (!userId) return;

    const take = takesRef.current.find(t => t.id === takeId);
    if (!take || take.author_id !== userId) return;

    // Optimistic update - remove from list
    setTakes(prev => prev.filter(t => t.id !== takeId));

    try {
      // Delete related data first
      await Promise.all([
        supabase.from("take_comments").delete().eq("take_id", takeId),
        supabase.from("take_saves").delete().eq("take_id", takeId),
        supabase.from("take_relays").delete().eq("take_id", takeId),
        supabase.from("take_reactions").delete().eq("take_id", takeId).then(({ error }) => {
          if (error) return supabase.from("take_admires").delete().eq("take_id", takeId);
        }),
        supabase.from("notifications").delete().eq("take_id", takeId),
      ]);

      // Delete the take
      const { error } = await supabase.from("takes").delete().eq("id", takeId);
      if (error) throw error;
    } catch (err) {
      console.error("[useTakes.deleteTake] Error:", err);
      // Revert - add back to list
      if (take) {
        setTakes(prev => [...prev, take].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
      throw err;
    }
  }, [userId]);

  // Report take
  const reportTake = useCallback(async (takeId: string, reason: string, details?: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: userId,
        reported_post_id: takeId,
        reason: reason,
        details: details || null,
        type: "take",
      });

      if (error) {
        // Fallback if the reports table has different columns
        if (error.message?.includes('details') || error.message?.includes('type')) {
          await supabase.from("reports").insert({
            reporter_id: userId,
            reported_post_id: takeId,
            reason: reason,
          });
        } else {
          throw error;
        }
      }
    } catch (err) {
      console.error("[useTakes.reportTake] Error:", err);
      throw err;
    }
  }, [userId]);

  return {
    takes,
    loading,
    error,
    hasMore,
    fetchMore,
    refetch: () => fetchTakes(true),
    toggleAdmire,
    toggleReaction,
    toggleSave,
    toggleRelay,
    deleteTake,
    reportTake,
  };
}

// ============================================================================
// REACTION COUNTS HOOK (for individual take)
// ============================================================================

export function useTakeReactionCounts(takeId: string) {
  const [counts, setCounts] = useState<TakeReactionCounts>({
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
      // Try take_reactions table first
      const { data, error } = await supabase
        .from("take_reactions")
        .select("reaction_type")
        .eq("take_id", takeId);

      if (error) {
        // Fall back to take_admires
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          const { count } = await supabase
            .from("take_admires")
            .select("*", { count: "exact", head: true })
            .eq("take_id", takeId);

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

      const newCounts: TakeReactionCounts = {
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
          const type = r.reaction_type as TakeReactionType;
          if (type in newCounts) {
            newCounts[type]++;
            newCounts.total++;
          }
        });
      }

      setCounts(newCounts);
    } catch (err) {
      console.warn("[useTakeReactionCounts] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [takeId]);

  useEffect(() => {
    if (takeId) fetchCounts();
  }, [takeId, fetchCounts]);

  return { counts, loading, refetch: fetchCounts };
}

// ============================================================================
// COMMENTS HOOK
// ============================================================================

export function useTakeComments(takeId: string, userId?: string) {
  const [comments, setComments] = useState<TakeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all comments including replies
      const { data: commentsData, error: commentsError } = await supabase
        .from("take_comments")
        .select("*")
        .eq("take_id", takeId)
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;
      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      const authorIds = [...new Set(commentsData.map(c => c.user_id))];
      const commentIds = commentsData.map(c => c.id);

      const [{ data: authors }, { data: likes }, { data: userLikes }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds),
        supabase.from("take_comment_likes").select("comment_id").in("comment_id", commentIds),
        userId
          ? supabase.from("take_comment_likes").select("comment_id").eq("user_id", userId).in("comment_id", commentIds)
          : Promise.resolve({ data: [] }),
      ]);

      const authorMap = new Map((authors || []).map(a => [a.id, a]));
      const likesCount: Record<string, number> = {};
      (likes || []).forEach(l => { likesCount[l.comment_id] = (likesCount[l.comment_id] || 0) + 1; });
      const userLikeSet = new Set((userLikes || []).map(l => l.comment_id));

      // Process all comments
      const allComments: TakeComment[] = commentsData.map(comment => ({
        ...comment,
        parent_id: comment.parent_id || null,
        author: authorMap.get(comment.user_id) || { username: "unknown", display_name: null, avatar_url: null },
        likes_count: likesCount[comment.id] || 0,
        is_liked: userLikeSet.has(comment.id),
        replies: [],
      }));

      // Build comment tree - nest replies under parent comments
      const commentMap = new Map<string, TakeComment>();
      allComments.forEach(c => commentMap.set(c.id, c));

      const topLevelComments: TakeComment[] = [];
      allComments.forEach(c => {
        if (c.parent_id && commentMap.has(c.parent_id)) {
          const parent = commentMap.get(c.parent_id)!;
          if (!parent.replies) parent.replies = [];
          parent.replies.push(c);
        } else if (!c.parent_id) {
          topLevelComments.push(c);
        }
      });

      // Sort top-level by newest first, replies by oldest first
      topLevelComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setComments(topLevelComments);
    } catch (err) {
      console.error("[useTakeComments] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [takeId, userId]);

  useEffect(() => {
    if (takeId) fetchComments();
  }, [takeId, fetchComments]);

  // Add comment (top-level or reply)
  const addComment = useCallback(async (content: string, parentId?: string) => {
    if (!userId || !content.trim()) return null;

    try {
      const { data: newComment, error } = await supabase
        .from("take_comments")
        .insert({
          take_id: takeId,
          user_id: userId,
          content: content.trim(),
          parent_id: parentId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Fetch author info for the new comment
      const { data: author } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", userId)
        .single();

      const processedComment: TakeComment = {
        ...newComment,
        parent_id: parentId || null,
        author: author || { username: "unknown", display_name: null, avatar_url: null },
        likes_count: 0,
        is_liked: false,
        replies: [],
      };

      // Update comments state
      if (parentId) {
        // Add as a reply
        setComments(prev => prev.map(c =>
          c.id === parentId
            ? { ...c, replies: [...(c.replies || []), processedComment] }
            : c
        ));
      } else {
        // Add as top-level comment
        setComments(prev => [processedComment, ...prev]);
      }

      return processedComment;
    } catch (err) {
      console.error("[useTakeComments.addComment] Error:", err);
      return null;
    }
  }, [takeId, userId]);

  // Toggle like on a comment (works for both top-level and replies)
  const toggleLike = useCallback(async (commentId: string) => {
    if (!userId) return;

    // Find comment in top-level or replies
    const findComment = (comments: TakeComment[]): TakeComment | null => {
      for (const c of comments) {
        if (c.id === commentId) return c;
        if (c.replies) {
          const found = findComment(c.replies);
          if (found) return found;
        }
      }
      return null;
    };

    const comment = findComment(comments);
    if (!comment) return;

    // Optimistic update for both top-level and nested
    const updateCommentLike = (comments: TakeComment[]): TakeComment[] =>
      comments.map(c => {
        if (c.id === commentId) {
          return { ...c, is_liked: !c.is_liked, likes_count: c.likes_count + (c.is_liked ? -1 : 1) };
        }
        if (c.replies) {
          return { ...c, replies: updateCommentLike(c.replies) };
        }
        return c;
      });

    setComments(prev => updateCommentLike(prev));

    try {
      if (comment.is_liked) {
        await supabase.from("take_comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
      } else {
        await supabase.from("take_comment_likes").insert({ comment_id: commentId, user_id: userId });
      }
    } catch (err) {
      // Revert
      setComments(prev => updateCommentLike(prev));
    }
  }, [userId, comments]);

  // Delete a comment
  const deleteComment = useCallback(async (commentId: string) => {
    if (!userId) return;

    // Store current state for potential revert
    const previousComments = [...comments];

    // Optimistic update - remove from top-level or replies
    const removeComment = (comments: TakeComment[]): TakeComment[] =>
      comments
        .filter(c => c.id !== commentId)
        .map(c => ({
          ...c,
          replies: c.replies ? removeComment(c.replies) : [],
        }));

    setComments(prev => removeComment(prev));

    try {
      await supabase.from("take_comments").delete().eq("id", commentId).eq("user_id", userId);
    } catch (err) {
      // Revert
      setComments(previousComments);
    }
  }, [userId, comments]);

  // Report a comment
  const reportComment = useCallback(async (commentId: string, reason: string) => {
    if (!userId) return false;

    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: userId,
        reported_comment_id: commentId,
        reason,
        type: 'take_comment',
        status: 'pending',
      });

      // If the column doesn't exist, try alternative
      if (error && error.message?.includes('reported_comment_id')) {
        await supabase.from("reports").insert({
          reporter_id: userId,
          reason: `Take Comment Report: ${commentId} - ${reason}`,
          type: 'take_comment',
          status: 'pending',
        });
      }

      return true;
    } catch (err) {
      console.error("[useTakeComments.reportComment] Error:", err);
      return false;
    }
  }, [userId]);

  return {
    comments,
    loading,
    error,
    addComment,
    toggleLike,
    deleteComment,
    reportComment,
    refetch: fetchComments,
  };
}

// ============================================================================
// MUTE STATE HOOK
// ============================================================================

const MUTE_KEY = "takes-muted";

export function useMuted() {
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(MUTE_KEY);
    if (stored === "false") setIsMuted(false);
  }, []);

  const toggle = useCallback(() => {
    setIsMuted(prev => {
      const newValue = !prev;
      localStorage.setItem(MUTE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  return { isMuted, toggle };
}

// ============================================================================
// VOLUME STATE HOOK
// ============================================================================

const VOLUME_KEY = "takes-volume";

export function useVolume() {
  const [volume, setVolumeState] = useState(0.8);

  useEffect(() => {
    const stored = localStorage.getItem(VOLUME_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        setVolumeState(parsed);
      }
    }
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    const clamped = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clamped);
    localStorage.setItem(VOLUME_KEY, String(clamped));
  }, []);

  return { volume, setVolume };
}

// ============================================================================
// FOLLOW HOOK
// ============================================================================

export function useFollow(userId?: string) {
  const [following, setFollowing] = useState<Set<string>>(new Set());

  const checkFollowing = useCallback(async (authorIds: string[]) => {
    if (!userId || authorIds.length === 0) return;

    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .in("following_id", authorIds);

    setFollowing(new Set((data || []).map(f => f.following_id)));
  }, [userId]);

  const toggle = useCallback(async (authorId: string) => {
    if (!userId) return;

    const isFollowing = following.has(authorId);

    // Optimistic update
    setFollowing(prev => {
      const next = new Set(prev);
      if (isFollowing) next.delete(authorId);
      else next.add(authorId);
      return next;
    });

    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", authorId);
      } else {
        await supabase.from("follows").insert({ follower_id: userId, following_id: authorId });
      }
    } catch (err) {
      // Revert
      setFollowing(prev => {
        const next = new Set(prev);
        if (isFollowing) next.add(authorId);
        else next.delete(authorId);
        return next;
      });
    }
  }, [userId, following]);

  return { following, checkFollowing, toggle };
}

// ============================================================================
// CREATE TAKE HOOK
// ============================================================================

interface CreateTakeOptions {
  videoFile: File;
  caption?: string;
  tags?: string[];
  contentWarning?: string;
  communityId?: string;
  soundId?: string;
  duration: number;
}

export function useCreateTake() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const createTake = useCallback(async (userId: string, options: CreateTakeOptions) => {
    try {
      setUploading(true);
      setProgress(0);
      setError(null);

      const { videoFile, caption, tags, contentWarning, communityId, soundId, duration } = options;

      // Upload video to storage
      const fileExt = videoFile.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      setProgress(10);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("takes")
        .upload(fileName, videoFile, {
          cacheControl: "31536000",
          upsert: false,
        });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      setProgress(60);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage.from("takes").getPublicUrl(uploadData.path);

      setProgress(70);

      // Create take record
      const { data: take, error: insertError } = await supabase
        .from("takes")
        .insert({
          author_id: userId,
          video_url: publicUrl,
          caption: caption || null,
          duration,
          content_warning: contentWarning || null,
          community_id: communityId || null,
          sound_id: soundId || null,
          visibility: "public",
        })
        .select()
        .single();

      if (insertError) throw new Error(`Failed to create take: ${insertError.message}`);

      setProgress(85);

      // Add tags if provided
      if (tags && tags.length > 0) {
        const tagInserts = tags.map(tag => ({
          take_id: take.id,
          tag: tag.toLowerCase(),
        }));

        await supabase.from("take_tags").insert(tagInserts);
      }

      setProgress(100);
      return take;
    } catch (err) {
      console.error("[useCreateTake] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to create take");
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { createTake, uploading, progress, error };
}

// ============================================================================
// USER TAKES HOOK - Fetch takes by a specific user
// ============================================================================

export function useUserTakes(username: string, viewerId?: string) {
  const [takes, setTakes] = useState<Take[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserTakes = async () => {
      try {
        setLoading(true);
        setError(null);

        // First get the user's profile id
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("username", username)
          .single();

        if (!profileData) {
          setTakes([]);
          return;
        }

        // Check visibility permissions
        const isOwnProfile = viewerId && viewerId === profileData.id;
        let viewerFollowsProfile = false;

        if (viewerId && !isOwnProfile) {
          const { data: followCheck } = await supabase
            .from("follows")
            .select("id")
            .eq("follower_id", viewerId)
            .eq("following_id", profileData.id)
            .maybeSingle();
          viewerFollowsProfile = !!followCheck;
        }

        // Build query with visibility filter
        let takesQuery = supabase
          .from("takes")
          .select("*")
          .eq("author_id", profileData.id)
          .order("created_at", { ascending: false });

        // Apply visibility filter based on relationship
        if (!isOwnProfile) {
          if (viewerFollowsProfile) {
            takesQuery = takesQuery.in("visibility", ["public", "followers"]);
          } else {
            takesQuery = takesQuery.eq("visibility", "public");
          }
        }
        // If isOwnProfile, no filter applied - owner sees all takes

        // Fetch takes by this user
        const { data: takesData, error: takesError } = await takesQuery;

        if (takesError) throw takesError;
        if (!takesData || takesData.length === 0) {
          setTakes([]);
          return;
        }

        const takeIds = takesData.map(t => t.id);

        // Fetch counts
        const [
          { data: reactions },
          { data: comments },
          { data: saves },
          { data: relays },
          { data: userReaction },
          { data: userSaves },
          { data: userRelays },
        ] = await Promise.all([
          supabase.from("take_reactions").select("take_id, reaction_type").in("take_id", takeIds),
          supabase.from("take_comments").select("take_id").in("take_id", takeIds),
          supabase.from("take_saves").select("take_id").in("take_id", takeIds),
          supabase.from("take_relays").select("take_id").in("take_id", takeIds),
          viewerId
            ? supabase.from("take_reactions").select("take_id, reaction_type").eq("user_id", viewerId).in("take_id", takeIds)
            : Promise.resolve({ data: [] as { take_id: string; reaction_type: string }[] }),
          viewerId
            ? supabase.from("take_saves").select("take_id").eq("user_id", viewerId).in("take_id", takeIds)
            : Promise.resolve({ data: [] as { take_id: string }[] }),
          viewerId
            ? supabase.from("take_relays").select("take_id").eq("user_id", viewerId).in("take_id", takeIds)
            : Promise.resolve({ data: [] as { take_id: string }[] }),
        ]);

        // Build counts
        const reactionsCount: Record<string, number> = {};
        const commentsCount: Record<string, number> = {};
        const savesCount: Record<string, number> = {};
        const relaysCount: Record<string, number> = {};

        (reactions || []).forEach(r => { reactionsCount[r.take_id] = (reactionsCount[r.take_id] || 0) + 1; });
        (comments || []).forEach(c => { commentsCount[c.take_id] = (commentsCount[c.take_id] || 0) + 1; });
        (saves || []).forEach(s => { savesCount[s.take_id] = (savesCount[s.take_id] || 0) + 1; });
        (relays || []).forEach(r => { relaysCount[r.take_id] = (relaysCount[r.take_id] || 0) + 1; });

        const userReactionMap = new Map<string, TakeReactionType>();
        (userReaction || []).forEach(r => {
          userReactionMap.set(r.take_id, r.reaction_type as TakeReactionType);
        });
        const userSaveSet = new Set((userSaves || []).map(s => s.take_id));
        const userRelaySet = new Set((userRelays || []).map(r => r.take_id));

        const processedTakes: Take[] = takesData.map(take => ({
          ...take,
          author: {
            username: profileData.username,
            display_name: profileData.display_name,
            avatar_url: profileData.avatar_url,
          },
          admires_count: reactionsCount[take.id] || 0,
          reactions_count: reactionsCount[take.id] || 0,
          comments_count: commentsCount[take.id] || 0,
          saves_count: savesCount[take.id] || 0,
          relays_count: relaysCount[take.id] || 0,
          is_admired: userReactionMap.has(take.id),
          is_saved: userSaveSet.has(take.id),
          is_relayed: userRelaySet.has(take.id),
          user_reaction_type: userReactionMap.get(take.id) || null,
        }));

        setTakes(processedTakes);
      } catch (err) {
        console.error("[useUserTakes] Error:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch takes");
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchUserTakes();
    }
  }, [username, viewerId]);

  return { takes, loading, error };
}

// ============================================================================
// RELAYED TAKES HOOK - Fetch takes relayed by a user
// ============================================================================

export interface RelayedTake extends Take {
  relayed_at: string;
}

export function useRelayedTakes(username: string, viewerId?: string) {
  const [takes, setTakes] = useState<RelayedTake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRelayedTakes = async () => {
      try {
        setLoading(true);
        setError(null);

        // First get the user's profile id
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username)
          .single();

        if (!profileData) {
          setTakes([]);
          return;
        }

        // Fetch relays with take info
        const { data: relaysData, error: relaysError } = await supabase
          .from("take_relays")
          .select("take_id, created_at")
          .eq("user_id", profileData.id)
          .order("created_at", { ascending: false });

        if (relaysError) throw relaysError;
        if (!relaysData || relaysData.length === 0) {
          setTakes([]);
          return;
        }

        const takeIds = relaysData.map(r => r.take_id);

        // Fetch the actual takes
        const { data: takesData } = await supabase
          .from("takes")
          .select("*")
          .in("id", takeIds)
          .eq("visibility", "public");

        if (!takesData || takesData.length === 0) {
          setTakes([]);
          return;
        }

        // Get author info
        const authorIds = [...new Set(takesData.map(t => t.author_id))];
        const { data: authors } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", authorIds);

        const authorMap = new Map((authors || []).map(a => [a.id, a]));

        // Fetch counts
        const [
          { data: reactions },
          { data: comments },
          { data: saves },
          { data: relays },
        ] = await Promise.all([
          supabase.from("take_reactions").select("take_id").in("take_id", takeIds),
          supabase.from("take_comments").select("take_id").in("take_id", takeIds),
          supabase.from("take_saves").select("take_id").in("take_id", takeIds),
          supabase.from("take_relays").select("take_id").in("take_id", takeIds),
        ]);

        const reactionsCount: Record<string, number> = {};
        const commentsCount: Record<string, number> = {};
        const savesCount: Record<string, number> = {};
        const relaysCount: Record<string, number> = {};

        (reactions || []).forEach(r => { reactionsCount[r.take_id] = (reactionsCount[r.take_id] || 0) + 1; });
        (comments || []).forEach(c => { commentsCount[c.take_id] = (commentsCount[c.take_id] || 0) + 1; });
        (saves || []).forEach(s => { savesCount[s.take_id] = (savesCount[s.take_id] || 0) + 1; });
        (relays || []).forEach(r => { relaysCount[r.take_id] = (relaysCount[r.take_id] || 0) + 1; });

        // Map relay created_at by take_id
        const relayTimeMap = new Map(relaysData.map(r => [r.take_id, r.created_at]));

        const processedTakes: RelayedTake[] = takesData.map(take => {
          const author = authorMap.get(take.author_id);
          return {
            ...take,
            author: author || { username: "unknown", display_name: null, avatar_url: null },
            admires_count: reactionsCount[take.id] || 0,
            reactions_count: reactionsCount[take.id] || 0,
            comments_count: commentsCount[take.id] || 0,
            saves_count: savesCount[take.id] || 0,
            relays_count: relaysCount[take.id] || 0,
            is_admired: false,
            is_saved: false,
            is_relayed: true,
            user_reaction_type: null,
            relayed_at: relayTimeMap.get(take.id) || take.created_at,
          };
        });

        // Sort by relay time
        processedTakes.sort((a, b) =>
          new Date(b.relayed_at).getTime() - new Date(a.relayed_at).getTime()
        );

        setTakes(processedTakes);
      } catch (err) {
        console.error("[useRelayedTakes] Error:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch relayed takes");
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchRelayedTakes();
    }
  }, [username, viewerId]);

  return { takes, loading, error };
}

// ============================================================================
// SAVED TAKES HOOK - Fetch takes saved by a user
// ============================================================================

export function useSavedTakes(userId?: string) {
  const [takes, setTakes] = useState<Take[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedTakes = useCallback(async () => {
    if (!userId) {
      setTakes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get saved take IDs
      const { data: savedData, error: savedError } = await supabase
        .from("take_saves")
        .select("take_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (savedError) throw savedError;
      if (!savedData || savedData.length === 0) {
        setTakes([]);
        setLoading(false);
        return;
      }

      const takeIds = savedData.map(s => s.take_id);

      // Fetch the takes
      const { data: takesData, error: takesError } = await supabase
        .from("takes")
        .select("*")
        .in("id", takeIds);

      if (takesError) throw takesError;
      if (!takesData || takesData.length === 0) {
        setTakes([]);
        setLoading(false);
        return;
      }

      // Get author info
      const authorIds = [...new Set(takesData.map(t => t.author_id))];
      const { data: authors } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", authorIds);

      const authorMap = new Map((authors || []).map(a => [a.id, a]));

      // Fetch counts
      const [
        { data: reactions },
        { data: comments },
        { data: saves },
        { data: relays },
      ] = await Promise.all([
        supabase.from("take_reactions").select("take_id, reaction_type").in("take_id", takeIds),
        supabase.from("take_comments").select("take_id").in("take_id", takeIds),
        supabase.from("take_saves").select("take_id").in("take_id", takeIds),
        supabase.from("take_relays").select("take_id").in("take_id", takeIds),
      ]);

      const reactionsCount: Record<string, number> = {};
      const commentsCount: Record<string, number> = {};
      const savesCount: Record<string, number> = {};
      const relaysCount: Record<string, number> = {};

      (reactions || []).forEach(r => { reactionsCount[r.take_id] = (reactionsCount[r.take_id] || 0) + 1; });
      (comments || []).forEach(c => { commentsCount[c.take_id] = (commentsCount[c.take_id] || 0) + 1; });
      (saves || []).forEach(s => { savesCount[s.take_id] = (savesCount[s.take_id] || 0) + 1; });
      (relays || []).forEach(r => { relaysCount[r.take_id] = (relaysCount[r.take_id] || 0) + 1; });

      // Order by save time
      const saveTimeMap = new Map(savedData.map(s => [s.take_id, s.created_at]));

      const processedTakes: Take[] = takesData.map(take => ({
        ...take,
        author: authorMap.get(take.author_id) || { username: "unknown", display_name: null, avatar_url: null },
        admires_count: reactionsCount[take.id] || 0,
        reactions_count: reactionsCount[take.id] || 0,
        comments_count: commentsCount[take.id] || 0,
        saves_count: savesCount[take.id] || 0,
        relays_count: relaysCount[take.id] || 0,
        is_admired: false,
        is_saved: true,
        is_relayed: false,
        user_reaction_type: null,
      }));

      // Sort by save time (most recent first)
      processedTakes.sort((a, b) => {
        const timeA = saveTimeMap.get(a.id) || a.created_at;
        const timeB = saveTimeMap.get(b.id) || b.created_at;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

      setTakes(processedTakes);
    } catch (err) {
      console.error("[useSavedTakes] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to load saved takes");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSavedTakes();
  }, [fetchSavedTakes]);

  return { takes, loading, error, refetch: fetchSavedTakes };
}
