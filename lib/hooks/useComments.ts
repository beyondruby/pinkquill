"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import { createNotification } from "./useNotifications";
import type { Comment } from "../types";

// ============================================================================
// useComments - Optimized with lazy-loaded replies
// ============================================================================

// Pagination constants
const COMMENTS_PAGE_SIZE = 30;
const REPLIES_PAGE_SIZE = 20;

interface UseCommentsReturn {
  comments: Comment[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  addComment: (
    currentUserId: string,
    content: string,
    parentId?: string
  ) => Promise<{ success: boolean; comment?: Comment }>;
  toggleLike: (commentId: string, currentUserId: string, isLiked: boolean) => Promise<void>;
  deleteComment: (commentId: string) => Promise<{ success: boolean }>;
  fetchReplies: (commentId: string) => Promise<Comment[]>;
  refetch: () => Promise<void>;
}

/**
 * Optimized comments hook
 *
 * Key improvements:
 * 1. Initially fetches only top-level comments (parent_id IS NULL)
 * 2. Replies are lazy-loaded on demand via fetchReplies()
 * 3. Reduces initial payload significantly for posts with many nested comments
 */
export function useComments(postId: string, userId?: string): UseCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const mountedRef = useRef(true);
  const pageRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use ref for userId to avoid re-fetching all comments when auth resolves
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Fetch only top-level comments with pagination
  const fetchComments = useCallback(async (page: number = 0, append: boolean = false) => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      if (!append) {
        setLoading(true);
      }

      const from = page * COMMENTS_PAGE_SIZE;
      const to = from + COMMENTS_PAGE_SIZE - 1;

      // Only fetch top-level comments (no parent) with pagination
      const { data, error } = await supabase
        .from("comments")
        .select(
          `
          *,
          author:profiles!comments_user_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `
        )
        .eq("post_id", postId)
        .is("parent_id", null) // Only top-level
        .order("created_at", { ascending: false }) // Newest first
        .range(from, to)
        .abortSignal(signal);

      // Check if still mounted before updating state
      if (!mountedRef.current || signal.aborted) return;

      if (error) throw error;

      if (!data || data.length === 0) {
        if (!append) {
          setComments([]);
        }
        setHasMore(false);
        setLoading(false);
        return;
      }

      const commentIds = data.map((c) => c.id);

      // Batch fetch likes and reply counts
      const currentUserId = userIdRef.current;
      const [likesResult, userLikesResult, repliesCountResult] = await Promise.all([
        supabase.from("comment_likes").select("comment_id").in("comment_id", commentIds).abortSignal(signal),
        currentUserId
          ? supabase
              .from("comment_likes")
              .select("comment_id")
              .eq("user_id", currentUserId)
              .in("comment_id", commentIds)
              .abortSignal(signal)
          : Promise.resolve({ data: [] }),
        supabase.from("comments").select("parent_id").in("parent_id", commentIds).abortSignal(signal),
      ]);

      // Check if still mounted after second batch of queries
      if (!mountedRef.current || signal.aborted) return;

      const likesCounts: Record<string, number> = {};
      const userLikes = new Set<string>();
      const repliesCounts: Record<string, number> = {};

      (likesResult.data || []).forEach((l) => {
        likesCounts[l.comment_id] = (likesCounts[l.comment_id] || 0) + 1;
      });
      (userLikesResult.data || []).forEach((l) => {
        userLikes.add(l.comment_id);
      });
      (repliesCountResult.data || []).forEach((r) => {
        if (r.parent_id) {
          repliesCounts[r.parent_id] = (repliesCounts[r.parent_id] || 0) + 1;
        }
      });

      // Transform comments
      const transformedComments: Comment[] = data.map((comment) => ({
        ...comment,
        likes_count: likesCounts[comment.id] || 0,
        replies_count: repliesCounts[comment.id] || 0,
        user_has_liked: userLikes.has(comment.id),
        replies: [], // Empty initially - load on demand
      }));

      if (append) {
        setComments((prev) => [...prev, ...transformedComments]);
      } else {
        setComments(transformedComments);
      }

      pageRef.current = page;
      setHasMore(data.length === COMMENTS_PAGE_SIZE);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[useComments] Error:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [postId]);

