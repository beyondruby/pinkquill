"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

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

const icons = {
  back: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  search: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  message: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  spinner: (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
};

export default function NewMessageModal({
  isOpen,
  onClose,
  onConversationCreated,
  currentUserId,
}: NewMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Search users
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
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
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
          .limit(10);

        if (searchError) {
          console.error("Search error:", searchError);
          setError("Failed to search users");
          return;
        }

        setUsers(data || []);
      } catch (err) {
        console.error("Failed to search users:", err);
        setError("Failed to search users");
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, currentUserId]);

  const handleSelectUser = async (selectedUser: User) => {
    if (creating) return; // Prevent double-clicks

    setCreating(true);
    setSelectedUserId(selectedUser.id);
    setError(null);

    try {
      // First, try to find an existing conversation between these two users
      // Using a simpler approach: query conversations where both users are participants
      const { data: myConversations, error: fetchError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      // If fetch fails, just proceed to create a new conversation
      // This handles the case where user has no conversations yet
      if (!fetchError && myConversations && myConversations.length > 0) {
        // Check if selected user is in any of these conversations
        const conversationIds = myConversations.map(c => c.conversation_id);

        const { data: sharedConversation } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", selectedUser.id)
          .in("conversation_id", conversationIds)
          .limit(1)
          .single();

        if (sharedConversation) {
          // Found existing conversation
          onConversationCreated(sharedConversation.conversation_id);
          return;
        }
      }

      // Create new conversation
      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({})
        .select("id")
        .single();

      if (convError) {
        console.error("Conversation creation error:", convError);
        throw new Error(`Failed to create conversation: ${convError.message}`);
      }

      if (!newConversation) {
        throw new Error("No conversation returned after insert");
      }

      // Add current user as participant first
      const { error: myParticipantError } = await supabase
        .from("conversation_participants")
        .insert({ conversation_id: newConversation.id, user_id: currentUserId });

      if (myParticipantError) {
        console.error("My participant error:", myParticipantError);
        await supabase.from("conversations").delete().eq("id", newConversation.id);
        throw new Error(`Failed to join conversation: ${myParticipantError.message}`);
      }

      // Add selected user as participant
      const { error: otherParticipantError } = await supabase
        .from("conversation_participants")
        .insert({ conversation_id: newConversation.id, user_id: selectedUser.id });

      if (otherParticipantError) {
        console.error("Other participant error:", otherParticipantError);
        await supabase.from("conversations").delete().eq("id", newConversation.id);
        throw new Error(`Failed to add participant: ${otherParticipantError.message}`);
      }

      onConversationCreated(newConversation.id);
    } catch (err: any) {
      console.error("Failed to create conversation:", err);
      setError(err?.message || "Failed to create conversation. Please try again.");
      setCreating(false);
      setSelectedUserId(null);
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setUsers([]);
      setError(null);
      setCreating(false);
      setSelectedUserId(null);
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !creating) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, creating]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
        onClick={() => !creating && onClose()}
      />

      {/* Modal Container */}
      <div
        className="fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
                   w-full h-full md:w-[480px] md:h-auto md:max-h-[600px]
                   bg-white md:rounded-2xl shadow-2xl z-[1001]
                   flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 md:p-5 border-b border-black/[0.06] bg-white"
          style={{ paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}
        >
          {/* Mobile back button */}
          <button
            onClick={() => !creating && onClose()}
            disabled={creating}
            className="md:hidden w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.04] transition-all disabled:opacity-50"
          >
            {icons.back}
          </button>

          <h2 className="flex-1 font-display text-[1.1rem] md:text-[1.3rem] text-ink">
            New Message
          </h2>

          {/* Desktop close button */}
          <button
            onClick={() => !creating && onClose()}
            disabled={creating}
            className="hidden md:flex w-10 h-10 rounded-full bg-black/[0.04] items-center justify-center text-muted hover:text-ink hover:bg-black/[0.08] transition-all hover:rotate-90 disabled:opacity-50"
          >
            {icons.close}
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-black/[0.06]">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              {icons.search}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for someone..."
              disabled={creating}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-black/[0.08] bg-[#fafafa] font-ui text-[0.95rem] text-ink outline-none focus:border-purple-primary focus:bg-white focus:ring-2 focus:ring-purple-primary/20 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="font-ui text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Results */}
        <div
          className="flex-1 overflow-y-auto p-4"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-purple-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              {searchQuery ? (
                <p className="font-body text-muted">No users found</p>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-primary/10 flex items-center justify-center text-purple-primary">
                    {icons.message}
                  </div>
                  <p className="font-body text-muted">
                    Search for someone to start a conversation
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => {
                const isSelected = selectedUserId === user.id;
                const isDisabled = creating && !isSelected;

                return (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    disabled={creating}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left group ${
                      isSelected
                        ? 'bg-purple-primary/10 ring-2 ring-purple-primary'
                        : 'hover:bg-purple-primary/5 active:bg-purple-primary/10'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <img
                      src={
                        user.avatar_url ||
                        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"
                      }
                      alt={user.display_name || user.username}
                      className={`w-12 h-12 rounded-full object-cover transition-all ${
                        isSelected ? 'ring-2 ring-purple-primary' : 'group-hover:ring-2 group-hover:ring-purple-primary/30'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-ui text-[0.95rem] font-medium truncate transition-colors ${
                        isSelected ? 'text-purple-primary' : 'text-ink group-hover:text-purple-primary'
                      }`}>
                        {user.display_name || user.username}
                      </h3>
                      <p className="font-ui text-[0.85rem] text-muted truncate">
                        @{user.username}
                      </p>
                    </div>
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-purple-primary to-pink-vivid text-white'
                        : 'bg-gradient-to-r from-purple-primary to-pink-vivid text-white opacity-0 group-hover:opacity-100'
                    }`}>
                      {isSelected && creating ? icons.spinner : icons.message}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
