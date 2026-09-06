"use client";

import "./messages.css";

import type { TypingUser } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
  typingText: string | null;
}

/** Three quiet dots and a name; nothing glows. */
export default function TypingIndicator({ typingUsers, typingText }: TypingIndicatorProps) {
  if (!typingText || typingUsers.length === 0) return null;
  return (
    <div className="pq-typing" role="status" aria-live="polite">
      <Avatar src={typingUsers[0]?.avatar_url} alt="" size={24} />
      <span className="pq-typing__dots" aria-hidden="true"><span /><span /><span /></span>
      <span>{typingText}</span>
    </div>
  );
}
