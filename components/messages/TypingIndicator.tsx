"use client";

import type { TypingUser } from "@/lib/types";

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
  typingText: string | null;
}

export default function TypingIndicator({ typingUsers, typingText }: TypingIndicatorProps) {
  if (!typingText || typingUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 animate-fadeIn">
      {/* Avatar(s) of typing user(s) */}
      <div className="flex -space-x-2">
        {typingUsers.slice(0, 3).map((user) => (
          <img
            key={user.user_id}
            src={user.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
            alt={user.display_name || user.username}
            className="w-6 h-6 rounded-full object-cover border-2 border-white shadow-sm"
          />
        ))}
      </div>

      {/* Typing indicator dots animation */}
      <div className="flex items-center gap-1 px-3 py-2 bg-white rounded-full shadow-sm">
        <div className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-purple-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-purple-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>

      {/* Typing text */}
      <span className="font-ui text-xs text-muted italic">{typingText}</span>
    </div>
  );
}
