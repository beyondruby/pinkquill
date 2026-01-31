/**
 * Messaging hooks for message reactions and typing indicators
 * Implements Instagram-style message reactions and real-time typing status
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { MessageReaction, MessageReactionEmoji, TypingUser, Message } from "@/lib/types";
import { MESSAGE_REACTION_EMOJIS } from "@/lib/types";

// ============================================================================
// MESSAGE REACTIONS HOOK
// ============================================================================

interface UseMessageReactionsOptions {
  conversationId: string;
  currentUserId: string;
}

interface UseMessageReactionsReturn {
  // Map of message_id -> reactions array
  reactionsByMessage: Map<string, MessageReaction[]>;
  // Add or update a reaction (if same emoji, removes it - toggle behavior)
  toggleReaction: (messageId: string, emoji: MessageReactionEmoji) => Promise<void>;
  // Remove user's reaction from a message
  removeReaction: (messageId: string) => Promise<void>;
  // Get user's reaction for a specific message
  getUserReaction: (messageId: string) => MessageReaction | undefined;
  // Loading state
  loading: boolean;
}

export function useMessageReactions({
  conversationId,
  currentUserId,
}: UseMessageReactionsOptions): UseMessageReactionsReturn {
  const [reactionsByMessage, setReactionsByMessage] = useState<Map<string, MessageReaction[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Fetch all reactions for messages in this conversation
  const fetchReactions = useCallback(async () => {
    if (!conversationId) return;

    try {
      // First get all message IDs in the conversation
      const { data: messages } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId);

      if (!messages || messages.length === 0) {
        setLoading(false);
        return;
      }

      const messageIds = messages.map(m => m.id);

      // Then get all reactions for these messages
      const { data: reactions, error } = await supabase
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
        .in("message_id", messageIds);

      if (error) {
        console.error("Failed to fetch message reactions:", error);
        setLoading(false);
        return;
      }

      // Group reactions by message_id
      const reactionsMap = new Map<string, MessageReaction[]>();
      (reactions || []).forEach((reaction: any) => {
        const messageId = reaction.message_id;
        if (!reactionsMap.has(messageId)) {
          reactionsMap.set(messageId, []);
        }
        reactionsMap.get(messageId)!.push({
          id: reaction.id,
          message_id: reaction.message_id,
          user_id: reaction.user_id,
          emoji: reaction.emoji,
          created_at: reaction.created_at,
          user: reaction.user,
        });
      });

      setReactionsByMessage(reactionsMap);
    } catch (err) {
      console.error("Error fetching reactions:", err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Initial fetch
  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  // Real-time subscription for reactions
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`message-reactions-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newReaction = payload.new as any;

            // Fetch user info for the new reaction
            const { data: userData } = await supabase
              .from("profiles")
              .select("username, display_name, avatar_url")
              .eq("id", newReaction.user_id)
              .single();

            const reaction: MessageReaction = {
              id: newReaction.id,
              message_id: newReaction.message_id,
              user_id: newReaction.user_id,
              emoji: newReaction.emoji,
              created_at: newReaction.created_at,
              user: userData || undefined,
            };

            setReactionsByMessage(prev => {
              const newMap = new Map(prev);
              const messageReactions = newMap.get(reaction.message_id) || [];
              // Remove any existing reaction from same user (in case of update)
              const filtered = messageReactions.filter(r => r.user_id !== reaction.user_id);
              newMap.set(reaction.message_id, [...filtered, reaction]);
              return newMap;
            });
          } else if (payload.eventType === "DELETE") {
            const oldReaction = payload.old as any;
            setReactionsByMessage(prev => {
              const newMap = new Map(prev);
              const messageReactions = newMap.get(oldReaction.message_id) || [];
              newMap.set(
                oldReaction.message_id,
                messageReactions.filter(r => r.id !== oldReaction.id)
              );
              return newMap;
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedReaction = payload.new as any;
            setReactionsByMessage(prev => {
              const newMap = new Map(prev);
              const messageReactions = newMap.get(updatedReaction.message_id) || [];
              const index = messageReactions.findIndex(r => r.id === updatedReaction.id);
              if (index !== -1) {
                messageReactions[index] = {
                  ...messageReactions[index],
                  emoji: updatedReaction.emoji,
                };
                newMap.set(updatedReaction.message_id, [...messageReactions]);
              }
              return newMap;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Toggle reaction (add if not exists or different emoji, remove if same emoji)
  const toggleReaction = useCallback(async (messageId: string, emoji: MessageReactionEmoji) => {
    if (!currentUserId) return;

    // Check if user already has a reaction on this message
    const existingReactions = reactionsByMessage.get(messageId) || [];
    const userReaction = existingReactions.find(r => r.user_id === currentUserId);

    if (userReaction) {
      if (userReaction.emoji === emoji) {
        // Same emoji - remove the reaction
        await removeReaction(messageId);
        return;
      }
      // Different emoji - update the reaction
      // Optimistic update
      setReactionsByMessage(prev => {
        const newMap = new Map(prev);
        const reactions = (newMap.get(messageId) || []).map(r =>
          r.user_id === currentUserId ? { ...r, emoji } : r
        );
        newMap.set(messageId, reactions);
        return newMap;
      });

      // Database update
      const { error } = await supabase
        .from("message_reactions")
        .update({ emoji })
        .eq("message_id", messageId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Failed to update reaction:", error);
        // Revert optimistic update
        fetchReactions();
      }
    } else {
      // No existing reaction - add new one
      // Optimistic update
      const optimisticReaction: MessageReaction = {
        id: `temp-${Date.now()}`,
        message_id: messageId,
        user_id: currentUserId,
        emoji,
        created_at: new Date().toISOString(),
      };

      setReactionsByMessage(prev => {
        const newMap = new Map(prev);
        const reactions = newMap.get(messageId) || [];
        newMap.set(messageId, [...reactions, optimisticReaction]);
        return newMap;
      });

      // Database insert
      const { data, error } = await supabase
        .from("message_reactions")
        .insert({
          message_id: messageId,
          user_id: currentUserId,
          emoji,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to add reaction:", error);
        // Revert optimistic update
        setReactionsByMessage(prev => {
          const newMap = new Map(prev);
          const reactions = (newMap.get(messageId) || []).filter(r => r.id !== optimisticReaction.id);
          newMap.set(messageId, reactions);
          return newMap;
        });
      } else if (data) {
        // Replace optimistic with real data
        setReactionsByMessage(prev => {
          const newMap = new Map(prev);
          const reactions = (newMap.get(messageId) || []).map(r =>
            r.id === optimisticReaction.id ? { ...r, id: data.id } : r
          );
          newMap.set(messageId, reactions);
          return newMap;
        });
      }
    }
  }, [currentUserId, reactionsByMessage, fetchReactions]);

  // Remove user's reaction from a message
  const removeReaction = useCallback(async (messageId: string) => {
    if (!currentUserId) return;

    // Optimistic update
    setReactionsByMessage(prev => {
      const newMap = new Map(prev);
      const reactions = (newMap.get(messageId) || []).filter(r => r.user_id !== currentUserId);
      newMap.set(messageId, reactions);
      return newMap;
    });

    // Database delete
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", currentUserId);

    if (error) {
      console.error("Failed to remove reaction:", error);
      // Revert on error
      fetchReactions();
    }
  }, [currentUserId, fetchReactions]);

  // Get user's reaction for a specific message
  const getUserReaction = useCallback((messageId: string): MessageReaction | undefined => {
    const reactions = reactionsByMessage.get(messageId) || [];
    return reactions.find(r => r.user_id === currentUserId);
  }, [reactionsByMessage, currentUserId]);

  return {
    reactionsByMessage,
    toggleReaction,
    removeReaction,
    getUserReaction,
    loading,
  };
}

// ============================================================================
// TYPING INDICATOR HOOK
// ============================================================================

interface UseTypingIndicatorOptions {
  conversationId: string;
  currentUserId: string;
  currentUserProfile?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface UseTypingIndicatorReturn {
  // Users currently typing (excluding current user)
  typingUsers: TypingUser[];
  // Call when user starts/continues typing
  setTyping: (isTyping: boolean) => void;
  // Formatted string like "John is typing..." or "John and Jane are typing..."
  typingText: string | null;
}

// Typing state expires after this many milliseconds of no activity
const TYPING_TIMEOUT_MS = 3000;
// Debounce interval for sending typing updates
const TYPING_DEBOUNCE_MS = 1000;

export function useTypingIndicator({
  conversationId,
  currentUserId,
  currentUserProfile,
}: UseTypingIndicatorOptions): UseTypingIndicatorReturn {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const lastTypingBroadcastRef = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Clean up expired typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev =>
        prev.filter(user => now - user.started_at < TYPING_TIMEOUT_MS)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Set up real-time channel for typing indicators
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const channelName = `typing-${conversationId}`;

    // Create a broadcast channel for typing indicators
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: {
          self: false, // Don't receive own broadcasts
        },
      },
    });

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const data = payload.payload as {
          user_id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          is_typing: boolean;
        };

        // Ignore own typing events
        if (data.user_id === currentUserId) return;

        if (data.is_typing) {
          setTypingUsers(prev => {
            // Update existing user or add new one
            const existingIndex = prev.findIndex(u => u.user_id === data.user_id);
            const typingUser: TypingUser = {
              user_id: data.user_id,
              username: data.username,
              display_name: data.display_name,
              avatar_url: data.avatar_url,
              started_at: Date.now(),
            };

            if (existingIndex !== -1) {
              const updated = [...prev];
              updated[existingIndex] = typingUser;
              return updated;
            }
            return [...prev, typingUser];
          });
        } else {
          // User stopped typing
          setTypingUsers(prev => prev.filter(u => u.user_id !== data.user_id));
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      // Broadcast stop typing before unsubscribing
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "typing",
          payload: {
            user_id: currentUserId,
            username: currentUserProfile?.username || "",
            display_name: currentUserProfile?.display_name || null,
            avatar_url: currentUserProfile?.avatar_url || null,
            is_typing: false,
          },
        });
        supabase.removeChannel(channelRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, currentUserId, currentUserProfile]);

  // Set typing state with debouncing
  const setTyping = useCallback((isTyping: boolean) => {
    if (!channelRef.current || !currentUserId || !currentUserProfile) return;

    const now = Date.now();

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (isTyping) {
      // Debounce typing broadcasts
      if (now - lastTypingBroadcastRef.current < TYPING_DEBOUNCE_MS) {
        // Still schedule the stop typing timeout
        typingTimeoutRef.current = setTimeout(() => {
          broadcastTyping(false);
        }, TYPING_TIMEOUT_MS);
        return;
      }

      lastTypingBroadcastRef.current = now;
      broadcastTyping(true);

      // Auto-stop typing after timeout
      typingTimeoutRef.current = setTimeout(() => {
        broadcastTyping(false);
      }, TYPING_TIMEOUT_MS);
    } else {
      broadcastTyping(false);
    }

    function broadcastTyping(typing: boolean) {
      channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: {
          user_id: currentUserId,
          username: currentUserProfile?.username || "",
          display_name: currentUserProfile?.display_name || null,
          avatar_url: currentUserProfile?.avatar_url || null,
          is_typing: typing,
        },
      });
    }
  }, [currentUserId, currentUserProfile]);

  // Format typing text
  const typingText = (() => {
    if (typingUsers.length === 0) return null;

    const names = typingUsers.map(u => u.display_name || u.username);

    if (names.length === 1) {
      return `${names[0]} is typing...`;
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else {
      return `${names[0]} and ${names.length - 1} others are typing...`;
    }
  })();

  return {
    typingUsers,
    setTyping,
    typingText,
  };
}

// ============================================================================
// COMBINED HOOK FOR CHAT FEATURES
// ============================================================================

interface UseChatFeaturesOptions {
  conversationId: string;
  currentUserId: string;
  currentUserProfile?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useChatFeatures(options: UseChatFeaturesOptions) {
  const reactions = useMessageReactions({
    conversationId: options.conversationId,
    currentUserId: options.currentUserId,
  });

  const typing = useTypingIndicator(options);

  return {
    reactions,
    typing,
  };
}

export { MESSAGE_REACTION_EMOJIS };
