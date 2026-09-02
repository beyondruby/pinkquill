/**
 * Messaging hooks for message reactions and typing indicators.
 *
 * Realtime design (docs/audit/02-plan.md Phase 2): one *broadcast* channel per
 * open conversation (`dm-live-<conversationId>`) carries both typing events
 * and reaction events between the participants. Nothing here opens a
 * `postgres_changes` subscription — the previous per-conversation
 * `message_reactions` stream was re-created on every message and was the
 * primary source of realtime subscription churn (findings H7).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { MessageReaction, MessageReactionEmoji, TypingUser } from "@/lib/types";
import { MESSAGE_REACTION_EMOJIS } from "@/lib/types";
import { isAbortError } from "../utils/retry";

type ChatProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type BroadcastSend = (event: "typing" | "reaction", payload: Record<string, unknown>) => void;

type ReactionBroadcast = {
  op: "upsert" | "delete";
  reaction: MessageReaction;
};

// ============================================================================
// MESSAGE REACTIONS HOOK
// ============================================================================

interface UseMessageReactionsOptions {
  conversationId: string;
  currentUserId: string;
  currentUserProfile?: ChatProfile;
  /** Real (server) message ids only — never optimistic `temp-` ids. */
  messageIds?: string[];
  send: BroadcastSend;
}

interface UseMessageReactionsReturn {
  reactionsByMessage: Map<string, MessageReaction[]>;
  toggleReaction: (messageId: string, emoji: MessageReactionEmoji) => Promise<void>;
  removeReaction: (messageId: string) => Promise<void>;
  getUserReaction: (messageId: string) => MessageReaction | undefined;
  loading: boolean;
  /** Apply a reaction event broadcast by the other participant. */
  applyRemote: (payload: ReactionBroadcast) => void;
}

function upsertInto(map: Map<string, MessageReaction[]>, reaction: MessageReaction) {
  const existing = map.get(reaction.message_id) || [];
  const filtered = existing.filter((r) => r.user_id !== reaction.user_id);
  map.set(reaction.message_id, [...filtered, reaction]);
}

