/**
 * Community chat hooks
 * Adds Reddit-style community modmail/broadcast chat without touching DMs.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  CommunityChatMembership,
  CommunityChatMessage,
  CommunityChatThread,
} from "@/lib/types";

interface UseCommunityChatMembershipsReturn {
  memberships: CommunityChatMembership[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseCommunityChatThreadsReturn {
  threads: CommunityChatThread[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseCommunityChatMessagesReturn {
  messages: CommunityChatMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  sendMessage: (content: string, options?: { messageType?: "message" | "appeal" }) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}

interface UseCommunityChatActionsReturn {
  broadcasting: boolean;
  broadcastToCommunity: (
    communityId: string,
    content: string
  ) => Promise<{ success: boolean; sentCount?: number; error?: string }>;
}

export function useCommunityChatMemberships(userId?: string): UseCommunityChatMembershipsReturn {
  const [memberships, setMemberships] = useState<CommunityChatMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchMemberships = useCallback(async () => {
    if (!userId) {
      setMemberships([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("community_members")
        .select(`
          community_id,
          role,
          status,
          mute_reason,
          ban_reason,
          community:communities!community_members_community_id_fkey (
            id,
            slug,
            name,
            avatar_url,
            welcome_message
          )
        `)
        .eq("user_id", userId)
        .in("status", ["active", "muted", "banned"])
        .order("joined_at", { ascending: false });

      if (!mountedRef.current) return;
      if (fetchError) throw fetchError;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (data || []).map((row: any) => ({
        community_id: row.community_id,
        role: row.role,
        status: row.status,
        mute_reason: row.mute_reason || null,
        ban_reason: row.ban_reason || null,
        community: Array.isArray(row.community) ? row.community[0] : row.community,
      })) as CommunityChatMembership[];

      setMemberships(mapped.filter((m) => !!m.community));
    } catch (err) {
      console.error("[useCommunityChatMemberships] Error:", err);
      if (mountedRef.current) {
        setError("Failed to load community inbox");
        setMemberships([]);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchMemberships();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchMemberships]);

  return { memberships, loading, error, refetch: fetchMemberships };
}

export function useCommunityChatThreads(
  communityId: string,
  userId?: string,
  isStaff = false
): UseCommunityChatThreadsReturn {
  const [threads, setThreads] = useState<CommunityChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchThreads = useCallback(async () => {
    if (!communityId || !userId) {
      setThreads([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isStaff) {
        const { data, error: fetchError } = await supabase
          .from("community_chat_threads")
          .select(`
            id,
            community_id,
            member_id,
            created_at,
            updated_at,
            last_message_at,
            closed_at,
            member_profile:profiles!community_chat_threads_member_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          `)
          .eq("community_id", communityId)
          .order("updated_at", { ascending: false });

        if (!mountedRef.current) return;
        if (fetchError) throw fetchError;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (data || []).map((row: any) => ({
          ...row,
          member_profile: Array.isArray(row.member_profile) ? row.member_profile[0] : row.member_profile,
        })) as CommunityChatThread[];

        setThreads(mapped);
        return;
      }

      // Member mode: ensure own thread exists, then load it.
      const { data: threadIdData, error: ensureError } = await supabase.rpc(
        "ensure_community_chat_thread",
        {
          p_community_id: communityId,
          p_member_id: userId,
        }
      );

      if (ensureError) throw ensureError;
      if (!threadIdData) {
        setThreads([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("community_chat_threads")
        .select(`
          id,
          community_id,
          member_id,
          created_at,
          updated_at,
          last_message_at,
          closed_at
        `)
        .eq("id", threadIdData)
        .single();

      if (!mountedRef.current) return;
      if (fetchError) throw fetchError;

      setThreads(data ? [data as CommunityChatThread] : []);
    } catch (err) {
      console.error("[useCommunityChatThreads] Error:", err);
      if (mountedRef.current) {
        setError("Failed to load chat threads");
        setThreads([]);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [communityId, userId, isStaff]);

  useEffect(() => {
    mountedRef.current = true;
    fetchThreads();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchThreads]);

  return { threads, loading, error, refetch: fetchThreads };
}

export function useCommunityChatMessages(
  threadId: string,
  userId?: string
): UseCommunityChatMessagesReturn {
  const [messages, setMessages] = useState<CommunityChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const markRead = useCallback(async () => {
    if (!threadId || !userId) return;
    await supabase.from("community_chat_thread_reads").upsert(
      {
        thread_id: threadId,
        user_id: userId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "thread_id,user_id" }
    );
  }, [threadId, userId]);

  const fetchMessages = useCallback(async () => {
    if (!threadId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("community_chat_messages")
        .select(`
          id,
          thread_id,
          sender_id,
          sender_role,
          message_type,
          content,
          metadata,
          created_at,
          sender_profile:profiles!community_chat_messages_sender_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (!mountedRef.current) return;
      if (fetchError) throw fetchError;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (data || []).map((row: any) => ({
        ...row,
        sender_profile: Array.isArray(row.sender_profile) ? row.sender_profile[0] : row.sender_profile,
      })) as CommunityChatMessage[];

      setMessages(mapped);
      await markRead();
    } catch (err) {
      console.error("[useCommunityChatMessages] Error:", err);
      if (mountedRef.current) {
        setError("Failed to load messages");
        setMessages([]);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [threadId, markRead]);

  useEffect(() => {
    mountedRef.current = true;
    fetchMessages();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchMessages]);

  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`community-chat-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          const row = payload.new as CommunityChatMessage;

          // Fetch sender profile only when sender exists.
          let senderProfile: CommunityChatMessage["sender_profile"] = null;
          if (row.sender_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .eq("id", row.sender_id)
              .single();
            senderProfile = profile || null;
          }

          if (!mountedRef.current) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, { ...row, sender_profile: senderProfile }];
          });

          if (row.sender_id && row.sender_id !== userId) {
            await markRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, userId, markRead]);

  const sendMessage = useCallback(
    async (
      content: string,
      options?: { messageType?: "message" | "appeal" }
    ): Promise<{ success: boolean; error?: string }> => {
      if (!threadId || !userId) {
        return { success: false, error: "Missing chat context" };
      }

      const trimmed = content.trim();
      if (!trimmed) {
        return { success: false, error: "Message cannot be empty" };
      }

      setSending(true);
      setError(null);

      try {
        const { error: insertError } = await supabase.from("community_chat_messages").insert({
          thread_id: threadId,
          sender_id: userId,
          message_type: options?.messageType || "message",
          content: trimmed,
        });

        if (insertError) throw insertError;
        await markRead();
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send message";
        console.error("[useCommunityChatMessages] sendMessage error:", err);
        if (mountedRef.current) setError(message);
        return { success: false, error: message };
      } finally {
        if (mountedRef.current) setSending(false);
      }
    },
    [threadId, userId, markRead]
  );

  return {
    messages,
    loading,
    sending,
    error,
    sendMessage,
    refetch: fetchMessages,
  };
}

export function useCommunityChatActions(): UseCommunityChatActionsReturn {
  const [broadcasting, setBroadcasting] = useState(false);

  const broadcastToCommunity = useCallback(
    async (
      communityId: string,
      content: string
    ): Promise<{ success: boolean; sentCount?: number; error?: string }> => {
      const trimmed = content.trim();
      if (!communityId || !trimmed) {
        return { success: false, error: "Message cannot be empty" };
      }

      setBroadcasting(true);
      try {
        const { data, error } = await supabase.rpc("community_chat_broadcast", {
          p_community_id: communityId,
          p_content: trimmed,
          p_message_type: "announcement",
        });

        if (error) throw error;
        return { success: true, sentCount: Number(data || 0) };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to broadcast message";
        console.error("[useCommunityChatActions] broadcast error:", err);
        return { success: false, error: message };
      } finally {
        setBroadcasting(false);
      }
    },
    []
  );

  return {
    broadcasting,
    broadcastToCommunity,
  };
}
