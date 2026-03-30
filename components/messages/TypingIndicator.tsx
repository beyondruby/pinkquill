"use client";

import type { TypingUser } from "@/lib/types";
import { DEFAULT_AVATAR } from "@/lib/utils/image";

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
  typingText: string | null;
}

export default function TypingIndicator({ typingUsers, typingText }: TypingIndicatorProps) {
  if (!typingText || typingUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-end gap-2 px-4 py-3 animate-fadeIn">
      {/* Avatar with subtle glow */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-primary/30 to-pink-vivid/30 rounded-full blur-md animate-pulse" />
        <img
          src={typingUsers[0]?.avatar_url || DEFAULT_AVATAR}
          alt={typingUsers[0]?.display_name || typingUsers[0]?.username}
          className="relative w-8 h-8 rounded-full object-cover border-2 border-white shadow-md"
          loading="lazy"
        />
        {/* Additional avatars stacked */}
        {typingUsers.length > 1 && (
          <div className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid text-white text-[0.55rem] font-bold flex items-center justify-center border border-white">
            +{typingUsers.length - 1}
          </div>
        )}
      </div>

      {/* Typing bubble */}
      <div className="relative">
        {/* Bubble tail */}
        <div className="absolute -left-1.5 bottom-1 w-3 h-3 bg-gradient-to-br from-purple-primary/[0.08] to-pink-vivid/[0.08] rotate-45 rounded-sm" />

        {/* Main bubble */}
        <div className="relative px-4 py-2.5 bg-gradient-to-br from-purple-primary/[0.08] to-pink-vivid/[0.08] rounded-2xl rounded-bl-md backdrop-blur-sm border border-purple-primary/10">
          <div className="flex items-center gap-2">
            {/* Animated dots with gradient */}
            <div className="flex items-center gap-[3px]">
              <span
                className="w-[7px] h-[7px] rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid animate-typing-dot"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-[7px] h-[7px] rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid animate-typing-dot"
                style={{ animationDelay: "160ms" }}
              />
              <span
                className="w-[7px] h-[7px] rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid animate-typing-dot"
                style={{ animationDelay: "320ms" }}
              />
            </div>

            {/* Typing text with gradient */}
            <span className="font-ui text-xs font-medium bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
              {typingText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
