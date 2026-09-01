"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useBlock, useSendVoiceNote, useSendMedia, useChatFeatures } from "@/lib/hooks";
import type { Message, MessageReactionEmoji } from "@/lib/types";
import VoiceRecorder from "./VoiceRecorder";
import VoiceNotePlayer from "./VoiceNotePlayer";
import MessageReactionPicker, { ReactionsDisplay } from "./MessageReactionPicker";
import TypingIndicator from "./TypingIndicator";
import SharedPostCard from "./SharedPostCard";
import Loading from "@/components/ui/Loading";
import EmojiPicker from "@/components/ui/EmojiPicker";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import Avatar from "@/components/ui/Avatar";
import ActionMenu from "@/components/ui/ActionMenu";

// Local type for chat participants (simplified from ConversationParticipant)
interface Participant {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface ChatViewProps {
  conversationId: string;
  currentUserId: string;
  currentUserProfile?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  onBack: () => void;
}

const icons = {
  back: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  send: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  smile: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  image: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  mic: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  ),
  check: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  doubleCheck: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7M5 13l4 4L19 7" transform="translate(-2, 0)" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" transform="translate(2, 0)" />
    </svg>
  ),
};

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateDivider(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
}

function shouldShowDateDivider(
  currentMessage: Message,
  previousMessage: Message | null
): boolean {
  if (!previousMessage) return true;
  const currentDate = new Date(currentMessage.created_at).toDateString();
  const previousDate = new Date(previousMessage.created_at).toDateString();
  return currentDate !== previousDate;
}

