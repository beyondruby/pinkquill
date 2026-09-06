"use client";

import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { Switch } from "@/components/create/pieces";
import { PostTypeChip } from "@/components/feed/PostTypeChip";
import { stripHtml } from "@/lib/utils/sanitize";
import { formatDate } from "@/lib/utils/time";
import type { StudioWork } from "./works";

interface PinSheetProps {
  isOpen: boolean;
  onClose: () => void;
  works: StudioWork[];
  pinnedIds: string[];
  canPin: boolean;
  onPin: (postId: string) => Promise<boolean>;
  onUnpin: (postId: string) => Promise<boolean>;
}

const MAX_PINS = 6;

/** The owner's one place to choose which posts open the studio. */
export default function PinSheet({ isOpen, onClose, works, pinnedIds, canPin, onPin, onUnpin }: PinSheetProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = async (id: string, next: boolean) => {
    setBusy(id);
    try {
      await (next ? onPin(id) : onUnpin(id));
    } finally {
      setBusy(null);
    }
  };
  const candidates = works.filter((w) => !w.community_id && !w.isCollaboration);

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Pinned posts"
      subtitle={`Up to ${MAX_PINS} posts show first on your studio. ${pinnedIds.length} of ${MAX_PINS} chosen.`}
      bodyClassName="pq-dialog__body--flush"
    >
      {candidates.length === 0 ? (
        <div className="pq-feed-state"><p className="pq-feed-state__title">Nothing to pin yet</p></div>
      ) : (
        <div className="pq-list" role="list">
          {candidates.map((work) => {
            const pinned = pinnedIds.includes(work.id);
            const title = work.title || stripHtml(work.content || "").slice(0, 80) || "Untitled";
            return (
              <div key={work.id} className="pq-pin-row" role="listitem">
                <div className="pq-pin-row__text">
                  <span className="pq-pin-row__title">{title}</span>
                  <span className="pq-pin-row__meta"><PostTypeChip type={work.type} size="sm" /> · {formatDate(work.created_at)}</span>
                </div>
                <Switch
                  checked={pinned}
                  onChange={(next) => { if (busy) return; if (next && !canPin) return; void toggle(work.id, next); }}
                  label={pinned ? `Unpin ${title}` : `Pin ${title}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
