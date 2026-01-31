"use client";

import { useState, useRef, useEffect } from "react";
import { MESSAGE_REACTION_EMOJIS } from "@/lib/hooks";
import type { MessageReaction, MessageReactionEmoji } from "@/lib/types";

interface MessageReactionPickerProps {
  // Current user's reaction on this message (if any)
  userReaction?: MessageReaction;
  // All reactions on this message
  reactions: MessageReaction[];
  // Called when user selects a reaction
  onReact: (emoji: MessageReactionEmoji) => void;
  // Called when user wants to remove their reaction
  onRemoveReaction: () => void;
  // Whether this is the current user's message
  isOwnMessage: boolean;
  // Disabled state
  disabled?: boolean;
}

export default function MessageReactionPicker({
  userReaction,
  reactions,
  onReact,
  onRemoveReaction,
  isOwnMessage,
  disabled = false,
}: MessageReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showReactionsList, setShowReactionsList] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const reactionsListRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
      if (reactionsListRef.current && !reactionsListRef.current.contains(event.target as Node)) {
        setShowReactionsList(false);
      }
    };

    if (showPicker || showReactionsList) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPicker, showReactionsList]);

  // Group reactions by emoji for display
  const reactionsByEmoji = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, MessageReaction[]>);

  const handleEmojiSelect = (emoji: MessageReactionEmoji) => {
    if (disabled) return;

    // If user clicks the same emoji they already reacted with, remove the reaction
    if (userReaction?.emoji === emoji) {
      onRemoveReaction();
    } else {
      onReact(emoji);
    }
    setShowPicker(false);
  };

  const hasReactions = reactions.length > 0;

  return (
    <div className="relative inline-flex items-center">
      {/* Reactions Display (shown below message) */}
      {hasReactions && (
        <div className="flex items-center gap-0.5 mr-1.5">
          {Object.entries(reactionsByEmoji).map(([emoji, reactionsList]) => (
            <button
              key={emoji}
              onClick={() => setShowReactionsList(!showReactionsList)}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all ${
                isOwnMessage
                  ? "bg-white/20 hover:bg-white/30"
                  : "bg-purple-primary/10 hover:bg-purple-primary/20"
              } ${
                reactionsList.some(r => r.user_id === userReaction?.user_id)
                  ? "ring-1 ring-purple-primary/40"
                  : ""
              }`}
            >
              <span className="text-sm">{emoji}</span>
              {reactionsList.length > 1 && (
                <span className={`font-ui text-[0.65rem] ${
                  isOwnMessage ? "text-white/80" : "text-purple-primary/80"
                }`}>
                  {reactionsList.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Add Reaction Button */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => !disabled && setShowPicker(!showPicker)}
          disabled={disabled}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${
            isOwnMessage
              ? "text-white/60 hover:text-white hover:bg-white/20"
              : "text-muted hover:text-purple-primary hover:bg-purple-primary/10"
          } ${disabled ? "cursor-not-allowed" : ""}`}
          aria-label="Add reaction"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>

        {/* Emoji Picker Popup */}
        {showPicker && (
          <div
            className={`absolute ${
              isOwnMessage ? "right-0" : "left-0"
            } bottom-full mb-1 flex items-center gap-1 px-2 py-1.5 bg-white rounded-full shadow-lg border border-black/10 z-50 animate-scaleIn`}
          >
            {MESSAGE_REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-purple-primary/10 hover:scale-125 transition-all ${
                  userReaction?.emoji === emoji ? "bg-purple-primary/20 scale-110" : ""
                }`}
                aria-label={`React with ${emoji}`}
              >
                <span className="text-lg">{emoji}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reactions List Modal (shows who reacted) */}
      {showReactionsList && hasReactions && (
        <div
          ref={reactionsListRef}
          className={`absolute ${
            isOwnMessage ? "right-0" : "left-0"
          } bottom-full mb-8 w-48 bg-white rounded-xl shadow-lg border border-black/10 z-50 animate-scaleIn overflow-hidden`}
        >
          <div className="p-2 border-b border-black/[0.06]">
            <p className="font-ui text-xs text-muted text-center">Reactions</p>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {reactions.map((reaction) => (
              <div
                key={reaction.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-black/[0.02]"
              >
                <span className="text-base">{reaction.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-ui text-sm text-ink truncate">
                    {reaction.user?.display_name || reaction.user?.username || "User"}
                  </p>
                </div>
                {reaction.user_id === userReaction?.user_id && (
                  <button
                    onClick={() => {
                      onRemoveReaction();
                      setShowReactionsList(false);
                    }}
                    className="text-muted hover:text-red-500 transition-colors"
                    aria-label="Remove your reaction"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
