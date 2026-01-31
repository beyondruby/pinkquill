"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import ConversationList from "./ConversationList";
import ChatView from "./ChatView";
import NewMessageModal from "./NewMessageModal";

// Type for the participant query result from Supabase
interface ParticipantQueryResult {
  user_id: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

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
}

const icons = {
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

  // Fetch conversations - OPTIMIZED: Batched queries instead of N+1
  const fetchConversations = async (showLoading = true) => {
    if (!user) return;

    try {
      if (showLoading) setLoading(true);

      // BATCH QUERY 1: Get all conversations with participants in one query
      const { data: participations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (!participations || participations.length === 0) {
        setConversations([]);
        if (showLoading) setLoading(false);
        return;
      }

      const conversationIds = participations.map((p) => p.conversation_id);

      // BATCH QUERY 2-5: Run all queries in parallel instead of per-conversation
      const [
        conversationsResult,
        allParticipantsResult,
        blockedByMeResult,
        blockedMeResult,
        allMessagesResult,
        unreadCountsResult,
      ] = await Promise.all([
        // Get all conversations at once
        supabase
          .from("conversations")
          .select("id, updated_at")
          .in("id", conversationIds),
        // Get all other participants at once
        supabase
          .from("conversation_participants")
          .select(`
            conversation_id,
            user_id,
            user:profiles (
              id,
              username,
              display_name,
              avatar_url
            )
          `)
          .in("conversation_id", conversationIds)
          .neq("user_id", user.id),
        // Get all users I've blocked
        supabase
          .from("blocks")
          .select("blocked_id")
          .eq("blocker_id", user.id),
        // Get all users who blocked me
        supabase
          .from("blocks")
          .select("blocker_id")
          .eq("blocked_id", user.id),
        // Get latest message per conversation (we'll filter in JS)
        supabase
          .from("messages")
          .select("conversation_id, content, created_at, sender_id, message_type, voice_duration, media_type")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false }),
        // Get unread counts per conversation
        supabase
          .from("messages")
          .select("conversation_id, sender_id")
          .in("conversation_id", conversationIds)
          .eq("is_read", false)
          .neq("sender_id", user.id),
      ]);

      // Build lookup maps for O(1) access
      const conversationsMap = new Map(
        (conversationsResult.data || []).map((c) => [c.id, c])
      );

      const participantsMap = new Map<string, ParticipantQueryResult["user"]>();
      (allParticipantsResult.data || []).forEach((p: any) => {
        if (p.user && !participantsMap.has(p.conversation_id)) {
          participantsMap.set(p.conversation_id, p.user);
        }
      });

      // Build blocked sets
      const blockedByMe = new Set((blockedByMeResult.data || []).map((b) => b.blocked_id));
      const blockedMe = new Set((blockedMeResult.data || []).map((b) => b.blocker_id));

      // Build last message map (first message per conversation since ordered desc)
      const lastMessageMap = new Map<string, any>();
      const myLastMessageMap = new Map<string, any>(); // For blocked users
      (allMessagesResult.data || []).forEach((m: any) => {
        // Store first (latest) message per conversation
        if (!lastMessageMap.has(m.conversation_id)) {
          lastMessageMap.set(m.conversation_id, m);
        }
        // Also track my last message for blocked scenarios
        if (m.sender_id === user.id && !myLastMessageMap.has(m.conversation_id)) {
          myLastMessageMap.set(m.conversation_id, m);
        }
      });

      // Build unread count map (excluding blocked users)
      const unreadCountMap = new Map<string, number>();
      (unreadCountsResult.data || []).forEach((m: any) => {
        // Only count if sender is not blocked
        if (!blockedByMe.has(m.sender_id) && !blockedMe.has(m.sender_id)) {
          unreadCountMap.set(
            m.conversation_id,
            (unreadCountMap.get(m.conversation_id) || 0) + 1
          );
        }
      });

      // Transform data
      const conversationsData: Conversation[] = conversationIds
        .map((convId) => {
          const conv = conversationsMap.get(convId);
          const otherParticipant = participantsMap.get(convId);

          // Check block status
          const isBlocked = otherParticipant
            ? blockedByMe.has(otherParticipant.id) || blockedMe.has(otherParticipant.id)
            : false;

          // Get appropriate last message
          const lastMessage = isBlocked
            ? myLastMessageMap.get(convId) || null
            : lastMessageMap.get(convId) || null;

          // Get unread count (already filtered for blocks)
          const unreadCount = isBlocked ? 0 : unreadCountMap.get(convId) || 0;

          return {
            id: convId,
            updated_at: conv?.updated_at || "",
            participant: otherParticipant || {
              id: "",
              username: "Unknown",
              display_name: null,
              avatar_url: null,
            },
            last_message: lastMessage
              ? {
                  content: lastMessage.content,
                  created_at: lastMessage.created_at,
                  sender_id: lastMessage.sender_id,
                  message_type: lastMessage.message_type,
                  voice_duration: lastMessage.voice_duration,
                  media_type: lastMessage.media_type,
                }
              : null,
            unread_count: unreadCount,
          };
        })
        .filter((c) => c.participant.id); // Filter out conversations with unknown participants

      // Sort by most recent
      conversationsData.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      setConversations(conversationsData);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations(true);
  }, [user]);

  // Real-time subscription for new messages - update silently without loading state
  // OPTIMIZED: User-specific channel name + debounced refetch to prevent excessive queries
  useEffect(() => {
    if (!user) return;

    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchConversations(false); // Silent update
      }, 500); // Debounce 500ms to batch rapid message updates
    };

    // Use user-specific channel name to prevent conflicts
    const channel = supabase
      .channel(`messages-list-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        debouncedRefetch
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        debouncedRefetch
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user]);

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

  // Redirect if not logged in
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="font-display text-[2rem] text-ink mb-4">Messages</h1>
          <p className="font-body text-muted mb-6">
            Sign in to view your messages
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-white"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-container flex h-screen md:h-screen bg-[#f8f7fc]">
      {/* Conversations Sidebar - full width on mobile, hidden when conversation selected */}
      <div className={`messages-sidebar w-full md:w-[340px] bg-white border-r border-black/[0.06] flex flex-col ${
        selectedConversation ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 md:p-5 border-b border-black/[0.06]"
          style={{ paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}
        >
          <h1 className="font-display text-[1.2rem] md:text-[1.4rem] text-ink">Messages</h1>
          <button
            onClick={() => setShowNewMessage(true)}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center shadow-lg shadow-purple-primary/30 hover:scale-105 hover:shadow-xl transition-all active:scale-95"
          >
            {icons.edit}
          </button>
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
            currentUserProfile={profile ? {
              username: profile.username,
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
            } : undefined}
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