"use client";

import "./messages.css";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUserEvent } from "@/components/providers/UserEventsProvider";
import { useCommunityChatOverview } from "@/lib/hooks/useCommunityChat";
import { usePollOnFocus } from "@/lib/hooks/usePollOnFocus";
import ConversationList from "./ConversationList";
import ChatView from "./ChatView";
import NewMessageModal from "./NewMessageModal";

export interface Conversation {
  id: string;
  updated_at: string;
  participant: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  last_message: {
    content: string;
    created_at: string;
    sender_id: string;
    message_type?: "text" | "voice" | "media";
    voice_duration?: number;
    media_type?: "image" | "video";
  } | null;
  unread_count: number;
  is_blocked?: boolean;
}

/** Row shape of the `get_dm_conversation_overview` RPC. */
interface ConversationOverviewRow {
  conversation_id: string;
  updated_at: string | null;
  participant_id: string | null;
  participant_username: string | null;
  participant_display_name: string | null;
  participant_avatar_url: string | null;
  is_blocked: boolean;
  last_message_content: string | null;
  last_message_created_at: string | null;
  last_message_sender_id: string | null;
  last_message_type: "text" | "voice" | "media" | null;
  last_message_voice_duration: number | null;
  last_message_media_type: "image" | "video" | null;
  unread_count: number;
}

function rowToConversation(row: ConversationOverviewRow): Conversation | null {
  if (!row.participant_id) return null;
  return {
    id: row.conversation_id,
    updated_at: row.updated_at || "",
    participant: {
      id: row.participant_id,
      username: row.participant_username || "Unknown",
      display_name: row.participant_display_name,
      avatar_url: row.participant_avatar_url,
    },
    last_message:
      row.last_message_created_at && row.last_message_sender_id
        ? {
            content: row.last_message_content || "",
            created_at: row.last_message_created_at,
            sender_id: row.last_message_sender_id,
            message_type: row.last_message_type ?? undefined,
            voice_duration: row.last_message_voice_duration ?? undefined,
            media_type: row.last_message_media_type ?? undefined,
          }
        : null,
    unread_count: row.unread_count || 0,
    is_blocked: row.is_blocked,
  };
}

