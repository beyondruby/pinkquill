"use client";

/**
 * useComments — the ONE comments hook for posts and takes
 * (docs/engagement/02-plan.md, Phase 2).
 *
 * - Top-level comments paginated (30), replies lazy + paginated (20), one
 *   level deep (replies to replies are stored under the top-level comment
 *   with `reply_to_user_id`).
 * - Every write goes through an RPC that returns the server's answer
 *   (`add_*_comment`, `delete_*_comment`, `set_*_comment_like`); the comment
 *   count in `lib/engagement/store.ts` is updated from that answer so every
 *   card, modal and page shows the same number.
 * - Adds are optimistic (temp row, replaced on success, removed on failure so
 *   the composer can restore the text); likes are optimistic with revert;
 *   deletes remove the subtree and correct the count from the server.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { bumpComments, setCommentsCount, type EngagementKind } from "@/lib/engagement/store";
import type { Comment } from "../types";
import { isAbortError } from "../utils/retry";

export const COMMENTS_PAGE_SIZE = 30;
export const REPLIES_PAGE_SIZE = 20;
export const COMMENT_MAX_LENGTH = 2200;

interface KindConfig {
  table: string;
  likesTable: string;
  parentCol: string;
  authorEmbed: string;
  replyToEmbed: string;
  likesEmbed: string;
  repliesEmbed: string;
  addRpc: string;
  addArg: string;
  deleteRpc: string;
  likeRpc: string;
}

const CONFIG: Record<EngagementKind, KindConfig> = {
  post: {
    table: "comments",
    likesTable: "comment_likes",
    parentCol: "post_id",
    authorEmbed: "author:profiles!comments_user_id_fkey (username, display_name, avatar_url)",
    replyToEmbed: "reply_to:profiles!comments_reply_to_user_id_fkey (username, display_name)",
    likesEmbed: "likes_agg:comment_likes(count)",
    repliesEmbed: "replies_agg:comments!parent_id(count)",
    addRpc: "add_post_comment",
    addArg: "p_post_id",
    deleteRpc: "delete_post_comment",
    likeRpc: "set_post_comment_like",
  },
  take: {
    table: "take_comments",
    likesTable: "take_comment_likes",
    parentCol: "take_id",
    authorEmbed: "author:profiles!take_comments_user_id_fkey (username, display_name, avatar_url)",
    replyToEmbed: "reply_to:profiles!take_comments_reply_to_user_id_fkey (username, display_name)",
    likesEmbed: "likes_agg:take_comment_likes(count)",
    repliesEmbed: "replies_agg:take_comments!parent_id(count)",
    addRpc: "add_take_comment",
    addArg: "p_take_id",
    deleteRpc: "delete_take_comment",
    likeRpc: "set_take_comment_like",
  },
};

type Row = Record<string, unknown>;

function aggCount(agg: unknown): number {
  if (Array.isArray(agg) && agg[0] && typeof (agg[0] as { count?: unknown }).count === "number") {
    return (agg[0] as { count: number }).count;
  }
  return 0;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return (v as T) ?? null;
}

function rowToComment(kind: EngagementKind, row: Row, userLikes: Set<string>): Comment {
  const cfg = CONFIG[kind];
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    post_id: String(row[cfg.parentCol]),
    parent_id: (row.parent_id as string | null) ?? null,
    reply_to_user_id: (row.reply_to_user_id as string | null) ?? null,
    reply_to: one(row.reply_to as Comment["reply_to"]) ?? null,
    content: String(row.content ?? ""),
    created_at: String(row.created_at),
    author: one(row.author as Comment["author"]) ?? { username: "unknown", display_name: null, avatar_url: null },
    likes_count: aggCount(row.likes_agg),
    replies_count: aggCount(row.replies_agg),
    user_has_liked: userLikes.has(String(row.id)),
    replies: [],
  };
}

export interface AddCommentOptions {
  parentId?: string;
  replyToUserId?: string | null;
}

export interface UseCommentsOptions {
  /** Post/take author (kept for callers; notifications are DB triggers now). */
  authorId?: string | null;
}

