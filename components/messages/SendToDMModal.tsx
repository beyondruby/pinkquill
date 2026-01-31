"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useShareToDM } from "@/lib/hooks";
import type { Post } from "@/lib/types";
import { DEFAULT_AVATAR } from "@/lib/utils/image";

interface SendToDMModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  currentUserId: string;
}

interface Recipient {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified?: boolean;
  hasConversation?: boolean;
}

export default function SendToDMModal({
  isOpen,
  onClose,
  post,
  currentUserId,
}: SendToDMModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [recentRecipients, setRecentRecipients] = useState<Recipient[]>([]);
  const [searchResults, setSearchResults] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [optionalMessage, setOptionalMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { sharePostToDM, sharing, progress } = useShareToDM();

  // Fetch recent conversations/recipients
  useEffect(() => {
    if (!isOpen || !currentUserId) return;

    const fetchRecentRecipients = async () => {
      setLoading(true);

      try {
        // Get user's conversations with participants
        const { data: participations } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", currentUserId);

        if (!participations || participations.length === 0) {
          setRecentRecipients([]);
          setLoading(false);
          return;
        }

        const conversationIds = participations.map((p) => p.conversation_id);

        // Get other participants from these conversations
        const { data: otherParticipants } = await supabase
          .from("conversation_participants")
          .select(
            `
            user_id,
            conversation_id,
            profile:profiles (
              id,
              username,
              display_name,
              avatar_url,
              is_verified
            )
          `
          )
          .in("conversation_id", conversationIds)
          .neq("user_id", currentUserId);

        if (!otherParticipants) {
          setRecentRecipients([]);
          setLoading(false);
          return;
        }

        // Get conversation timestamps for sorting
        const { data: conversations } = await supabase
          .from("conversations")
          .select("id, updated_at")
          .in("id", conversationIds)
          .order("updated_at", { ascending: false });

        const conversationOrder = new Map(
          conversations?.map((c, i) => [c.id, i]) || []
        );

        // Deduplicate and sort by recency
        const uniqueRecipients = new Map<string, Recipient & { order: number }>();
        for (const p of otherParticipants) {
          const profile = p.profile as unknown as Recipient;
          if (!profile || !profile.id || uniqueRecipients.has(profile.id)) continue;

          uniqueRecipients.set(profile.id, {
            ...profile,
            hasConversation: true,
            order: conversationOrder.get(p.conversation_id) ?? 999,
          });
        }

        const sorted = Array.from(uniqueRecipients.values())
          .sort((a, b) => a.order - b.order)
          .slice(0, 20);

        setRecentRecipients(sorted);
      } catch (err) {
        console.error("Failed to fetch recent recipients:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentRecipients();
  }, [isOpen, currentUserId]);

  // Search for users
  const searchUsers = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setSearching(true);

      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, is_verified")
          .neq("id", currentUserId)
          .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
          .limit(15);

        setSearchResults(data || []);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    },
    [currentUserId]
  );

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchUsers]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedRecipients([]);
      setOptionalMessage("");
      setSuccess(false);
    }
  }, [isOpen]);

  const toggleRecipient = (recipient: Recipient) => {
    setSelectedRecipients((prev) => {
      const exists = prev.find((r) => r.id === recipient.id);
      if (exists) {
        return prev.filter((r) => r.id !== recipient.id);
      }
      return [...prev, recipient];
    });
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0 || sharing) return;

    const recipientIds = selectedRecipients.map((r) => r.id);
    const results = await sharePostToDM(
      post,
      recipientIds,
      currentUserId,
      optionalMessage.trim() || undefined
    );

    const successCount = results.filter((r) => r.success).length;
    if (successCount > 0) {
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  if (!isOpen) return null;

  const displayList = searchQuery.trim() ? searchResults : recentRecipients;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-[440px] bg-white rounded-2xl shadow-2xl z-[1001] overflow-hidden max-h-[85vh] flex flex-col animate-scaleIn">
        {success ? (
          // Success state
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="font-display text-xl text-ink mb-2">Sent!</h3>
            <p className="font-body text-sm text-muted">
              Post shared to {selectedRecipients.length} {selectedRecipients.length === 1 ? "person" : "people"}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="relative px-5 py-4 border-b border-black/[0.06]">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-purple-primary to-pink-vivid" />
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg text-ink">Send to</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.04] transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <div className="mt-3 relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search people..."
                  className="w-full pl-10 pr-4 py-2.5 bg-black/[0.03] rounded-full border-none outline-none font-ui text-sm text-ink placeholder:text-muted/60 focus:ring-2 focus:ring-purple-primary/20 transition-all"
                />
              </div>

              {/* Selected recipients chips */}
              {selectedRecipients.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedRecipients.map((recipient) => (
                    <button
                      key={recipient.id}
                      onClick={() => toggleRecipient(recipient)}
                      className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full text-white text-xs font-ui font-medium hover:opacity-90 transition-opacity"
                    >
                      <img
                        src={recipient.avatar_url || DEFAULT_AVATAR}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover"
                      />
                      <span>{recipient.display_name || recipient.username}</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recipients list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="p-8 flex justify-center">
                  <div className="w-6 h-6 border-2 border-purple-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : displayList.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-ui text-sm text-muted">
                    {searchQuery.trim()
                      ? "No people found"
                      : "Start a conversation to see recent chats"}
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  {!searchQuery.trim() && (
                    <p className="px-5 py-2 font-ui text-xs text-muted uppercase tracking-wide">
                      Recent
                    </p>
                  )}
                  {displayList.map((recipient) => {
                    const isSelected = selectedRecipients.some(
                      (r) => r.id === recipient.id
                    );
                    return (
                      <button
                        key={recipient.id}
                        onClick={() => toggleRecipient(recipient)}
                        className={`w-full flex items-center gap-3 px-5 py-3 transition-colors ${
                          isSelected
                            ? "bg-purple-primary/[0.06]"
                            : "hover:bg-black/[0.02]"
                        }`}
                      >
                        <div className="relative">
                          <img
                            src={recipient.avatar_url || DEFAULT_AVATAR}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover"
                          />
                          {recipient.is_verified && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-purple-primary rounded-full flex items-center justify-center">
                              <svg
                                className="w-2.5 h-2.5 text-white"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-ui text-sm font-medium text-ink truncate">
                            {recipient.display_name || recipient.username}
                          </p>
                          <p className="font-ui text-xs text-muted truncate">
                            @{recipient.username}
                          </p>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? "border-purple-primary bg-purple-primary"
                              : "border-black/20"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3.5 h-3.5 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer with optional message and send button */}
            <div className="border-t border-black/[0.06] p-4">
              {/* Optional message input */}
              <div className="mb-3">
                <input
                  type="text"
                  value={optionalMessage}
                  onChange={(e) => setOptionalMessage(e.target.value)}
                  placeholder="Add a message... (optional)"
                  className="w-full px-4 py-2.5 bg-black/[0.03] rounded-xl border-none outline-none font-body text-sm text-ink placeholder:text-muted/60 focus:ring-2 focus:ring-purple-primary/20 transition-all"
                />
              </div>

              {/* Post preview mini */}
              <div className="mb-3 p-2.5 bg-black/[0.02] rounded-xl flex items-center gap-2.5">
                {post.media?.[0] && (
                  <img
                    src={post.media[0].media_url}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-ui text-xs text-muted">Sharing post by</p>
                  <p className="font-ui text-sm font-medium text-ink truncate">
                    @{post.author?.username}
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-purple-primary flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={selectedRecipients.length === 0 || sharing}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-semibold shadow-lg shadow-purple-primary/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {sharing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending ({progress.current}/{progress.total})
                  </span>
                ) : (
                  `Send${selectedRecipients.length > 0 ? ` to ${selectedRecipients.length}` : ""}`
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
