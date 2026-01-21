import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
// Import types from centralized types file instead of redefining them
import type { Post, PostMedia, ReactionType } from "./types";

// Re-export for backwards compatibility with existing imports
export type { Post, PostMedia, ReactionType };

export function usePosts(userId?: string) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastUserIdRef = useRef<string | undefined | null>(null); // Use null as initial to distinguish from undefined userId
  const hasFetchedRef = useRef(false);

  const fetchPosts = async (currentUserId?: string) => {
    try {
      setLoading(true);
      setError(null);

      // First, get users who have blocked the current user (if logged in)
      let blockedByUsers: Set<string> = new Set();
      let usersIBlocked: Set<string> = new Set();

      if (currentUserId) {
        const [blockedByResult, iBlockedResult] = await Promise.all([
          // Users who blocked me (I can't see their posts)
          supabase.from("blocks").select("blocker_id").eq("blocked_id", currentUserId),
          // Users I blocked (I shouldn't see their posts either)
          supabase.from("blocks").select("blocked_id").eq("blocker_id", currentUserId),
        ]);

        (blockedByResult.data || []).forEach(b => blockedByUsers.add(b.blocker_id));
        (iBlockedResult.data || []).forEach(b => usersIBlocked.add(b.blocked_id));
      }

      // Get list of users this user follows (only accepted follows - for visibility filtering)
      let followingIds: Set<string> = new Set();
      if (currentUserId) {
        // Try with status column first, fall back to without if column doesn't exist
        let followingData: { following_id: string }[] | null = null;
        const { data, error: followingError } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUserId)
          .eq("status", "accepted");

        if (followingError && (followingError.code === "42703" || followingError.message?.includes("status"))) {
          // Status column doesn't exist - fall back to simple query
          const { data: fallbackData } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", currentUserId);
          followingData = fallbackData;
        } else {
          followingData = data;
        }

        (followingData || []).forEach(f => followingIds.add(f.following_id));
      }

      // Get list of private accounts (for filtering their posts)
      const { data: privateAccountsData } = await supabase
        .from("profiles")
        .select("id")
        .eq("is_private", true);

      const privateAccountIds: Set<string> = new Set(
        (privateAccountsData || []).map(p => p.id)
      );

      // Fetch posts with author info, media, and community
      // We need to fetch posts that are either:
      // 1. Public (anyone can see)
      // 2. Followers-only from users the current user follows
      // 3. User's own posts (all visibility levels)
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(`
          *,
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
          ),
          community:communities (
            slug,
            name,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false });

      if (postsError) {
        console.error("[usePosts] Posts query error:", postsError);
        throw postsError;
      }

      console.log("[usePosts] Raw posts count:", postsData?.length);

      // Filter posts based on visibility rules
      console.log("[usePosts] Pre-filter posts:", postsData?.map(p => ({
        id: p.id,
        author_id: p.author_id,
        visibility: p.visibility,
        author: p.author?.username
      })));
      console.log("[usePosts] Following IDs:", Array.from(followingIds));

      const visibilityFilteredPosts = (postsData || []).filter(post => {
        const isOwnPost = currentUserId && post.author_id === currentUserId;
        const isFollowing = followingIds.has(post.author_id);
        const isPrivateAccount = privateAccountIds.has(post.author_id);

        // User can always see their own posts
        if (isOwnPost) return true;

        // SECURITY: Posts from private accounts are only visible to accepted followers
        if (isPrivateAccount && !isFollowing) {
          console.log("[usePosts] Filtering out post from private account:", {
            id: post.id,
            author_id: post.author_id,
            isFollowing
          });
          return false;
        }

        // Check post visibility (public/followers/private)
        if (post.visibility === 'public') return true;
        if (post.visibility === 'followers' && isFollowing) {
          console.log("[usePosts] Including followers-only post:", post.id, "from", post.author?.username);
          return true;
        }

        if (post.visibility !== 'public') {
          console.log("[usePosts] Filtering out post:", {
            id: post.id,
            visibility: post.visibility,
            author_id: post.author_id,
            isFollowing
          });
        }

        // Private posts are never shown to others, followers-only posts not shown to non-followers
        return false;
      });

      console.log("[usePosts] After visibility filter:", visibilityFilteredPosts.length, "posts");

      if (visibilityFilteredPosts.length === 0) {
        setPosts([]);
        return;
      }

      // Filter out posts from blocked users
      const filteredPosts = visibilityFilteredPosts.filter(post =>
        !blockedByUsers.has(post.author_id) && !usersIBlocked.has(post.author_id)
      );

      if (filteredPosts.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = filteredPosts.map((p) => p.id);

      // Batch fetch counts using aggregation
      const [admiresResult, commentsResult, relaysResult, collaboratorsResult, mentionsResult, tagsResult] = await Promise.all([
        supabase.from("admires").select("post_id").in("post_id", postIds),
        supabase.from("comments").select("post_id").in("post_id", postIds),
        supabase.from("relays").select("post_id").in("post_id", postIds),
        // Fetch collaborators with user info
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
        // Fetch mentions with user info
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
        // Fetch hashtags
        supabase
          .from("post_tags")
          .select(`
            post_id,
            tag:tags(name)
          `)
          .in("post_id", postIds),
      ]);

      // Count occurrences per post
      const admiresCounts: Record<string, number> = {};
      const commentsCounts: Record<string, number> = {};
      const relaysCounts: Record<string, number> = {};

      (admiresResult.data || []).forEach((a) => {
        admiresCounts[a.post_id] = (admiresCounts[a.post_id] || 0) + 1;
      });
      (commentsResult.data || []).forEach((c) => {
        commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
      });
      (relaysResult.data || []).forEach((r) => {
        relaysCounts[r.post_id] = (relaysCounts[r.post_id] || 0) + 1;
      });

      // Group collaborators, mentions, and hashtags by post_id
      const collaboratorsByPost: Record<string, any[]> = {};
      const mentionsByPost: Record<string, any[]> = {};
      const hashtagsByPost: Record<string, string[]> = {};

      (collaboratorsResult.data || []).forEach((c) => {
        if (!collaboratorsByPost[c.post_id]) {
          collaboratorsByPost[c.post_id] = [];
        }
        collaboratorsByPost[c.post_id].push({
          status: c.status,
          role: c.role,
          user: c.user,
        });
      });

      (mentionsResult.data || []).forEach((m) => {
        if (!mentionsByPost[m.post_id]) {
          mentionsByPost[m.post_id] = [];
        }
        mentionsByPost[m.post_id].push({
          user: m.user,
        });
      });

      (tagsResult.data || []).forEach((t: any) => {
        const tagName = t.tag?.name;
        if (tagName) {
          if (!hashtagsByPost[t.post_id]) {
            hashtagsByPost[t.post_id] = [];
          }
          hashtagsByPost[t.post_id].push(tagName);
        }
      });

      // Batch fetch user interactions if logged in
      let userAdmires: Set<string> = new Set();
      let userSaves: Set<string> = new Set();
      let userRelays: Set<string> = new Set();

      if (currentUserId) {
        const [userAdmiresResult, userSavesResult, userRelaysResult] = await Promise.all([
          supabase.from("admires").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
          supabase.from("saves").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
          supabase.from("relays").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
        ]);

        userAdmires = new Set((userAdmiresResult.data || []).map((a) => a.post_id));
        userSaves = new Set((userSavesResult.data || []).map((s) => s.post_id));
        userRelays = new Set((userRelaysResult.data || []).map((r) => r.post_id));
      }

      // Map posts with all their data
      const postsWithStats = filteredPosts.map((post) => ({
        ...post,
        media: (post.media || []).sort((a: PostMedia, b: PostMedia) => a.position - b.position),
        admires_count: admiresCounts[post.id] || 0,
        comments_count: commentsCounts[post.id] || 0,
        relays_count: relaysCounts[post.id] || 0,
        user_has_admired: userAdmires.has(post.id),
        user_has_saved: userSaves.has(post.id),
        user_has_relayed: userRelays.has(post.id),
        collaborators: collaboratorsByPost[post.id] || [],
        mentions: mentionsByPost[post.id] || [],
        hashtags: hashtagsByPost[post.id] || [],
      }));

      setPosts(postsWithStats);
      lastUserIdRef.current = currentUserId;
    } catch (err: unknown) {
      console.error("[usePosts] Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch posts";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch on initial mount or when userId changes
    if (!hasFetchedRef.current || lastUserIdRef.current !== userId) {
      hasFetchedRef.current = true;
      fetchPosts(userId);
    }
  }, [userId]);

  // Real-time subscriptions for admires and relays
  useEffect(() => {
    const channel = supabase
      .channel('posts-interactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admires' },
        (payload) => {
          const newData = payload.new as { post_id?: string; user_id?: string } | null;
          const oldData = payload.old as { post_id?: string; user_id?: string } | null;
          const postId = newData?.post_id || oldData?.post_id;
          if (!postId) return;

          setPosts((current) =>
            current.map((post) => {
              if (post.id !== postId) return post;

              if (payload.eventType === 'INSERT') {
                return {
                  ...post,
                  admires_count: post.admires_count + 1,
                  user_has_admired: newData?.user_id === userId ? true : post.user_has_admired,
                };
              } else if (payload.eventType === 'DELETE') {
                return {
                  ...post,
                  admires_count: Math.max(0, post.admires_count - 1),
                  user_has_admired: oldData?.user_id === userId ? false : post.user_has_admired,
                };
              }
              return post;
            })
          );
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'relays' },
        (payload) => {
          const newData = payload.new as { post_id?: string; user_id?: string } | null;
          const oldData = payload.old as { post_id?: string; user_id?: string } | null;
          const postId = newData?.post_id || oldData?.post_id;
          if (!postId) return;

          setPosts((current) =>
            current.map((post) => {
              if (post.id !== postId) return post;

              if (payload.eventType === 'INSERT') {
                return {
                  ...post,
                  relays_count: post.relays_count + 1,
                  user_has_relayed: newData?.user_id === userId ? true : post.user_has_relayed,
                };
              } else if (payload.eventType === 'DELETE') {
                return {
                  ...post,
                  relays_count: Math.max(0, post.relays_count - 1),
                  user_has_relayed: oldData?.user_id === userId ? false : post.user_has_relayed,
                };
              }
              return post;
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { posts, loading, error, refetch: () => fetchPosts(userId) };
}

export function useToggleAdmire() {
  const toggle = async (postId: string, userId: string, isAdmired: boolean) => {
    if (isAdmired) {
      await supabase
        .from("admires")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
    } else {
      await supabase.from("admires").insert({
        post_id: postId,
        user_id: userId,
      });
    }
  };

  return { toggle };
}

// New reaction system with multiple reaction types
// Falls back to 'admires' table if 'reactions' table doesn't exist
export function useToggleReaction() {
  const [useReactionsTable, setUseReactionsTable] = useState(true);

  const react = async (
    postId: string,
    userId: string,
    reactionType: ReactionType,
    currentReaction: ReactionType | null
  ) => {
    try {
      if (useReactionsTable) {
        if (currentReaction === reactionType) {
          // Same reaction clicked - remove it
          const { error } = await supabase
            .from("reactions")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", userId);

          if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
            setUseReactionsTable(false);
            return reactWithAdmires(postId, userId, reactionType, currentReaction);
          }
          return { success: true, removed: true };
        } else if (currentReaction) {
          // Different reaction - update it
          const { error } = await supabase
            .from("reactions")
            .update({ reaction_type: reactionType })
            .eq("post_id", postId)
            .eq("user_id", userId);

          if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
            setUseReactionsTable(false);
            return reactWithAdmires(postId, userId, reactionType, currentReaction);
          }
          return { success: true, changed: true };
        } else {
          // No current reaction - insert new
          const { error } = await supabase.from("reactions").insert({
            post_id: postId,
            user_id: userId,
            reaction_type: reactionType,
          });

          if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
            setUseReactionsTable(false);
            return reactWithAdmires(postId, userId, reactionType, currentReaction);
          }
          return { success: true, added: true };
        }
      } else {
        return reactWithAdmires(postId, userId, reactionType, currentReaction);
      }
    } catch (err) {
      console.warn("[useToggleReaction] Using fallback:", err);
      return { success: false, error: err };
    }
  };

  // Fallback using admires table (only supports admire reaction)
  const reactWithAdmires = async (
    postId: string,
    userId: string,
    reactionType: ReactionType,
    currentReaction: ReactionType | null
  ) => {
    try {
      // Only 'admire' is supported in fallback mode
      if (reactionType !== 'admire') {
        console.warn("[useToggleReaction] Only 'admire' is supported in fallback mode");
        return { success: false, error: 'Only admire is supported' };
      }

      if (currentReaction === 'admire') {
        // Remove admire
        await supabase
          .from("admires")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
        return { success: true, removed: true };
      } else {
        // Add admire
        await supabase.from("admires").insert({
          post_id: postId,
          user_id: userId,
        });
        return { success: true, added: true };
      }
    } catch (err) {
      console.error("[useToggleReaction] Fallback Error:", err);
      return { success: false, error: err };
    }
  };

  const removeReaction = async (postId: string, userId: string) => {
    try {
      if (useReactionsTable) {
        const { error } = await supabase
          .from("reactions")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
          setUseReactionsTable(false);
          await supabase
            .from("admires")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", userId);
        }
      } else {
        await supabase
          .from("admires")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
      }
      return { success: true };
    } catch (err) {
      console.warn("[useToggleReaction] Remove Error:", err);
      return { success: false, error: err };
    }
  };

  const getReaction = async (postId: string, userId: string): Promise<ReactionType | null> => {
    try {
      if (useReactionsTable) {
        const { data, error } = await supabase
          .from("reactions")
          .select("reaction_type")
          .eq("post_id", postId)
          .eq("user_id", userId)
          .maybeSingle();

        if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
          setUseReactionsTable(false);
          const { data: admireData } = await supabase
            .from("admires")
            .select("post_id")
            .eq("post_id", postId)
            .eq("user_id", userId)
            .maybeSingle();
          return admireData ? 'admire' : null;
        }
        return data?.reaction_type || null;
      } else {
        const { data: admireData } = await supabase
          .from("admires")
          .select("post_id")
          .eq("post_id", postId)
          .eq("user_id", userId)
          .maybeSingle();
        return admireData ? 'admire' : null;
      }
    } catch {
      return null;
    }
  };

  return { react, removeReaction, getReaction };
}

// Reaction counts interface
export interface ReactionCounts {
  admire: number;
  snap: number;
  ovation: number;
  support: number;
  inspired: number;
  applaud: number;
  total: number;
}

// Hook to get and subscribe to reaction counts for a post
// Falls back to 'admires' table if 'reactions' table doesn't exist
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
  const [useReactionsTable, setUseReactionsTable] = useState(true);

  const fetchCounts = async () => {
    try {
      if (useReactionsTable) {
        // Try the new reactions table first
        const { data, error } = await supabase
          .from("reactions")
          .select("reaction_type")
          .eq("post_id", postId);

        if (error) {
          // If table doesn't exist, fall back to admires
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            setUseReactionsTable(false);
            // Fetch from admires instead
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
      } else {
        // Fall back to admires table
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
      }
    } catch (err) {
      // Silently handle - table may not exist yet
      console.warn("[useReactionCounts] Using fallback:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();

    // Subscribe to real-time changes (only if using reactions table)
    if (useReactionsTable) {
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
    }
  }, [postId, useReactionsTable]);

  return { counts, loading, refetch: fetchCounts };
}

// Get user's reaction for a post with real-time updates
// Falls back to 'admires' table if 'reactions' table doesn't exist
export function useUserReaction(postId: string, userId?: string) {
  const [reaction, setReaction] = useState<ReactionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [useReactionsTable, setUseReactionsTable] = useState(true);

  const fetchReaction = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      if (useReactionsTable) {
        const { data, error } = await supabase
          .from("reactions")
          .select("reaction_type")
          .eq("post_id", postId)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          // If table doesn't exist, fall back to admires
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            setUseReactionsTable(false);
            // Check admires table
            const { data: admireData } = await supabase
              .from("admires")
              .select("post_id")
              .eq("post_id", postId)
              .eq("user_id", userId)
              .maybeSingle();

            setReaction(admireData ? 'admire' : null);
            return;
          }
          throw error;
        }

        setReaction(data?.reaction_type || null);
      } else {
        // Fall back to admires table
        const { data: admireData } = await supabase
          .from("admires")
          .select("post_id")
          .eq("post_id", postId)
          .eq("user_id", userId)
          .maybeSingle();

        setReaction(admireData ? 'admire' : null);
      }
    } catch (err) {
      console.warn("[useUserReaction] Using fallback:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReaction();

    if (!userId) return;

    // Subscribe to real-time changes for this user's reaction
    const tableName = useReactionsTable ? "reactions" : "admires";
    const channel = supabase
      .channel(`user_reaction:${postId}:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          // Check if this change affects the current user
          if (payload.eventType === "DELETE") {
            const old = payload.old as { user_id?: string };
            if (old.user_id === userId) {
              setReaction(null);
            }
          } else if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const newData = payload.new as { user_id?: string; reaction_type?: string };
            if (newData.user_id === userId) {
              setReaction(useReactionsTable ? (newData.reaction_type as ReactionType) : 'admire');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, userId, useReactionsTable]);

  return { reaction, loading, setReaction, refetch: fetchReaction };
}