export interface UseCommentsReturn {
  comments: Comment[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
  addComment: (content: string, options?: AddCommentOptions) => Promise<{ success: boolean; comment?: Comment; error?: string }>;
  toggleLike: (commentId: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<{ success: boolean }>;
  /** Load (or load more of) a comment's replies. */
  fetchReplies: (commentId: string, options?: { more?: boolean }) => Promise<Comment[]>;
  /** Make a specific comment (top-level or reply) present in the list; returns whether it exists. */
  ensureCommentVisible: (commentId: string) => Promise<{ found: boolean; parentId: string | null }>;
  refetch: () => Promise<void>;
}

export function useComments(kind: EngagementKind, id: string, options: UseCommentsOptions = {}): UseCommentsReturn {
  const cfg = CONFIG[kind];
  const { user, profile } = useAuth();
  const userId = user?.id;

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const mountedRef = useRef(true);
  const pageRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const likePendingRef = useRef<Set<string>>(new Set());
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const commentsRef = useRef<Comment[]>([]);
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  const fetchUserLikes = useCallback(
    async (commentIds: string[], signal?: AbortSignal): Promise<Set<string>> => {
      const uid = userIdRef.current;
      if (!uid || commentIds.length === 0) return new Set();
      let q = supabase.from(cfg.likesTable).select("comment_id").eq("user_id", uid).in("comment_id", commentIds);
      if (signal) q = q.abortSignal(signal);
      const { data } = await q;
      return new Set(((data || []) as { comment_id: string }[]).map((l) => l.comment_id));
    },
    [cfg.likesTable]
  );

  const selectTopLevel = `*, ${cfg.authorEmbed}, ${cfg.replyToEmbed}, ${cfg.likesEmbed}, ${cfg.repliesEmbed}`;
  const selectReply = `*, ${cfg.authorEmbed}, ${cfg.replyToEmbed}, ${cfg.likesEmbed}`;

  // ---- top-level page ------------------------------------------------------
  const fetchComments = useCallback(
    async (page: number = 0, append: boolean = false) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        if (append) setLoadingMore(true);
        else setLoading(true);

        const from = page * COMMENTS_PAGE_SIZE;
        const to = from + COMMENTS_PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from(cfg.table)
          .select(selectTopLevel)
          .eq(cfg.parentCol, id)
          .is("parent_id", null)
          .order("created_at", { ascending: false })
          .range(from, to)
          .abortSignal(signal);

        if (!mountedRef.current || signal.aborted) return;
        if (error) throw error;

        const rows = (data || []) as unknown as Row[];
        if (rows.length === 0) {
          if (!append) setComments([]);
          setHasMore(false);
          return;
        }

        const userLikes = await fetchUserLikes(rows.map((r) => String(r.id)), signal);
        if (!mountedRef.current || signal.aborted) return;

        const transformed = rows.map((r) => rowToComment(kind, r, userLikes));
        setComments((prev) => {
          if (!append) return transformed;
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...transformed.filter((c) => !seen.has(c.id))];
        });
        pageRef.current = page;
        setHasMore(rows.length === COMMENTS_PAGE_SIZE);
      } catch (err: unknown) {
        if (isAbortError(err)) return;
        console.error("[useComments] fetch error:", err);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [kind, id, cfg.table, cfg.parentCol, selectTopLevel, fetchUserLikes]
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore) return;
    await fetchComments(pageRef.current + 1, true);
  }, [fetchComments, hasMore, loading, loadingMore]);

  // ---- replies -------------------------------------------------------------
  const fetchReplies = useCallback(
    async (commentId: string, opts: { more?: boolean } = {}): Promise<Comment[]> => {
      try {
        const parent = comments.find((c) => c.id === commentId);
        const offset = opts.more ? (parent?.replies?.filter((r) => !r.pending).length ?? 0) : 0;
        const { data, error } = await supabase
          .from(cfg.table)
          .select(selectReply)
          .eq("parent_id", commentId)
          .order("created_at", { ascending: true })
          .range(offset, offset + REPLIES_PAGE_SIZE - 1);
        if (error) throw error;
        const rows = (data || []) as unknown as Row[];
        const userLikes = await fetchUserLikes(rows.map((r) => String(r.id)));
        const replies = rows.map((r) => rowToComment(kind, r, userLikes));
        const hasMoreReplies = rows.length === REPLIES_PAGE_SIZE;

        setComments((current) =>
          current.map((c) => {
            if (c.id !== commentId) return c;
            const existing = opts.more ? c.replies || [] : (c.replies || []).filter((r) => r.pending);
            const seen = new Set(existing.map((r) => r.id));
            const merged = [...existing.filter((r) => !r.pending), ...replies.filter((r) => !seen.has(r.id)), ...existing.filter((r) => r.pending)];
            return { ...c, replies: merged, hasMoreReplies };
          })
        );
        return replies;
      } catch (err) {
        console.error("[useComments] fetchReplies error:", err);
        return [];
      }
    },
    [kind, cfg.table, selectReply, fetchUserLikes, comments]
  );

  // ---- deep link -----------------------------------------------------------
  const ensureCommentVisible = useCallback(
    async (commentId: string): Promise<{ found: boolean; parentId: string | null }> => {
      try {
        const { data } = await supabase
          .from(cfg.table)
          .select("id, parent_id")
          .eq("id", commentId)
          .eq(cfg.parentCol, id)
          .maybeSingle();
        if (!data) return { found: false, parentId: null };
        const target = data as { id: string; parent_id: string | null };
        const topId = target.parent_id ?? target.id;

        // Make sure the top-level comment is in the list (it may be past page 1).
        const inList = comments.some((c) => c.id === topId);
        if (!inList) {
          const { data: topRow } = await supabase.from(cfg.table).select(selectTopLevel).eq("id", topId).maybeSingle();
          if (!topRow) return { found: false, parentId: null };
          const userLikes = await fetchUserLikes([topId]);
          const top = rowToComment(kind, topRow as unknown as Row, userLikes);
          setComments((current) => (current.some((c) => c.id === topId) ? current : [top, ...current]));
        }

        // A reply: load reply pages until it shows up (bounded).
        if (target.parent_id) {
          for (let page = 0; page < 10; page++) {
            const offset = page * REPLIES_PAGE_SIZE;
            const { data: rows, error } = await supabase
              .from(cfg.table)
              .select(selectReply)
              .eq("parent_id", topId)
              .order("created_at", { ascending: true })
              .range(offset, offset + REPLIES_PAGE_SIZE - 1);
            if (error || !rows || rows.length === 0) break;
            const pageRows = rows as unknown as Row[];
            const userLikes = await fetchUserLikes(pageRows.map((r) => String(r.id)));
            const replies = pageRows.map((r) => rowToComment(kind, r, userLikes));
            const hasMoreReplies = rows.length === REPLIES_PAGE_SIZE;
            setComments((current) =>
              current.map((c) => {
                if (c.id !== topId) return c;
                const existing = c.replies || [];
                const seen = new Set(existing.map((r) => r.id));
                return { ...c, replies: [...existing, ...replies.filter((r) => !seen.has(r.id))], hasMoreReplies };
              })
            );
            if (replies.some((r) => r.id === commentId) || !hasMoreReplies) break;
          }
        }
        return { found: true, parentId: target.parent_id };
      } catch (err) {
        console.error("[useComments] ensureCommentVisible error:", err);
        return { found: false, parentId: null };
      }
    },
    [kind, id, cfg.table, cfg.parentCol, selectTopLevel, selectReply, fetchUserLikes, comments]
  );

  // ---- add -----------------------------------------------------------------
  const addComment = useCallback(
    async (content: string, opts: AddCommentOptions = {}) => {
      const uid = userIdRef.current;
      const trimmed = content.trim();
      if (!uid) return { success: false, error: "Not signed in" };
      if (!trimmed) return { success: false, error: "Empty comment" };
      if (trimmed.length > COMMENT_MAX_LENGTH) return { success: false, error: "Comment is too long" };

      const tempId = `temp-${crypto.randomUUID()}`;
      const parentId = opts.parentId ?? null;
      const optimistic: Comment = {
        id: tempId,
        user_id: uid,
        post_id: id,
        parent_id: parentId,
        reply_to_user_id: opts.replyToUserId ?? null,
        reply_to: null,
        content: trimmed,
        created_at: new Date().toISOString(),
        author: {
          username: profile?.username ?? "you",
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        },
        likes_count: 0,
        replies_count: 0,
        user_has_liked: false,
        replies: [],
        pending: true,
      };

      // Optimistic insert + count nudge.
      setComments((current) =>
        parentId
          ? current.map((c) =>
              c.id === parentId
                ? { ...c, replies_count: c.replies_count + 1, replies: [...(c.replies || []), optimistic] }
                : c
            )
          : [optimistic, ...current]
      );
      bumpComments(kind, id, 1);

      const rollback = () => {
        setComments((current) =>
          parentId
            ? current.map((c) =>
                c.id === parentId
                  ? {
                      ...c,
                      replies_count: Math.max(0, c.replies_count - 1),
                      replies: (c.replies || []).filter((r) => r.id !== tempId),
                    }
                  : c
              )
            : current.filter((c) => c.id !== tempId)
        );
        bumpComments(kind, id, -1);
      };

      try {
        const { data, error } = await supabase.rpc(cfg.addRpc, {
          [cfg.addArg]: id,
          p_content: trimmed,
          p_parent_id: parentId,
          p_reply_to_user_id: opts.replyToUserId ?? null,
        });
        if (error) throw error;
        const result = data as {
          id: string;
          created_at: string;
          parent_id: string | null;
          reply_to_user_id: string | null;
          comments_count: number;
        };

        // Fetch the confirmed row (author + reply_to embeds) so the list
        // shows exactly what everyone else will see.
        const { data: row } = await supabase.from(cfg.table).select(selectReply).eq("id", result.id).maybeSingle();
        const confirmed: Comment = row
          ? { ...rowToComment(kind, row as unknown as Row, new Set()), replies: [] }
          : { ...optimistic, id: result.id, created_at: result.created_at, reply_to_user_id: result.reply_to_user_id, pending: false };

        setComments((current) =>
          parentId
            ? current.map((c) =>
                c.id === parentId
                  ? { ...c, replies: (c.replies || []).map((r) => (r.id === tempId ? confirmed : r)) }
                  : c
              )
            : current.map((c) => (c.id === tempId ? confirmed : c))
        );
        setCommentsCount(kind, id, result.comments_count);

        // Notifications: database triggers (Phase 3).

        return { success: true, comment: confirmed };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[useComments] addComment error:", message);
        rollback();
        return { success: false, error: message };
      }
    },
    [kind, id, cfg.addRpc, cfg.addArg, cfg.table, selectReply, profile]
  );

  // ---- like ----------------------------------------------------------------
  const toggleLike = useCallback(
    async (commentId: string) => {
      const uid = userIdRef.current;
      if (!uid || commentId.startsWith("temp-")) return;
      if (likePendingRef.current.has(commentId)) return;
      const target = findComment(commentsRef.current, commentId);
      if (!target) return;
      likePendingRef.current.add(commentId);

      const wasLiked = target.user_has_liked;
      const prevCount = target.likes_count;
      const nextLiked = !wasLiked;

      // Optimistic flip.
      setComments((current) => setLike(current, commentId, nextLiked, Math.max(0, prevCount + (nextLiked ? 1 : -1))));

      try {
        const { data, error } = await supabase.rpc(cfg.likeRpc, { p_comment_id: commentId, p_liked: nextLiked });
        if (error) throw error;
        const result = data as { liked: boolean; likes_count: number };
        setComments((current) => setLike(current, commentId, result.liked, result.likes_count));
      } catch (err) {
        console.error("[useComments] toggleLike error:", err);
        setComments((current) => setLike(current, commentId, wasLiked, prevCount));
      } finally {
        likePendingRef.current.delete(commentId);
      }
    },
    [cfg.likeRpc]
  );

  // ---- delete --------------------------------------------------------------
  const deleteComment = useCallback(
    async (commentId: string): Promise<{ success: boolean }> => {
      if (commentId.startsWith("temp-")) return { success: false };
      let removed = 0;
      setComments((current) => {
        const top = current.find((c) => c.id === commentId);
        if (top) {
          removed = 1 + (top.replies_count || 0);
          return current.filter((c) => c.id !== commentId);
        }
        return current.map((c) => {
          if (!c.replies?.some((r) => r.id === commentId)) return c;
          removed = 1;
          return {
            ...c,
            replies: c.replies.filter((r) => r.id !== commentId),
            replies_count: Math.max(0, c.replies_count - 1),
          };
        });
      });
      bumpComments(kind, id, -removed);

      try {
        const { data, error } = await supabase.rpc(cfg.deleteRpc, { p_comment_id: commentId });
        if (error) throw error;
        const result = data as { deleted: number; comments_count: number };
        setCommentsCount(kind, id, result.comments_count);
        return { success: true };
      } catch (err) {
        console.error("[useComments] deleteComment error:", err);
        // Put the list back the way the server has it.
        void fetchComments(0, false);
        return { success: false };
      }
    },
    [kind, id, cfg.deleteRpc, fetchComments]
  );

  // ---- lifecycle -----------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    pageRef.current = 0;
    if (id) {
      fetchComments(0, false);
    } else {
      setLoading(false);
    }
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [id, fetchComments]);

  return {
    comments,
    loading,
    hasMore,
    loadingMore,
    loadMore,
    addComment,
    toggleLike,
    deleteComment,
    fetchReplies,
    ensureCommentVisible,
    refetch: () => fetchComments(0, false),
  };
}

function findComment(list: Comment[], id: string): Comment | null {
  for (const c of list) {
    if (c.id === id) return c;
    if (c.replies) {
      const hit = findComment(c.replies, id);
      if (hit) return hit;
    }
  }
  return null;
}

function setLike(list: Comment[], id: string, liked: boolean, count: number): Comment[] {
  return list.map((c) => {
    if (c.id === id) return { ...c, user_has_liked: liked, likes_count: count };
    if (c.replies && c.replies.length > 0) return { ...c, replies: setLike(c.replies, id, liked, count) };
    return c;
  });
}