  // Load more comments
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchComments(pageRef.current + 1, true);
  }, [fetchComments, hasMore, loading]);

  // Lazy-load replies for a specific comment with pagination
  const fetchReplies = useCallback(
    async (commentId: string, limit = REPLIES_PAGE_SIZE, offset = 0): Promise<Comment[]> => {
      try {
        const { data, error } = await supabase
          .from("comments")
          .select(
            `
            *,
            author:profiles!comments_user_id_fkey (
              username,
              display_name,
              avatar_url
            )
          `
          )
          .eq("parent_id", commentId)
          .order("created_at", { ascending: true }) // Oldest first for replies
          .range(offset, offset + limit - 1);

        if (error) throw error;
        if (!data || data.length === 0) return [];

        const replyIds = data.map((c) => c.id);
        const hasMoreReplies = data.length === limit;

        // Fetch likes for replies
        const currentUserId = userIdRef.current;
        const [likesResult, userLikesResult] = await Promise.all([
          supabase.from("comment_likes").select("comment_id").in("comment_id", replyIds),
          currentUserId
            ? supabase
                .from("comment_likes")
                .select("comment_id")
                .eq("user_id", currentUserId)
                .in("comment_id", replyIds)
            : Promise.resolve({ data: [] }),
        ]);

        const likesCounts: Record<string, number> = {};
        const userLikes = new Set<string>();

        (likesResult.data || []).forEach((l) => {
          likesCounts[l.comment_id] = (likesCounts[l.comment_id] || 0) + 1;
        });
        (userLikesResult.data || []).forEach((l) => {
          userLikes.add(l.comment_id);
        });

        const replies: Comment[] = data.map((comment) => ({
          ...comment,
          likes_count: likesCounts[comment.id] || 0,
          replies_count: 0, // No nested replies beyond one level
          user_has_liked: userLikes.has(comment.id),
          replies: [],
        }));

        // Update parent comment with replies (append if offset > 0, replace if first page)
        setComments((current) =>
          current.map((c) => {
            if (c.id === commentId) {
              const updatedReplies = offset > 0 ? [...(c.replies || []), ...replies] : replies;
              return { ...c, replies: updatedReplies, hasMoreReplies };
            }
            return c;
          })
        );

        return replies;
      } catch (err) {
        console.error("[useComments] fetchReplies Error:", err);
        return [];
      }
    },
    []
  );

  // Add a new comment or reply
  const addComment = async (
    currentUserId: string,
    content: string,
    parentId?: string
  ): Promise<{ success: boolean; comment?: Comment; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          user_id: currentUserId,
          post_id: postId,
          parent_id: parentId || null,
          content,
        })
        .select(
          `
          *,
          author:profiles!comments_user_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `
        )
        .single();

      if (error) throw error;
      if (!data) throw new Error("Comment insert returned no data");

      const newComment: Comment = {
        ...data,
        likes_count: 0,
        replies_count: 0,
        user_has_liked: false,
        replies: [],
      };

      if (parentId) {
        // Add as reply, deduping in case the same comment id is already
        // present (defensive — prevents the "ghost duplicate" bug if a
        // realtime/refetch race fires between the insert and this update).
        setComments((current) =>
          current.map((c) => {
            if (c.id === parentId) {
              const existingReplies = c.replies || [];
              if (existingReplies.some((r) => r.id === newComment.id)) {
                return c;
              }
              return {
                ...c,
                replies_count: c.replies_count + 1,
                replies: [...existingReplies, newComment],
              };
            }
            return c;
          })
        );

        // Notify parent comment author. Wrapped in its own try/catch so a
        // notification failure (e.g., RLS or trigger error) does NOT roll
        // back the user-visible reply.
        try {
          const { data: parentComment } = await supabase
            .from("comments")
            .select("user_id")
            .eq("id", parentId)
            .single();

          if (parentComment && parentComment.user_id !== currentUserId) {
            await createNotification(
              parentComment.user_id,
              currentUserId,
              "reply",
              postId,
              content.substring(0, 100),
              undefined,
              parentId
            );
          }
        } catch (notifyErr) {
          console.warn("[useComments] reply notification failed:", notifyErr);
        }
      } else {
        // Add as top-level comment, also deduping.
        setComments((current) => {
          if (current.some((c) => c.id === newComment.id)) return current;
          return [newComment, ...current];
        });
      }

      return { success: true, comment: newComment };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useComments] addComment Error:", message, err);
      return { success: false, error: message };
    }
  };

  // Toggle like on a comment
  const toggleLike = async (commentId: string, currentUserId: string, isLiked: boolean) => {
    // Optimistic update
    setComments((current) => {
      const updateComment = (comments: Comment[]): Comment[] => {
        return comments.map((c) => {
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

        // Notify comment author
        const { data: comment } = await supabase
          .from("comments")
          .select("user_id, content")
          .eq("id", commentId)
          .single();

        if (comment && comment.user_id !== currentUserId) {
          await createNotification(
            comment.user_id,
            currentUserId,
            "comment_like",
            postId,
            comment.content?.substring(0, 100),
            undefined,
            commentId // Pass the comment ID for scroll-to functionality
          );
        }
      }
    } catch (err) {
      console.error("[useComments] toggleLike Error:", err);
      // Revert optimistic update directly instead of expensive full refetch
      setComments((current) => {
        const revertComment = (comments: Comment[]): Comment[] => {
          return comments.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                likes_count: isLiked ? c.likes_count + 1 : c.likes_count - 1,
                user_has_liked: isLiked,
              };
            }
            if (c.replies && c.replies.length > 0) {
              return { ...c, replies: revertComment(c.replies) };
            }
            return c;
          });
        };
        return revertComment(current);
      });
    }
  };

  // Delete a comment
  const deleteComment = async (commentId: string): Promise<{ success: boolean }> => {
    try {
      // Delete in order: likes, replies, then the comment
      const { error: likesError } = await supabase.from("comment_likes").delete().eq("comment_id", commentId);
      if (likesError) console.warn("[useComments] Failed to delete comment likes:", likesError.message);

      const { error: repliesError } = await supabase.from("comments").delete().eq("parent_id", commentId);
      if (repliesError) console.warn("[useComments] Failed to delete replies:", repliesError.message);

      const { error: commentError } = await supabase.from("comments").delete().eq("id", commentId);
      if (commentError) throw commentError;

      // Update local state - fixed to avoid calling removeComment twice
      setComments((current) => {
        const removeComment = (comments: Comment[]): Comment[] => {
          return comments
            .filter((c) => c.id !== commentId)
            .map((c) => {
              const filteredReplies = c.replies ? removeComment(c.replies) : [];
              return {
                ...c,
                replies: filteredReplies,
                replies_count: filteredReplies.length,
              };
            });
        };
        return removeComment(current);
      });

      return { success: true };
    } catch (err) {
      console.error("[useComments] deleteComment Error:", err);
      return { success: false };
    }
  };

  // Initial fetch and cleanup
  useEffect(() => {
    mountedRef.current = true;
    pageRef.current = 0;

    if (postId) {
      fetchComments(0, false);
    } else {
      // Without a postId there's nothing to fetch; reset loading so the
      // comments panel doesn't render a permanent spinner.
      setLoading(false);
    }

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [postId, fetchComments]);

  return {
    comments,
    loading,
    hasMore,
    loadMore,
    addComment,
    toggleLike,
    deleteComment,
    fetchReplies,
    refetch: () => fetchComments(0, false),
  };
}
