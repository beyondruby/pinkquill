"use client";

import ReactionPicker from "@/components/feed/ReactionPicker";
import { icons } from "@/components/ui/Icons";
import type { EngagementKind } from "@/lib/engagement/store";
import type { ReactionType } from "@/lib/types";
import type { useReaction } from "@/lib/engagement/reactions";

/** What the row needs from a post or take detail hook (structural, both satisfy it). */
export interface EngagementActions {
  user: { id: string } | null;
  isOwner: boolean;
  reaction: ReturnType<typeof useReaction>;
  commentsCount: number;
  react: (type: ReactionType) => Promise<void>;
  unreact: () => Promise<void>;
  isRelayed: boolean;
  relayCount: number;
  toggleRelay: () => Promise<void>;
  isSaved: boolean;
  toggleSave: () => Promise<void>;
  dialogs: { share: { show: () => void } };
}

interface Props {
  kind: EngagementKind;
  contentId: string;
  actions: EngagementActions;
  onComment: () => void;
  hasDarkBg?: boolean;
  /** "pill" for takes, the card style for posts. */
  pickerVariant?: "card" | "pill";
  className?: string;
}

/** Reaction · Comment · Relay … Share · Save, identical on modal and page, posts and takes (V-4). */
export function DetailActionRow({ kind, contentId, actions, onComment, hasDarkBg = false, pickerVariant = "card", className = "" }: Props) {
  const { user, reaction, commentsCount, react, unreact, isRelayed, relayCount, toggleRelay, isSaved, toggleSave, isOwner, dialogs } = actions;
  const noun = kind === "take" ? "take" : "post";
  const quiet = hasDarkBg ? "text-white hover:bg-white/10" : "text-ink hover:bg-subtle";
  const guest = !user ? "opacity-50 cursor-not-allowed" : "";
  return (
    <div className={`post-actions-bar flex items-center gap-1.5 md:gap-2 flex-wrap ${hasDarkBg ? "dark-bg" : ""} ${className}`}>
      <ReactionPicker
        variant={pickerVariant}
        kind={kind}
        id={contentId}
        currentReaction={reaction.mine}
        reactionCounts={reaction.counts}
        countsLoaded={reaction.countsLoaded}
        onOpen={reaction.loadCounts}
        onReact={react}
        onRemoveReaction={unreact}
      />

      <button
        onClick={onComment}
        aria-label={commentsCount > 0 ? `Show comments, ${commentsCount.toLocaleString()}` : "Show comments"}
        className={`engage-pill transition-colors ${quiet}`}
      >
        {icons.comment}
        {commentsCount > 0 && <span className="engage-pill-count">{commentsCount.toLocaleString()}</span>}
      </button>

      {!isOwner && (
        <button
          onClick={toggleRelay}
          aria-label={isRelayed ? `Remove relay (${relayCount} relays)` : `Relay ${noun} (${relayCount} relays)`}
          aria-pressed={isRelayed}
          disabled={!user}
          className={`engage-pill transition-colors ${isRelayed ? "text-green-400" : quiet} ${guest}`}
        >
          {icons.relay}
          {relayCount > 0 && <span className="engage-pill-count">{relayCount.toLocaleString()}</span>}
        </button>
      )}

      <div className="flex-1" />

      <button onClick={dialogs.share.show} aria-label={`Share ${noun}`} className={`post-action-icon w-10 h-10 rounded-full flex items-center justify-center transition-colors ${quiet}`}>
        {icons.share}
      </button>

      <button
        onClick={toggleSave}
        aria-label={isSaved ? `Unsave ${noun}` : `Save ${noun}`}
        aria-pressed={isSaved}
        disabled={!user}
        className={`post-action-icon w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSaved ? "text-white" : quiet} ${guest}`}
      >
        {isSaved ? icons.bookmarkFilled : icons.bookmark}
      </button>
    </div>
  );
}
