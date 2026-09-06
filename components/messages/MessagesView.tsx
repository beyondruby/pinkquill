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
import Button from "@/components/ui/Button";
import { NavIcon } from "@/components/layout/navigation";

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
    <div className="pq-msgs" data-open={selectedConversation ? "thread" : "list"}>
      <div className="pq-msgs__list">
        <div className="pq-msgs__head">
          <button type="button" onClick={() => router.push("/")} aria-label="Back to Home" className="pq-icon-button md:hidden -ml-1">
            <NavIcon name="back" />
          </button>
          <h1 className="pq-msgs__title">Messages</h1>
          <div className="relative">
            <button type="button" onClick={() => router.push("/messages/community")} className="pq-icon-button pq-icon-button--filled" aria-label={`Community inbox${communityUnreadCount > 0 ? `, ${communityUnreadCount} unread` : ""}`} title="Community inbox">
              <NavIcon name="people" />
            </button>
            {communityUnreadCount > 0 && <span className="pq-msgs__count" aria-hidden="true">{communityUnreadCount > 99 ? "99+" : communityUnreadCount}</span>}
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowNewMessage(true)}>New</Button>
        </div>

        <ConversationList
          conversations={conversations}
          loading={loading}
          selectedId={selectedConversation}
          currentUserId={user.id}
          onSelect={handleSelectConversation}
        />
      </div>

      <div className="pq-msgs__thread">
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
          <div className="pq-chat-empty">
            <span className="pq-thread-row__mark" aria-hidden="true"><NavIcon name="message" /></span>
            <h2>Your messages</h2>
            <p>Pick a conversation, or start one with someone whose work you like.</p>
            <Button variant="primary" onClick={() => setShowNewMessage(true)}>New message</Button>
          </div>
        )}
      </div>

      <NewMessageModal
        isOpen={showNewMessage}
        onClose={() => setShowNewMessage(false)}
        onConversationCreated={handleNewConversation}
        currentUserId={user.id}
      />
    </div>
  );
}
