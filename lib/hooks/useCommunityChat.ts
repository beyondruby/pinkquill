/**
 * Community chat hooks
 * Adds Reddit-style community modmail/broadcast chat without touching DMs.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePollOnFocus } from "./usePollOnFocus";
import { sanitizePostgrestSearchTerm } from "@/lib/utils/postgrest";
import type {
  CommunityChatMembership,
  CommunityChatMessage,
  CommunityChatMessageType,
  CommunityChatSenderRole,
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

interface UseCommunityChatThreadsOptions {
  includeStaffThreads?: boolean;
}

interface UseCommunityChatMessagesReturn {
  messages: CommunityChatMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  sendMessage: (content: string, options?: { messageType?: "message" | "appeal" }) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}

interface UseCommunityChatMessagesOptions {
  includeCommunityChannelMessages?: boolean;
}

interface UseCommunityChatActionsReturn {
  broadcasting: boolean;
  postingToCommunity: boolean;
  updatingJoinState: boolean;
  broadcastToCommunity: (
    communityId: string,
    content: string
  ) => Promise<{ success: boolean; sentCount?: number; error?: string }>;
  postCommunityMessage: (
    communityId: string,
    content: string
  ) => Promise<{ success: boolean; sentCount?: number; error?: string }>;
  setCommunityChatJoinState: (
    communityId: string,
    joined: boolean
  ) => Promise<{ success: boolean; error?: string }>;
}

export interface CommunityChatOverview {
  community_id: string;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
}

interface UseCommunityChatOverviewReturn {
  overviewByCommunity: Map<string, CommunityChatOverview>;
  totalUnreadCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseCommunityChatUnreadCountReturn {
  count: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseCommunityAnnouncementsReturn {
  messages: CommunityChatMessage[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface CommunityAnnouncementRow {
  id: string;
  thread_id: string;
  sender_id: string | null;
  sender_role: CommunityChatSenderRole;
  message_type: CommunityChatMessageType;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  sender_profile?: CommunityChatMessage["sender_profile"] | CommunityChatMessage["sender_profile"][];
}

interface CommunityChatOverviewRow {
  community_id: string;
  unread_count: number | string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
}

export interface CommunityChatMemberSearchResult {
  user_id: string;
  status: "active" | "muted" | "banned";
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

function normalizeSenderProfile(row: {
  sender_profile?: CommunityChatMessage["sender_profile"] | CommunityChatMessage["sender_profile"][];
}): CommunityChatMessage["sender_profile"] {
  if (!row.sender_profile) return null;
  return Array.isArray(row.sender_profile) ? row.sender_profile[0] || null : row.sender_profile;
}

function toAnnouncementDedupKey(message: CommunityChatMessage): string {
  const metadata = message.metadata as Record<string, unknown> | null | undefined;
  const broadcastId =
    metadata && typeof metadata.broadcast_id === "string" ? metadata.broadcast_id : null;

  if (broadcastId) return `broadcast:${broadcastId}`;

  // Fallback key for historical rows without broadcast metadata.
  const secondBucket = message.created_at.slice(0, 19);
  return `legacy:${message.sender_id || "system"}:${message.content}:${secondBucket}`;
}

function dedupeAnnouncements(messages: CommunityChatMessage[]): CommunityChatMessage[] {
  const deduped = new Map<string, CommunityChatMessage>();
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const key = toAnnouncementDedupKey(message);
    const existing = deduped.get(key);
    if (!existing || new Date(message.created_at).getTime() > new Date(existing.created_at).getTime()) {
      deduped.set(key, message);
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

function isCommunityChannelMessage(message: {
  message_type: CommunityChatMessageType;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const metadata = message.metadata || null;
  const broadcast = metadata && metadata.broadcast === true;
  const channel = metadata && metadata.channel === "community";

  if (!broadcast && !channel) return false;
  return message.message_type === "announcement" || message.message_type === "message";
}

export function useCommunityChatOverview(userId?: string): UseCommunityChatOverviewReturn {
  const [overviewByCommunity, setOverviewByCommunity] = useState<Map<string, CommunityChatOverview>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchOverview = useCallback(async () => {
    if (!userId) {
      setOverviewByCommunity(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.rpc(
        "get_community_chat_overview",
        { p_user_id: userId }
      );

      if (!mountedRef.current) return;
      if (fetchError) throw fetchError;

      const rows = (data || []) as CommunityChatOverviewRow[];
      const nextMap = new Map<string, CommunityChatOverview>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        nextMap.set(row.community_id, {
          community_id: row.community_id,
          unread_count: Number(row.unread_count || 0),
          last_message_at: row.last_message_at || null,
          last_message_preview: row.last_message_preview || null,
        });
      }

      setOverviewByCommunity(nextMap);
    } catch (err) {
      console.error("[useCommunityChatOverview] Error:", err);
      if (mountedRef.current) {
        setError("Failed to load community chat overview");
        setOverviewByCommunity(new Map());
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchOverview();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchOverview]);

  // Refresh on focus instead of a realtime subscription. The previous channel
  // subscribed to community_chat_messages INSERT *unfiltered*, waking every
  // connected user on every community message sent anywhere on the platform.
  usePollOnFocus(fetchOverview);

  const totalUnreadCount = useMemo(() => {
    let total = 0;
    overviewByCommunity.forEach((overview) => {
      total += overview.unread_count;
    });
    return total;
  }, [overviewByCommunity]);

  return {
    overviewByCommunity,
    totalUnreadCount,
    loading,
    error,
    refetch: fetchOverview,
  };
}

export function useCommunityChatUnreadCount(userId?: string): UseCommunityChatUnreadCountReturn {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) {
      setCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.rpc(
        "get_community_chat_unread_count",
        { p_user_id: userId }
      );

      if (!mountedRef.current) return;
      if (fetchError) throw fetchError;

      setCount(Number(data || 0));
    } catch (err) {
      console.error("[useCommunityChatUnreadCount] Error:", err);
      if (mountedRef.current) {
        setError("Failed to load unread community messages");
        setCount(0);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchUnreadCount();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchUnreadCount]);

  // Refresh on focus instead of a realtime subscription (see useCommunityChatOverview).
  usePollOnFocus(fetchUnreadCount);

  return {
    count,
    loading,
    error,
    refetch: fetchUnreadCount,
  };
}

export function useCommunityChatMemberSearch(
  communityId: string,
  query: string,
  enabled = true,
  limit = 20
): {
  results: CommunityChatMemberSearchResult[];
  loading: boolean;
  error: string | null;
} {
  const [results, setResults] = useState<CommunityChatMemberSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const trimmedQuery = query.trim();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !communityId) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (trimmedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const debounceTimer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const sanitizedQuery = sanitizePostgrestSearchTerm(trimmedQuery);
        if (!sanitizedQuery) {
          setResults([]);
          return;
        }
        const likePattern = `%${sanitizedQuery}%`;

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .or(`username.ilike.${likePattern},display_name.ilike.${likePattern}`)
          .limit(Math.max(limit * 3, 30));

        if (profilesError) throw profilesError;
        if (!profiles || profiles.length === 0 || cancelled || !mountedRef.current) {
          setResults([]);
          return;
        }

        const profileIds = profiles.map((profile) => profile.id);
        const { data: memberships, error: membersError } = await supabase
          .from("community_members")
          .select(`
            user_id,
            status,
            profile:profiles!community_members_user_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          `)
          .eq("community_id", communityId)
          .eq("role", "member")
          .in("status", ["active", "muted", "banned"])
          .in("user_id", profileIds)
          .limit(limit);

        if (membersError) throw membersError;
        if (cancelled || !mountedRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (memberships || []).map((row: any) => ({
          user_id: row.user_id,
          status: row.status as "active" | "muted" | "banned",
          profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
        })) as CommunityChatMemberSearchResult[];

        mapped.sort((a, b) => {
          const aName = a.profile?.display_name || a.profile?.username || "";
          const bName = b.profile?.display_name || b.profile?.username || "";
          return aName.localeCompare(bName);
        });

        setResults(mapped.slice(0, limit));
      } catch (err) {
        console.error("[useCommunityChatMemberSearch] Error:", err);
        if (!cancelled && mountedRef.current) {
          setError("Failed to search community members");
          setResults([]);
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [communityId, enabled, limit, trimmedQuery]);

  return { results, loading, error };
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
          community_chat_joined,
          mute_reason,
          ban_reason,
          permissions,
          community:communities!community_members_community_id_fkey (
            id,
            slug,
            name,
            avatar_url,
            welcome_message,
            community_chat_enabled,
            community_chat_allow_member_messages,
            community_chat_allow_modmail
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
        community_chat_joined: row.community_chat_joined === true,
        mute_reason: row.mute_reason || null,
        ban_reason: row.ban_reason || null,
        permissions: row.permissions || null,
        community: Array.isArray(row.community) ? row.community[0] : row.community,
      })) as CommunityChatMembership[];

      setMemberships(
        mapped.filter(
          (membership) =>
            !!membership.community &&
            membership.community.community_chat_enabled !== false
        )
      );
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
  isStaff = false,
  options?: UseCommunityChatThreadsOptions
): UseCommunityChatThreadsReturn {
  const [threads, setThreads] = useState<CommunityChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const includeStaffThreads = options?.includeStaffThreads ?? true;

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
        if (!includeStaffThreads) {
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
            closed_at,
            member_profile:profiles!community_chat_threads_member_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          `)
          .eq("community_id", communityId)
          .order("last_message_at", { ascending: false, nullsFirst: false });

        if (!mountedRef.current) return;
        if (fetchError) throw fetchError;

        // Fetch read states to determine unread threads
        const threadIds = (data || []).map((row: { id: string }) => row.id);
        let readMap = new Map<string, string>();
        if (threadIds.length > 0) {
          const { data: readData } = await supabase
            .from("community_chat_thread_reads")
            .select("thread_id, last_read_at")
            .eq("user_id", userId)
            .in("thread_id", threadIds);

          if (readData) {
            readMap = new Map(readData.map((r: { thread_id: string; last_read_at: string }) => [r.thread_id, r.last_read_at]));
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (data || []).map((row: any) => {
          const lastReadAt = readMap.get(row.id);
          const hasUnread = row.last_message_at
            ? !lastReadAt || new Date(row.last_message_at) > new Date(lastReadAt)
            : false;

          return {
            ...row,
            member_profile: Array.isArray(row.member_profile) ? row.member_profile[0] : row.member_profile,
            has_unread: hasUnread,
          };
        }) as CommunityChatThread[];

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
  }, [communityId, userId, isStaff, includeStaffThreads]);

  useEffect(() => {
    mountedRef.current = true;
    fetchThreads();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchThreads]);

  // Real-time: refresh thread list when new messages arrive (for staff)
  useEffect(() => {
    if (!communityId || !userId || !isStaff || !includeStaffThreads) return;

    const channel = supabase
      .channel(`community-threads-${communityId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "community_chat_threads",
          filter: `community_id=eq.${communityId}`,
        },
        () => {
          if (mountedRef.current) fetchThreads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId, userId, isStaff, includeStaffThreads, fetchThreads]);

  return { threads, loading, error, refetch: fetchThreads };
}

export function useCommunityChatMessages(
  threadId: string,
  userId?: string,
  options?: UseCommunityChatMessagesOptions
): UseCommunityChatMessagesReturn {
  const [messages, setMessages] = useState<CommunityChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const includeCommunityChannelMessages = options?.includeCommunityChannelMessages ?? false;

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
      let mapped = (data || []).map((row: any) => ({
        ...row,
        sender_profile: Array.isArray(row.sender_profile) ? row.sender_profile[0] : row.sender_profile,
      })) as CommunityChatMessage[];

      if (!includeCommunityChannelMessages) {
        mapped = mapped.filter((message) => !isCommunityChannelMessage(message));
      }

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
  }, [threadId, markRead, includeCommunityChannelMessages]);

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

          if (!includeCommunityChannelMessages && isCommunityChannelMessage(row)) {
            return;
          }

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
  }, [threadId, userId, markRead, includeCommunityChannelMessages]);

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

export function useCommunityAnnouncements(
  communityId: string,
  userId?: string
): UseCommunityAnnouncementsReturn {
  const [messages, setMessages] = useState<CommunityChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchAnnouncements = useCallback(async () => {
    if (!communityId || !userId) {
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
          ),
          thread:community_chat_threads!inner (
            community_id
          )
        `)
        .contains("metadata", { broadcast: true })
        .eq("thread.community_id", communityId)
        .order("created_at", { ascending: true });

      if (!mountedRef.current) return;
      if (fetchError) throw fetchError;

      const rows = (data || []) as CommunityAnnouncementRow[];
      const mapped = rows.map((row) => ({
        id: row.id,
        thread_id: row.thread_id,
        sender_id: row.sender_id,
        sender_role: row.sender_role,
        message_type: row.message_type,
        content: row.content,
        metadata: row.metadata,
        created_at: row.created_at,
        sender_profile: normalizeSenderProfile(row),
      }))
      .filter((message) => isCommunityChannelMessage(message));

      setMessages(dedupeAnnouncements(mapped));
    } catch (err) {
      console.error("[useCommunityAnnouncements] Error:", err);
      if (mountedRef.current) {
        setError("Failed to load community announcements");
        setMessages([]);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [communityId, userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchAnnouncements();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchAnnouncements]);

  // Announcements used to come from an UNFILTERED `community_chat_messages`
  // INSERT stream (every message on the platform woke every open inbox and
  // ran a query per client). Members already receive broadcast rows through
  // their own per-thread channel; this list refreshes on focus.
  usePollOnFocus(fetchAnnouncements);

  return {
    messages,
    loading,
    error,
    refetch: fetchAnnouncements,
  };
}

export function useCommunityChatActions(): UseCommunityChatActionsReturn {
  const [broadcasting, setBroadcasting] = useState(false);
  const [postingToCommunity, setPostingToCommunity] = useState(false);
  const [updatingJoinState, setUpdatingJoinState] = useState(false);

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

  const postCommunityMessage = useCallback(
    async (
      communityId: string,
      content: string
    ): Promise<{ success: boolean; sentCount?: number; error?: string }> => {
      const trimmed = content.trim();
      if (!communityId || !trimmed) {
        return { success: false, error: "Message cannot be empty" };
      }

      setPostingToCommunity(true);
      try {
        const { data, error } = await supabase.rpc("community_chat_broadcast", {
          p_community_id: communityId,
          p_content: trimmed,
          p_message_type: "message",
        });

        if (error) throw error;
        return { success: true, sentCount: Number(data || 0) };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send community message";
        console.error("[useCommunityChatActions] postCommunityMessage error:", err);
        return { success: false, error: message };
      } finally {
        setPostingToCommunity(false);
      }
    },
    []
  );

  const setCommunityChatJoinState = useCallback(
    async (
      communityId: string,
      joined: boolean
    ): Promise<{ success: boolean; error?: string }> => {
      if (!communityId) {
        return { success: false, error: "Missing community context" };
      }

      setUpdatingJoinState(true);
      try {
        const { error } = await supabase.rpc("set_community_chat_join_state", {
          p_community_id: communityId,
          p_joined: joined,
        });

        if (error) throw error;
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update chat participation";
        console.error("[useCommunityChatActions] setCommunityChatJoinState error:", err);
        return { success: false, error: message };
      } finally {
        setUpdatingJoinState(false);
      }
    },
    []
  );

  return {
    broadcasting,
    postingToCommunity,
    updatingJoinState,
    broadcastToCommunity,
    postCommunityMessage,
    setCommunityChatJoinState,
  };
}