function sortByRecent(list: Conversation[]): Conversation[] {
  return [...list].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

const icons = {
  community: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-1a4 4 0 00-5-3.87M17 20H7m10 0v-1c0-.65-.12-1.27-.34-1.84M7 20H2v-1a4 4 0 015-3.87M7 20v-1c0-.65.12-1.27.34-1.84m0 0a5 5 0 019.32 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  edit: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  inbox: (
    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
};

export default function MessagesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const userId = user?.id;
  const { totalUnreadCount: communityUnreadCount } = useCommunityChatOverview(userId);
  const currentUserProfile = useMemo(
    () =>
      profile
        ? { username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url }
        : undefined,
    [profile]
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewMessage, setShowNewMessage] = useState(false);

  // Check for conversation ID in URL
  useEffect(() => {
    const conversationId = searchParams.get("conversation");
    if (conversationId) {
      setSelectedConversation(conversationId);
    }
  }, [searchParams]);

  // Conversation list = ONE aggregate RPC (last message + unread per
  // conversation, block-aware, computed in SQL). Replaces the 7-query scan
  // that pulled every message of every conversation into the browser and
  // re-ran on each read receipt (docs/audit/01-findings.md L1).
  const fetchConversations = useCallback(async (showLoading = true) => {
    if (!userId) return;

    try {
      if (showLoading) setLoading(true);

      const { data, error } = await supabase.rpc("get_dm_conversation_overview");
      if (error) throw error;

      const rows = (data || []) as ConversationOverviewRow[];
      const next = rows
        .map(rowToConversation)
        .filter((c): c is Conversation => c !== null);
      setConversations(sortByRecent(next));
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchConversations(true);
  }, [fetchConversations]);

  // Backstop for anything the delta handler cannot express (deleted
  // messages, new conversations). Throttled; no interval.
  usePollOnFocus(() => fetchConversations(false), 30_000);

  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null;
      fetchConversations(false);
    }, 500);
  }, [fetchConversations]);
  useEffect(() => {
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, []);

  // Live updates arrive on the per-user broadcast channel (DB trigger on
  // `messages`) and are applied as deltas — no postgres_changes subscription
  // and no refetch on read receipts.
  useUserEvent("dm_unread_change", (payload) => {
    if (!userId) return;
    const { op, conversation_id, sender_id } = payload;
    const isFromOther = sender_id !== userId;

    if (op === "DELETE") {
      scheduleRefetch();
      return;
    }

    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === conversation_id);
      if (index === -1) {
        scheduleRefetch();
        return prev;
      }
      const conv = prev[index];
      if (conv.is_blocked && isFromOther) return prev;

      if (op === "INSERT") {
        const createdAt = payload.created_at || new Date().toISOString();
        const updated: Conversation = {
          ...conv,
          last_message: {
            content: payload.content || "",
            created_at: createdAt,
            sender_id,
            message_type: payload.message_type ?? undefined,
            voice_duration: payload.voice_duration ?? undefined,
            media_type: payload.media_type ?? undefined,
          },
          unread_count:
            isFromOther && payload.is_read !== true ? conv.unread_count + 1 : conv.unread_count,
          updated_at: createdAt,
        };
        const next = [...prev];
        next[index] = updated;
        return sortByRecent(next);
      }

      // UPDATE: only read-state flips are broadcast.
      if (!isFromOther) return prev;
      let delta = 0;
      if (payload.was_read === false && payload.is_read === true) delta = -1;
      else if (payload.was_read === true && payload.is_read === false) delta = 1;
      if (delta === 0) return prev;
      const next = [...prev];
      next[index] = { ...conv, unread_count: Math.max(0, conv.unread_count + delta) };
      return next;
    });
  });

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversation(conversationId);
    router.push(`/messages?conversation=${conversationId}`, { scroll: false });
  };

  const handleNewConversation = (conversationId: string) => {
    // Close modal first
    setShowNewMessage(false);
    // Select the new conversation immediately
    setSelectedConversation(conversationId);
    router.push(`/messages?conversation=${conversationId}`, { scroll: false });
    // Then refresh conversations list in the background
    fetchConversations(false);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="messages-container flex h-screen md:h-screen bg-canvas">
      {/* Conversations Sidebar - full width on mobile, hidden when conversation selected */}
      <div className={`messages-sidebar w-full md:w-[340px] bg-surface border-r border-border-light flex flex-col ${
        selectedConversation ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header */}
        <div
          className="flex items-center justify-between gap-2 px-4 py-3 md:p-5 border-b border-border-light"
          style={{ paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.push("/")}
              aria-label="Back"
              className="md:hidden w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-skeleton/60 transition-all flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="font-display text-[1.2rem] md:text-[1.4rem] text-ink truncate">Messages</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/messages/community")}
              className="relative w-9 h-9 md:w-10 md:h-10 rounded-full bg-skeleton/70 text-ink flex items-center justify-center hover:bg-skeleton transition-all"
              title="Community Inbox"
              aria-label="Open community inbox"
            >
              {icons.community}
              {communityUnreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white font-ui text-[10px] font-semibold flex items-center justify-center">
                  {communityUnreadCount > 99 ? "99+" : communityUnreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowNewMessage(true)}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center shadow-lg shadow-purple-primary/30 hover:scale-105 hover:shadow-xl transition-all active:scale-95"
            >
              {icons.edit}
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <ConversationList
          conversations={conversations}
          loading={loading}
          selectedId={selectedConversation}
          currentUserId={user.id}
          onSelect={handleSelectConversation}
        />
      </div>

      {/* Chat Area - full width on mobile when conversation selected */}
      <div className={`messages-chat flex-1 flex flex-col ${
        selectedConversation ? 'flex' : 'hidden md:flex'
      }`}>
        {selectedConversation ? (
          <ChatView
            conversationId={selectedConversation}
            currentUserId={user.id}
            currentUserProfile={currentUserProfile}
            onBack={() => {
              setSelectedConversation(null);
              router.push("/messages", { scroll: false });
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-4">
              <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-6 rounded-full bg-purple-primary/10 flex items-center justify-center text-purple-primary">
                {icons.inbox}
              </div>
              <h2 className="font-display text-[1.3rem] md:text-[1.5rem] text-ink mb-2">
                Your Messages
              </h2>
              <p className="font-body text-muted mb-6 max-w-[280px] mx-auto text-sm md:text-base">
                Select a conversation or start a new one to connect with fellow creators
              </p>
              <button
                onClick={() => setShowNewMessage(true)}
                className="px-5 py-2.5 md:px-6 md:py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.9rem] md:text-[0.95rem] font-medium text-white shadow-lg shadow-purple-primary/30 hover:-translate-y-0.5 hover:shadow-xl transition-all"
              >
                New Message
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Message Modal */}
      <NewMessageModal
        isOpen={showNewMessage}
        onClose={() => setShowNewMessage(false)}
        onConversationCreated={handleNewConversation}
        currentUserId={user.id}
      />
    </div>
  );
}
