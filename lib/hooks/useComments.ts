"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import { createNotification } from "./useNotifications";
import type { Comment } from "../types";

// ============================================================================
// useComments - Optimized with lazy-loaded replies
// ============================================================================

interface UseCommentsReturn {
  comments: Comment[];
  loading: boolean;
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
  const mountedRef = useRef(true);

  // Fetch only top-level comments initially
  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);

      // Only fetch top-level comments (no parent)
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
        .order("created_at", { ascending: false }); // Newest first

      // Check if still mounted before updating state
      if (!mountedRef.current) return;

      if (error) throw error;

      if (!data || data.length === 0) {
        setComments([]);
        setLoading(false);
        return;
      }

      const commentIds = data.map((c) => c.id);

      // Batch fetch likes and reply counts
      const [likesResult, userLikesResult, repliesCountResult] = await Promise.all([
        supabase.from("comment_likes").select("comment_id").in("comment_id", commentIds),
        userId
          ? supabase
              .from("comment_likes")
              .select("comment_id")
              .eq("user_id", userId)
              .in("comment_id", commentIds)
          : Promise.resolve({ data: [] }),
        supabase.from("comments").select("parent_id").in("parent_id", commentIds),
      ]);

      // Check if still mounted after second batch of queries
      if (!mountedRef.current) return;

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

      setComments(transformedComments);
    } catch (err) {
      console.error("[useComments] Error:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [postId, userId]);

  // Lazy-load replies for a specific comment
  const fetchReplies = useCallback(
    async (commentId: string): Promise<Comment[]> => {
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
          .order("created_at", { ascending: true }); // Oldest first for replies

        if (error) throw error;
        if (!data || data.length === 0) return [];

        const replyIds = data.map((c) => c.id);

        // Fetch likes for replies
        const [likesResult, userLikesResult] = await Promise.all([
          supabase.from("comment_likes").select("comment_id").in("comment_id", replyIds),
          userId
            ? supabase
                .from("comment_likes")
                .select("comment_id")
                .eq("user_id", userId)
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

        // Update parent comment with replies
        setComments((current) =>
          current.map((c) => {
            if (c.id === commentId) {
              return { ...c, replies };
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
    [userId]
  );

  // Add a new comment or reply
  const addComment = async (
    currentUserId: string,
    content: string,
    parentId?: string
  ): Promise<{ success: boolean; comment?: Comment }> => {
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

      const newComment: Comment = {
        ...data,
        likes_count: 0,
        replies_count: 0,
        user_has_liked: false,
        replies: [],
      };

      if (parentId) {
        // Add as reply
        setComments((current) =>
          current.map((c) => {
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

        // Notify parent comment author
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
            parentId // Pass the parent comment ID for scroll-to functionality
          );
        }
      } else {
        // Add as top-level comment
        setComments((current) => [newComment, ...current]);
      }

      return { success: true, comment: newComment };
    } catch (err) {
      console.error("[useComments] addComment Error:", err);
      return { success: false };
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
            commentId // Pass the comment ID for scroll-to functionality
          );
        }
      }
    } catch (err) {
      console.error("[useComments] toggleLike Error:", err);
      // Revert on error
      fetchComments();
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

    if (postId) {
      fetchComments();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [postId, fetchComments]);

  return {
    comments,
    loading,
    addComment,
    toggleLike,
    deleteComment,
    fetchReplies,
    refetch: fetchComments,
  };
}