export function useToggleSave() {
  const toggle = async (postId: string, userId: string, isSaved: boolean) => {
    if (isSaved) {
      await supabase
        .from("saves")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
    } else {
      await supabase.from("saves").insert({
        post_id: postId,
        user_id: userId,
      });
    }
  };

  return { toggle };
}

// Hook to fetch saved posts for a user
export function useSavedPosts(userId?: string) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedPosts = useCallback(async () => {
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get saved post IDs with timestamps
      const { data: savedData, error: savedError } = await supabase
        .from("saves")
        .select("post_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (savedError) throw savedError;
      if (!savedData || savedData.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const postIds = savedData.map((s) => s.post_id);
      const savedTimestamps = new Map(savedData.map((s) => [s.post_id, s.created_at]));

      // Fetch posts with all related data
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
            slug,
            name,
            avatar_url
          )
        `)
        .in("id", postIds);

      if (postsError) throw postsError;
      if (!postsData) {
        setPosts([]);
        setLoading(false);
        return;
      }

      // Get counts for all posts
      const [admiresResult, commentsResult, relaysResult] = await Promise.all([
        supabase.from("admires").select("post_id").in("post_id", postIds),
        supabase.from("comments").select("post_id").in("post_id", postIds),
        supabase.from("relays").select("post_id").in("post_id", postIds),
      ]);

      // Count occurrences
      const admiresCounts: Record<string, number> = {};
      const commentsCounts: Record<string, number> = {};
      const relaysCounts: Record<string, number> = {};

      (admiresResult.data || []).forEach((a) => {
        admiresCounts[a.post_id] = (admiresCounts[a.post_id] || 0) + 1;
      });
      (commentsResult.data || []).forEach((c) => {
        commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
      });
      (relaysResult.data || []).forEach((r) => {
        relaysCounts[r.post_id] = (relaysCounts[r.post_id] || 0) + 1;
      });

      // Check user interactions
      const [userAdmiresResult, userRelaysResult] = await Promise.all([
        supabase.from("admires").select("post_id").eq("user_id", userId).in("post_id", postIds),
        supabase.from("relays").select("post_id").eq("user_id", userId).in("post_id", postIds),
      ]);

      const userAdmires = new Set((userAdmiresResult.data || []).map((a) => a.post_id));
      const userRelays = new Set((userRelaysResult.data || []).map((r) => r.post_id));

      // Map posts with all data
      const postsWithStats = postsData.map((post) => ({
        ...post,
        media: (post.media || []).sort((a: PostMedia, b: PostMedia) => a.position - b.position),
        admires_count: admiresCounts[post.id] || 0,
        comments_count: commentsCounts[post.id] || 0,
        relays_count: relaysCounts[post.id] || 0,
        user_has_admired: userAdmires.has(post.id),
        user_has_saved: true, // All these posts are saved
        user_has_relayed: userRelays.has(post.id),
        saved_at: savedTimestamps.get(post.id),
      }));

      // Sort by saved timestamp (most recent first)
      postsWithStats.sort((a, b) => {
        const timeA = new Date(a.saved_at || 0).getTime();
        const timeB = new Date(b.saved_at || 0).getTime();
        return timeB - timeA;
      });

      setPosts(postsWithStats);
    } catch (err) {
      console.error("Error fetching saved posts:", err);
      setError("Failed to load saved posts");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSavedPosts();
  }, [fetchSavedPosts]);

  return { posts, loading, error, refetch: fetchSavedPosts };
}

export interface Profile {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    bio: string | null;
    tagline: string | null;
    role: string | null;
    education: string | null;
    location: string | null;
    languages: string | null;
    website: string | null;
    is_verified: boolean;
    is_private: boolean;
    created_at: string;
    works_count: number;
    followers_count: number;
    following_count: number;
    admires_count: number;
  }

  export function useProfile(username: string, viewerId?: string) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isBlockedByUser, setIsBlockedByUser] = useState(false);
    const [isPrivateAccount, setIsPrivateAccount] = useState(false);

    const fetchProfile = useCallback(async () => {
      if (!username) return;
        try {
          setLoading(true);
          setIsPrivateAccount(false);

          // Fetch profile
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("username", username)
            .single();

          if (profileError) throw profileError;

          const isOwnProfile = viewerId && viewerId === profileData.id;

          // Check if the profile owner has blocked the viewer
          if (viewerId && !isOwnProfile) {
            const { data: blockData } = await supabase
              .from("blocks")
              .select("id")
              .eq("blocker_id", profileData.id)
              .eq("blocked_id", viewerId)
              .maybeSingle();

            if (blockData) {
              // User is blocked - show as if profile doesn't exist
              setIsBlockedByUser(true);
              setError("blocked");
              setLoading(false);
              return;
            }
          }

          // Check if viewer is an ACCEPTED follower (for visibility filtering)
          let viewerFollowsProfile = false;

          if (viewerId && !isOwnProfile) {
            const { data: followCheck } = await supabase
              .from("follows")
              .select("status")
              .eq("follower_id", viewerId)
              .eq("following_id", profileData.id)
              .eq("status", "accepted") // Only count accepted follows
              .maybeSingle();
            viewerFollowsProfile = !!followCheck;
          }

          // SECURITY: Handle private accounts
          if (!isOwnProfile && profileData.is_private && !viewerFollowsProfile) {
            // Non-follower viewing a private account - show limited data
            setIsPrivateAccount(true);

            // Get follower/following counts (still shown for private accounts)
            const [followersResult, followingResult] = await Promise.all([
              supabase.from("follows").select("*", { count: "exact", head: true })
                .eq("following_id", profileData.id)
                .eq("status", "accepted"),
              supabase.from("follows").select("*", { count: "exact", head: true })
                .eq("follower_id", profileData.id)
                .eq("status", "accepted"),
            ]);

            setProfile({
              ...profileData,
              // Hide sensitive info for private accounts
              bio: null,
              tagline: null,
              role: null,
              education: null,
              location: null,
              languages: null,
              website: null,
              // Show counts
              works_count: 0, // Don't reveal post count
              followers_count: followersResult.count || 0,
              following_count: followingResult.count || 0,
              admires_count: 0,
            });
            setPosts([]); // No posts visible
            setLoading(false);
            return;
          }

          // Build visibility filter for posts
          // - Owner sees all their posts
          // - Followers see public + followers posts
          // - Others see only public posts
          let postsQuery = supabase
            .from("posts")
            .select(`
              *,
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
            `)
            .eq("author_id", profileData.id)
            .order("created_at", { ascending: false });

          // Apply visibility filter based on relationship
          if (!isOwnProfile) {
            if (viewerFollowsProfile) {
              // Follower: can see public and followers posts
              postsQuery = postsQuery.in("visibility", ["public", "followers"]);
            } else {
              // Not following: can only see public posts
              postsQuery = postsQuery.eq("visibility", "public");
            }
          }
          // If isOwnProfile, no filter applied - owner sees all posts

          // Fetch all counts in parallel (only count accepted follows)
          // Note: works_count should only count posts the viewer can see
          const [followersResult, followingResult, postsData] = await Promise.all([
            supabase.from("follows").select("*", { count: "exact", head: true })
              .eq("following_id", profileData.id)
              .eq("status", "accepted"),
            supabase.from("follows").select("*", { count: "exact", head: true })
              .eq("follower_id", profileData.id)
              .eq("status", "accepted"),
            postsQuery,
          ]);

          // Works count = number of posts visible to viewer
          const worksCount = postsData.data?.length || 0;

          const postIds = (postsData.data || []).map((p) => p.id);

          // Batch fetch admires and comments counts for all posts
          let admiresCounts: Record<string, number> = {};
          let commentsCounts: Record<string, number> = {};
          let totalAdmires = 0;

          if (postIds.length > 0) {
            const [admiresResult, commentsResult] = await Promise.all([
              supabase.from("admires").select("post_id").in("post_id", postIds),
              supabase.from("comments").select("post_id").in("post_id", postIds),
            ]);

            (admiresResult.data || []).forEach((a) => {
              admiresCounts[a.post_id] = (admiresCounts[a.post_id] || 0) + 1;
              totalAdmires++;
            });
            (commentsResult.data || []).forEach((c) => {
              commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
            });
          }

          setProfile({
            ...profileData,
            works_count: worksCount,
            followers_count: followersResult.count || 0,
            following_count: followingResult.count || 0,
            admires_count: totalAdmires,
          });

          const postsWithStats = (postsData.data || []).map((post) => ({
            ...post,
            media: (post.media || []).sort((a: PostMedia, b: PostMedia) => a.position - b.position),
            admires_count: admiresCounts[post.id] || 0,
            comments_count: commentsCounts[post.id] || 0,
            relays_count: 0,
            user_has_admired: false,
            user_has_saved: false,
            user_has_relayed: false,
          }));

          setPosts(postsWithStats);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Failed to fetch profile";
          setError(errorMessage);
        } finally {
          setLoading(false);
        }
    }, [username, viewerId]);

    useEffect(() => {
      fetchProfile();
    }, [fetchProfile]);

    return { profile, posts, loading, error, isBlockedByUser, isPrivateAccount, refetch: fetchProfile };
  }

  export type FollowStatus = 'pending' | 'accepted' | null;

  export function useFollow() {
    // Check follow status (returns: null | 'pending' | 'accepted')
    const checkFollowStatus = async (followerId: string, followingId: string): Promise<FollowStatus> => {
      const { data, error } = await supabase
        .from("follows")
        .select("status")
        .eq("follower_id", followerId)
        .eq("following_id", followingId)
        .maybeSingle();

      // If status column doesn't exist (schema not migrated), fall back to checking if row exists
      if (error) {
        const { data: existsData } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", followerId)
          .eq("following_id", followingId)
          .maybeSingle();
        return existsData ? 'accepted' : null;
      }

      return (data?.status as FollowStatus) || null;
    };

    // Legacy method for backwards compatibility
    const checkIsFollowing = async (followerId: string, followingId: string) => {
      const status = await checkFollowStatus(followerId, followingId);
      return status === 'accepted';
    };

    // Check if target account is private
    const checkIsPrivate = async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("is_private")
        .eq("id", userId)
        .single();
      return data?.is_private || false;
    };

    // Follow or send request (based on target's privacy setting)
    const follow = async (followerId: string, followingId: string): Promise<FollowStatus> => {
      const isPrivate = await checkIsPrivate(followingId);

      if (isPrivate) {
        // Send follow request (pending)
        const { error } = await supabase.from("follows").insert({
          follower_id: followerId,
          following_id: followingId,
          status: 'pending',
        });
        // If status column doesn't exist, fall back to regular insert
        if (error) {
          await supabase.from("follows").insert({
            follower_id: followerId,
            following_id: followingId,
          });
          // Without status column, can't do pending - treat as accepted
          await createNotification(followingId, followerId, 'follow');
          return 'accepted';
        }
        await createNotification(followingId, followerId, 'follow_request');
        return 'pending';
      } else {
        // Direct follow (accepted)
        const { error } = await supabase.from("follows").insert({
          follower_id: followerId,
          following_id: followingId,
          status: 'accepted',
        });
        // If status column doesn't exist, fall back to regular insert
        if (error) {
          await supabase.from("follows").insert({
            follower_id: followerId,
            following_id: followingId,
          });
        }
        await createNotification(followingId, followerId, 'follow');
        return 'accepted';
      }
    };

    // Unfollow or cancel request
    const unfollow = async (followerId: string, followingId: string) => {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", followerId)
        .eq("following_id", followingId);
    };

    // Accept follow request (for private accounts)
    const acceptRequest = async (ownerId: string, requesterId: string) => {
      await supabase
        .from("follows")
        .update({ status: 'accepted' })
        .eq("follower_id", requesterId)
        .eq("following_id", ownerId)
        .eq("status", 'pending');

      await createNotification(requesterId, ownerId, 'follow_request_accepted');
    };

    // Decline follow request (silently, like Instagram)
    const declineRequest = async (ownerId: string, requesterId: string) => {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", requesterId)
        .eq("following_id", ownerId)
        .eq("status", 'pending');
    };

    // Get pending follow requests for a user
    const getPendingRequests = async (userId: string) => {
      const { data } = await supabase
        .from("follows")
        .select(`
          follower_id,
          requested_at,
          requester:profiles!follows_follower_id_fkey (
            id, username, display_name, avatar_url, bio
          )
        `)
        .eq("following_id", userId)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      return data || [];
    };

    // Legacy toggle method for backwards compatibility
    const toggle = async (followerId: string, followingId: string, isFollowing: boolean) => {
      if (isFollowing) {
        await unfollow(followerId, followingId);
      } else {
        await follow(followerId, followingId);
      }
    };

    return {
      checkFollowStatus,
      checkIsFollowing,
      checkIsPrivate,
      follow,
      unfollow,
      acceptRequest,
      declineRequest,
      getPendingRequests,
      toggle
    };
  }

  export interface Comment {
    id: string;
    user_id: string;
    post_id: string;
    parent_id: string | null;
    content: string;
    created_at: string;
    author: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
    likes_count: number;
    replies_count: number;
    user_has_liked: boolean;
    replies?: Comment[];
  }
  
  export interface FollowUser {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    is_verified: boolean;
  }

  export function useFollowList(userId: string, type: "followers" | "following") {
    const [users, setUsers] = useState<FollowUser[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchList = async () => {
      if (!userId) return;

      try {
        setLoading(true);

        if (type === "followers") {
          // Get users who follow this user (only accepted follows)
          const { data, error } = await supabase
            .from("follows")
            .select(`
              follower:profiles!follows_follower_id_fkey (
                id,
                username,
                display_name,
                avatar_url,
                bio,
                is_verified
              )
            `)
            .eq("following_id", userId)
            .eq("status", "accepted");

          if (error) throw error;
          setUsers(data?.map((d) => d.follower as unknown as FollowUser) || []);
        } else {
          // Get users this user follows (only accepted follows)
          const { data, error } = await supabase
            .from("follows")
            .select(`
              following:profiles!follows_following_id_fkey (
                id,
                username,
                display_name,
                avatar_url,
                bio,
                is_verified
              )
            `)
            .eq("follower_id", userId)
            .eq("status", "accepted");

          if (error) throw error;
          setUsers(data?.map((d) => d.following as unknown as FollowUser) || []);
        }
      } catch (err) {
        console.error("Failed to fetch follow list:", err);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchList();
    }, [userId, type]);

    return { users, loading, refetch: fetchList };
  }

  // Interface for follow request
  export interface FollowRequest {
    follower_id: string;
    requested_at: string;
    requester: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      bio: string | null;
    };
  }

  // Hook for managing follow requests (for private accounts)
  export function useFollowRequests(userId?: string) {
    const [requests, setRequests] = useState<FollowRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [count, setCount] = useState(0);

    const fetchRequests = useCallback(async () => {
      if (!userId) {
        setRequests([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("follows")
          .select(`
            follower_id,
            requested_at,
            requester:profiles!follows_follower_id_fkey (
              id, username, display_name, avatar_url, bio
            )
          `)
          .eq("following_id", userId)
          .eq("status", "pending")
          .order("requested_at", { ascending: false });

        if (error) {
          // Handle case where status/requested_at columns don't exist yet (schema not migrated)
          const errorMsg = error.message || '';
          const errorCode = error.code || '';
          // Also handle empty error objects (common when columns don't exist)
          const isSchemaError = errorMsg.includes('status') ||
                               errorMsg.includes('requested_at') ||
                               errorCode === '42703' ||
                               errorCode === 'PGRST116' ||
                               (!errorMsg && !errorCode); // Empty error = likely schema issue
          if (isSchemaError) {
            // Schema not migrated yet - silently return empty
            setRequests([]);
            setCount(0);
            return;
          }
          throw error;
        }
        setRequests(data as unknown as FollowRequest[] || []);
        setCount(data?.length || 0);
      } catch (err: any) {
        // Silently handle schema errors and network errors
        const errorMsg = err?.message || '';
        const isSchemaError = errorMsg.includes('status') || errorMsg.includes('requested_at');
        const isNetworkError = errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError');
        if (!isSchemaError && !isNetworkError) {
          console.error("Failed to fetch follow requests:", err);
        }
        setRequests([]);
        setCount(0);
      } finally {
        setLoading(false);
      }
    }, [userId]);

    // Accept a follow request
    const accept = async (requesterId: string) => {
      if (!userId) return;

      try {
        // First verify the follow request exists
        const { data: existingFollow, error: checkError } = await supabase
          .from("follows")
          .select("follower_id, following_id, status")
          .eq("follower_id", requesterId)
          .eq("following_id", userId)
          .maybeSingle();

        if (checkError) {
          console.error("Failed to check follow request:", checkError);
          return;
        }

        if (!existingFollow) {
          console.error("Follow request not found for requester:", requesterId);
          return;
        }

        console.log("Found follow request:", existingFollow);

        // Update the follow status to accepted
        const { data: updateData, error: updateError } = await supabase
          .from("follows")
          .update({ status: 'accepted' })
          .eq("follower_id", requesterId)
          .eq("following_id", userId)
          .select();

        if (updateError) {
          console.error("Failed to accept follow request:", updateError);
          return;
        }

        // Check if any rows were actually updated
        if (!updateData || updateData.length === 0) {
          console.error("Update succeeded but no rows affected. This may be an RLS policy issue.");
          console.log("Attempting alternative approach...");

          // Try deleting and re-inserting with accepted status
          const { error: deleteError } = await supabase
            .from("follows")
            .delete()
            .eq("follower_id", requesterId)
            .eq("following_id", userId);

          if (deleteError) {
            console.error("Alternative delete failed:", deleteError);
            return;
          }

          const { error: insertError } = await supabase
            .from("follows")
            .insert({
              follower_id: requesterId,
              following_id: userId,
              status: 'accepted'
            });

          if (insertError) {
            console.error("Alternative insert failed:", insertError);
            return;
          }

          console.log("Alternative approach succeeded - follow accepted via delete+insert");
        } else {
          console.log("Follow request accepted successfully:", updateData);
        }

        // Send notification to the requester that their request was accepted
        try {
          await createNotification(requesterId, userId, 'follow_request_accepted');
        } catch (notifError) {
          // Notification failed but the accept succeeded - that's ok
          console.warn("Failed to send acceptance notification:", notifError);
        }

        // Update local state
        setRequests(prev => prev.filter(r => r.follower_id !== requesterId));
        setCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Error accepting follow request:", err);
      }
    };

    // Decline a follow request (silently)
    const decline = async (requesterId: string) => {
      if (!userId) return;

      try {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", requesterId)
          .eq("following_id", userId);

        if (error) {
          console.error("Failed to decline follow request:", error);
          return;
        }

        // Update local state
        setRequests(prev => prev.filter(r => r.follower_id !== requesterId));
        setCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Error declining follow request:", err);
      }
    };

    useEffect(() => {
      fetchRequests();
    }, [fetchRequests]);

    // Real-time subscription for new follow requests
    useEffect(() => {
      if (!userId) return;

      const channel = supabase
        .channel(`follow-requests-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'follows',
            filter: `following_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.new && (payload.new as any).status === 'pending') {
              fetchRequests(); // Refetch to get the full requester data
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'follows',
            filter: `following_id=eq.${userId}`,
          },
          () => {
            fetchRequests(); // Refetch on any deletion
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [userId, fetchRequests]);

    return { requests, loading, count, accept, decline, refetch: fetchRequests };
  }

  export function useComments(postId: string, userId?: string) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchComments = async () => {
      try {
        setLoading(true);

        // Fetch all comments for the post (both top-level and replies)
        const { data, error } = await supabase
          .from("comments")
          .select(`
            *,
            author:profiles!comments_user_id_fkey (
              username,
              display_name,
              avatar_url
            )
          `)
          .eq("post_id", postId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
          setComments([]);
          setLoading(false);
          return;
        }

        const commentIds = data.map(c => c.id);

        // Fetch likes counts and user likes
        const [likesResult, userLikesResult, repliesCountResult] = await Promise.all([
          supabase.from("comment_likes").select("comment_id").in("comment_id", commentIds),
          userId
            ? supabase.from("comment_likes").select("comment_id").eq("user_id", userId).in("comment_id", commentIds)
            : Promise.resolve({ data: [] }),
          supabase.from("comments").select("parent_id").in("parent_id", commentIds),
        ]);

        const likesCounts: Record<string, number> = {};
        const userLikes = new Set<string>();
        const repliesCounts: Record<string, number> = {};

        (likesResult.data || []).forEach(l => {
          likesCounts[l.comment_id] = (likesCounts[l.comment_id] || 0) + 1;
        });
        (userLikesResult.data || []).forEach(l => {
          userLikes.add(l.comment_id);
        });
        (repliesCountResult.data || []).forEach(r => {
          if (r.parent_id) {
            repliesCounts[r.parent_id] = (repliesCounts[r.parent_id] || 0) + 1;
          }
        });

        // Build comment tree
        const commentMap = new Map<string, Comment>();
        const topLevelComments: Comment[] = [];

        // First pass: create all comments with stats
        data.forEach(comment => {
          const enrichedComment: Comment = {
            ...comment,
            likes_count: likesCounts[comment.id] || 0,
            replies_count: repliesCounts[comment.id] || 0,
            user_has_liked: userLikes.has(comment.id),
            replies: [],
          };
          commentMap.set(comment.id, enrichedComment);
        });

        // Second pass: build tree structure
        data.forEach(comment => {
          const enrichedComment = commentMap.get(comment.id)!;
          if (comment.parent_id && commentMap.has(comment.parent_id)) {
            const parent = commentMap.get(comment.parent_id)!;
            parent.replies = parent.replies || [];
            parent.replies.push(enrichedComment);
          } else if (!comment.parent_id) {
            topLevelComments.push(enrichedComment);
          }
        });

        // Sort: newest first for top-level, oldest first for replies
        topLevelComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        topLevelComments.forEach(c => {
          if (c.replies) {
            c.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          }
        });

        setComments(topLevelComments);
      } catch (err) {
        console.error("Failed to fetch comments:", err);
      } finally {
        setLoading(false);
      }
    };

    const addComment = async (currentUserId: string, content: string, parentId?: string) => {
      try {
        const { data, error } = await supabase
          .from("comments")
          .insert({
            user_id: currentUserId,
            post_id: postId,
            parent_id: parentId || null,
            content,
          })
          .select(`
            *,
            author:profiles!comments_user_id_fkey (
              username,
              display_name,
              avatar_url
            )
          `)
          .single();

        if (error) throw error;
        if (data) {
          const newComment: Comment = {
            ...data,
            likes_count: 0,
            replies_count: 0,
            user_has_liked: false,
            replies: [],
          };

          if (parentId) {
            // Add as reply
            setComments(current =>
              current.map(c => {
                if (c.id === parentId) {
                  return {
                    ...c,
                    replies_count: c.replies_count + 1,
                    replies: [...(c.replies || []), newComment],
                  };
                }
                return c;
              })
            );

            // Send notification to the parent comment's author
            const { data: parentComment } = await supabase
              .from("comments")
              .select("user_id")
              .eq("id", parentId)
              .single();

            if (parentComment && parentComment.user_id !== currentUserId) {
              await createNotification(
                parentComment.user_id,
                currentUserId,
                'reply',
                postId,
                content.substring(0, 100) // Truncate content for notification preview
              );
            }
          } else {
            // Add as top-level comment
            setComments(current => [newComment, ...current]);
          }
        }
        return { success: true, comment: data };
      } catch (err) {
        console.error("Failed to add comment:", err);
        return { success: false };
      }
    };

    const toggleLike = async (commentId: string, currentUserId: string, isLiked: boolean) => {
      // Optimistic update
      setComments(current => {
        const updateComment = (comments: Comment[]): Comment[] => {
          return comments.map(c => {
            if (c.id === commentId) {
              return {
                ...c,
                likes_count: isLiked ? c.likes_count - 1 : c.likes_count + 1,
                user_has_liked: !isLiked,
              };
            }
            if (c.replies && c.replies.length > 0) {
              return { ...c, replies: updateComment(c.replies) };
            }
            return c;
          });
        };
        return updateComment(current);
      });

      try {
        if (isLiked) {
          await supabase
            .from("comment_likes")
            .delete()
            .eq("comment_id", commentId)
            .eq("user_id", currentUserId);
        } else {
          await supabase.from("comment_likes").insert({
            comment_id: commentId,
            user_id: currentUserId,
          });

          // Send notification to the comment author
          const { data: comment } = await supabase
            .from("comments")
            .select("user_id, content")
            .eq("id", commentId)
            .single();

          if (comment && comment.user_id !== currentUserId) {
            await createNotification(
              comment.user_id,
              currentUserId,
              'comment_like',
              postId,
              comment.content?.substring(0, 100)
            );
          }
        }
      } catch (err) {
        console.error("Failed to toggle like:", err);
        // Revert on error
        fetchComments();
      }
    };

    const deleteComment = async (commentId: string) => {
      try {
        // Delete comment likes first
        await supabase.from("comment_likes").delete().eq("comment_id", commentId);
        // Delete replies
        await supabase.from("comments").delete().eq("parent_id", commentId);
        // Delete comment
        await supabase.from("comments").delete().eq("id", commentId);

        // Update local state
        setComments(current => {
          const removeComment = (comments: Comment[]): Comment[] => {
            return comments
              .filter(c => c.id !== commentId)
              .map(c => ({
                ...c,
                replies: c.replies ? removeComment(c.replies) : [],
                replies_count: c.replies ? removeComment(c.replies).length : 0,
              }));
          };
          return removeComment(current);
        });

        return { success: true };
      } catch (err) {
        console.error("Failed to delete comment:", err);
        return { success: false };
      }
    };

    useEffect(() => {
      if (postId) {
        fetchComments();
      }
    }, [postId, userId]);

    return { comments, loading, addComment, toggleLike, deleteComment, refetch: fetchComments };
  }

  export function useToggleRelay() {
    const toggle = async (postId: string, userId: string, isRelayed: boolean) => {
      if (isRelayed) {
        await supabase
          .from("relays")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
      } else {
        await supabase.from("relays").insert({
          post_id: postId,
          user_id: userId,
        });
      }
    };
  
    return { toggle };
  }
  
  export interface RelayedPost extends Post {
    relayed_at: string;
    original_author: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  }
  
  export function useRelays(username: string) {
    const [relays, setRelays] = useState<RelayedPost[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const fetchRelays = async () => {
        try {
          setLoading(true);

          // First get the user's profile id
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", username)
            .single();

          if (!profileData) {
            setRelays([]);
            return;
          }

          // Fetch relays with post, author info, and media
          const { data: relaysData } = await supabase
            .from("relays")
            .select(`
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
            `)
            .eq("user_id", profileData.id)
            .order("created_at", { ascending: false });

          if (!relaysData || relaysData.length === 0) {
            setRelays([]);
            return;
          }

          const postIds = relaysData.map((r) => (r.post as any).id);

          // Batch fetch counts for all posts
          const [admiresResult, commentsResult, relaysCountResult] = await Promise.all([
            supabase.from("admires").select("post_id").in("post_id", postIds),
            supabase.from("comments").select("post_id").in("post_id", postIds),
            supabase.from("relays").select("post_id").in("post_id", postIds),
          ]);

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

          const processedRelays = relaysData.map((relay) => {
            const post = relay.post as any;
            return {
              ...post,
              media: (post.media || []).sort((a: PostMedia, b: PostMedia) => a.position - b.position),
              relayed_at: relay.created_at,
              original_author: post.author,
              admires_count: admiresCounts[post.id] || 0,
              comments_count: commentsCounts[post.id] || 0,
              relays_count: relaysCounts[post.id] || 0,
              user_has_admired: false,
              user_has_saved: false,
              user_has_relayed: false,
            };
          });

          setRelays(processedRelays);
        } catch (err) {
          console.error("Failed to fetch relays:", err);
        } finally {
          setLoading(false);
        }
      };

      if (username) {
        fetchRelays();
      }
    }, [username]);

    return { relays, loading };
  }

// Notification Types (includes reaction types)
export type NotificationType =
  | 'admire'
  | 'snap'
  | 'ovation'
  | 'support'
  | 'inspired'
  | 'applaud'
  | 'comment'
  | 'relay'
  | 'save'
  | 'follow'
  | 'follow_request'
  | 'follow_request_accepted'
  | 'reply'
  | 'comment_like'
  | 'community_invite'
  | 'community_join_request'
  | 'community_join_approved'
  | 'community_role_change'
  | 'community_muted'
  | 'community_banned'
  | 'collaboration_invite'
  | 'collaboration_accepted'
  | 'collaboration_declined'
  | 'mention';

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  community_id: string | null;
  content: string | null;
  read: boolean;
  created_at: string;
  actor: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  post?: {
    title: string | null;
    content: string;
    type: string;
  };
  community?: {
    name: string;
    slug: string;
    avatar_url: string | null;
  };
}

// Create a notification
export async function createNotification(
  userId: string,
  actorId: string,
  type: NotificationType,
  postId?: string,
  content?: string,
  communityId?: string,
  commentId?: string
): Promise<{ success: boolean; error?: any }> {
  // Don't notify yourself
  if (userId === actorId) {
    return { success: true };
  }

  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      actor_id: actorId,
      type,
      post_id: postId || null,
      content: content || null,
      community_id: communityId || null,
      comment_id: commentId || null,
    });

    if (error) {
      console.error('[createNotification] Failed to create notification:', {
        type,
        userId,
        actorId,
        postId,
        error: error.message,
        code: error.code,
      });
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error('[createNotification] Exception:', err);
    return { success: false, error: err };
  }
}

// Fetch notifications for a user
export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchNotifications = async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      if (!fetchedRef.current) {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from("notifications")
        .select(`
          *,
          actor:profiles!notifications_actor_id_fkey (
            username,
            display_name,
            avatar_url
          ),
          post:posts (
            title,
            content,
            type
          ),
          community:communities (
            name,
            slug,
            avatar_url
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      console.log('[useNotifications] Query result:', { dataCount: data?.length, error, userId });

      if (error) throw error;

      console.log('[useNotifications] Notifications:', data?.map(n => ({ id: n.id, type: n.type, read: n.read })));
      setNotifications(data || []);
      fetchedRef.current = true;
    } catch (err: any) {
      // Silently handle network errors (transient)
      const errMsg = err?.message || '';
      if (!errMsg.includes('Failed to fetch') && !errMsg.includes('NetworkError')) {
        console.error("[useNotifications] Failed to fetch:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchNotifications();
    }
  }, [userId]);

  // Real-time subscription - separate effect
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Cleanup previous subscription first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!userId) return;

    // CRITICAL: Use stable channel name to prevent connection leaks
    const channelName = `notifications-realtime-legacy-${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchNotifications();
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

  return { notifications, loading, refetch: fetchNotifications };
}

// Get unread notification count
export function useUnreadCount(userId?: string) {
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    if (!userId) {
      setCount(0);
      return;
    }

    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    setCount(unreadCount || 0);
  };

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchCount();
    }
  }, [userId]);

  // Real-time subscription - separate effect
  useEffect(() => {
    if (!userId) return;

    const channelName = `unread-count-realtime-${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { count, refetch: fetchCount };
}

// Mark notifications as read
export function useMarkAsRead() {
  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);
  };

  const markAllAsRead = async (userId: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
  };

  return { markAsRead, markAllAsRead };
}

