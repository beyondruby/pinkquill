"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useShareToDM } from "@/lib/hooks/useShareToDM";
import type { Post } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Loading";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { PersonRow } from "@/components/communities/pieces";
import "@/components/create/composer.css";
import { sanitizePostgrestSearchTerm } from "@/lib/utils/postgrest";

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

      const sanitizedQuery = sanitizePostgrestSearchTerm(query);
      if (!sanitizedQuery) {
        setSearchResults([]);
        return;
      }

      setSearching(true);

      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, is_verified")
          .neq("id", currentUserId)
          .or(`username.ilike.%${sanitizedQuery}%,display_name.ilike.%${sanitizedQuery}%`)
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
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={success ? "Sent" : "Send to"}
      subtitle={success ? undefined : `Sharing a post by @${post.author?.username}`}
      busy={sharing}
      size="tall"
      initialFocus={() => searchInputRef.current}
      footer={success ? undefined : (
        <>
          <Button variant="ghost" onClick={onClose} disabled={sharing}>Cancel</Button>
          <Button variant="primary" onClick={handleSend} disabled={selectedRecipients.length === 0} loading={sharing} loadingText={`Sending ${progress.current}/${progress.total}`}>
            {selectedRecipients.length > 0 ? `Send to ${selectedRecipients.length}` : "Send"}
          </Button>
        </>
      )}
    >
      {success ? (
        <p className="pq-discussion__state">Shared with {selectedRecipients.length} {selectedRecipients.length === 1 ? "person" : "people"}.</p>
      ) : (
        <>
          <input
            ref={searchInputRef}
            type="search"
            className="pq-field pq-field--ui"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
          />
          {selectedRecipients.length > 0 && (
            <div className="pq-chip-row" aria-label="Sending to">
              {selectedRecipients.map((recipient) => (
                <button key={recipient.id} type="button" className="pq-chip" aria-pressed="true" onClick={() => toggleRecipient(recipient)} aria-label={`Remove ${recipient.display_name || recipient.username}`}>
                  <Avatar src={recipient.avatar_url} alt="" size={18} />
                  {recipient.display_name || recipient.username}
                  <span className="pq-chip__remove" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </span>
                </button>
              ))}
            </div>
          )}
          {loading ? (
            <div className="pq-discussion__state" role="status" aria-label="Loading"><Spinner size="md" /></div>
          ) : displayList.length === 0 ? (
            <p className="pq-discussion__state">{searchQuery.trim() ? "No one by that name." : "People you've messaged show up here."}</p>
          ) : (
            <div>
              {!searchQuery.trim() && <p className="pq-msgs__section">Recent</p>}
              <div className="pq-list">
                {displayList.map((recipient) => {
                  const isSelected = selectedRecipients.some((r) => r.id === recipient.id);
                  return (
                    <PersonRow
                      key={recipient.id}
                      person={recipient}
                      trailing={
                        <Button variant={isSelected ? "primary" : "secondary"} size="sm" onClick={() => toggleRecipient(recipient)} aria-pressed={isSelected}>
                          {isSelected ? "Chosen" : "Choose"}
                        </Button>
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <input
              type="text"
              className="pq-field"
              value={optionalMessage}
              onChange={(e) => setOptionalMessage(e.target.value)}
              placeholder="Add a note (optional)"
              aria-label="Note"
            />
          </div>
        </>
      )}
    </Sheet>
  );
}
