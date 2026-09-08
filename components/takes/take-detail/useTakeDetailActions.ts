"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useReaction } from "@/lib/engagement/reactions";
import { deleteOwnTake } from "@/lib/content-client";
import { followUserRecord, unfollowUserRecord } from "@/lib/hooks/useProfile";
import { setTakeSaved, setTakeRelayed } from "@/lib/takes/interactions";
import { useMuted, useVolume, takeVideoStyle, type Take, type TakeReactionType } from "@/lib/hooks/useTakes";
import { useTrackTakeImpression, useTrackTakeView } from "@/lib/hooks/useTracking";
import { actionToast } from "@/lib/utils/toast";
import { icons } from "@/components/ui/Icons";
import type { ActionMenuItem } from "@/components/ui/ActionMenu";
import type { FollowStatus } from "@/lib/types";
import { useDiscussion, useReportFlow, useBlockFlow } from "@/components/feed/post-detail/flows";

export interface TakeUpdate {
  takeId: string;
  field: "comments" | "relays" | "saves";
  isActive: boolean;
  countChange: number;
}

interface Options {
  /** The page knows the id before the row arrives. */
  takeId?: string;
  /** Where the view is counted: the modal or the page. */
  source: "modal" | "page";
  /** Whether the surface is showing (the modal passes `isOpen`). */
  active?: boolean;
  commentsEnabled?: boolean;
  onTakeUpdate?: (update: TakeUpdate) => void;
  onDeleted: (takeId: string) => void;
  onBlocked: (authorId: string) => void;
  onNavigate?: () => void;
}

/**
 * Everything a take detail surface does besides layout — the take twin of
 * usePostDetailActions (profile audit 2f, V-52 / V-4). The modal and the
 * page used to carry separate copies, and the modal had no Follow or Block.
 */
