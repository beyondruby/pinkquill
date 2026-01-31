"use client";

import { Conversation } from "./MessagesView";
import { ConversationSkeleton } from "@/components/ui/Skeleton";

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
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

export default function ConversationList({
  conversations,
  loading,
  selectedId,
  currentUserId,
  onSelect,
}: ConversationListProps) {
  if (loading) {
    return (
      <div className="flex-1 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <ConversationSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="font-body text-muted italic">No conversations yet</p>
          <p className="font-ui text-[0.8rem] text-muted/60 mt-2">
            Start a conversation with someone!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          onClick={() => onSelect(conversation.id)}
          className={`flex items-center gap-3 p-4 cursor-pointer transition-all border-b border-black/[0.04] ${
            selectedId === conversation.id
              ? "bg-purple-primary/10 border-l-[3px] border-l-purple-primary"
              : "hover:bg-purple-primary/5"
          }`}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <img
              src={
                conversation.participant.avatar_url ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"
              }
              alt={conversation.participant.display_name || conversation.participant.username}
              className="w-12 h-12 rounded-full object-cover"
            />
            {/* Online indicator - placeholder for future feature */}
            {/* <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" /> */}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3
                className={`font-ui text-[0.95rem] truncate ${
                  conversation.unread_count > 0
                    ? "font-semibold text-ink"
                    : "font-medium text-ink"
                }`}
              >
                {conversation.participant.display_name ||
                  conversation.participant.username}
              </h3>
              {conversation.last_message && (
                <span className="font-ui text-[0.75rem] text-muted flex-shrink-0 ml-2">
                  {formatTime(conversation.last_message.created_at)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p
                className={`font-body text-[0.85rem] truncate ${
                  conversation.unread_count > 0 ? "text-ink" : "text-muted"
                }`}
              >
                {conversation.last_message ? (
                  <>
                    {conversation.last_message.sender_id === currentUserId && (
                      <span className="text-muted">You: </span>
                    )}
                    {conversation.last_message.message_type === "voice" ? (
                      <span className="inline-flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <span>Voice message ({formatVoiceDuration(conversation.last_message.voice_duration || 0)})</span>
                      </span>
                    ) : conversation.last_message.message_type === "media" ? (
                      <span className="inline-flex items-center gap-1">
                        {conversation.last_message.media_type === "video" ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Video</span>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Photo</span>
                          </>
                        )}
                      </span>
                    ) : (
                      conversation.last_message.content
                    )}
                  </>
                ) : (
                  <span className="italic text-muted">No messages yet</span>
                )}
              </p>
              {conversation.unread_count > 0 && (
                <span className="ml-2 flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-[0.7rem] font-semibold rounded-full flex items-center justify-center">
                  {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}