// Unread messages count with real-time updates
export function useUnreadMessagesCount(userId?: string) {
  const [count, setCount] = useState(0);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchCount = async () => {
    if (!userId) {
      setCount(0);
      return;
    }

    // Get blocked users (both directions)
    const [blockedByResult, iBlockedResult] = await Promise.all([
      supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
      supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
    ]);

    const blockedUserIds = new Set<string>();
    (blockedByResult.data || []).forEach(b => blockedUserIds.add(b.blocker_id));
    (iBlockedResult.data || []).forEach(b => blockedUserIds.add(b.blocked_id));

    // Get all conversations the user is part of
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    if (!participations || participations.length === 0) {
      setCount(0);
      setHasFetched(true);
      return;
    }

    const conversationIds = participations.map((p) => p.conversation_id);

    // Get unread messages across all conversations
    const { data: unreadMessages } = await supabase
      .from("messages")
      .select("sender_id")
      .in("conversation_id", conversationIds)
      .eq("is_read", false)
      .neq("sender_id", userId);

    // Filter out messages from blocked users
    const filteredCount = (unreadMessages || []).filter(
      m => !blockedUserIds.has(m.sender_id)
    ).length;

    setCount(filteredCount);
    setHasFetched(true);
  };

  useEffect(() => {
    // Only fetch if we haven't fetched yet and have a userId
    if (!hasFetched && userId) {
      fetchCount();
    }

    // Set up real-time subscription only if we have a userId
    if (userId) {
      const channelName = `unread-messages-count-${userId}`;
      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
          },
          () => {
            fetchCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId, hasFetched]);

  return { count, refetch: fetchCount };
}

// Block functionality
export function useBlock() {
  // Check if blockerId has blocked blockedId
  const checkIsBlocked = async (blockerId: string, blockedId: string) => {
    const { data } = await supabase
      .from("blocks")
      .select("id")
      .eq("blocker_id", blockerId)
      .eq("blocked_id", blockedId)
      .maybeSingle();
    return !!data;
  };

  // Check if either user has blocked the other (for messaging)
  const checkIsBlockedEitherWay = async (userId1: string, userId2: string) => {
    const { data } = await supabase
      .from("blocks")
      .select("id")
      .or(`and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`)
      .limit(1);
    return data && data.length > 0;
  };

  const blockUser = async (blockerId: string, blockedId: string) => {
    // Block the user
    const { error } = await supabase.from("blocks").insert({
      blocker_id: blockerId,
      blocked_id: blockedId,
    });

    if (error) {
      console.error("Failed to block user:", error);
      return { success: false, error };
    }

    // Also unfollow if following
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", blockerId)
      .eq("following_id", blockedId);

    // Remove their follow too
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", blockedId)
      .eq("following_id", blockerId);

    return { success: true };
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
      .select(`
        blocked_id,
        blocked:profiles!blocks_blocked_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq("blocker_id", userId);

    if (error) {
      console.error("Failed to get blocked users:", error);
      return [];
    }

    return data?.map(d => d.blocked) || [];
  };

  return { checkIsBlocked, checkIsBlockedEitherWay, blockUser, unblockUser, getBlockedUsers };
}

// ============================================
// COMMUNITY TYPES
// ============================================

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  privacy: 'public' | 'private';
  topics: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  post_count?: number;
  is_member?: boolean;
  user_role?: 'admin' | 'moderator' | 'member' | null;
  user_status?: 'active' | 'muted' | 'banned' | null;
  has_pending_request?: boolean;
  has_pending_invitation?: boolean;
  pending_invitation_id?: string;
  creator?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  status: 'active' | 'muted' | 'banned';
  muted_until: string | null;
  joined_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

export interface CommunityRule {
  id: string;
  community_id: string;
  rule_number: number;
  title: string;
  description: string | null;
}

export interface CommunityTag {
  id: string;
  community_id: string;
  tag: string;
  tag_type: 'genre' | 'theme' | 'type' | 'custom';
}

export interface JoinRequest {
  id: string;
  community_id: string;
  user_id: string;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CommunityInvitation {
  id: string;
  community_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
  community: {
    name: string;
    slug: string;
    avatar_url: string | null;
  };
  inviter: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// ============================================
// COMMUNITY HOOKS
// ============================================

// Fetch a single community by slug
export function useCommunity(slug: string, userId?: string) {
  const [community, setCommunity] = useState<Community | null>(null);
  const [rules, setRules] = useState<CommunityRule[]>([]);
  const [tags, setTags] = useState<CommunityTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunity = async () => {
    if (!slug) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch community
      const { data: communityData, error: communityError } = await supabase
        .from("communities")
        .select(`
          *,
          creator:profiles!communities_created_by_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("slug", slug)
        .single();

      if (communityError) {
        if (communityError.code === 'PGRST116') {
          setError("Community not found");
        } else {
          throw communityError;
        }
        return;
      }

      // Fetch counts and user membership in parallel
      const [membersResult, postsResult, userMemberResult, pendingRequestResult, pendingInvitationResult, rulesResult, tagsResult] = await Promise.all([
        supabase.from("community_members").select("*", { count: "exact", head: true }).eq("community_id", communityData.id).eq("status", "active"),
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("community_id", communityData.id),
        userId ? supabase.from("community_members").select("role, status").eq("community_id", communityData.id).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
        userId ? supabase.from("community_join_requests").select("id").eq("community_id", communityData.id).eq("user_id", userId).eq("status", "pending").maybeSingle() : Promise.resolve({ data: null }),
        userId ? supabase.from("community_invitations").select("id").eq("community_id", communityData.id).eq("invitee_id", userId).eq("status", "pending").maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("community_rules").select("*").eq("community_id", communityData.id).order("rule_number", { ascending: true }),
        supabase.from("community_tags").select("*").eq("community_id", communityData.id),
      ]);

      setCommunity({
        ...communityData,
        member_count: membersResult.count || 0,
        post_count: postsResult.count || 0,
        is_member: !!userMemberResult.data && userMemberResult.data.status === 'active',
        user_role: userMemberResult.data?.role || null,
        user_status: userMemberResult.data?.status || null,
        has_pending_request: !!pendingRequestResult.data,
        has_pending_invitation: !!pendingInvitationResult.data,
        pending_invitation_id: pendingInvitationResult.data?.id || undefined,
      });

      setRules(rulesResult.data || []);
      setTags(tagsResult.data || []);
    } catch (err) {
      console.error("[useCommunity] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch community");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunity();
  }, [slug, userId]);

  return { community, rules, tags, loading, error, refetch: fetchCommunity };
}

// Fetch list of communities
export function useCommunities(userId?: string, filter?: 'all' | 'joined' | 'created') {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunities = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("communities")
        .select(`
          *,
          creator:profiles!communities_created_by_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false });

      if (filter === 'created' && userId) {
        query = query.eq("created_by", userId);
      }

      const { data: communitiesData, error: communitiesError } = await query;

      if (communitiesError) throw communitiesError;

      if (!communitiesData || communitiesData.length === 0) {
        setCommunities([]);
        return;
      }

      // If filtering by joined, get user's memberships first
      let joinedCommunityIds: Set<string> = new Set();
      let userMemberships: Record<string, { role: string; status: string }> = {};

      if (userId) {
        const { data: membershipData } = await supabase
          .from("community_members")
          .select("community_id, role, status")
          .eq("user_id", userId)
          .eq("status", "active");

        (membershipData || []).forEach(m => {
          joinedCommunityIds.add(m.community_id);
          userMemberships[m.community_id] = { role: m.role, status: m.status };
        });
      }

      // Filter if needed
      let filteredCommunities = communitiesData;
      if (filter === 'joined' && userId) {
        filteredCommunities = communitiesData.filter(c => joinedCommunityIds.has(c.id));
      }

      if (filteredCommunities.length === 0) {
        setCommunities([]);
        return;
      }

      // Get counts for all communities
      const communityIds = filteredCommunities.map(c => c.id);

      const [membersResult, postsResult] = await Promise.all([
        supabase.from("community_members").select("community_id").in("community_id", communityIds).eq("status", "active"),
        supabase.from("posts").select("community_id").in("community_id", communityIds),
      ]);

      const memberCounts: Record<string, number> = {};
      const postCounts: Record<string, number> = {};

      (membersResult.data || []).forEach(m => {
        memberCounts[m.community_id] = (memberCounts[m.community_id] || 0) + 1;
      });
      (postsResult.data || []).forEach(p => {
        postCounts[p.community_id] = (postCounts[p.community_id] || 0) + 1;
      });

      const enrichedCommunities = filteredCommunities.map(c => ({
        ...c,
        member_count: memberCounts[c.id] || 0,
        post_count: postCounts[c.id] || 0,
        is_member: joinedCommunityIds.has(c.id),
        user_role: userMemberships[c.id]?.role || null,
        user_status: userMemberships[c.id]?.status || null,
      }));

      setCommunities(enrichedCommunities);
    } catch (err) {
      console.error("[useCommunities] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch communities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [userId, filter]);

  return { communities, loading, error, refetch: fetchCommunities };
}

// Discover communities (trending, by category)
export function useDiscoverCommunities(options?: { category?: string; tag?: string; limit?: number }) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [trending, setTrending] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiscoverCommunities = async () => {
      try {
        setLoading(true);

        let query = supabase
          .from("communities")
          .select(`
            *,
            creator:profiles!communities_created_by_fkey (
              username,
              display_name,
              avatar_url
            )
          `)
          .eq("privacy", "public")
          .order("created_at", { ascending: false });

        if (options?.category) {
          query = query.eq("category", options.category);
        }

        if (options?.limit) {
          query = query.limit(options.limit);
        }

        const { data: communitiesData } = await query;

        if (!communitiesData || communitiesData.length === 0) {
          setCommunities([]);
          setTrending([]);
          return;
        }

        // Filter by tag if specified
        let filteredIds = new Set(communitiesData.map(c => c.id));

        if (options?.tag) {
          const { data: taggedCommunities } = await supabase
            .from("community_tags")
            .select("community_id")
            .eq("tag", options.tag);

          const taggedIds = new Set((taggedCommunities || []).map(t => t.community_id));
          filteredIds = new Set([...filteredIds].filter(id => taggedIds.has(id)));
        }

        const communityIds = [...filteredIds];

        // Get member counts for sorting by popularity
        const { data: membersData } = await supabase
          .from("community_members")
          .select("community_id")
          .in("community_id", communityIds)
          .eq("status", "active");

        const memberCounts: Record<string, number> = {};
        (membersData || []).forEach(m => {
          memberCounts[m.community_id] = (memberCounts[m.community_id] || 0) + 1;
        });

        const enrichedCommunities = communitiesData
          .filter(c => filteredIds.has(c.id))
          .map(c => ({
            ...c,
            member_count: memberCounts[c.id] || 0,
          }));

        setCommunities(enrichedCommunities);

        // Trending = sorted by member count
        const trendingSorted = [...enrichedCommunities]
          .sort((a, b) => (b.member_count || 0) - (a.member_count || 0))
          .slice(0, 5);

        setTrending(trendingSorted);
      } catch (err) {
        console.error("[useDiscoverCommunities] Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscoverCommunities();
  }, [options?.category, options?.tag, options?.limit]);

  return { communities, trending, loading };
}

// ============================================================================
// Suggested Communities Algorithm
// ============================================================================
// Recommendation algorithm based on:
// 1. Topic/Interest Matching (40%) - post types, joined community topics
// 2. Social Graph (30%) - communities that followed users have joined
// 3. Engagement Signals (20%) - activity, member count growth
// 4. Location (10%) - same location as user
// ============================================================================

export function useSuggestedCommunities(userId?: string, limit: number = 10) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchSuggestedCommunities = async () => {
      try {
        setLoading(true);

        // 1. Get user's profile (for location)
        const { data: profile } = await supabase
          .from("profiles")
          .select("location")
          .eq("id", userId)
          .single();

        // 2. Get communities user has already joined (to exclude)
        const { data: joinedData } = await supabase
          .from("community_members")
          .select("community_id")
          .eq("user_id", userId)
          .eq("status", "active");

        const joinedIds = new Set((joinedData || []).map(m => m.community_id));

        // 3. Get user's post types to understand their interests
        const { data: userPosts } = await supabase
          .from("posts")
          .select("type")
          .eq("author_id", userId)
          .limit(50);

        const postTypeCounts: Record<string, number> = {};
        (userPosts || []).forEach(p => {
          postTypeCounts[p.type] = (postTypeCounts[p.type] || 0) + 1;
        });

        // Map post types to community topics
        const postTypeToTopic: Record<string, string[]> = {
          'poem': ['Writing & Literature', 'Performing Arts'],
          'story': ['Writing & Literature'],
          'essay': ['Writing & Literature'],
          'journal': ['Writing & Literature'],
          'letter': ['Writing & Literature'],
          'screenplay': ['Writing & Literature', 'Film & Video'],
          'visual': ['Visual Arts', 'Photography'],
          'audio': ['Music & Audio', 'Performing Arts'],
          'video': ['Film & Video'],
          'quote': ['Writing & Literature'],
          'thought': ['Writing & Literature'],
        };

        const userInterestTopics: Record<string, number> = {};
        Object.entries(postTypeCounts).forEach(([type, count]) => {
          const topics = postTypeToTopic[type] || [];
          topics.forEach(topic => {
            userInterestTopics[topic] = (userInterestTopics[topic] || 0) + count;
          });
        });

        // 4. Get topics from communities user has joined
        const { data: joinedCommunities } = await supabase
          .from("communities")
          .select("topics")
          .in("id", [...joinedIds]);

        (joinedCommunities || []).forEach(c => {
          (c.topics || []).forEach((topic: string) => {
            userInterestTopics[topic] = (userInterestTopics[topic] || 0) + 5; // Higher weight for joined
          });
        });

        // 5. Get communities that followed users have joined (social graph)
        const { data: following } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId);

        const followingIds = (following || []).map(f => f.following_id);

        let socialCommunityIds: string[] = [];
        if (followingIds.length > 0) {
          const { data: socialData } = await supabase
            .from("community_members")
            .select("community_id")
            .in("user_id", followingIds)
            .eq("status", "active");

          socialCommunityIds = (socialData || []).map(m => m.community_id);
        }

        const socialCommunityCount: Record<string, number> = {};
        socialCommunityIds.forEach(id => {
          socialCommunityCount[id] = (socialCommunityCount[id] || 0) + 1;
        });

        // 6. Get all public communities not joined by user
        const { data: allCommunities } = await supabase
          .from("communities")
          .select(`
            *,
            creator:profiles!communities_created_by_fkey (
              username,
              display_name,
              avatar_url
            )
          `)
          .eq("privacy", "public");

        if (!allCommunities) {
          setCommunities([]);
          return;
        }

        // Filter out joined communities
        const availableCommunities = allCommunities.filter(c => !joinedIds.has(c.id));

        // 7. Get member counts
        const communityIds = availableCommunities.map(c => c.id);
        const { data: membersData } = await supabase
          .from("community_members")
          .select("community_id")
          .in("community_id", communityIds)
          .eq("status", "active");

        const memberCounts: Record<string, number> = {};
        (membersData || []).forEach(m => {
          memberCounts[m.community_id] = (memberCounts[m.community_id] || 0) + 1;
        });

        // 8. Calculate recommendation scores
        const scoredCommunities = availableCommunities.map(community => {
          let score = 0;

          // Topic matching (40% weight)
          const communityTopics = community.topics || [];
          let topicScore = 0;
          communityTopics.forEach((topic: string) => {
            if (userInterestTopics[topic]) {
              topicScore += userInterestTopics[topic];
            }
          });
          score += Math.min(topicScore * 4, 40); // Cap at 40

          // Social graph (30% weight)
          const socialCount = socialCommunityCount[community.id] || 0;
          score += Math.min(socialCount * 10, 30); // Cap at 30

          // Engagement/Activity (20% weight)
          const memberCount = memberCounts[community.id] || 0;
          // Favor medium-sized active communities
          if (memberCount >= 5 && memberCount <= 100) {
            score += 15;
          } else if (memberCount > 100) {
            score += 20;
          } else if (memberCount >= 1) {
            score += 5;
          }

          // Location matching (10% weight)
          if (profile?.location && community.location) {
            const userLoc = profile.location.toLowerCase();
            const commLoc = community.location.toLowerCase();
            if (userLoc === commLoc || userLoc.includes(commLoc) || commLoc.includes(userLoc)) {
              score += 10;
            }
          }

          return {
            ...community,
            member_count: memberCount,
            recommendation_score: score,
          };
        });

        // Sort by score and take top results
        const sorted = scoredCommunities
          .sort((a, b) => b.recommendation_score - a.recommendation_score)
          .slice(0, limit);

        setCommunities(sorted);
      } catch (err) {
        console.error("[useSuggestedCommunities] Error:", err);
        setCommunities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestedCommunities();
  }, [userId, limit]);

  return { communities, loading };
}

// Fetch community members
export function useCommunityMembers(communityId: string, options?: { role?: string; status?: string }) {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    if (!communityId) return;

    try {
      setLoading(true);

      let query = supabase
        .from("community_members")
        .select(`
          *,
          profile:profiles!community_members_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .eq("community_id", communityId)
        .order("joined_at", { ascending: true });

      if (options?.role) {
        query = query.eq("role", options.role);
      }

      if (options?.status) {
        query = query.eq("status", options.status);
      } else {
        // Default to active members
        query = query.eq("status", "active");
      }

      const { data, error } = await query;

      if (error) throw error;

      setMembers(data || []);
    } catch (err) {
      console.error("[useCommunityMembers] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [communityId, options?.role, options?.status]);

  return { members, loading, refetch: fetchMembers };
}

// Fetch community posts
export function useCommunityPosts(communityId: string, userId?: string, sortBy: 'newest' | 'top' = 'newest') {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pinnedPosts, setPinnedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = async () => {
    if (!communityId) return;

    try {
      setLoading(true);
      setError(null);

      // Get blocked users
      let blockedUserIds = new Set<string>();
      if (userId) {
        const [blockedByResult, iBlockedResult] = await Promise.all([
          supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
          supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
        ]);
        (blockedByResult.data || []).forEach(b => blockedUserIds.add(b.blocker_id));
        (iBlockedResult.data || []).forEach(b => blockedUserIds.add(b.blocked_id));
      }

      // Fetch posts
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(`
          *,
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
        `)
        .eq("community_id", communityId)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setPinnedPosts([]);
        return;
      }

      // Filter blocked users
      const filteredPosts = postsData.filter(post => !blockedUserIds.has(post.author_id));

      if (filteredPosts.length === 0) {
        setPosts([]);
        setPinnedPosts([]);
        return;
      }

      const postIds = filteredPosts.map(p => p.id);

      // Batch fetch counts
      const [admiresResult, commentsResult, relaysResult] = await Promise.all([
        supabase.from("admires").select("post_id").in("post_id", postIds),
        supabase.from("comments").select("post_id").in("post_id", postIds),
        supabase.from("relays").select("post_id").in("post_id", postIds),
      ]);

      const admiresCounts: Record<string, number> = {};
      const commentsCounts: Record<string, number> = {};
      const relaysCounts: Record<string, number> = {};

      (admiresResult.data || []).forEach(a => {
        admiresCounts[a.post_id] = (admiresCounts[a.post_id] || 0) + 1;
      });
      (commentsResult.data || []).forEach(c => {
        commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
      });
      (relaysResult.data || []).forEach(r => {
        relaysCounts[r.post_id] = (relaysCounts[r.post_id] || 0) + 1;
      });

      // User interactions
      let userAdmires: Set<string> = new Set();
      let userSaves: Set<string> = new Set();
      let userRelays: Set<string> = new Set();

      if (userId) {
        const [userAdmiresResult, userSavesResult, userRelaysResult] = await Promise.all([
          supabase.from("admires").select("post_id").eq("user_id", userId).in("post_id", postIds),
          supabase.from("saves").select("post_id").eq("user_id", userId).in("post_id", postIds),
          supabase.from("relays").select("post_id").eq("user_id", userId).in("post_id", postIds),
        ]);

        userAdmires = new Set((userAdmiresResult.data || []).map(a => a.post_id));
        userSaves = new Set((userSavesResult.data || []).map(s => s.post_id));
        userRelays = new Set((userRelaysResult.data || []).map(r => r.post_id));
      }

      // Enrich posts with stats
      const enrichedPosts = filteredPosts.map(post => ({
        ...post,
        media: (post.media || []).sort((a: PostMedia, b: PostMedia) => a.position - b.position),
        admires_count: admiresCounts[post.id] || 0,
        comments_count: commentsCounts[post.id] || 0,
        relays_count: relaysCounts[post.id] || 0,
        user_has_admired: userAdmires.has(post.id),
        user_has_saved: userSaves.has(post.id),
        user_has_relayed: userRelays.has(post.id),
      }));

      // Separate pinned and regular posts
      const pinned = enrichedPosts.filter(p => p.is_pinned);
      let regular = enrichedPosts.filter(p => !p.is_pinned);

      // Sort regular posts
      if (sortBy === 'top') {
        regular.sort((a, b) => b.admires_count - a.admires_count);
      }
      // 'newest' is already sorted by created_at DESC

      setPinnedPosts(pinned);
      setPosts(regular);
    } catch (err) {
      console.error("[useCommunityPosts] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [communityId, userId, sortBy]);

  // Real-time subscription
  useEffect(() => {
    if (!communityId) return;

    const channel = supabase
      .channel(`community-posts-${communityId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: `community_id=eq.${communityId}` },
        () => fetchPosts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId]);

  return { posts, pinnedPosts, loading, error, refetch: fetchPosts };
}

// Join/Leave community
export function useJoinCommunity() {
  const [loading, setLoading] = useState(false);

  const join = async (communityId: string, userId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("community_members").insert({
        community_id: communityId,
        user_id: userId,
        role: 'member',
        status: 'active',
      });

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("[useJoinCommunity] Join Error:", errorMessage, err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const leave = async (communityId: string, userId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", userId);

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("[useJoinCommunity] Leave Error:", errorMessage, err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const requestJoin = async (communityId: string, userId: string, message?: string) => {
    setLoading(true);
    try {
      // Check if request already exists
      const { data: existingRequest } = await supabase
        .from("community_join_requests")
        .select("id, status")
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRequest) {
        // Request already exists - treat as success if pending
        if (existingRequest.status === 'pending') {
          return { success: true, alreadyRequested: true };
        }
        // If previously rejected, delete and create new request
        if (existingRequest.status === 'rejected') {
          await supabase
            .from("community_join_requests")
            .delete()
            .eq("id", existingRequest.id);
        }
      }

      const { error } = await supabase.from("community_join_requests").insert({
        community_id: communityId,
        user_id: userId,
        message: message || null,
        status: 'pending',
      });

      if (error) {
        // Handle duplicate key error gracefully (race condition)
        if (error.code === '23505') {
          return { success: true, alreadyRequested: true };
        }
        throw error;
      }

      // Notify community admins about the join request
      const { data: admins } = await supabase
        .from("community_members")
        .select("user_id")
        .eq("community_id", communityId)
        .eq("role", "admin")
        .eq("status", "active");

      if (admins && admins.length > 0) {
        await Promise.all(
          admins.map(admin =>
            createNotification(admin.user_id, userId, 'community_join_request', undefined, undefined, communityId)
          )
        );
      }

      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("[useJoinCommunity] Request Error:", errorMessage, err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const cancelRequest = async (communityId: string, userId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("community_join_requests")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .eq("status", "pending");

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("[useJoinCommunity] Cancel Error:", errorMessage, err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  return { join, leave, requestJoin, cancelRequest, loading };
}

// Community invitations
export function useCommunityInvitations(userId?: string) {
  const [invitations, setInvitations] = useState<CommunityInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvitations = async () => {
    if (!userId) {
      setInvitations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("community_invitations")
        .select(`
          *,
          community:communities (
            name,
            slug,
            avatar_url
          ),
          inviter:profiles!community_invitations_inviter_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("invitee_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setInvitations(data || []);
    } catch (err) {
      console.error("[useCommunityInvitations] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const accept = async (invitationId: string, communityId: string, userId: string) => {
    try {
      // Update invitation status
      await supabase
        .from("community_invitations")
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq("id", invitationId);

      // Add as member
      await supabase.from("community_members").insert({
        community_id: communityId,
        user_id: userId,
        role: 'member',
        status: 'active',
      });

      fetchInvitations();
      return { success: true };
    } catch (err) {
      console.error("[useCommunityInvitations] Accept Error:", err);
      return { success: false, error: err };
    }
  };

  const decline = async (invitationId: string) => {
    try {
      await supabase
        .from("community_invitations")
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq("id", invitationId);

      fetchInvitations();
      return { success: true };
    } catch (err) {
      console.error("[useCommunityInvitations] Decline Error:", err);
      return { success: false, error: err };
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [userId]);

  return { invitations, loading, accept, decline, refetch: fetchInvitations };
}

// Join requests (for admins)
export function useJoinRequests(communityId: string) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    console.log("[useJoinRequests] fetchRequests called, communityId:", communityId);

    if (!communityId) {
      console.log("[useJoinRequests] No communityId, returning empty");
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log("[useJoinRequests] Fetching join requests for community:", communityId);

      const { data, error } = await supabase
        .from("community_join_requests")
        .select(`
          *,
          profile:profiles!community_join_requests_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("community_id", communityId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      console.log("[useJoinRequests] Query result - data:", data?.length, "error:", error);

      if (error) throw error;

      setRequests(data || []);
    } catch (err) {
      console.error("[useJoinRequests] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (requestId: string, userId: string, adminId: string) => {
    try {
      // Update request
      await supabase
        .from("community_join_requests")
        .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
        .eq("id", requestId);

      // Add as member
      await supabase.from("community_members").insert({
        community_id: communityId,
        user_id: userId,
        role: 'member',
        status: 'active',
      });

      // Create notification
      await createNotification(userId, adminId, 'community_join_approved', undefined, undefined, communityId);

      fetchRequests();
      return { success: true };
    } catch (err) {
      console.error("[useJoinRequests] Approve Error:", err);
      return { success: false, error: err };
    }
  };

  const reject = async (requestId: string, adminId: string) => {
    try {
      await supabase
        .from("community_join_requests")
        .update({ status: 'rejected', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
        .eq("id", requestId);

      fetchRequests();
      return { success: true };
    } catch (err) {
      console.error("[useJoinRequests] Reject Error:", err);
      return { success: false, error: err };
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [communityId]);

  // Real-time subscription
  useEffect(() => {
    if (!communityId) return;

    const channel = supabase
      .channel(`join-requests-${communityId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_join_requests', filter: `community_id=eq.${communityId}` },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId]);

  return { requests, loading, approve, reject, refetch: fetchRequests };
}

// Create community
export function useCreateCommunity() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (data: {
    name: string;
    slug: string;
    description?: string;
    avatar_url?: string;
    cover_url?: string;
    privacy: 'public' | 'private';
    topics?: string[];
    rules?: { title: string; description?: string }[];
    tags?: { tag: string; tag_type: string }[];
  }, userId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Create community
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .insert({
          name: data.name,
          slug: data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          description: data.description || null,
          avatar_url: data.avatar_url || null,
          cover_url: data.cover_url || null,
          privacy: data.privacy,
          topics: data.topics || [],
          created_by: userId,
        })
        .select()
        .single();

      if (communityError) {
        if (communityError.code === '23505') {
          setError("A community with this name already exists");
        } else {
          setError(communityError.message);
        }
        return { success: false, error: communityError };
      }

      // Add rules if provided
      if (data.rules && data.rules.length > 0) {
        const rulesData = data.rules.map((rule, index) => ({
          community_id: community.id,
          rule_number: index + 1,
          title: rule.title,
          description: rule.description || null,
        }));

        await supabase.from("community_rules").insert(rulesData);
      }

      // Add tags if provided
      if (data.tags && data.tags.length > 0) {
        const tagsData = data.tags.map(t => ({
          community_id: community.id,
          tag: t.tag,
          tag_type: t.tag_type,
        }));

        await supabase.from("community_tags").insert(tagsData);
      }

      return { success: true, community };
    } catch (err) {
      console.error("[useCreateCommunity] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to create community");
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  return { create, loading, error };
}

// Update community
export function useUpdateCommunity() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (communityId: string, data: Partial<{
    name: string;
    description: string;
    avatar_url: string;
    cover_url: string;
    privacy: 'public' | 'private';
    category: string;
  }>) => {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("communities")
        .update(data)
        .eq("id", communityId);

      if (updateError) throw updateError;

      return { success: true };
    } catch (err) {
      console.error("[useUpdateCommunity] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to update community");
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const updateRules = async (communityId: string, rules: { title: string; description?: string }[]) => {
    setLoading(true);

    try {
      // Delete existing rules
      await supabase.from("community_rules").delete().eq("community_id", communityId);

      // Insert new rules
      if (rules.length > 0) {
        const rulesData = rules.map((rule, index) => ({
          community_id: communityId,
          rule_number: index + 1,
          title: rule.title,
          description: rule.description || null,
        }));

        await supabase.from("community_rules").insert(rulesData);
      }

      return { success: true };
    } catch (err) {
      console.error("[useUpdateCommunity] Rules Error:", err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const updateTags = async (communityId: string, tags: { tag: string; tag_type: string }[]) => {
    setLoading(true);

    try {
      // Delete existing tags
      await supabase.from("community_tags").delete().eq("community_id", communityId);

      // Insert new tags
      if (tags.length > 0) {
        const tagsData = tags.map(t => ({
          community_id: communityId,
          tag: t.tag,
          tag_type: t.tag_type,
        }));

        await supabase.from("community_tags").insert(tagsData);
      }

      return { success: true };
    } catch (err) {
      console.error("[useUpdateCommunity] Tags Error:", err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  return { update, updateRules, updateTags, loading, error };
}

// Delete community
export function useDeleteCommunity() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteCommunity = async (communityId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Delete related data first (order matters due to foreign keys)
      // Delete posts and their related data
      const { data: communityPosts } = await supabase
        .from("posts")
        .select("id")
        .eq("community_id", communityId);

      if (communityPosts && communityPosts.length > 0) {
        const postIds = communityPosts.map(p => p.id);

        // Delete post-related data
        await Promise.all([
          supabase.from("post_media").delete().in("post_id", postIds),
          supabase.from("admires").delete().in("post_id", postIds),
          supabase.from("saves").delete().in("post_id", postIds),
          supabase.from("relays").delete().in("post_id", postIds),
          supabase.from("comments").delete().in("post_id", postIds),
          supabase.from("notifications").delete().in("post_id", postIds),
        ]);

        // Delete the posts
        await supabase.from("posts").delete().eq("community_id", communityId);
      }

      // Delete community-related data
      await Promise.all([
        supabase.from("community_members").delete().eq("community_id", communityId),
        supabase.from("community_join_requests").delete().eq("community_id", communityId),
        supabase.from("community_invitations").delete().eq("community_id", communityId),
        supabase.from("community_rules").delete().eq("community_id", communityId),
        supabase.from("community_tags").delete().eq("community_id", communityId),
        supabase.from("notifications").delete().eq("community_id", communityId),
      ]);

      // Finally delete the community itself
      const { error: deleteError } = await supabase
        .from("communities")
        .delete()
        .eq("id", communityId);

      if (deleteError) throw deleteError;

      return { success: true };
    } catch (err) {
      console.error("[useDeleteCommunity] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to delete community");
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  return { deleteCommunity, loading, error };
}

// Community moderation
export function useCommunityModeration(communityId: string) {
  // Check and auto-unmute expired mutes
  const checkExpiredMutes = async () => {
    try {
      // Get muted members whose mute has expired
      const { data: expiredMutes } = await supabase
        .from("community_members")
        .select("user_id")
        .eq("community_id", communityId)
        .eq("status", "muted")
        .not("muted_until", "is", null)
        .lt("muted_until", new Date().toISOString());

      if (expiredMutes && expiredMutes.length > 0) {
        // Auto-unmute all expired mutes
        await supabase
          .from("community_members")
          .update({ status: 'active', muted_until: null })
          .eq("community_id", communityId)
          .in("user_id", expiredMutes.map(m => m.user_id));

        return { unmuteCount: expiredMutes.length };
      }

      return { unmuteCount: 0 };
    } catch (err) {
      console.error("[useCommunityModeration] Check Expired Mutes Error:", err);
      return { unmuteCount: 0, error: err };
    }
  };

  const muteUser = async (userId: string, actorId: string, mutedUntil?: Date) => {
    try {
      await supabase
        .from("community_members")
        .update({
          status: 'muted',
          muted_until: mutedUntil?.toISOString() || null,
        })
        .eq("community_id", communityId)
        .eq("user_id", userId);

      // Send notification
      await createNotification(userId, actorId, 'community_muted', undefined, undefined, communityId);

      return { success: true };
    } catch (err) {
      console.error("[useCommunityModeration] Mute Error:", err);
      return { success: false, error: err };
    }
  };

  const unmuteUser = async (userId: string) => {
    try {
      await supabase
        .from("community_members")
        .update({ status: 'active', muted_until: null })
        .eq("community_id", communityId)
        .eq("user_id", userId);

      return { success: true };
    } catch (err) {
      console.error("[useCommunityModeration] Unmute Error:", err);
      return { success: false, error: err };
    }
  };

  const banUser = async (userId: string, actorId: string) => {
    try {
      await supabase
        .from("community_members")
        .update({ status: 'banned' })
        .eq("community_id", communityId)
        .eq("user_id", userId);

      // Send notification
      await createNotification(userId, actorId, 'community_banned', undefined, undefined, communityId);

      return { success: true };
    } catch (err) {
      console.error("[useCommunityModeration] Ban Error:", err);
      return { success: false, error: err };
    }
  };

  const unbanUser = async (userId: string) => {
    try {
      await supabase
        .from("community_members")
        .update({ status: 'active' })
        .eq("community_id", communityId)
        .eq("user_id", userId);

      return { success: true };
    } catch (err) {
      console.error("[useCommunityModeration] Unban Error:", err);
      return { success: false, error: err };
    }
  };

  const promoteUser = async (userId: string, role: 'admin' | 'moderator', actorId?: string) => {
    try {
      await supabase
        .from("community_members")
        .update({ role })
        .eq("community_id", communityId)
        .eq("user_id", userId);

      // Notify user about their role change
      if (actorId) {
        await createNotification(userId, actorId, 'community_role_change', undefined, `You are now a ${role}`, communityId);
      }

      return { success: true };
    } catch (err) {
      console.error("[useCommunityModeration] Promote Error:", err);
      return { success: false, error: err };
    }
  };

  const demoteUser = async (userId: string, actorId?: string) => {
    try {
      await supabase
        .from("community_members")
        .update({ role: 'member' })
        .eq("community_id", communityId)
        .eq("user_id", userId);

      // Notify user about their role change
      if (actorId) {
        await createNotification(userId, actorId, 'community_role_change', undefined, 'You are now a member', communityId);
      }

      return { success: true };
    } catch (err) {
      console.error("[useCommunityModeration] Demote Error:", err);
      return { success: false, error: err };
    }
  };

  const pinPost = async (postId: string, adminId: string) => {
    try {
      await supabase
        .from("posts")
        .update({
          is_pinned: true,
          pinned_at: new Date().toISOString(),
          pinned_by: adminId,
        })
        .eq("id", postId)
        .eq("community_id", communityId);

      return { success: true };
    } catch (err) {
      console.error("[useCommunityModeration] Pin Error:", err);
      return { success: false, error: err };
    }
  };

  const unpinPost = async (postId: string) => {
    try {
      await supabase
        .from("posts")
        .update({
          is_pinned: false,
          pinned_at: null,
          pinned_by: null,
        })
        .eq("id", postId)
        .eq("community_id", communityId);

      return { success: true };
    } catch (err) {
      console.error("[useCommunityModeration] Unpin Error:", err);
      return { success: false, error: err };
    }
  };

  const deletePost = async (postId: string) => {
    try {
      // Delete related data first
      await Promise.all([
        supabase.from("post_media").delete().eq("post_id", postId),
        supabase.from("admires").delete().eq("post_id", postId),
        supabase.from("saves").delete().eq("post_id", postId),
        supabase.from("relays").delete().eq("post_id", postId),
        supabase.from("comments").delete().eq("post_id", postId),
        supabase.from("notifications").delete().eq("post_id", postId),
      ]);

      // Delete the post
      await supabase.from("posts").delete().eq("id", postId);

      return { success: true };
    } catch (err) {
      console.error("[useCommunityModeration] Delete Post Error:", err);
      return { success: false, error: err };
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      // Delete comment likes first
      await supabase.from("comment_likes").delete().eq("comment_id", commentId);
      // Delete replies
      await supabase.from("comments").delete().eq("parent_id", commentId);
      // Delete comment
      await supabase.from("comments").delete().eq("id", commentId);

      return { success: true };
    } catch (err) {
      console.error("[useCommunityModeration] Delete Comment Error:", err);
      return { success: false, error: err };
    }
  };

  const inviteUser = async (inviterId: string, inviteeId: string) => {
    try {
      // Check if invitation already exists
      const { data: existingInvitation } = await supabase
        .from("community_invitations")
        .select("id, status")
        .eq("community_id", communityId)
        .eq("invitee_id", inviteeId)
        .maybeSingle();

      if (existingInvitation) {
        // Invitation already exists
        if (existingInvitation.status === 'pending') {
          return { success: true, alreadyInvited: true };
        }
        // If previously declined, delete and create new invitation
        if (existingInvitation.status === 'declined') {
          await supabase
            .from("community_invitations")
            .delete()
            .eq("id", existingInvitation.id);
        }
        // If accepted, user is already a member
        if (existingInvitation.status === 'accepted') {
          return { success: false, error: 'User is already a member' };
        }
      }

      const { error } = await supabase.from("community_invitations").insert({
        community_id: communityId,
        inviter_id: inviterId,
        invitee_id: inviteeId,
        status: 'pending',
      });

      if (error) {
        // Handle duplicate key error gracefully (race condition)
        if (error.code === '23505') {
          return { success: true, alreadyInvited: true };
        }
        throw error;
      }

      // Create notification
      await createNotification(inviteeId, inviterId, 'community_invite', undefined, undefined, communityId);

      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("[useCommunityModeration] Invite Error:", errorMessage, err);
      return { success: false, error: err };
    }
  };

  return {
    checkExpiredMutes,
    muteUser,
    unmuteUser,
    banUser,
    unbanUser,
    promoteUser,
    demoteUser,
    pinPost,
    unpinPost,
    deletePost,
    deleteComment,
    inviteUser,
  };
}

// ============================================
// SEARCH
// ============================================

export interface SearchResultProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface SearchResultCommunity {
  id: string;
  slug: string;
  name: string;
  avatar_url: string | null;
  member_count: number;
}

export interface SearchResultTag {
  tag: string;
  community_count: number;
}

export interface SearchResults {
  profiles: SearchResultProfile[];
  communities: SearchResultCommunity[];
  tags: SearchResultTag[];
}

export function useSearch(query: string, options?: { debounceMs?: number; limit?: number }) {
  const [results, setResults] = useState<SearchResults>({ profiles: [], communities: [], tags: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceMs = options?.debounceMs ?? 300;
  const limit = options?.limit ?? 5;

  useEffect(() => {
    // Don't search if query is too short
    if (!query || query.trim().length < 2) {
      setResults({ profiles: [], communities: [], tags: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const timeoutId = setTimeout(async () => {
      try {
        const searchQuery = query.trim();

        // Run all searches in parallel
        const [profilesResult, communitiesResult, tagsResult] = await Promise.all([
          // Search profiles
          supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
            .limit(limit),

          // Search public communities
          supabase
            .from("communities")
            .select("id, slug, name, avatar_url")
            .eq("privacy", "public")
            .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
            .limit(limit),

          // Search tags (distinct)
          supabase
            .from("community_tags")
            .select("tag")
            .ilike("tag", `%${searchQuery}%`)
            .limit(limit * 2), // Get more since we'll dedupe
        ]);

        const profiles = (profilesResult.data || []) as SearchResultProfile[];

        // Get member counts for communities
        const communities = communitiesResult.data || [];
        let enrichedCommunities: SearchResultCommunity[] = [];

        if (communities.length > 0) {
          const communityIds = communities.map(c => c.id);
          const { data: membersData } = await supabase
            .from("community_members")
            .select("community_id")
            .in("community_id", communityIds)
            .eq("status", "active");

          const memberCounts: Record<string, number> = {};
          (membersData || []).forEach(m => {
            memberCounts[m.community_id] = (memberCounts[m.community_id] || 0) + 1;
          });

          enrichedCommunities = communities.map(c => ({
            ...c,
            member_count: memberCounts[c.id] || 0,
          }));
        }

        // Dedupe tags and count occurrences
        const tagCounts: Record<string, number> = {};
        (tagsResult.data || []).forEach(t => {
          tagCounts[t.tag] = (tagCounts[t.tag] || 0) + 1;
        });

        const tags: SearchResultTag[] = Object.entries(tagCounts)
          .map(([tag, count]) => ({ tag, community_count: count }))
          .slice(0, limit);

        setResults({
          profiles,
          communities: enrichedCommunities,
          tags,
        });
      } catch (err) {
        console.error("[useSearch] Error:", err);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [query, debounceMs, limit]);

  return { results, loading, error };
}

// ============================================
// VOICE NOTES HOOKS
// ============================================

export interface VoiceRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  waveformData: number[];
  error: string | null;
  hasPermission: boolean;
}

export function useVoiceRecorder(maxDuration: number = 300) {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    waveformData: [],
    error: null,
    hasPermission: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const waveformIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Check for browser support
  const isSupported = typeof window !== 'undefined' &&
    navigator.mediaDevices &&
    typeof MediaRecorder !== 'undefined';

  // Get the best supported MIME type
  const getMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      setState(prev => ({ ...prev, error: 'Audio recording is not supported in this browser' }));
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setState(prev => ({ ...prev, hasPermission: true, error: null }));
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Microphone permission denied';
      setState(prev => ({ ...prev, hasPermission: false, error }));
      return false;
    }
  };

  const startRecording = async () => {
    if (!isSupported) {
      setState(prev => ({ ...prev, error: 'Audio recording is not supported' }));
      return;
    }

    try {
      // Reset state
      setState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        audioUrl: null,
        waveformData: [],
        error: null,
      }));
      chunksRef.current = [];

      // Get audio stream with simple settings for better quality
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      streamRef.current = stream;

      // Set up audio context for waveform visualization only
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.3;
      source.connect(analyserRef.current);

      // Create media recorder with higher quality settings
      const mimeType = getMimeType();
      const options: MediaRecorderOptions = { mimeType };
      if (MediaRecorder.isTypeSupported(mimeType)) {
        options.audioBitsPerSecond = 128000;
      }
      mediaRecorderRef.current = new MediaRecorder(stream, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setState(prev => ({
          ...prev,
          audioBlob: blob,
          audioUrl: url,
          isRecording: false,
        }));
      };

      // Start recording - no timeslice for better audio quality
      mediaRecorderRef.current.start();
      startTimeRef.current = Date.now();

      setState(prev => ({ ...prev, isRecording: true, hasPermission: true }));

      // Start duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState(prev => ({ ...prev, duration: elapsed }));

        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 1000);

      // Start waveform sampling
      const waveformData: number[] = [];
      waveformIntervalRef.current = setInterval(() => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate average amplitude
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const normalized = average / 255;

          waveformData.push(normalized);
          // Keep last 100 samples for visualization
          if (waveformData.length > 100) {
            waveformData.shift();
          }

          setState(prev => ({ ...prev, waveformData: [...waveformData] }));
        }
      }, 100);

    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to start recording';
      setState(prev => ({ ...prev, error, isRecording: false }));
    }
  };

  const stopRecording = () => {
    // Clear timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setState(prev => ({ ...prev, isPaused: true }));
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      const pausedDuration = state.duration;
      startTimeRef.current = Date.now() - (pausedDuration * 1000);
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState(prev => ({ ...prev, duration: elapsed }));
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 1000);
      setState(prev => ({ ...prev, isPaused: false }));
    }
  };

  const cancelRecording = () => {
    stopRecording();
    chunksRef.current = [];
    setState(prev => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      waveformData: [],
    }));
  };

  const reset = () => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    setState(prev => ({
      ...prev,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      waveformData: [],
      error: null,
    }));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }
    };
  }, []);

  return {
    ...state,
    isSupported,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    requestPermission,
    reset,
  };
}

export interface AudioPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  error: string | null;
}

export function useAudioPlayer(audioUrl: string | null) {
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadstart = () => setState(prev => ({ ...prev, isLoading: true }));
    audio.oncanplay = () => setState(prev => ({ ...prev, isLoading: false }));
    audio.onloadedmetadata = () => setState(prev => ({ ...prev, duration: audio.duration }));
    audio.ontimeupdate = () => setState(prev => ({ ...prev, currentTime: audio.currentTime }));
    audio.onended = () => setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    audio.onplay = () => setState(prev => ({ ...prev, isPlaying: true }));
    audio.onpause = () => setState(prev => ({ ...prev, isPlaying: false }));
    audio.onerror = () => setState(prev => ({ ...prev, error: 'Failed to load audio', isLoading: false }));

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);

  const play = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => {
        setState(prev => ({ ...prev, error: err.message }));
      });
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const toggle = () => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setState(prev => ({ ...prev, currentTime: time }));
    }
  };

  const setPlaybackRate = (rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      setState(prev => ({ ...prev, playbackRate: rate }));
    }
  };

  return {
    ...state,
    play,
    pause,
    toggle,
    seek,
    setPlaybackRate,
  };
}

export function useSendVoiceNote() {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sendVoiceNote = async (
    conversationId: string,
    senderId: string,
    audioBlob: Blob,
    duration: number,
    waveformData: number[]
  ) => {
    setSending(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Upload audio to Supabase Storage (0-60%)
      setProgress(10);

      const fileExt = audioBlob.type.includes('webm') ? 'webm' : 'mp4';
      const fileName = `${senderId}/${conversationId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-notes')
        .upload(fileName, audioBlob, {
          cacheControl: '31536000',
          contentType: audioBlob.type,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setProgress(60);

      // Step 2: Get public URL (60-70%)
      const { data: { publicUrl } } = supabase.storage
        .from('voice-notes')
        .getPublicUrl(uploadData.path);

      setProgress(70);

      // Step 3: Create message record (70-90%)
      const { data: message, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: '',
          message_type: 'voice',
          voice_url: publicUrl,
          voice_duration: Math.round(duration),
          waveform_data: waveformData,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to save message: ${insertError.message}`);
      }

      setProgress(90);

      // Step 4: Update conversation timestamp (90-100%)
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      setProgress(100);

      return message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send voice note';
      setError(errorMessage);
      console.error('[useSendVoiceNote] Error:', err);
      return null;
    } finally {
      setSending(false);
    }
  };

  return { sendVoiceNote, sending, progress, error };
}

// ============================================================================
// Media Message Hook
// ============================================================================

export interface MediaLimits {
  maxImageSize: number; // in bytes
  maxVideoSize: number; // in bytes
  allowedImageTypes: string[];
  allowedVideoTypes: string[];
}

const DEFAULT_MEDIA_LIMITS: MediaLimits = {
  maxImageSize: 10 * 1024 * 1024, // 10MB
  maxVideoSize: 50 * 1024 * 1024, // 50MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
};

export function useSendMedia(limits: MediaLimits = DEFAULT_MEDIA_LIMITS) {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): { valid: boolean; error?: string; mediaType?: 'image' | 'video' } => {
    const isImage = limits.allowedImageTypes.includes(file.type);
    const isVideo = limits.allowedVideoTypes.includes(file.type);

    if (!isImage && !isVideo) {
      return {
        valid: false,
        error: `File type not supported. Allowed: ${[...limits.allowedImageTypes, ...limits.allowedVideoTypes].join(', ')}`,
      };
    }

    if (isImage && file.size > limits.maxImageSize) {
      const maxMB = limits.maxImageSize / (1024 * 1024);
      return { valid: false, error: `Image too large. Max size: ${maxMB}MB` };
    }

    if (isVideo && file.size > limits.maxVideoSize) {
      const maxMB = limits.maxVideoSize / (1024 * 1024);
      return { valid: false, error: `Video too large. Max size: ${maxMB}MB` };
    }

    return { valid: true, mediaType: isImage ? 'image' : 'video' };
  };

  const sendMedia = async (
    conversationId: string,
    senderId: string,
    file: File
  ) => {
    setSending(true);
    setProgress(0);
    setError(null);

    try {
      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setProgress(10);

      // Get file extension
      const ext = file.name.split('.').pop() || (validation.mediaType === 'image' ? 'jpg' : 'mp4');
      const fileName = `${senderId}/${conversationId}/${Date.now()}.${ext}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message-media')
        .upload(fileName, file, {
          cacheControl: '31536000',
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setProgress(60);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('message-media')
        .getPublicUrl(uploadData.path);

      setProgress(70);

      // Create message record
      const { data: message, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: '',
          message_type: 'media',
          media_url: publicUrl,
          media_type: validation.mediaType,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create message: ${insertError.message}`);
      }

      setProgress(90);

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      setProgress(100);

      return message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send media';
      setError(errorMessage);
      console.error('[useSendMedia] Error:', err);
      return null;
    } finally {
      setSending(false);
    }
  };

  return { sendMedia, validateFile, sending, progress, error, limits };
}

