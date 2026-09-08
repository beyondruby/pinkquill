"use client";

import { useState, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import PostTags from "@/components/feed/PostTags";
import { icons } from "@/components/ui/Icons";
import type { Take } from "@/lib/hooks/useTakes";
import { DetailActionRow } from "@/components/feed/post-detail/DetailActionRow";
import { DiscussionBody } from "@/components/feed/post-detail/DiscussionBody";
import { useTakeDetailActions, type TakeUpdate } from "./take-detail/useTakeDetailActions";
import { useTakeMetadata } from "./take-detail/useTakeMetadata";
import { TakeDetailHeader } from "./take-detail/TakeDetailHeader";
import { TakeVideoFrame } from "./take-detail/TakeVideoFrame";
import { TakeDetailDialogs } from "./take-detail/TakeDetailDialogs";

export type { TakeUpdate };

interface TakeDetailModalProps {
  take: Take | null;
  isOpen: boolean;
  onClose: () => void;
  onTakeUpdate?: (update: TakeUpdate) => void;
  onTakeDeleted?: (takeId: string) => void;
}

/**
 * The take opened over a list. Layout only: header, video frame, action row,
 * discussion and dialogs are the modules app/take/[id] renders too
 * (profile audit 2f, V-52 / V-4 — the modal now has Follow and Block).
 */
export default function TakeDetailModal({ take, isOpen, onClose, onTakeUpdate, onTakeDeleted }: TakeDetailModalProps) {
  const [showComments, setShowComments] = useState(false);

  const onDeleted = useCallback((takeId: string) => { onClose(); onTakeDeleted?.(takeId); }, [onClose, onTakeDeleted]);
  const onBlocked = useCallback(() => { onClose(); if (take) onTakeDeleted?.(take.id); }, [onClose, onTakeDeleted, take]);

  const actions = useTakeDetailActions(take, {
    source: "modal",
    active: isOpen,
    commentsEnabled: showComments,
    onTakeUpdate,
    onDeleted,
    onBlocked,
    onNavigate: onClose,
  });
  const metadata = useTakeMetadata(take?.id);

  if (!take) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className="flex h-full">
          <div className={`flex flex-col overflow-y-auto p-10 ${showComments ? "flex-1 border-r border-border-light" : "flex-1"}`}>
            <TakeDetailHeader
              take={take}
              actions={actions}
              discussion={{ onToggle: () => setShowComments((v) => !v) }}
              className="mb-8 pb-6 border-b border-border-light"
            />

            <div className="flex-1">
              {take.caption && <p className="font-body text-[1.1rem] text-ink leading-relaxed mb-6">{take.caption}</p>}

              <PostTags
                hashtags={metadata.hashtags}
                collaborators={metadata.collaborators}
                mentions={metadata.mentions}
                kind="take"
                contentId={take.id}
                currentUserId={actions.user?.id}
                onNavigate={onClose}
              />

              <div className="mt-2">
                <TakeVideoFrame take={take} actions={actions} isActive={isOpen} frameClassName="max-h-[480px] mx-auto" />
              </div>
            </div>

            <DetailActionRow
              kind="take"
              contentId={take.id}
              actions={actions}
              onComment={() => setShowComments(true)}
              pickerVariant="pill"
              className="mt-auto pt-6 border-t border-border-light"
            />
          </div>

          {showComments && (
            <div className="discussion-panel">
              <div className="p-5 border-b border-border-light bg-surface/60 flex justify-between items-center">
                <span className="font-ui text-[0.8rem] font-medium text-muted">Discussion</span>
                <button
                  onClick={() => setShowComments(false)}
                  aria-label="Close comments"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-pink-vivid hover:rotate-90 transition-colors"
                >
                  {icons.close}
                </button>
              </div>
              <DiscussionBody
                kind="take"
                contentId={take.id}
                discussion={actions.comments}
                currentUserId={actions.user?.id}
                avatarUrl={actions.profile?.avatar_url}
                canDeleteAny={actions.isOwner}
                composerClassName="p-3 md:p-4 bg-surface border-t border-border-light"
              />
            </div>
          )}
        </div>
      </Modal>

      <TakeDetailDialogs take={take} actions={actions} />
    </>
  );
}
