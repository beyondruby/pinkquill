"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getOrCreateConversation } from "@/lib/messaging/conversations";
import { sanitizePostgrestSearchTerm } from "@/lib/utils/postgrest";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Loading";
import { PersonRow } from "@/components/communities/pieces";
import { Notice } from "@/components/communities/pieces";
import "@/components/create/composer.css";

interface User {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
  currentUserId: string;
}

/** Find a person and open (or resume) the conversation with them. */
export default function NewMessageModal({ isOpen, onClose, onConversationCreated, currentUserId }: NewMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setUsers([]);
        return;
      }
      const sanitizedQuery = sanitizePostgrestSearchTerm(searchQuery);
      if (!sanitizedQuery) {
        setUsers([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error: searchError } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .neq("id", currentUserId)
          .or(`username.ilike.%${sanitizedQuery}%,display_name.ilike.%${sanitizedQuery}%`)
          .limit(10);
        if (searchError) {
          console.error("Search error:", searchError);
          setError("Search didn't work. Try again.");
          return;
        }
        setUsers(data || []);
      } catch (err) {
        console.error("Failed to search users:", err);
        setError("Search didn't work. Try again.");
      } finally {
        setLoading(false);
      }
    };
    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, currentUserId]);

  const handleSelectUser = async (selectedUser: User) => {
    if (creating) return;
    setCreating(true);
    setSelectedUserId(selectedUser.id);
    setError(null);
    try {
      const conversationId = await getOrCreateConversation(selectedUser.id);
      onConversationCreated(conversationId);
    } catch (err: unknown) {
      console.error("Failed to create conversation:", err);
      setError(err instanceof Error ? err.message : "That conversation couldn't be opened. Try again.");
      setCreating(false);
      setSelectedUserId(null);
    }
  };

  // Start clean each time the sheet closes.
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setUsers([]);
      setError(null);
      setCreating(false);
      setSelectedUserId(null);
    }
  }, [isOpen]);

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="New message" subtitle="Find someone to write to." busy={creating} size="tall" initialFocus={() => inputRef.current}>
      <input
        ref={inputRef}
        type="search"
        className="pq-field pq-field--ui"
        placeholder="Search by name or handle"
        aria-label="Search people"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        disabled={creating}
      />
      {error && <Notice tone="danger">{error}</Notice>}
      {loading ? (
        <div className="pq-discussion__state" role="status" aria-label="Searching"><Spinner size="md" /></div>
      ) : users.length === 0 ? (
        <p className="pq-discussion__state">{searchQuery ? "No one by that name." : "Type a name or a handle."}</p>
      ) : (
        <div className="pq-list">
          {users.map((user) => (
            <PersonRow
              key={user.id}
              person={user}
              trailing={
                <Button variant="secondary" size="sm" onClick={() => handleSelectUser(user)} disabled={creating && selectedUserId !== user.id} loading={creating && selectedUserId === user.id} loadingText="Opening…">
                  Message
                </Button>
              }
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
