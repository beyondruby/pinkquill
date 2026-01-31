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

/**
 * Reaction picker button - shows on hover beside the message
 */
export function ReactionButton({
  onOpenPicker,
  isOwnMessage,
  disabled = false,
}: {
  onOpenPicker: () => void;
  isOwnMessage: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onOpenPicker()}
      disabled={disabled}
      className={`
        w-7 h-7 rounded-full flex items-center justify-center
        transition-all duration-200
        opacity-0 group-hover:opacity-100 focus:opacity-100
        ${isOwnMessage
          ? "text-white/50 hover:text-white hover:bg-white/20"
          : "text-muted/40 hover:text-purple-primary hover:bg-purple-primary/10"
        }
        ${disabled ? "cursor-not-allowed !opacity-20" : "hover:scale-110 active:scale-95"}
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
  );
}

/**
 * Reactions display badge - positioned at bottom corner of message (Instagram-style)
 */
export function ReactionsDisplay({
  reactions,
  userReaction,
  onRemoveReaction,
  isOwnMessage,
}: {
  reactions: MessageReaction[];
  userReaction?: MessageReaction;
  onRemoveReaction: () => void;
  isOwnMessage: boolean;
}) {
  const [showList, setShowList] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(event.target as Node)) {
        setShowList(false);
      }
    };

    if (showList) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showList]);

  if (reactions.length === 0) return null;

  // Group reactions by emoji
  const reactionsByEmoji = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) acc[reaction.emoji] = [];
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, MessageReaction[]>);

  const userHasReacted = !!userReaction;

  return (
    <div className="relative" ref={listRef}>
      <button
        onClick={() => setShowList(!showList)}
        className={`
          flex items-center gap-0.5 px-1.5 py-0.5 rounded-full
          transition-all duration-200 hover:scale-105 active:scale-95
          shadow-sm border
          ${isOwnMessage
            ? "bg-white/95 border-white/50"
            : "bg-white border-purple-primary/10"
          }
          ${userHasReacted ? "ring-1 ring-purple-primary/30" : ""}
        `}
      >
        {/* Stacked emojis */}
        {Object.keys(reactionsByEmoji).slice(0, 3).map((emoji, index) => (
          <span
            key={emoji}
            className="text-xs leading-none"
            style={{
              marginLeft: index > 0 ? "-2px" : "0",
              zIndex: 10 - index,
            }}
          >
            {emoji}
          </span>
        ))}
        {/* Count */}
        {reactions.length > 1 && (
          <span className="ml-0.5 font-ui text-[0.55rem] font-bold text-purple-primary leading-none">
            {reactions.length}
          </span>
        )}
      </button>

      {/* Who Reacted Popup */}
      {showList && (
        <div
          className={`
            absolute z-[60] w-52
            ${isOwnMessage ? "right-0" : "left-0"}
            bottom-full mb-2
            bg-white rounded-xl shadow-xl
            border border-black/[0.06]
            overflow-hidden animate-scaleIn
          `}
        >
          {/* Header */}
          <div className="relative px-3 py-2 border-b border-black/[0.05]">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-purple-primary to-pink-vivid" />
            <p className="font-ui text-xs font-semibold text-ink">Reactions</p>
          </div>

          {/* List */}
          <div className="max-h-48 overflow-y-auto">
            {reactions.map((reaction) => (
              <div
                key={reaction.id}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-purple-primary/[0.03] transition-colors"
              >
                <span className="text-base">{reaction.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-ui text-sm font-medium text-ink truncate">
                    {reaction.user?.display_name || reaction.user?.username || "User"}
                  </p>
                </div>
                {reaction.user_id === userReaction?.user_id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveReaction();
                      setShowList(false);
                    }}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-muted/50 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

/**
 * Main component - combines picker button with emoji popup
 */
export default function MessageReactionPicker({
  userReaction,
  reactions,
  onReact,
  onRemoveReaction,
  isOwnMessage,
  disabled = false,
}: MessageReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPicker]);

  const handleEmojiSelect = (emoji: MessageReactionEmoji) => {
    if (disabled) return;

    if (userReaction?.emoji === emoji) {
      onRemoveReaction();
    } else {
      onReact(emoji);
    }
    setShowPicker(false);
  };

  return (
    <div className="relative" ref={pickerRef}>
      <ReactionButton
        onOpenPicker={() => setShowPicker(!showPicker)}
        isOwnMessage={isOwnMessage}
        disabled={disabled}
      />

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
          <div className="flex items-center gap-0.5 px-2 py-1.5 bg-white rounded-full shadow-xl border border-black/[0.06]">
            {MESSAGE_REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                className={`
                  w-8 h-8 flex items-center justify-center rounded-full
                  transition-all duration-150
                  hover:scale-125 active:scale-100 hover:bg-purple-primary/[0.08]
                  ${userReaction?.emoji === emoji ? "bg-purple-primary/10 scale-110" : ""}
                `}
                aria-label={`React with ${emoji}`}
              >
                <span className="text-lg leading-none">{emoji}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
