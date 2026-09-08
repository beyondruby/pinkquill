"use client";

import ReactionPicker from "@/components/feed/ReactionPicker";
import { icons } from "@/components/ui/Icons";
import type { PostDetailActions } from "./usePostDetailActions";

interface Props {
  postId: string;
  actions: PostDetailActions;
  onComment: () => void;
  hasDarkBg: boolean;
  className?: string;
}

/** Reaction · Comment · Relay … Share · Save, identical on modal and page (V-4). */
export function PostActionRow({ postId, actions, onComment, hasDarkBg, className = "" }: Props) {
  const { user, reaction, commentsCount, react, unreact, isRelayed, relayCount, toggleRelay, isSaved, toggleSave, isOwner, dialogs } = actions;
  const quiet = hasDarkBg ? "text-white hover:bg-white/10" : "text-ink hover:bg-subtle";
  const guest = !user ? "opacity-50 cursor-not-allowed" : "";
  return (
    <div className={`post-actions-bar flex items-center gap-1.5 md:gap-2 flex-wrap ${hasDarkBg ? "dark-bg" : ""} ${className}`}>
      <ReactionPicker
        kind="post"
        id={postId}
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
          aria-label={isRelayed ? `Remove relay (${relayCount} relays)` : `Relay post (${relayCount} relays)`}
          aria-pressed={isRelayed}
          disabled={!user}
          className={`engage-pill transition-colors ${isRelayed ? "text-green-400" : quiet} ${guest}`}
        >
          {icons.relay}
          {relayCount > 0 && <span className="engage-pill-count">{relayCount.toLocaleString()}</span>}
        </button>
      )}

      <div className="flex-1" />

      <button onClick={dialogs.share.show} aria-label="Share post" className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${quiet}`}>
        {icons.share}
      </button>

      <button
        onClick={toggleSave}
        aria-label={isSaved ? "Unsave post" : "Save post"}
        aria-pressed={isSaved}
        disabled={!user}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSaved ? "text-white" : quiet} ${guest}`}
      >
        {isSaved ? icons.bookmarkFilled : icons.bookmark}
      </button>
    </div>
  );
}