export function useMessageReactions({
  conversationId,
  currentUserId,
  currentUserProfile,
  messageIds = [],
  send,
}: UseMessageReactionsOptions): UseMessageReactionsReturn {
  const [reactionsByMessage, setReactionsByMessage] = useState<Map<string, MessageReaction[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const fetchedIdsRef = useRef<Set<string>>(new Set());
  const messageIdsKey = messageIds.join(",");

  // Reset per conversation.
  useEffect(() => {
    fetchedIdsRef.current = new Set();
    setReactionsByMessage(new Map());
    setLoading(true);
  }, [conversationId]);

  // Fetch reactions only for message ids we have not fetched yet. A new
  // message or an older page adds ids; read receipts and edits do not, so
  // they no longer trigger a query.
  useEffect(() => {
    mountedRef.current = true;
    if (!conversationId) {
      setLoading(false);
      return;
    }
    const ids = messageIdsKey ? messageIdsKey.split(",") : [];
    const newIds = ids.filter((id) => id && !id.startsWith("temp-") && !fetchedIdsRef.current.has(id));
    if (newIds.length === 0) {
      setLoading(false);
      return;
    }
    newIds.forEach((id) => fetchedIdsRef.current.add(id));

    const controller = new AbortController();
    (async () => {
      try {
        const { data, error } = await supabase
          .from("message_reactions")
          .select(`
            id,
            message_id,
            user_id,
            emoji,
            created_at,
            user:profiles!message_reactions_user_id_fkey (
              username,
              display_name,
              avatar_url
            )
          `)
          .in("message_id", newIds)
          .abortSignal(controller.signal);

        if (!mountedRef.current || controller.signal.aborted) return;
        if (error) {
          console.error("Failed to fetch message reactions:", error);
          // Allow a retry for these ids on the next change.
          newIds.forEach((id) => fetchedIdsRef.current.delete(id));
          return;
        }

        setReactionsByMessage((prev) => {
          const next = new Map(prev);
          for (const raw of data || []) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = raw as any;
            const u = Array.isArray(r.user) ? r.user[0] : r.user;
            upsertInto(next, {
              id: r.id,
              message_id: r.message_id,
              user_id: r.user_id,
              emoji: r.emoji as MessageReactionEmoji,
              created_at: r.created_at,
              user: u,
            });
          }
          return next;
        });
      } catch (err: unknown) {
        if (isAbortError(err)) return;
        console.error("Error fetching reactions:", err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [conversationId, messageIdsKey]);

  const applyRemote = useCallback((payload: ReactionBroadcast) => {
    if (!payload?.reaction?.message_id) return;
    setReactionsByMessage((prev) => {
      const next = new Map(prev);
      if (payload.op === "delete") {
        const existing = next.get(payload.reaction.message_id) || [];
        next.set(
          payload.reaction.message_id,
          existing.filter((r) => r.user_id !== payload.reaction.user_id)
        );
      } else {
        upsertInto(next, payload.reaction);
      }
      return next;
    });
  }, []);

  const removeReaction = useCallback(async (messageId: string) => {
    if (!currentUserId) return;

    let removed: MessageReaction | undefined;
    setReactionsByMessage((prev) => {
      const next = new Map(prev);
      const existing = next.get(messageId) || [];
      removed = existing.find((r) => r.user_id === currentUserId);
      next.set(messageId, existing.filter((r) => r.user_id !== currentUserId));
      return next;
    });

    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", currentUserId);

    if (error) {
      console.error("Failed to remove reaction:", error);
      if (removed) {
        const restore = removed;
        setReactionsByMessage((prev) => {
          const next = new Map(prev);
          upsertInto(next, restore);
          return next;
        });
      }
      return;
    }

    send("reaction", {
      op: "delete",
      reaction: {
        id: removed?.id ?? "",
        message_id: messageId,
        user_id: currentUserId,
        emoji: removed?.emoji ?? MESSAGE_REACTION_EMOJIS[0],
        created_at: new Date().toISOString(),
      },
    });
  }, [currentUserId, send]);

  const toggleReaction = useCallback(async (messageId: string, emoji: MessageReactionEmoji) => {
    if (!currentUserId || messageId.startsWith("temp-")) return;

    const existingReactions = reactionsByMessage.get(messageId) || [];
    const userReaction = existingReactions.find((r) => r.user_id === currentUserId);

    if (userReaction && userReaction.emoji === emoji) {
      await removeReaction(messageId);
      return;
    }

    const optimistic: MessageReaction = {
      id: userReaction?.id ?? `temp-${crypto.randomUUID()}`,
      message_id: messageId,
      user_id: currentUserId,
      emoji,
      created_at: new Date().toISOString(),
      user: currentUserProfile,
    };

    setReactionsByMessage((prev) => {
      const next = new Map(prev);
      upsertInto(next, optimistic);
      return next;
    });

    // One upsert instead of insert-or-update: (message_id, user_id) is unique.
    // RLS on message_reactions enforces that the user is a participant and
    // not blocked; the old client-side block pre-check (2 extra reads per
    // click) is redundant with it.
    const { data, error } = await supabase
      .from("message_reactions")
      .upsert(
        { message_id: messageId, user_id: currentUserId, emoji },
        { onConflict: "message_id,user_id" }
      )
      .select("id, created_at")
      .single();

    if (error) {
      console.error("Failed to save reaction:", error);
      setReactionsByMessage((prev) => {
        const next = new Map(prev);
        const existing = (next.get(messageId) || []).filter((r) => r.user_id !== currentUserId);
        if (userReaction) existing.push(userReaction);
        next.set(messageId, existing);
        return next;
      });
      return;
    }

    const saved: MessageReaction = { ...optimistic, id: data?.id ?? optimistic.id, created_at: data?.created_at ?? optimistic.created_at };
    setReactionsByMessage((prev) => {
      const next = new Map(prev);
      upsertInto(next, saved);
      return next;
    });
    send("reaction", { op: "upsert", reaction: saved });
  }, [currentUserId, currentUserProfile, reactionsByMessage, removeReaction, send]);

  const getUserReaction = useCallback((messageId: string): MessageReaction | undefined => {
    const reactions = reactionsByMessage.get(messageId) || [];
    return reactions.find((r) => r.user_id === currentUserId);
  }, [reactionsByMessage, currentUserId]);

  return {
    reactionsByMessage,
    toggleReaction,
    removeReaction,
    getUserReaction,
    loading,
    applyRemote,
  };
}

// ============================================================================
// TYPING INDICATOR HOOK
// ============================================================================

interface UseTypingIndicatorOptions {
  currentUserId: string;
  currentUserProfile?: ChatProfile;
  send: BroadcastSend;
}

interface UseTypingIndicatorReturn {
  typingUsers: TypingUser[];
  setTyping: (isTyping: boolean) => void;
  typingText: string | null;
  applyRemote: (payload: TypingBroadcast) => void;
}

type TypingBroadcast = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_typing: boolean;
};

const TYPING_TIMEOUT_MS = 3000;
const TYPING_DEBOUNCE_MS = 1000;

export function useTypingIndicator({
  currentUserId,
  currentUserProfile,
  send,
}: UseTypingIndicatorOptions): UseTypingIndicatorReturn {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const lastTypingBroadcastRef = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const profileRef = useRef(currentUserProfile);
  useEffect(() => {
    profileRef.current = currentUserProfile;
  }, [currentUserProfile]);

  // Expire stale indicators. Only tick while someone is typing.
  useEffect(() => {
    if (typingUsers.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => prev.filter((u) => now - u.started_at < TYPING_TIMEOUT_MS));
    }, 1000);
    return () => clearInterval(interval);
  }, [typingUsers.length]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const applyRemote = useCallback((data: TypingBroadcast) => {
    if (!data || data.user_id === currentUserId) return;
    if (data.is_typing) {
      setTypingUsers((prev) => {
        const typingUser: TypingUser = {
          user_id: data.user_id,
          username: data.username,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
          started_at: Date.now(),
        };
        const idx = prev.findIndex((u) => u.user_id === data.user_id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = typingUser;
          return updated;
        }
        return [...prev, typingUser];
      });
    } else {
      setTypingUsers((prev) => prev.filter((u) => u.user_id !== data.user_id));
    }
  }, [currentUserId]);

  const broadcastTyping = useCallback((typing: boolean) => {
    const profile = profileRef.current;
    send("typing", {
      user_id: currentUserId,
      username: profile?.username || "",
      display_name: profile?.display_name || null,
      avatar_url: profile?.avatar_url || null,
      is_typing: typing,
    });
  }, [currentUserId, send]);

  const setTyping = useCallback((isTyping: boolean) => {
    if (!currentUserId) return;
    const now = Date.now();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (isTyping) {
      if (now - lastTypingBroadcastRef.current >= TYPING_DEBOUNCE_MS) {
        lastTypingBroadcastRef.current = now;
        broadcastTyping(true);
      }
      typingTimeoutRef.current = setTimeout(() => broadcastTyping(false), TYPING_TIMEOUT_MS);
    } else if (lastTypingBroadcastRef.current !== 0) {
      lastTypingBroadcastRef.current = 0;
      broadcastTyping(false);
    }
  }, [currentUserId, broadcastTyping]);

  const typingText = (() => {
    if (typingUsers.length === 0) return null;
    const names = typingUsers.map((u) => u.display_name || u.username);
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]} and ${names.length - 1} others are typing...`;
  })();

  return { typingUsers, setTyping, typingText, applyRemote };
}

// ============================================================================
// COMBINED HOOK FOR CHAT FEATURES — owns the single live channel
// ============================================================================

interface UseChatFeaturesOptions {
  conversationId: string;
  currentUserId: string;
  messageIds?: string[];
  currentUserProfile?: ChatProfile;
}

export function useChatFeatures(options: UseChatFeaturesOptions) {
  const { conversationId, currentUserId } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reactionsApplyRef = useRef<(p: ReactionBroadcast) => void>(() => undefined);
  const typingApplyRef = useRef<(p: TypingBroadcast) => void>(() => undefined);

  const send = useCallback<BroadcastSend>((event, payload) => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event, payload }).catch(() => undefined);
  }, []);

  const reactions = useMessageReactions({
    conversationId,
    currentUserId,
    currentUserProfile: options.currentUserProfile,
    messageIds: options.messageIds,
    send,
  });
  const typing = useTypingIndicator({
    currentUserId,
    currentUserProfile: options.currentUserProfile,
    send,
  });

  useEffect(() => {
    reactionsApplyRef.current = reactions.applyRemote;
    typingApplyRef.current = typing.applyRemote;
  }, [reactions.applyRemote, typing.applyRemote]);

  // One channel per open conversation, keyed on stable ids only.
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const channel = supabase
      .channel(`dm-live-${conversationId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        typingApplyRef.current(payload as TypingBroadcast);
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        reactionsApplyRef.current(payload as ReactionBroadcast);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  return { reactions, typing };
}

export { MESSAGE_REACTION_EMOJIS };
