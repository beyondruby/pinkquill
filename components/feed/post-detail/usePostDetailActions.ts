"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { removeSelfAsCollaborator } from "@/lib/hooks.legacy";
import { useToggleSave, useToggleRelay } from "@/lib/hooks/useInteractions";
import { useReaction } from "@/lib/engagement/reactions";
import { deleteOwnPost } from "@/lib/content-client";
import { showToast, actionToast } from "@/lib/utils/toast";
import type { ReactionType } from "@/lib/types";
import type { PostUpdate } from "@/components/providers/ModalProvider";
import type { ModalPost } from "@/components/feed/PostCard/types";
import { buildPostMenuItems } from "./postMenu";
import { useDiscussion, useReportFlow, useBlockFlow } from "./flows";

interface Options {
  /** The page knows the id before the row arrives; the modal always has the row. */
  postId?: string;
  /** False while the discussion is hidden (modal): comments are not fetched or subscribed. */
  commentsEnabled?: boolean;
  onPostUpdate?: (update: PostUpdate) => void;
  /** After a successful delete (the modal closes and prunes lists; the page leaves). */
  onDeleted: (postId: string) => void;
  /** After a successful block of the author. */
  onBlocked: (authorId: string) => void;
  /** After the viewer removes themself from the collaboration. */
  onCollabRemoved?: () => void;
  /** Called before any navigation the hook starts (the modal closes itself first). */
  onNavigate?: () => void;
}

/**
 * Everything a post detail surface does besides layout: reactions, save,
 * relay, comments, the options menu, and the delete / report / block /
 * remove-collaborator flows. Shared by PostDetailModal and app/post/[id]
 * (profile audit 2e, V-52 / V-4): the two used to carry their own drifting
 * copies of every handler.
 */
