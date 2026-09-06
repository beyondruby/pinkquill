"use client";

import { memo } from "react";
import type { Conversation } from "./MessagesView";
import { ConversationSkeleton } from "@/components/ui/Skeleton";
import Avatar from "@/components/ui/Avatar";

function formatVoiceDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  selectedId: string | null;
  currentUserId: string;
  onSelect: (id: string) => void;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

const micIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
    <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
  </svg>
);
const imageIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 16l5-5 4 4 3-3 6 6" />
  </svg>
);
const videoIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3" />
  </svg>
);

/** One row per person: who, when, the last line, and how many are unread. */
function ConversationList({ conversations, loading, selectedId, currentUserId, onSelect }: ConversationListProps) {
  if (loading) {
    return (
      <div className="pq-msgs__scroll" aria-busy="true">
        {[...Array(6)].map((_, i) => <ConversationSkeleton key={i} />)}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="pq-chat-empty">
        <h3>No conversations yet</h3>
        <p>Start one from a studio, or with the New message button above.</p>
      </div>
    );
  }

  return (
    <div className="pq-msgs__scroll" role="list" aria-label="Conversations">
      {conversations.map((conversation) => {
        const name = conversation.participant.display_name || conversation.participant.username;
        const unread = conversation.unread_count > 0;
        const last = conversation.last_message;
        return (
          <button
            key={conversation.id}
            type="button"
            role="listitem"
            onClick={() => onSelect(conversation.id)}
            aria-current={selectedId === conversation.id ? "true" : undefined}
            className={`pq-thread-row ${unread ? "pq-thread-row--unread" : ""}`}
            aria-label={`${name}${unread ? `, ${conversation.unread_count} unread` : ""}`}
          >
            <Avatar src={conversation.participant.avatar_url} alt="" size={40} />
            <div className="pq-thread-row__text">
              <div className="pq-thread-row__top">
                <span className="pq-thread-row__name">{name}</span>
                {last && <span className="pq-thread-row__when">{formatTime(last.created_at)}</span>}
              </div>
              <div className="pq-thread-row__preview">
                <span>
                  {last ? (
                    <>
                      {last.sender_id === currentUserId && <span>You: </span>}
                      {last.message_type === "voice" ? (
                        <>{micIcon}<span>Voice note · {formatVoiceDuration(last.voice_duration || 0)}</span></>
                      ) : last.message_type === "media" ? (
                        last.media_type === "video" ? <>{videoIcon}<span>Video</span></> : <>{imageIcon}<span>Photo</span></>
                      ) : (
                        last.content
                      )}
                    </>
                  ) : (
                    "No messages yet"
                  )}
                </span>
                {unread && <span className="pq-thread-row__unread">{conversation.unread_count > 9 ? "9+" : conversation.unread_count}</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default memo(ConversationList);