export function useTakeDetailActions(take: Take | null, options: Options) {
  const { source, active = true, commentsEnabled = true, onTakeUpdate, onDeleted, onBlocked, onNavigate } = options;
  const { user, profile } = useAuth();
  const takeId = take?.id || options.takeId || "";
  const authorId = take?.author_id;
  const isOwner = !!(user && authorId && user.id === authorId);

  const [isSaved, setIsSaved] = useState(false);
  const [isRelayed, setIsRelayed] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [showContent, setShowContent] = useState(true);
  const [followStatus, setFollowStatus] = useState<FollowStatus>(null);
  const [showShare, setShowShare] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { isMuted, toggle: toggleMute } = useMuted();
  const { volume } = useVolume();
  const videoStyle = useMemo(() => takeVideoStyle(take?.effects), [take?.effects]);
  const tracking = useTrackTakeView(takeId || undefined, take?.duration ?? 0, source);
  useTrackTakeImpression(takeId || undefined, source, active && !!take && showContent);

  const comments = useDiscussion("take", takeId, { authorId, enabled: commentsEnabled });
  const reaction = useReaction("take", takeId, {
    seed: take ? { total: take.reactions_count, mine: take.user_reaction_type, counts: take.reaction_counts } : undefined,
    authorId,
    refreshOnFocus: true,
    loadCounts: true,
    loadComments: true,
    live: true,
  });
  const report = useReportFlow(take ? { type: "take", takeId: take.id, reportedUserId: take.author_id } : null);
  const block = useBlockFlow(authorId, onBlocked);

  // Sync from the row (the card that opened the modal, or the page fetch).
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!take) return;
    setIsSaved(take.is_saved || false);
    setIsRelayed(take.is_relayed || false);
    setRelayCount(take.relays_count || 0);
    setShowContent(!take.content_warning);
  }, [take?.id, take?.is_saved, take?.is_relayed, take?.relays_count, take?.content_warning]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // Follow status for the author (one request per take/viewer; the same
  // helpers as the profile button, so a private account gets a request, V-23).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setFollowStatus(null);
    if (!user || !authorId || isOwner) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("follows").select("status").eq("follower_id", user.id).eq("following_id", authorId).maybeSingle();
      if (!cancelled) setFollowStatus((data?.status as FollowStatus) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authorId, isOwner]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleFollow = useCallback(async () => {
    if (!user || !authorId || isOwner) return;
    const previous = followStatus;
    try {
      if (previous) {
        setFollowStatus(null);
        await unfollowUserRecord(user.id, authorId);
      } else {
        setFollowStatus(await followUserRecord(user.id, authorId));
      }
    } catch {
      setFollowStatus(previous);
      if (previous) actionToast.unfollowError();
      else actionToast.followError();
    }
  }, [user, authorId, isOwner, followStatus]);

  const react = useCallback(async (type: TakeReactionType) => { if (take) await reaction.react(type); }, [take, reaction]);
  const unreact = useCallback(async () => { if (take) await reaction.unreact(); }, [take, reaction]);

  const toggleSave = useCallback(async () => {
    if (!user || !take) return;
    const next = !isSaved;
    setIsSaved(next);
    onTakeUpdate?.({ takeId: take.id, field: "saves", isActive: next, countChange: 0 });
    try {
      await setTakeSaved(take.id, user.id, next);
    } catch {
      setIsSaved(isSaved);
      onTakeUpdate?.({ takeId: take.id, field: "saves", isActive: isSaved, countChange: 0 });
      actionToast.genericError(next ? "save take" : "unsave take");
    }
  }, [user, take, isSaved, onTakeUpdate]);

  const toggleRelay = useCallback(async () => {
    if (!user || !take || isOwner) return;
    const next = !isRelayed;
    const countChange = next ? 1 : -1;
    setIsRelayed(next);
    setRelayCount((prev) => Math.max(0, prev + countChange));
    onTakeUpdate?.({ takeId: take.id, field: "relays", isActive: next, countChange });
    try {
      await setTakeRelayed(take.id, user.id, next);
    } catch {
      setIsRelayed(isRelayed);
      setRelayCount((prev) => Math.max(0, prev - countChange));
      onTakeUpdate?.({ takeId: take.id, field: "relays", isActive: isRelayed, countChange: -countChange });
      actionToast.genericError(next ? "relay take" : "remove relay");
    }
  }, [user, take, isOwner, isRelayed, onTakeUpdate]);

  const confirmDelete = useCallback(async () => {
    if (!take || !user || !isOwner) return;
    setDeleting(true);
    try {
      await deleteOwnTake(take.id);
      setShowDeleteConfirm(false);
      onDeleted(take.id);
    } catch (err) {
      console.error("Failed to delete take:", err);
      actionToast.genericError("delete take");
      setDeleting(false);
    }
  }, [take, user, isOwner, onDeleted]);

  const menuItems: ActionMenuItem[] = isOwner
    ? [{ label: "Delete", onSelect: () => setShowDeleteConfirm(true), icon: icons.trash, tone: "danger" }]
    : user
      ? [
          { label: "Block", onSelect: block.show, icon: icons.block },
          { label: "Report", onSelect: report.show, icon: icons.flag, tone: "danger" },
        ]
      : [];

  return {
    user,
    profile,
    isOwner,
    menuItems,
    reaction,
    commentsCount: reaction.comments,
    react,
    unreact,
    isSaved,
    toggleSave,
    isRelayed,
    relayCount,
    toggleRelay,
    followStatus,
    toggleFollow,
    showContent,
    revealContent: () => setShowContent(true),
    comments,
    player: { isMuted, toggleMute, volume, videoStyle, tracking },
    onNavigate,
    dialogs: {
      share: { open: showShare, show: () => setShowShare(true), hide: () => setShowShare(false) },
      del: { open: showDeleteConfirm, hide: () => setShowDeleteConfirm(false), confirm: confirmDelete, loading: deleting },
      report,
      block,
    },
  };
}

export type TakeDetailActions = ReturnType<typeof useTakeDetailActions>;
