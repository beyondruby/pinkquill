"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOrderMessages, useSendOrderMessage } from "@/lib/hooks/useOrders";
import { useOrderFileUrls } from "@/lib/hooks/useOrderFiles";
import type { OrderMessage } from "@/lib/types/store";

interface OrderMessagesProps {
  orderId: string;
}

export default function OrderMessages({ orderId }: OrderMessagesProps) {
  const { user } = useAuth();
  const { messages, loading } = useOrderMessages(orderId);
  const { sendMessage, sending } = useSendOrderMessage();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Attachments are stored as private order-files storage paths; resolve them to
  // short-lived signed URLs (legacy public-URL rows resolve too).
  const attachmentRefs = useMemo(
    () => messages.flatMap((m) => (m.attachments || []).map((a) => a.url)),
    [messages]
  );
  const fileUrls = useOrderFileUrls(orderId, attachmentRefs);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    await sendMessage(orderId, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section className="rounded-2xl border border-border-light bg-surface overflow-hidden">
      {/* Messages list */}
      <div
        ref={scrollRef}
        className="max-h-[400px] overflow-y-auto px-5 py-4 space-y-3"
      >
        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-pink-200 border-t-pink-vivid rounded-full animate-spin" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-sm font-body text-muted text-center py-6">
            No messages yet. Start the conversation!
          </p>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_id === user?.id} fileUrls={fileUrls} />
        ))}
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-border-light flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 px-4 py-2.5 rounded-xl border border-border-light text-sm font-body resize-none focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="px-4 py-2.5 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-40 shrink-0"
        >
          Send
        </button>
      </div>
    </section>
  );
}

function MessageBubble({ message, isOwn, fileUrls }: { message: OrderMessage; isOwn: boolean; fileUrls: Record<string, string> }) {
  const isSystem = message.message_type === "system" || message.message_type === "status_update";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-3 py-1.5 rounded-full bg-subtle border border-border-light">
          <p className="text-xs font-ui text-muted">{message.content}</p>
          <p className="text-[10px] font-ui text-muted/60 text-center mt-0.5">
            {new Date(message.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 ${isOwn ? "flex-row-reverse" : ""}`}>
      {message.sender?.avatar_url ? (
        <Image
          src={message.sender.avatar_url}
          alt=""
          width={28}
          height={28}
          className="w-7 h-7 rounded-full shrink-0"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid shrink-0 flex items-center justify-center">
          <span className="text-[10px] font-ui font-bold text-white">
            {(message.sender?.display_name || message.sender?.username || "?")[0].toUpperCase()}
          </span>
        </div>
      )}

      <div className={`max-w-[75%] ${isOwn ? "text-right" : ""}`}>
        <p className="text-[10px] font-ui text-muted mb-1">
          {message.sender?.display_name || message.sender?.username || "User"}
        </p>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm font-body ${
            isOwn
              ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-tr-sm"
              : "bg-subtle border border-border-light text-ink rounded-tl-sm"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.attachments.map((att, i) => {
                const href = fileUrls[att.url];
                return (
                <a
                  key={i}
                  href={href || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!href}
                  className={`block text-xs underline ${!href ? "opacity-50 pointer-events-none" : ""} ${isOwn ? "text-white/80" : "text-pink-vivid"}`}
                >
                  {att.name}
                </a>
                );
              })}
            </div>
          )}
        </div>
        <p className={`text-[10px] font-ui text-muted/60 mt-1 ${isOwn ? "text-right" : ""}`}>
          {new Date(message.created_at).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