export function usePostDetailActions(post: ModalPost | null, options: Options) {
  const { commentsEnabled = true, onPostUpdate, onDeleted, onBlocked, onCollabRemoved, onNavigate } = options;
  const router = useRouter();
  const { user, profile } = useAuth();
  const { toggle: toggleSaveRow } = useToggleSave();
  const { toggle: toggleRelayRow } = useToggleRelay();

  const postId = post?.id || options.postId || "";
  const authorId = post?.authorId;

  const [isSaved, setIsSaved] = useState(false);
  const [isRelayed, setIsRelayed] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [showContent, setShowContent] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRemoveCollabConfirm, setShowRemoveCollabConfirm] = useState(false);
  const [removingCollab, setRemovingCollab] = useState(false);

  const comments = useDiscussion("post", postId, { authorId, enabled: commentsEnabled });
  const report = useReportFlow(post ? { type: "post", postId: post.id, reportedUserId: post.authorId } : null);
  const block = useBlockFlow(authorId, onBlocked);

  const reaction = useReaction("post", postId, {
    seed: post
      ? { total: post.stats.reactions, counts: post.stats.reactionCounts, mine: post.reactionType, comments: post.stats.comments }
      : undefined,
    authorId,
    refreshOnFocus: true,
    loadCounts: true,
    loadComments: true,
    live: true,
  });

  const isOwner = !!(user && authorId && user.id === authorId);
  const isAcceptedCollaborator = !!(
    user &&
    post?.collaborators?.some(
      (c) =>
        c.user?.id === user.id &&
        // Rows from `fetchCollaboratedPosts` carry a status; profile lists only
        // hold accepted collaborators, so a missing status counts as accepted.
        ((c as { status?: string }).status === undefined || (c as { status?: string }).status === "accepted"),
    ) &&
    authorId !== user.id
  );

  // Sync from the row (the card that opened the modal, or the page fetch).
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!post) return;
    setIsSaved(post.isSaved || false);
    setIsRelayed(post.isRelayed || false);
    setRelayCount(post.stats.relays);
    setShowContent(!post.contentWarning);
  }, [post?.id, post?.isSaved, post?.isRelayed, post?.stats.relays, post?.contentWarning]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const react = useCallback(async (type: ReactionType) => { if (post) await reaction.react(type); }, [post, reaction]);
  const unreact = useCallback(async () => { if (post) await reaction.unreact(); }, [post, reaction]);

  const toggleSave = useCallback(async () => {
    if (!user || !post) return;
    const next = !isSaved;
    setIsSaved(next);
    onPostUpdate?.({ postId: post.id, field: "saves", isActive: next, countChange: 0 });
    try {
      await toggleSaveRow(post.id, user.id, isSaved);
    } catch {
      setIsSaved(isSaved);
      onPostUpdate?.({ postId: post.id, field: "saves", isActive: isSaved, countChange: 0 });
      actionToast.postSaveError();
    }
  }, [user, post, isSaved, onPostUpdate, toggleSaveRow]);

  const toggleRelay = useCallback(async () => {
    if (!user || !post || user.id === post.authorId) return;
    const next = !isRelayed;
    const countChange = next ? 1 : -1;
    setIsRelayed(next);
    setRelayCount((prev) => Math.max(0, prev + countChange));
    onPostUpdate?.({ postId: post.id, field: "relays", isActive: next, countChange });
    try {
      await toggleRelayRow(post.id, user.id, isRelayed);
    } catch {
      setIsRelayed(isRelayed);
      setRelayCount((prev) => Math.max(0, prev - countChange));
      onPostUpdate?.({ postId: post.id, field: "relays", isActive: isRelayed, countChange: -countChange });
      actionToast.postRelayError();
    }
  }, [user, post, isRelayed, onPostUpdate, toggleRelayRow]);

  const edit = useCallback(() => {
    if (!post) return;
    onNavigate?.();
    router.push(`/create?edit=${post.id}`);
  }, [post, onNavigate, router]);

  const confirmDelete = useCallback(async () => {
    if (!post || !user) return;
    setDeleting(true);
    try {
      await deleteOwnPost(post.id);
      setShowDeleteConfirm(false);
      onDeleted(post.id);
    } catch (err) {
      console.error("Failed to delete post:", err);
      actionToast.postDeleteError();
      setDeleting(false);
    }
  }, [post, user, onDeleted]);

  const confirmRemoveCollab = useCallback(async () => {
    if (!user || !post?.id || !post?.authorId || !isAcceptedCollaborator) return;
    setRemovingCollab(true);
    const result = await removeSelfAsCollaborator(post.id, user.id, post.authorId);
    if (result.success) {
      setShowRemoveCollabConfirm(false);
      showToast.success("Removed from collaboration", "This post no longer appears on your profile.");
      onCollabRemoved?.();
    } else {
      showToast.error("Couldn't remove you from this post", "Please try again.");
    }
    setRemovingCollab(false);
  }, [user, post, isAcceptedCollaborator, onCollabRemoved]);

  const menuItems = buildPostMenuItems({
    isOwner,
    signedIn: !!user,
    isAcceptedCollaborator,
    onEdit: edit,
    onDelete: () => setShowDeleteConfirm(true),
    onAddToCollection: () => setShowCollectionPicker(true),
    onRemoveCollab: () => setShowRemoveCollabConfirm(true),
    onBlock: block.show,
    onReport: report.show,
  });

  return {
    user,
    profile,
    isOwner,
    isAcceptedCollaborator,
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
    showContent,
    revealContent: () => setShowContent(true),
    comments,
    dialogs: {
      share: { open: showShare, show: () => setShowShare(true), hide: () => setShowShare(false) },
      del: { open: showDeleteConfirm, hide: () => setShowDeleteConfirm(false), confirm: confirmDelete, loading: deleting },
      collection: { open: showCollectionPicker, hide: () => setShowCollectionPicker(false) },
      report,
      block,
      removeCollab: { open: showRemoveCollabConfirm, hide: () => setShowRemoveCollabConfirm(false), confirm: confirmRemoveCollab, loading: removingCollab },
    },
  };
}

export type PostDetailActions = ReturnType<typeof usePostDetailActions>;
