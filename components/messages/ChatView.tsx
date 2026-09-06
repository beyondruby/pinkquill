"use client";

import "./messages.css";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useBlock } from "@/lib/hooks/useInteractions";
import { useSendVoiceNote, useSendMedia } from "@/lib/hooks/useMedia";
import { useChatFeatures } from "@/lib/hooks/useMessaging";
import type { Message, MessageReactionEmoji } from "@/lib/types";
import VoiceRecorder from "./VoiceRecorder";
import VoiceNotePlayer from "./VoiceNotePlayer";
import MessageReactionPicker, { ReactionsDisplay } from "./MessageReactionPicker";
import TypingIndicator from "./TypingIndicator";
import SharedPostCard from "./SharedPostCard";
import MessageMediaBody from "./MessageMediaBody";
import { Spinner } from "@/components/ui/Loading";
import EmojiPicker from "@/components/ui/EmojiPicker";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ReportModal from "@/components/ui/ReportModal";
import Avatar from "@/components/ui/Avatar";
import ActionMenu from "@/components/ui/ActionMenu";
import Button from "@/components/ui/Button";
import { NavIcon } from "@/components/layout/navigation";
import { icons as uiIcons } from "@/components/ui/Icons";

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
  // Server ids only: optimistic `temp-` ids must never reach a query or a
  // realtime filter (they produced `invalid input syntax for type uuid` in
  // production logs).
  const messageIds = useMemo(
    () => messages.filter((message) => !message.id.startsWith("temp-")).map((message) => message.id),
    [messages]
  );
  // Block flags are read through refs inside the realtime handler so the
  // chat channel is not torn down and re-created when they resolve.
  const isBlockedByThemRef = useRef(isBlockedByThem);
  const iBlockedThemRef = useRef(iBlockedThem);
  useEffect(() => {
    isBlockedByThemRef.current = isBlockedByThem;
    iBlockedThemRef.current = iBlockedThem;
  }, [isBlockedByThem, iBlockedThem]);

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
  const handleReport = async (reason: string, details?: string) => {
    if (!participant || !reason.trim()) return;

    setReportLoading(true);
    try {
      await supabase.from("reports").insert({
        reporter_id: currentUserId,
        reported_user_id: participant.id,
        reason: details ? `${reason.trim()} - ${details}` : reason.trim(),
        type: "user",
      });
      setReportSuccess(true);
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
          if (newMsg.sender_id !== currentUserId && (isBlockedByThemRef.current || iBlockedThemRef.current)) {
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
  }, [conversationId, currentUserId]);

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
    return <div className="pq-chat-empty" role="status" aria-label="Loading conversation"><Spinner size="lg" /></div>;
  }

  const name = participant?.display_name || participant?.username || "Conversation";
  const visible = messages.filter((message) => (isBlockedByThem || iBlockedThem ? message.sender_id === currentUserId : true));

  const foot = (message: Message) => {
    const isOwn = message.sender_id === currentUserId;
    return (
      <div className={`pq-bubble__foot ${isOwn && message.is_read ? "pq-bubble__foot--read" : ""}`}>
        <span>{formatMessageTime(message.created_at)}</span>
        {isOwn && (
          <span aria-label={message.is_read ? "Read" : "Sent"} title={message.is_read ? "Read" : "Sent"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {message.is_read ? <path d="M2 12l4 4L14 8M9 16l1 1L20 7" /> : <path d="M5 12l4 4L19 6" />}
            </svg>
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="pq-msgs__thread">
      <div className="pq-chat-head">
        <button type="button" onClick={onBack} className="pq-icon-button md:hidden -ml-1" aria-label="Back to conversations">
          <NavIcon name="back" />
        </button>
        <Link href={`/studio/${participant?.username}`} className="pq-chat-head__who">
          <Avatar src={participant?.avatar_url} alt="" size={40} />
          <div className="min-w-0">
            <h2 className="pq-chat-head__name">{name}</h2>
            <p className="pq-chat-head__meta">@{participant?.username}</p>
          </div>
        </Link>
        <ActionMenu
          label="Conversation"
          description={participant ? `@${participant.username}` : undefined}
          widthClassName="w-64"
          buttonClassName="pq-icon-button"
          buttonAriaLabel="Conversation actions"
          portal
          items={[
            { label: "View studio", href: participant ? `/studio/${participant.username}` : undefined, hidden: !participant },
            {
              label: iBlockedThem ? `Unblock @${participant?.username}` : `Block @${participant?.username}`,
              onSelect: () => (iBlockedThem ? handleBlock() : setShowBlockConfirm(true)),
              tone: "warning",
              dividerBefore: true,
              sectionLabel: "Safety",
              icon: uiIcons.block,
            },
            { label: `Report @${participant?.username}`, onSelect: () => setShowReportModal(true), tone: "danger", icon: uiIcons.flag },
            { label: "Delete conversation", onSelect: () => setShowDeleteConfirm(true), tone: "danger", dividerBefore: true, icon: uiIcons.trash },
          ]}
        />
      </div>

      <div className="pq-chat-log">
        {hasOlderMessages && (
          <div className="pq-chat-more">
            <Button variant="ghost" size="sm" onClick={loadOlderMessages} loading={loadingOlder} loadingText="Loading…">Show older messages</Button>
          </div>
        )}
        {(iBlockedThem || isBlockedByThem) && (
          <p className="pq-chat-note"><strong>Blocked</strong>{iBlockedThem ? "You blocked this person. Only your own messages show here." : "New messages here can't be delivered right now."}</p>
        )}
        {visible.length === 0 ? (
          <div className="pq-chat-empty">
            <Avatar src={participant?.avatar_url} alt="" size={72} />
            <h3>{name}</h3>
            <p>Say hello. This is the start of your conversation.</p>
          </div>
        ) : (
          visible.map((message, index, arr) => {
            const isOwn = message.sender_id === currentUserId;
            const showDate = shouldShowDateDivider(message, index > 0 ? arr[index - 1] : null);
            const isTemp = message.id.startsWith("temp-");
            const messageReactions = reactions.reactionsByMessage.get(message.id) || [];
            const picker = !isTemp && (
              <MessageReactionPicker
                userReaction={reactions.getUserReaction(message.id)}
                reactions={messageReactions}
                onReact={(emoji) => handleReaction(message.id, emoji)}
                onRemoveReaction={() => handleRemoveReaction(message.id)}
                isOwnMessage={isOwn}
              />
            );
            return (
              <div key={message.id}>
                {showDate && <div className="pq-chat-day"><span>{formatDateDivider(message.created_at)}</span></div>}
                <div className={`pq-chat-line ${isOwn ? "pq-chat-line--own" : ""}`}>
                  {isOwn && picker}
                  <div className={`pq-chat-line__stack ${messageReactions.length > 0 ? "pq-chat-line__stack--reacted" : ""}`}>
                    <div className={`pq-bubble ${message.message_type === "voice" || message.message_type === "media" ? "pq-bubble--wide" : ""}`}>
                      {message.message_type === "voice" && message.voice_url ? (
                        <VoiceNotePlayer audioUrl={message.voice_url} duration={message.voice_duration || 0} waveformData={message.waveform_data || []} isOwn={isOwn} />
                      ) : message.message_type === "media" && message.media_url ? (
                        <div className="pq-bubble__media">
                          <MessageMediaBody url={message.media_url} mediaType={message.media_type} onOpenImage={setLightboxImage} />
                        </div>
                      ) : message.message_type === "post_share" && message.shared_post_id ? (
                        <>
                          <div className="p-1"><SharedPostCard postId={message.shared_post_id} isOwnMessage={isOwn} cachedPost={message.shared_post} /></div>
                          {message.content && <p className="pq-bubble__text">{message.content}</p>}
                        </>
                      ) : (
                        <p className="pq-bubble__text">{message.content}</p>
                      )}
                      {foot(message)}
                    </div>
                    {!isTemp && messageReactions.length > 0 && (
                      <div className="relative">
                        <div className="pq-chat-reactions">
                          <ReactionsDisplay reactions={messageReactions} userReaction={reactions.getUserReaction(message.id)} onRemoveReaction={() => handleRemoveReaction(message.id)} isOwnMessage={isOwn} />
                        </div>
                      </div>
                    )}
                  </div>
                  {!isOwn && picker}
                </div>
              </div>
            );
          })
        )}
        <TypingIndicator typingUsers={typing.typingUsers} typingText={typing.typingText} />
        <div ref={messagesEndRef} />
      </div>

      <div className="pq-chat-compose">
        {mediaError && <p className="pq-alert" role="alert">{mediaError}</p>}
        {mediaPreview && (
          <div className="pq-chat-preview">
            {mediaPreview.type === "image" ? <img src={mediaPreview.url} alt="Ready to send" /> : <video src={mediaPreview.url} controls playsInline />}
            <button type="button" className="pq-chat-preview__remove" onClick={cancelMediaPreview} aria-label="Remove attachment">{uiIcons.close}</button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept={[...limits.allowedImageTypes, ...limits.allowedVideoTypes].join(",")} onChange={handleFileSelect} className="hidden" />
        <div className="pq-chat-compose__row">
          {!showVoiceRecorder && (
            <button type="button" className="pq-icon-button" onClick={() => fileInputRef.current?.click()} disabled={sendingMedia} aria-label="Add a photo or video">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-5 h-5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6" /></svg>
            </button>
          )}
          <div className="pq-chat-compose__field">
            {showVoiceRecorder ? (
              <VoiceRecorder onSend={handleSendVoiceNote} onCancel={() => setShowVoiceRecorder(false)} maxDuration={300} disabled={sendingVoice} />
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onBlur={() => typing.setTyping(false)}
                  placeholder={`Message ${name}`}
                  aria-label="Message"
                />
                <div className="relative">
                  <button type="button" className="pq-icon-button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} aria-label="Add emoji" aria-expanded={showEmojiPicker}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-5 h-5"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 10h.01M15 10h.01" /></svg>
                  </button>
                  <EmojiPicker isOpen={showEmojiPicker} onClose={() => setShowEmojiPicker(false)} onSelect={(emoji) => setNewMessage((prev) => prev + emoji)} />
                </div>
                <button type="button" className="pq-icon-button" onClick={() => setShowVoiceRecorder(true)} aria-label="Record a voice note">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-5 h-5"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a7 7 0 0 1-14 0M12 18v3" /></svg>
                </button>
              </>
            )}
          </div>
          {!showVoiceRecorder && (
            <button
              type="button"
              className="pq-chat-compose__send"
              onClick={mediaPreview ? handleSendMedia : handleSend}
              disabled={(!newMessage.trim() && !mediaPreview) || sending || sendingMedia}
              aria-label={sendingMedia ? "Sending" : mediaPreview ? "Send attachment" : "Send"}
            >
              {sendingMedia ? <Spinner size="sm" /> : uiIcons.send}
            </button>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showBlockConfirm}
        onClose={() => setShowBlockConfirm(false)}
        onConfirm={handleBlock}
        title={`Block @${participant?.username}?`}
        description="They won't be able to see your posts, follow you, or message you. They won't be told."
        confirmText="Block"
        isDanger
        loading={blockLoading}
      />

      <ReportModal
        isOpen={showReportModal}
        onClose={() => { setShowReportModal(false); setReportSuccess(false); }}
        onSubmit={handleReport}
        submitting={reportLoading}
        submitted={reportSuccess}
        title={`Report @${participant?.username}`}
        placeholder="What happened in this conversation…"
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConversation}
        title="Delete this conversation?"
        description="Every message in it goes, for both of you. This can't be undone."
        confirmText="Delete"
        isDanger
        loading={deleteLoading}
      />

      {lightboxImage && (
        <div className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-black/90 p-4" role="dialog" aria-label="Image" onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={() => setLightboxImage(null)} className="pq-takes-back" style={{ left: "auto", right: "0.75rem" }} aria-label="Close image" autoFocus>
            {uiIcons.close}
          </button>
        </div>
      )}
    </div>
  );
}
