"use client";

// Lightweight interaction hook for feed tiles/rows that are NOT the full
// classic card: heart (default reaction) + save with optimistic updates,
// modal open on activate. Reaction state comes from the shared engagement
// store, so a tile, the card, and the modal always show the same thing.

import { useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useToggleSave } from "@/lib/hooks/useInteractions";
import { useReaction } from "@/lib/engagement/reactions";
import { createNotification } from "@/lib/hooks/useNotifications";
import { useTrackPostImpression } from "@/lib/hooks/useTracking";
import { actionToast } from "@/lib/utils/toast";
import type { PostProps } from "./PostCard/types";

export function useTileActions(post: PostProps) {
  const { user } = useAuth();
  const { openModal: openAuthModal } = useAuthModal();
  const { openPostModal, subscribeToUpdates, notifyUpdate } = useModal();
  const { toggle: toggleSave } = useToggleSave();
  const reaction = useReaction("post", post.id, {
    seed: { total: post.stats?.reactions, mine: post.reactionType },
    authorId: post.authorId,
  });

  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const savePending = useRef(false);
  const [saving, setSaving] = useState(false);
  const commentCount = post.stats?.comments ?? 0;

  useTrackPostImpression(post.id, "feed");

  useEffect(() => {
    const unsub = subscribeToUpdates((update) => {
      if (update.postId !== post.id) return;
      if (update.field === "saves") {
        setIsSaved(update.isActive);
      }
    });
    return unsub;
  }, [post.id, subscribeToUpdates]);

  const onCardActivate = useCallback(() => {
    const mappedMentions = (post.mentions || [])
      .map((m) => m.user)
      .filter((u): u is NonNullable<typeof u> => u !== null && u !== undefined);
    openPostModal({
      ...post,
      isSaved,
      reactionType: reaction.mine,
      stats: {
        reactions: reaction.counts.total,
        comments: commentCount,
        relays: post.stats?.relays ?? 0,
      },
      mentions: mappedMentions,
      hashtags: post.hashtags || [],
      collaborators: post.collaborators || [],
    });
  }, [post, isSaved, reaction.mine, reaction.counts.total, commentCount, openPostModal]);

  const onAdmire = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      await reaction.toggleDefault();
    },
    [reaction]
  );

  const onSave = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (!user) {
        openAuthModal();
        return;
      }
      if (savePending.current) return;
      savePending.current = true;
      setSaving(true);
      const next = !isSaved;
      notifyUpdate({ postId: post.id, field: "saves", isActive: next, countChange: 0 });
      try {
        await toggleSave(post.id, user.id, isSaved);
        if (next) actionToast.postSaved();
        else actionToast.postUnsaved();
        if (next && post.authorId !== user.id) {
          void createNotification(post.authorId, user.id, "save", post.id).catch(console.error);
        }
      } catch {
        notifyUpdate({ postId: post.id, field: "saves", isActive: !next, countChange: 0 });
        actionToast.genericError("save post");
      } finally {
        savePending.current = false;
        setSaving(false);
      }
    },
    [user, openAuthModal, isSaved, post.id, post.authorId, notifyUpdate, toggleSave]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onCardActivate();
      }
    },
    [onCardActivate]
  );

  return {
    reacting: reaction.pending,
    saving,
    isReacted: reaction.mine !== null,
    reactionCount: reaction.counts.total,
    isSaved,
    commentCount,
    onCardActivate,
    onAdmire,
    onSave,
    onKeyDown,
  };
}

export function firstVisualMedia(post: PostProps) {
  if (!post.media || post.media.length === 0) return null;
  return (
    [...post.media]
      .sort((a, b) => a.position - b.position)
      .find((m) => m.media_type === "image" || m.media_type === "video") ?? null
  );
}
