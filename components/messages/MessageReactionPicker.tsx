"use client";

import { useState, useRef, useEffect } from "react";
import { MESSAGE_REACTION_EMOJIS } from "@/lib/hooks";
import type { MessageReaction, MessageReactionEmoji } from "@/lib/types";

interface MessageReactionPickerProps {
  userReaction?: MessageReaction;
  reactions: MessageReaction[];
  onReact: (emoji: MessageReactionEmoji) => void;
  onRemoveReaction: () => void;
  isOwnMessage: boolean;
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

    if (userReaction?.emoji === emoji) {
      onRemoveReaction();
    } else {
      onReact(emoji);
    }
    setShowPicker(false);
  };

  const hasReactions = reactions.length > 0;
  const userHasReacted = !!userReaction;

  return (
    <div className="relative flex items-center">
      {/* Add Reaction Button - Always visible on hover */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => !disabled && setShowPicker(!showPicker)}
          disabled={disabled}
          className={`
            w-7 h-7 rounded-full flex items-center justify-center
            transition-all duration-200
            opacity-0 group-hover:opacity-100 focus:opacity-100
            ${showPicker ? "!opacity-100" : ""}
            ${isOwnMessage
              ? "text-white/60 hover:text-white hover:bg-white/20"
              : "text-muted/50 hover:text-purple-primary hover:bg-purple-primary/10"
            }
            ${disabled ? "cursor-not-allowed !opacity-30" : "hover:scale-110 active:scale-95"}
          `}
          aria-label="Add reaction"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>

        {/* Emoji Picker Popup */}
        {showPicker && (
          <div
            className={`
              absolute z-50
              ${isOwnMessage ? "right-0" : "left-0"}
              bottom-full mb-2
              animate-scaleIn
            `}
          >
            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-primary/15 to-pink-vivid/15 rounded-full blur-lg scale-110" />

            {/* Picker container */}
            <div className="relative flex items-center gap-0.5 px-2 py-1.5 bg-white rounded-full shadow-xl border border-black/[0.06]">
              {MESSAGE_REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  className={`
                    relative w-9 h-9 flex items-center justify-center rounded-full
                    transition-all duration-150
                    hover:scale-125 active:scale-100
                    ${userReaction?.emoji === emoji
                      ? "bg-gradient-to-br from-purple-primary/15 to-pink-vivid/15 scale-110"
                      : "hover:bg-purple-primary/[0.08]"
                    }
                  `}
                  aria-label={`React with ${emoji}`}
                >
                  <span className="text-xl leading-none">{emoji}</span>
                  {userReaction?.emoji === emoji && (
                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reactions Display Badge - Floats beside button when has reactions */}
      {hasReactions && (
        <div
          className={`relative ${isOwnMessage ? "mr-1 order-first" : "ml-1"}`}
          ref={reactionsListRef}
        >
          <button
            onClick={() => setShowReactionsList(!showReactionsList)}
            className={`
              flex items-center gap-0.5 px-2 py-1 rounded-full
              transition-all duration-200 hover:scale-105 active:scale-95
              ${isOwnMessage
                ? "bg-white/95 shadow-md hover:shadow-lg"
                : "bg-gradient-to-r from-purple-primary/[0.08] to-pink-vivid/[0.08] hover:from-purple-primary/[0.12] hover:to-pink-vivid/[0.12]"
              }
              ${userHasReacted ? "ring-2 ring-purple-primary/20 ring-offset-1" : ""}
            `}
          >
            {/* Stacked emojis */}
            <div className="flex items-center">
              {Object.keys(reactionsByEmoji).slice(0, 3).map((emoji, index) => (
                <span
                  key={emoji}
                  className="text-sm leading-none"
                  style={{
                    marginLeft: index > 0 ? "-3px" : "0",
                    zIndex: 10 - index,
                  }}
                >
                  {emoji}
                </span>
              ))}
            </div>
            {/* Count badge */}
            {reactions.length > 1 && (
              <span
                className={`
                  ml-0.5 font-ui text-[0.6rem] font-bold leading-none
                  ${isOwnMessage
                    ? "text-purple-primary"
                    : "bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent"
                  }
                `}
              >
                {reactions.length}
              </span>
            )}
          </button>

          {/* Who Reacted Popup */}
          {showReactionsList && (
            <div
              className={`
                absolute z-[60] w-56
                ${isOwnMessage ? "right-0" : "left-0"}
                bottom-full mb-2
                bg-white rounded-2xl shadow-2xl
                border border-black/[0.06]
                overflow-hidden animate-scaleIn
              `}
            >
              {/* Header with gradient bar */}
              <div className="relative px-4 py-2.5 border-b border-black/[0.05] bg-gradient-to-r from-purple-primary/[0.03] to-pink-vivid/[0.03]">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-purple-primary to-pink-vivid" />
                <p className="font-ui text-xs font-semibold text-ink">Reactions</p>
              </div>

              {/* Reactions list */}
              <div className="max-h-52 overflow-y-auto">
                {reactions.map((reaction) => (
                  <div
                    key={reaction.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-purple-primary/[0.03] transition-colors"
                  >
                    {/* Emoji with subtle background */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-primary/[0.08] to-pink-vivid/[0.08] flex items-center justify-center">
                      <span className="text-lg">{reaction.emoji}</span>
                    </div>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-ui text-sm font-medium text-ink truncate">
                        {reaction.user?.display_name || reaction.user?.username || "User"}
                      </p>
                      {reaction.user?.username && (
                        <p className="font-ui text-[0.7rem] text-muted truncate">
                          @{reaction.user.username}
                        </p>
                      )}
                    </div>

                    {/* Remove button for own reaction */}
                    {reaction.user_id === userReaction?.user_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveReaction();
                          setShowReactionsList(false);
                        }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-muted/60 hover:text-red-500 hover:bg-red-50 transition-all"
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
      )}
    </div>
  );
}