// ============================================
// COLLABORATOR & MENTION TYPES
// ============================================

export type CollaboratorStatus = 'pending' | 'accepted' | 'declined';

export interface Collaborator {
  id: string;
  post_id: string;
  user_id: string;
  status: CollaboratorStatus;
  invited_at: string;
  responded_at: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface Mention {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CollaborationInvite {
  id: string;
  post_id: string;
  user_id: string;
  status: CollaboratorStatus;
  invited_at: string;
  post: {
    id: string;
    title: string | null;
    type: string;
    content: string;
    status: string;
    author: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
}

// ============================================
// COLLABORATOR HOOKS
// ============================================

// Fetch collaborators for a post
export function useCollaborators(postId?: string) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollaborators = useCallback(async () => {
    if (!postId) {
      setCollaborators([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('post_collaborators')
        .select(`
          *,
          user:profiles!post_collaborators_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('invited_at', { ascending: true });

      if (error) throw error;
      setCollaborators(data || []);
    } catch (err) {
      console.error('[useCollaborators] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  // Real-time subscription for status changes
  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`collaborators-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_collaborators',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchCollaborators();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, fetchCollaborators]);

  const inviteCollaborator = async (userId: string, authorId: string) => {
    if (!postId) return { success: false, error: 'No post ID' };

    try {
      const { error } = await supabase
        .from('post_collaborators')
        .insert({
          post_id: postId,
          user_id: userId,
          status: 'pending',
        });

      if (error) throw error;

      // Send notification to the invited user
      await createNotification(userId, authorId, 'collaboration_invite', postId);

      return { success: true };
    } catch (err) {
      console.error('[inviteCollaborator] Error:', err);
      return { success: false, error: err };
    }
  };

  const removeCollaborator = async (userId: string) => {
    if (!postId) return { success: false, error: 'No post ID' };

    try {
      const { error } = await supabase
        .from('post_collaborators')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('[removeCollaborator] Error:', err);
      return { success: false, error: err };
    }
  };

  const respondToInvite = async (userId: string, accept: boolean, authorId: string) => {
    if (!postId) return { success: false, error: 'No post ID' };

    try {
      const { error } = await supabase
        .from('post_collaborators')
        .update({
          status: accept ? 'accepted' : 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) throw error;

      // Notify the post author of the response
      await createNotification(
        authorId,
        userId,
        accept ? 'collaboration_accepted' : 'collaboration_declined',
        postId
      );

      return { success: true };
    } catch (err) {
      console.error('[respondToInvite] Error:', err);
      return { success: false, error: err };
    }
  };

  return {
    collaborators,
    loading,
    inviteCollaborator,
    removeCollaborator,
    respondToInvite,
    refetch: fetchCollaborators,
  };
}

// Fetch collaboration invites for a user
export function useCollaborationInvites(userId?: string) {
  const [invites, setInvites] = useState<CollaborationInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvites = useCallback(async () => {
    if (!userId) {
      setInvites([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('post_collaborators')
        .select(`
          *,
          post:posts (
            id,
            title,
            type,
            content,
            status,
            author:profiles!posts_author_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

      console.log('[useCollaborationInvites] Query result:', { data, error, userId });

      if (error) {
        console.error('[useCollaborationInvites] Query error:', error);
        // Table might not exist yet - silently ignore
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          setInvites([]);
          return;
        }
        throw error;
      }

      console.log('[useCollaborationInvites] Found invites:', data?.length, data);
      setInvites(data || []);
    } catch (err: any) {
      // Silently handle table doesn't exist errors and network errors
      const errMsg = err?.message || '';
      const isTableError = err?.code === '42P01';
      const isNetworkError = errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError');
      if (!isTableError && !isNetworkError) {
        console.error('[useCollaborationInvites] Error:', errMsg || err);
      }
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`collab-invites-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_collaborators',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchInvites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchInvites]);

  const accept = async (postId: string, authorId: string) => {
    if (!userId) return { success: false };

    try {
      const { error } = await supabase
        .from('post_collaborators')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
        })
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) throw error;

      await createNotification(authorId, userId, 'collaboration_accepted', postId);
      return { success: true };
    } catch (err) {
      console.error('[accept] Error:', err);
      return { success: false, error: err };
    }
  };

  const decline = async (postId: string, authorId: string) => {
    if (!userId) return { success: false };

    try {
      const { error } = await supabase
        .from('post_collaborators')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) throw error;

      await createNotification(authorId, userId, 'collaboration_declined', postId);
      return { success: true };
    } catch (err) {
      console.error('[decline] Error:', err);
      return { success: false, error: err };
    }
  };

  return { invites, loading, accept, decline, refetch: fetchInvites };
}

// Fetch posts with pending collaborators (for post author)
export function usePendingCollaborations(userId?: string) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = useCallback(async () => {
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
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
          ),
          collaborators:post_collaborators (
            status,
            user:profiles!post_collaborators_user_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .eq('author_id', userId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('[usePendingCollaborations] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  return { posts, loading, refetch: fetchPending };
}

// ============================================
// MENTION HOOKS
// ============================================

// Fetch mentions for a post
export function useMentions(postId?: string) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMentions = useCallback(async () => {
    if (!postId) {
      setMentions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('post_mentions')
        .select(`
          *,
          user:profiles!post_mentions_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMentions(data || []);
    } catch (err) {
      console.error('[useMentions] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions]);

  const addMention = async (userId: string, authorId: string) => {
    if (!postId) return { success: false, error: 'No post ID' };

    try {
      const { error } = await supabase
        .from('post_mentions')
        .insert({
          post_id: postId,
          user_id: userId,
        });

      if (error) throw error;

      // Notify the mentioned user
      await createNotification(userId, authorId, 'mention', postId);

      return { success: true };
    } catch (err) {
      console.error('[addMention] Error:', err);
      return { success: false, error: err };
    }
  };

  const removeMention = async (userId: string) => {
    if (!postId) return { success: false, error: 'No post ID' };

    try {
      const { error } = await supabase
        .from('post_mentions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('[removeMention] Error:', err);
      return { success: false, error: err };
    }
  };

  return { mentions, loading, addMention, removeMention, refetch: fetchMentions };
}

// Fetch posts where user is mentioned
export function useMentionedPosts(userId?: string) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMentioned = useCallback(async () => {
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // First get the post IDs where user is mentioned
      const { data: mentionData, error: mentionError } = await supabase
        .from('post_mentions')
        .select('post_id')
        .eq('user_id', userId);

      if (mentionError) throw mentionError;

      if (!mentionData || mentionData.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const postIds = mentionData.map(m => m.post_id);

      // Fetch the actual posts
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
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
        `)
        .in('id', postIds)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('[useMentionedPosts] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMentioned();
  }, [fetchMentioned]);

  return { posts, loading, refetch: fetchMentioned };
}

// ============================================
// USER SEARCH HOOK (for people picker)
// ============================================

export interface SearchableUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

export function useUserSearch(currentUserId?: string) {
  const [results, setResults] = useState<SearchableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchableUser[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch suggestions (people user follows)
  const fetchSuggestions = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select(`
          following:profiles!follows_following_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .eq('follower_id', currentUserId)
        .limit(20);

      if (error) throw error;
      setSuggestions(data?.map(d => d.following as unknown as SearchableUser) || []);
    } catch (err) {
      console.error('[fetchSuggestions] Error:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const search = useCallback(async (query: string) => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Debounce the search
    debounceRef.current = setTimeout(async () => {
      try {
        // Get blocked users to filter them out
        let blockedUsers: Set<string> = new Set();
        if (currentUserId) {
          const [blockedBy, iBlocked] = await Promise.all([
            supabase.from('blocks').select('blocker_id').eq('blocked_id', currentUserId),
            supabase.from('blocks').select('blocked_id').eq('blocker_id', currentUserId),
          ]);
          (blockedBy.data || []).forEach(b => blockedUsers.add(b.blocker_id));
          (iBlocked.data || []).forEach(b => blockedUsers.add(b.blocked_id));
        }

        const searchQuery = query.toLowerCase();
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, is_verified')
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
          .limit(20);

        if (error) throw error;

        // Filter out blocked users and self
        const filtered = (data || []).filter(
          user => user.id !== currentUserId && !blockedUsers.has(user.id)
        );

        setResults(filtered);
      } catch (err) {
        console.error('[useUserSearch] Error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [currentUserId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { results, loading, search, suggestions };
}

// ============================================
// HELPER: Batch save collaborators and mentions
// ============================================

export async function saveCollaboratorsAndMentions(
  postId: string,
  authorId: string,
  collaborators: { id: string; role?: string }[],
  mentionIds: string[],
  hasCollaborators: boolean
): Promise<{ success: boolean; collaboratorsAdded: boolean; notificationsSent: boolean; error?: any }> {
  let collaboratorsAdded = false;
  let notificationsSent = false;

  try {
    console.log('[saveCollaboratorsAndMentions] Starting:', {
      postId,
      authorId,
      collaboratorCount: collaborators.length,
      mentionCount: mentionIds.length,
      hasCollaborators,
    });

    // If there are collaborators, set post to draft status
    if (hasCollaborators && collaborators.length > 0) {
      const { error: statusError } = await supabase
        .from('posts')
        .update({ status: 'draft' })
        .eq('id', postId);

      if (statusError) {
        console.error('[saveCollaboratorsAndMentions] Failed to set post to draft:', {
          postId,
          error: statusError.message,
          code: statusError.code,
        });
        // Continue anyway - the post will be published immediately but collaborators will still be invited
      } else {
        console.log('[saveCollaboratorsAndMentions] Post set to draft status');
      }
    }

    // Insert collaborators
    if (collaborators.length > 0) {
      const collaboratorRecords = collaborators.map(collab => ({
        post_id: postId,
        user_id: collab.id,
        status: 'pending' as const,
        role: collab.role || null,
      }));

      console.log('[saveCollaboratorsAndMentions] Inserting collaborators:', collaboratorRecords);

      const { data: insertedCollabs, error: collabError } = await supabase
        .from('post_collaborators')
        .insert(collaboratorRecords)
        .select();

      if (collabError) {
        // Log the full error for debugging
        console.error('[saveCollaboratorsAndMentions] Collaborators insert error:', {
          error: collabError.message,
          code: collabError.code,
          details: collabError.details,
          hint: collabError.hint,
        });

        // Table might not exist yet or other issue
        const isTableMissing = collabError.code === '42P01' ||
          collabError.message?.includes('relation') ||
          collabError.message?.includes('does not exist');

        if (isTableMissing) {
          console.warn('[saveCollaboratorsAndMentions] post_collaborators table not ready');
        }
      } else {
        collaboratorsAdded = true;
        console.log('[saveCollaboratorsAndMentions] Collaborators inserted successfully:', insertedCollabs?.length);

        // Send notifications to all collaborators
        console.log('[saveCollaboratorsAndMentions] Sending collaboration invite notifications...');
        const notificationResults = await Promise.all(
          collaborators.map(async (collab) => {
            const result = await createNotification(collab.id, authorId, 'collaboration_invite', postId);
            console.log(`[saveCollaboratorsAndMentions] Notification to ${collab.id}:`, result);
            return result;
          })
        );

        const successfulNotifications = notificationResults.filter(r => r.success).length;
        notificationsSent = successfulNotifications > 0;
        console.log(`[saveCollaboratorsAndMentions] Notifications sent: ${successfulNotifications}/${collaborators.length}`);
      }
    }

    // Insert mentions
    if (mentionIds.length > 0) {
      const mentionRecords = mentionIds.map(userId => ({
        post_id: postId,
        user_id: userId,
      }));

      console.log('[saveCollaboratorsAndMentions] Inserting mentions:', mentionRecords);

      const { data: insertedMentions, error: mentionError } = await supabase
        .from('post_mentions')
        .insert(mentionRecords)
        .select();

      if (mentionError) {
        console.error('[saveCollaboratorsAndMentions] Mentions insert error:', {
          error: mentionError.message,
          code: mentionError.code,
          details: mentionError.details,
        });

        const isTableMissing = mentionError.code === '42P01' ||
          mentionError.message?.includes('relation') ||
          mentionError.message?.includes('does not exist');

        if (isTableMissing) {
          console.warn('[saveCollaboratorsAndMentions] post_mentions table not ready');
        }
      } else {
        console.log('[saveCollaboratorsAndMentions] Mentions inserted successfully:', insertedMentions?.length);

        // Send notifications to all mentioned users
        await Promise.all(
          mentionIds.map(async (userId) => {
            const result = await createNotification(userId, authorId, 'mention', postId);
            console.log(`[saveCollaboratorsAndMentions] Mention notification to ${userId}:`, result);
            return result;
          })
        );
      }
    }

    console.log('[saveCollaboratorsAndMentions] Completed:', {
      collaboratorsAdded,
      notificationsSent,
    });

    return { success: true, collaboratorsAdded, notificationsSent };
  } catch (err) {
    // Don't fail the post creation - just log and continue
    console.error('[saveCollaboratorsAndMentions] Fatal error:', err);
    return { success: false, collaboratorsAdded, notificationsSent, error: err };
  }
}

// ============================================
// HELPER: Fetch posts with collaborators for profile
// ============================================

export async function fetchCollaboratedPosts(userId: string) {
  try {
    // Get posts where user is an accepted collaborator
    const { data: collabData, error: collabError } = await supabase
      .from('post_collaborators')
      .select('post_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    // Table might not exist yet - return empty array
    if (collabError) {
      if (collabError.code === '42P01' || collabError.message?.includes('relation') || collabError.message?.includes('does not exist')) {
        return [];
      }
      throw collabError;
    }

    if (!collabData || collabData.length === 0) {
      return [];
    }

    const postIds = collabData.map(c => c.post_id);

    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select(`
        *,
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
        ),
        collaborators:post_collaborators (
          status,
          user:profiles!post_collaborators_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        )
      `)
      .in('id', postIds)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (postsError) throw postsError;

    return posts || [];
  } catch (err: any) {
    // Only log if it's not a "table doesn't exist" error
    if (err?.code !== '42P01') {
      console.error('[fetchCollaboratedPosts] Error:', err?.message || err);
    }
    return [];
  }
}