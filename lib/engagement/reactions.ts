"use client";

/**
 * useReaction — the one React hook for reacting to a post or a take.
 *
 * Replaces useToggleReaction / useReactionCounts / useUserReaction /
 * useToggleAdmire and the per-surface handlers that used to re-implement
 * insert-vs-update-vs-delete from local state. State lives in
 * `lib/engagement/store.ts`, so every surface showing the same post agrees.
 *
 *   const r = useReaction("post", post.id, {
 *     seed: { total: post.reactions_count, mine: post.user_reaction_type },
 *     authorId: post.author_id,
 *   });
 *   <ReactionPicker currentReaction={r.mine} reactionCounts={r.counts}
 *                   countsLoaded={r.countsLoaded} onOpen={r.loadCounts}
 *                   onReact={r.react} onRemoveReaction={r.unreact} />
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { createNotification } from "@/lib/hooks/useNotifications";
import { usePollOnFocus } from "@/lib/hooks/usePollOnFocus";
import { actionToast } from "@/lib/utils/toast";
import type { ReactionType, ReactionCounts } from "@/lib/types";
import {
  type EngagementKind,
  type ReactionEntry,
  type ReactionSeed,
  type ReactionWriteResult,
  clearReaction,
  ensureReactionLoaded,
  getReaction,
  hasReaction,
  needsReactionLoad,
  refreshReaction,
  seedReaction,
  setEngagementViewer,
  setReaction,
  subscribeReaction,
  toggleDefaultReaction,
} from "./store";

export interface UseReactionOptions {
  /** Values from the list row this surface was rendered from. `mine`
   *  undefined = unknown (fetched); `total` undefined = unknown (fetched). */
  seed?: Omit<ReactionSeed, "viewerId">;
  /** Post/take author — a brand-new reaction on a post notifies them. */
  authorId?: string | null;
  /** Re-read counts + own reaction when the tab regains focus (open post). */
  refreshOnFocus?: boolean;
  /** Fetch per-type counts immediately instead of on picker open. */
  loadCounts?: boolean;
  /** Make sure the comment count is loaded (surfaces that show it). */
  loadComments?: boolean;
}

export interface UseReactionResult {
  mine: ReactionType | null;
  counts: ReactionCounts;
  /** Per-type numbers are real (the total is always as good as the seed). */
  countsLoaded: boolean;
  totalLoaded: boolean;
  pending: boolean;
  /** Comment count (all rows); trustworthy when `commentsLoaded`. */
  comments: number;
  commentsLoaded: boolean;
  isAuthenticated: boolean;
  /** Set this reaction; same type as `mine` removes it. Opens the auth modal
   *  for signed-out viewers and returns null. */
  react: (type: ReactionType) => Promise<ReactionWriteResult | null>;
  unreact: () => Promise<ReactionWriteResult | null>;
  /** Heart button / double-tap semantics: any reaction → remove, none → admire. */
  toggleDefault: () => Promise<ReactionWriteResult | null>;
  /** Make sure per-type counts are loaded (call when the picker opens). */
  loadCounts: () => void;
}

const NOOP_UNSUBSCRIBE = () => {};

export function useReaction(kind: EngagementKind, id: string, options: UseReactionOptions = {}): UseReactionResult {
  const { user } = useAuth();
  const { openModal: openAuthModal } = useAuthModal();
  const viewerId = user?.id ?? null;
  const { authorId, refreshOnFocus = false, loadCounts: wantCounts = false, loadComments: wantComments = false } = options;
  const seedTotal = options.seed?.total;
  const seedMine = options.seed?.mine;
  const seedCounts = options.seed?.counts;
  const seedComments = options.seed?.comments;
  const seedCountsKey = seedCounts
    ? `${seedCounts.admire}|${seedCounts.snap}|${seedCounts.ovation}|${seedCounts.support}|${seedCounts.inspired}|${seedCounts.applaud}|${seedCounts.total}`
    : "";

  setEngagementViewer(viewerId);

  // First paint must already show the list's numbers: seed synchronously
  // when the store has never heard of this id.
  if (id && options.seed && !hasReaction(kind, id)) {
    seedReaction(kind, id, { total: seedTotal, mine: seedMine, counts: seedCounts, comments: seedComments, viewerId }, { silent: true });
  }

  const subscribe = useCallback(
    (listener: () => void) => (id ? subscribeReaction(kind, id, listener) : NOOP_UNSUBSCRIBE),
    [kind, id]
  );
  const getSnapshot = useCallback((): ReactionEntry => getReaction(kind, id), [kind, id]);
  const entry = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Re-seed when the list row changes (refetch). No-op during/after writes.
  useEffect(() => {
    if (!id || !options.seed) return;
    seedReaction(kind, id, { total: seedTotal, mine: seedMine, counts: seedCounts, comments: seedComments, viewerId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seedCounts keyed by value
  }, [kind, id, seedTotal, seedMine, seedCountsKey, seedComments, viewerId, !!options.seed]);

  // Fetch whatever is still unknown for this viewer.
  useEffect(() => {
    if (!id) return;
    if (needsReactionLoad(entry, viewerId, wantCounts, wantComments)) void ensureReactionLoaded(kind, id);
  }, [kind, id, viewerId, wantCounts, wantComments, entry.totalLoaded, entry.countsLoaded, entry.commentsLoaded, entry.mineFor, entry]);

  usePollOnFocus(() => {
    if (refreshOnFocus && id) void refreshReaction(kind, id);
  });

  const afterWrite = useCallback(
    (result: ReactionWriteResult, userId: string) => {
      if (!result.ok) {
        if (result.error !== "pending") actionToast.reactionError();
        return;
      }
      if (kind === "post" && result.added && result.mine && authorId && authorId !== userId) {
        void createNotification(authorId, userId, result.mine, id).catch(() => {});
      }
    },
    [kind, id, authorId]
  );

  const react = useCallback(
    async (type: ReactionType) => {
      if (!user) {
        openAuthModal();
        return null;
      }
      const current = getReaction(kind, id);
      const mine = current.mineFor === user.id ? current.mine : null;
      const result = mine === type ? await clearReaction(kind, id, user.id) : await setReaction(kind, id, user.id, type);
      afterWrite(result, user.id);
      return result;
    },
    [user, openAuthModal, kind, id, afterWrite]
  );

  const unreact = useCallback(async () => {
    if (!user) {
      openAuthModal();
      return null;
    }
    const result = await clearReaction(kind, id, user.id);
    afterWrite(result, user.id);
    return result;
  }, [user, openAuthModal, kind, id, afterWrite]);

  const toggleDefault = useCallback(async () => {
    if (!user) {
      openAuthModal();
      return null;
    }
    const result = await toggleDefaultReaction(kind, id, user.id);
    afterWrite(result, user.id);
    return result;
  }, [user, openAuthModal, kind, id, afterWrite]);

  const loadCounts = useCallback(() => {
    if (id && !getReaction(kind, id).countsLoaded) void ensureReactionLoaded(kind, id);
  }, [kind, id]);

  return {
    mine: entry.mineFor === viewerId ? entry.mine : null,
    counts: entry.counts,
    countsLoaded: entry.countsLoaded,
    totalLoaded: entry.totalLoaded,
    pending: entry.pending,
    comments: entry.comments,
    commentsLoaded: entry.commentsLoaded,
    isAuthenticated: !!user,
    react,
    unreact,
    toggleDefault,
    loadCounts,
  };
}