export default function ChatView({
  conversationId,
  currentUserId,
  currentUserProfile,
  onBack,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);
  const [iBlockedThem, setIBlockedThem] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ file: File; url: string; type: 'image' | 'video' } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (reportTimeoutRef.current) clearTimeout(reportTimeoutRef.current);
      if (mediaErrorTimeoutRef.current) clearTimeout(mediaErrorTimeoutRef.current);
    };
  }, []);
  const { checkIsBlocked, blockUser, unblockUser } = useBlock();
  const { sendVoiceNote, sending: sendingVoice } = useSendVoiceNote();
  const { sendMedia, validateFile, sending: sendingMedia, limits } = useSendMedia();
  const messageIds = useMemo(() => messages.map((message) => message.id), [messages]);

  // Message reactions and typing indicators
  const { reactions, typing } = useChatFeatures({
    conversationId,
    currentUserId,
    messageIds,
    currentUserProfile,
  });

  // Handle typing indicator - called when input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    // Notify typing
    if (e.target.value.length > 0) {
      typing.setTyping(true);
    }
  }, [typing]);

  // Handle reaction on a message
  const handleReaction = useCallback((messageId: string, emoji: MessageReactionEmoji) => {
    reactions.toggleReaction(messageId, emoji);
  }, [reactions]);

  // Handle removing a reaction
  const handleRemoveReaction = useCallback((messageId: string) => {
    reactions.removeReaction(messageId);
  }, [reactions]);

  // Scroll to bottom - instant on initial load, smooth for new messages
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth && !initialLoad ? "smooth" : "auto"
    });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(!initialLoad);
      if (initialLoad) setInitialLoad(false);
    }
  }, [messages]);

  // Handle block user
  const handleBlock = async () => {
    if (!participant) return;

    setBlockLoading(true);
    if (iBlockedThem) {
      const result = await unblockUser(currentUserId, participant.id);
      if (result.success) {
        setIBlockedThem(false);
      }
    } else {
      const result = await blockUser(currentUserId, participant.id);
      if (result.success) {
        setIBlockedThem(true);
        setShowBlockConfirm(false);
      }
    }
    setBlockLoading(false);
  };

  // Handle report user
  const handleReport = async () => {
    if (!participant || !reportReason.trim()) return;

    setReportLoading(true);
    try {
      await supabase.from("reports").insert({
        reporter_id: currentUserId,
        reported_user_id: participant.id,
        reason: reportReason.trim(),
        type: "user",
      });
      setReportSuccess(true);
      setReportReason("");
      reportTimeoutRef.current = setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
    } finally {
      setReportLoading(false);
    }
  };

  // Handle delete conversation
  const handleDeleteConversation = async () => {
    setDeleteLoading(true);
    try {
      // Delete all messages in the conversation
      await supabase.from("messages").delete().eq("conversation_id", conversationId);
      // Delete participants
      await supabase.from("conversation_participants").delete().eq("conversation_id", conversationId);
      // Delete conversation
      await supabase.from("conversations").delete().eq("id", conversationId);
      // Go back to conversations list
      onBack();
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Fetch participant and messages
  const fetchData = async () => {
    try {
      setLoading(true);

      // Get other participant
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select(`
          user:profiles (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("conversation_id", conversationId)
        .neq("user_id", currentUserId);

      if (participants && participants[0]) {
        const participantData = participants[0].user as unknown as Participant;
        setParticipant(participantData);

        // Check block status in both directions
        if (participantData?.id) {
          const [theyBlockedMe, iBlockedThemResult] = await Promise.all([
            checkIsBlocked(participantData.id, currentUserId), // They blocked me
            checkIsBlocked(currentUserId, participantData.id), // I blocked them
          ]);
          setIsBlockedByThem(theyBlockedMe);
          setIBlockedThem(iBlockedThemResult);
        }
      }

      // Get latest 50 messages (fetch newest first, then reverse for display)
      const { data: messagesData } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(50);

      const sorted = (messagesData || []).reverse();
      setMessages(sorted);
      setHasOlderMessages((messagesData || []).length === 50);

      // Mark messages as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", currentUserId)
        .eq("is_read", false);
    } catch (err) {
      console.error("Failed to fetch chat data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [conversationId]);

  const loadOlderMessages = async () => {
    if (loadingOlder || !hasOlderMessages || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldestMessage = messages[0];
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .lt("created_at", oldestMessage.created_at)
        .order("created_at", { ascending: false })
        .limit(50);

      const older = (data || []).reverse();
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
      }
      setHasOlderMessages((data || []).length === 50);
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Real-time subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;

          // If the message is from the other user and there's a block, don't show it
          if (newMsg.sender_id !== currentUserId && (isBlockedByThem || iBlockedThem)) {
            return; // Don't add blocked user's messages
          }

          setMessages((prev) => {
            // Check if this message already exists (by id or content match for optimistic)
            const exists = prev.some(m => m.id === newMsg.id);
            if (exists) return prev;

            // Check if there's an optimistic message with same content from same sender
            const optimisticIndex = prev.findIndex(
              m => m.id.startsWith('temp-') &&
                   m.sender_id === newMsg.sender_id &&
                   m.content === newMsg.content
            );

            if (optimisticIndex !== -1) {
              // Replace optimistic with real message
              const updated = [...prev];
              updated[optimisticIndex] = newMsg;
              return updated;
            }

            return [...prev, newMsg];
          });

          // Mark as read if not from current user
          if (newMsg.sender_id !== currentUserId) {
            supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", newMsg.id)
              .then(({ error }) => {
                if (error) console.error("Failed to mark message as read:", error.message);
              });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
          );
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[ChatView] Real-time connection error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, isBlockedByThem, iBlockedThem]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    // Check block status before doing anything (silent block)
    if (isBlockedByThem || iBlockedThem) {
      return;
    }

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage("");

    // Create optimistic message
    const optimisticId = `temp-${crypto.randomUUID()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      sender_id: currentUserId,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    // Add optimistic message immediately
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const { data } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: messageContent,
        })
        .select()
        .single();

      // Replace optimistic message with real one
      if (data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? data : m))
        );

        const { error: touchError } = await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);

        if (touchError) {
          console.warn("Failed to update conversation timestamp:", touchError.message);
        }
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSendVoiceNote = async (
    audioBlob: Blob,
    duration: number,
    waveformData: number[]
  ) => {
    // Check block status before doing anything (silent block)
    if (isBlockedByThem || iBlockedThem) {
      return;
    }

    // Create optimistic voice message
    const optimisticId = `temp-${crypto.randomUUID()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      sender_id: currentUserId,
      content: "",
      message_type: "voice",
      voice_url: URL.createObjectURL(audioBlob),
      voice_duration: Math.round(duration),
      waveform_data: waveformData,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setShowVoiceRecorder(false);

    const message = await sendVoiceNote(
      conversationId,
      currentUserId,
      audioBlob,
      duration,
      waveformData
    );

    if (message) {
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? message : m))
      );
    } else {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      setMediaError(validation.error || 'Invalid file');
      if (mediaErrorTimeoutRef.current) clearTimeout(mediaErrorTimeoutRef.current);
      mediaErrorTimeoutRef.current = setTimeout(() => setMediaError(null), 3000);
      return;
    }

    // Create preview
    const url = URL.createObjectURL(file);
    setMediaPreview({ file, url, type: validation.mediaType! });
  };

  const handleSendMedia = async () => {
    if (!mediaPreview) return;

    // Check block status before doing anything (silent block)
    if (isBlockedByThem || iBlockedThem) {
      return;
    }

    // Create optimistic message
    const optimisticId = `temp-${crypto.randomUUID()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      sender_id: currentUserId,
      content: "",
      message_type: "media",
      media_url: mediaPreview.url,
      media_type: mediaPreview.type,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const fileToSend = mediaPreview.file;
    setMediaPreview(null);

    const message = await sendMedia(conversationId, currentUserId, fileToSend);

    if (message) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? message : m))
      );
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setMediaError('Failed to send media');
      if (mediaErrorTimeoutRef.current) clearTimeout(mediaErrorTimeoutRef.current);
      mediaErrorTimeoutRef.current = setTimeout(() => setMediaError(null), 3000);
    }
  };

  const cancelMediaPreview = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview.url);
      setMediaPreview(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loading text="Loading chat" size="medium" />
      </div>
    );
  }

  return (
    <div className="chat-view flex-1 flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 md:py-4 bg-surface border-b border-border-light"
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={onBack}
          className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-skeleton/60 transition-all md:hidden"
        >
          {icons.back}
        </button>

        <Link
          href={`/studio/${participant?.username}`}
          className="flex items-center gap-3 flex-1 group"
        >
          <Avatar
            src={participant?.avatar_url}
            alt={participant?.display_name || participant?.username || "Participant"}
            size={44}
            className="group-hover:ring-2 group-hover:ring-purple-primary/30 transition-all"
          />
          <div>
            <h2 className="font-ui text-[1rem] font-medium text-ink group-hover:text-accent transition-colors">
              {participant?.display_name || participant?.username}
            </h2>
            <p className="font-ui text-[0.8rem] text-muted">
              @{participant?.username}
            </p>
          </div>
        </Link>

        <div className="relative">
          <ActionMenu
            label="Conversation"
            description={participant ? `@${participant.username}` : "Chat actions"}
            widthClassName="w-72"
            buttonClassName="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-accent hover:bg-purple-50 transition-all"
            buttonAriaLabel="Conversation actions"
            trigger={icons.info}
            items={[
              {
                label: "View profile",
                href: participant ? `/studio/${participant.username}` : undefined,
                hidden: !participant,
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                ),
              },
              {
                label: `${iBlockedThem ? "Unblock" : "Block"} @${participant?.username}`,
                onSelect: () => {
                  if (iBlockedThem) {
                    handleBlock();
                  } else {
                    setShowBlockConfirm(true);
                  }
                },
                tone: "warning",
                dividerBefore: true,
                sectionLabel: "Safety",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                ),
              },
              {
                label: `Report @${participant?.username}`,
                onSelect: () => setShowReportModal(true),
                tone: "danger",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ),
              },
              {
                label: "Delete conversation",
                onSelect: () => setShowDeleteConfirm(true),
                tone: "danger",
                dividerBefore: true,
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ),
              },
            ]}
          />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-canvas">
        {hasOlderMessages && (
          <div className="flex justify-center mb-4">
            <button
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="text-sm font-ui text-purple-primary hover:text-accent/80 disabled:opacity-50 transition-colors"
            >
              {loadingOlder ? "Loading..." : "Load older messages"}
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center">
              <Avatar
                src={participant?.avatar_url}
                alt={participant?.display_name || participant?.username || "Participant"}
                size={80}
                shadow
                className="mx-auto mb-4"
              />
              <h3 className="font-display text-[1.2rem] text-ink mb-1">
                {participant?.display_name || participant?.username}
              </h3>
              <p className="font-body text-[0.9rem] text-muted italic">
                Start the conversation with a message
              </p>
            </div>
          </div>
        ) : (
          // Filter out messages from blocked users (Instagram-style: messages "send" but don't deliver)
          messages
            .filter(message => {
              // If there's a block in either direction, only show my own messages
              if (isBlockedByThem || iBlockedThem) {
                return message.sender_id === currentUserId;
              }
              return true;
            })
            .map((message, index, filteredArr) => {
            const isOwn = message.sender_id === currentUserId;
            const showDate = shouldShowDateDivider(
              message,
              index > 0 ? filteredArr[index - 1] : null
            );

            return (
              <div key={message.id}>
                {/* Date Divider */}
                {showDate && (
                  <div className="flex items-center justify-center my-4">
                    <span className="px-3 py-1 bg-surface rounded-full font-ui text-[0.75rem] text-muted shadow-sm">
                      {formatDateDivider(message.created_at)}
                    </span>
                  </div>
                )}

                {/* Message Bubble with Reactions */}
                <div
                  className={`flex items-center ${isOwn ? "justify-end" : "justify-start"} mb-1 group`}
                >
                  {/* Reaction picker button - shown on left for own messages */}
                  {isOwn && !message.id.startsWith('temp-') && (
                    <div className="flex items-center mr-1.5">
                      <MessageReactionPicker
                        userReaction={reactions.getUserReaction(message.id)}
                        reactions={reactions.reactionsByMessage.get(message.id) || []}
                        onReact={(emoji) => handleReaction(message.id, emoji)}
                        onRemoveReaction={() => handleRemoveReaction(message.id)}
                        isOwnMessage={isOwn}
                      />
                    </div>
                  )}

                  {/* Message bubble wrapper with relative positioning for reactions */}
                  <div className={`relative max-w-[70%] ${(reactions.reactionsByMessage.get(message.id) || []).length > 0 ? "mb-3" : ""}`}>
                    {message.message_type === "voice" && message.voice_url ? (
                      <div
                        className={`max-w-[280px] rounded-2xl overflow-hidden ${
                          isOwn
                            ? "bg-gradient-to-r from-purple-primary to-pink-vivid rounded-br-md"
                            : "bg-subtle shadow-sm rounded-bl-md"
                        }`}
                      >
                        <VoiceNotePlayer
                          audioUrl={message.voice_url}
                          duration={message.voice_duration || 0}
                          waveformData={message.waveform_data || []}
                          isOwn={isOwn}
                        />
                        <div
                          className={`flex items-center justify-end gap-1 px-3 pb-2 ${
                            isOwn ? "text-white/70" : "text-muted"
                          }`}
                        >
                          <span className="font-ui text-[0.7rem]">
                            {formatMessageTime(message.created_at)}
                          </span>
                          {isOwn && (
                            <span className={message.is_read ? "text-white" : "text-white/50"}>
                              {icons.doubleCheck}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : message.message_type === "media" && message.media_url ? (
                      <div
                        className={`max-w-[280px] rounded-2xl overflow-hidden ${
                          isOwn
                            ? "bg-gradient-to-r from-purple-primary to-pink-vivid rounded-br-md"
                            : "bg-subtle shadow-sm rounded-bl-md"
                        }`}
                      >
                        {message.media_type === "image" ? (
                          <img
                            src={message.media_url}
                            alt="Shared image"
                            className="w-full max-h-[300px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => setLightboxImage(message.media_url!)}
                          />
                        ) : (
                          <video
                            src={message.media_url}
                            className="w-full max-h-[300px] rounded-t-xl"
                            controls
                            preload="metadata"
                            playsInline
                          />
                        )}
                        <div
                          className={`flex items-center justify-end gap-1 px-3 py-2 ${
                            isOwn ? "text-white/70" : "text-muted"
                          }`}
                        >
                          <span className="font-ui text-[0.7rem]">
                            {formatMessageTime(message.created_at)}
                          </span>
                          {isOwn && (
                            <span className={message.is_read ? "text-white" : "text-white/50"}>
                              {icons.doubleCheck}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : message.message_type === "post_share" && message.shared_post_id ? (
                      <div
                        className={`rounded-2xl overflow-hidden ${
                          isOwn
                            ? "bg-gradient-to-r from-purple-primary to-pink-vivid rounded-br-md"
                            : "bg-subtle shadow-sm rounded-bl-md"
                        }`}
                      >
                        <div className={isOwn ? "p-1" : "p-1"}>
                          <SharedPostCard
                            postId={message.shared_post_id}
                            isOwnMessage={isOwn}
                            cachedPost={message.shared_post}
                          />
                        </div>
                        {/* Optional message content */}
                        {message.content && (
                          <div className={`px-4 py-2 ${isOwn ? "text-white" : "text-ink"}`}>
                            <p className="font-body text-[0.95rem] leading-relaxed whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          </div>
                        )}
                        <div
                          className={`flex items-center justify-end gap-1 px-3 pb-2 ${
                            isOwn ? "text-white/70" : "text-muted"
                          }`}
                        >
                          <span className="font-ui text-[0.7rem]">
                            {formatMessageTime(message.created_at)}
                          </span>
                          {isOwn && (
                            <span className={message.is_read ? "text-white" : "text-white/50"}>
                              {icons.doubleCheck}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`px-4 py-2.5 rounded-2xl ${
                          isOwn
                            ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-br-md"
                            : "bg-subtle text-ink shadow-sm rounded-bl-md"
                        }`}
                      >
                        <p className="font-body text-[0.95rem] leading-relaxed whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 ${
                            isOwn ? "text-white/70" : "text-muted"
                          }`}
                        >
                          <span className="font-ui text-[0.7rem]">
                            {formatMessageTime(message.created_at)}
                          </span>
                          {isOwn && (
                            <span className={message.is_read ? "text-white" : "text-white/50"}>
                              {icons.doubleCheck}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Reactions display - Instagram style at bottom corner */}
                    {!message.id.startsWith('temp-') && (reactions.reactionsByMessage.get(message.id) || []).length > 0 && (
                      <div className={`absolute -bottom-2.5 ${isOwn ? "right-2" : "left-2"}`}>
                        <ReactionsDisplay
                          reactions={reactions.reactionsByMessage.get(message.id) || []}
                          userReaction={reactions.getUserReaction(message.id)}
                          onRemoveReaction={() => handleRemoveReaction(message.id)}
                          isOwnMessage={isOwn}
                        />
                      </div>
                    )}
                  </div>

                  {/* Reaction picker button - shown on right for other's messages */}
                  {!isOwn && !message.id.startsWith('temp-') && (
                    <div className="flex items-center ml-1.5">
                      <MessageReactionPicker
                        userReaction={reactions.getUserReaction(message.id)}
                        reactions={reactions.reactionsByMessage.get(message.id) || []}
                        onReact={(emoji) => handleReaction(message.id, emoji)}
                        onRemoveReaction={() => handleRemoveReaction(message.id)}
                        isOwnMessage={isOwn}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing Indicator */}
        <TypingIndicator
          typingUsers={typing.typingUsers}
          typingText={typing.typingText}
        />

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        className="p-3 md:p-4 bg-surface border-t border-border-light"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Media Error Toast */}
        {mediaError && (
          <div className="mb-3 px-4 py-2 bg-red-50 text-red-600 rounded-lg font-ui text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {mediaError}
          </div>
        )}

        {/* Media Preview */}
        {mediaPreview && (
          <div className="mb-3 relative inline-block">
            <div className="relative rounded-xl overflow-hidden border border-border-light shadow-sm bg-skeleton">
              {mediaPreview.type === 'image' ? (
                <img
                  src={mediaPreview.url}
                  alt="Preview"
                  className="max-h-48 max-w-full object-contain"
                />
              ) : (
                <video
                  src={mediaPreview.url}
                  className="max-h-48 max-w-[280px] rounded-lg"
                  controls
                  playsInline
                  style={{ display: 'block' }}
                />
              )}
              <button
                onClick={cancelMediaPreview}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-1 font-ui text-xs text-muted">
              {(mediaPreview.file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={[...limits.allowedImageTypes, ...limits.allowedVideoTypes].join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sendingMedia}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-accent hover:bg-purple-50 transition-all disabled:opacity-50"
          >
            {icons.image}
          </button>

          <div className={`flex-1 flex items-center rounded-full px-4 transition-all ${
            showVoiceRecorder
              ? "bg-gradient-to-r from-purple-primary/5 to-pink-vivid/5 ring-2 ring-purple-primary/30"
              : "bg-subtle focus-within:bg-surface focus-within:ring-2 focus-within:ring-purple-primary focus-within:shadow-lg"
          }`}>
            {showVoiceRecorder ? (
              <VoiceRecorder
                onSend={handleSendVoiceNote}
                onCancel={() => setShowVoiceRecorder(false)}
                maxDuration={300}
                disabled={sendingVoice}
              />
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onBlur={() => typing.setTyping(false)}
                  placeholder="Write a message..."
                  aria-label="Message input"
                  className="flex-1 py-3 border-none bg-transparent outline-none font-body text-[0.95rem] text-ink placeholder:text-muted/60"
                />
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="w-8 h-8 flex items-center justify-center text-muted hover:text-accent transition-all"
                    aria-label="Add emoji"
                    aria-expanded={showEmojiPicker}
                  >
                    {icons.smile}
                  </button>
                  <EmojiPicker
                    isOpen={showEmojiPicker}
                    onClose={() => setShowEmojiPicker(false)}
                    onSelect={(emoji) => setNewMessage((prev) => prev + emoji)}
                  />
                </div>
                <button
                  onClick={() => setShowVoiceRecorder(true)}
                  className="w-8 h-8 flex items-center justify-center text-muted hover:text-accent transition-all ml-1"
                  aria-label="Record voice note"
                >
                  {icons.mic}
                </button>
              </>
            )}
          </div>

          <button
            onClick={mediaPreview ? handleSendMedia : handleSend}
            disabled={(!newMessage.trim() && !mediaPreview) || sending || sendingMedia || showVoiceRecorder}
            aria-label={sendingMedia ? "Sending message" : (mediaPreview ? "Send media" : "Send message")}
            className="w-11 h-11 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center shadow-lg shadow-purple-primary/30 hover:scale-105 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {sendingMedia ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            ) : (
              icons.send
            )}
          </button>
        </div>
      </div>

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => !blockLoading && setShowBlockConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[420px] bg-surface rounded-2xl shadow-2xl z-[1001] p-5 md:p-6">
            <h3 className="font-display text-xl text-ink mb-3">
              Block @{participant?.username}?
            </h3>
            <p className="font-body text-sm text-muted mb-6">
              They won&apos;t be able to see your posts, follow you, or message you. They won&apos;t be notified that you blocked them.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                disabled={blockLoading}
                className="px-5 py-2.5 rounded-full font-ui text-sm text-muted bg-skeleton/70 hover:bg-skeleton transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                disabled={blockLoading}
                className="px-5 py-2.5 rounded-full font-ui text-sm text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {blockLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Blocking...
                  </>
                ) : (
                  "Block"
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => !reportLoading && setShowReportModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[480px] bg-surface rounded-2xl shadow-2xl z-[1001] overflow-hidden max-h-[90vh] overflow-y-auto">
            {reportSuccess ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-display text-xl text-ink mb-2">Report Submitted</h3>
                <p className="font-body text-sm text-muted">
                  Thank you for helping keep PinkQuill safe. We&apos;ll review this report.
                </p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-border-light">
                  <h3 className="font-display text-xl text-ink">
                    Report @{participant?.username}
                  </h3>
                  <p className="font-body text-sm text-muted mt-1">
                    Help us understand what&apos;s happening with this account.
                  </p>
                </div>

                <div className="p-6">
                  <label className="block font-ui text-sm text-ink mb-2">
                    Why are you reporting this user?
                  </label>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Please describe the issue..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-skeleton/60 border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all resize-none"
                  />

                  <div className="mt-4 space-y-2">
                    <p className="font-ui text-xs text-muted">Quick select:</p>
                    <div className="flex flex-wrap gap-2">
                      {["Spam", "Harassment", "Impersonation", "Inappropriate content", "Other"].map((reason) => (
                        <button
                          key={reason}
                          onClick={() => setReportReason(reason)}
                          className={`px-3 py-1.5 rounded-full font-ui text-xs transition-all ${
                            reportReason === reason
                              ? "bg-purple-primary text-white"
                              : "bg-skeleton/70 text-muted hover:bg-skeleton"
                          }`}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-border-light flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowReportModal(false);
                      setReportReason("");
                    }}
                    disabled={reportLoading}
                    className="px-5 py-2.5 rounded-full font-ui text-sm text-muted bg-skeleton/70 hover:bg-skeleton transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={reportLoading || !reportReason.trim()}
                    className="px-5 py-2.5 rounded-full font-ui text-sm text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {reportLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Report"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConversation}
        title="Delete Conversation?"
        description="This will permanently delete all messages in this conversation. This action cannot be undone."
        confirmText="Delete"
        isDanger
        loading={deleteLoading}
      />

      {/* Image Lightbox */}
      {lightboxImage && (
        <>
          <div
            className="fixed inset-0 bg-black/90 z-(--z-modal)"
            onClick={() => setLightboxImage(null)}
          />
          <div className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 pointer-events-none">
            <img
              src={lightboxImage}
              alt="Full size image"
              className="max-w-full max-h-full object-contain pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <button
            onClick={() => setLightboxImage(null)}
            className="fixed top-4 right-4 z-[1002] w-10 h-10 rounded-full bg-surface/10 text-white flex items-center justify-center hover:bg-surface/20 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
