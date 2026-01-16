"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Loading from "@/components/ui/Loading";

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

  // Search users
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setUsers([]);
        return;
      }

      setLoading(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .neq("id", currentUserId)
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
          .limit(10);

        setUsers(data || []);
      } catch (err) {
        console.error("Failed to search users:", err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, currentUserId]);

  const handleSelectUser = async (selectedUser: User) => {
    setCreating(true);

    try {
      // Check if conversation already exists
      const { data: existingParticipations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      if (existingParticipations) {
        for (const participation of existingParticipations) {
          const { data: otherParticipant } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", participation.conversation_id)
            .eq("user_id", selectedUser.id)
            .single();

          if (otherParticipant) {
            // Conversation exists, use it
            onConversationCreated(participation.conversation_id);
            return;
          }
        }
      }

      // Create new conversation
      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({})
        .select()
        .single();

      if (convError) {
        console.error("Conversation creation error:", convError.message, convError.details, convError.hint);
        throw convError;
      }

      if (!newConversation) {
        throw new Error("No conversation returned after insert");
      }

      // Add participants
      const { error: participantsError } = await supabase
        .from("conversation_participants")
        .insert([
          { conversation_id: newConversation.id, user_id: currentUserId },
          { conversation_id: newConversation.id, user_id: selectedUser.id },
        ]);

      if (participantsError) {
        console.error("Participants error:", participantsError.message, participantsError.details);
        throw participantsError;
      }

      onConversationCreated(newConversation.id);
    } catch (err: any) {
      console.error("Failed to create conversation:", err?.message || err);
    } finally {
      setCreating(false);
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setUsers([]);
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
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
        onClick={onClose}
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
            onClick={onClose}
            className="md:hidden w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.04] transition-all"
          >
            {icons.back}
          </button>

          <h2 className="flex-1 font-display text-[1.1rem] md:text-[1.3rem] text-ink">
            New Message
          </h2>

          {/* Desktop close button */}
          <button
            onClick={onClose}
            className="hidden md:flex w-10 h-10 rounded-full bg-black/[0.04] items-center justify-center text-muted hover:text-ink hover:bg-black/[0.08] transition-all hover:rotate-90"
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
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for someone..."
              autoFocus
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-black/[0.08] bg-[#fafafa] font-ui text-[0.95rem] text-ink outline-none focus:border-purple-primary focus:bg-white focus:ring-2 focus:ring-purple-primary/20 transition-all"
            />
          </div>
        </div>

        {/* Results */}
        <div
          className="flex-1 overflow-y-auto p-4"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loading text="" size="small" />
            </div>
          ) : creating ? (
            <div className="flex items-center justify-center py-8">
              <Loading text="Creating conversation" size="small" />
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
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-purple-primary/5 active:bg-purple-primary/10 transition-all text-left group"
                >
                  <img
                    src={
                      user.avatar_url ||
                      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"
                    }
                    alt={user.display_name || user.username}
                    className="w-12 h-12 rounded-full object-cover group-hover:ring-2 group-hover:ring-purple-primary/30 transition-all"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-ui text-[0.95rem] font-medium text-ink group-hover:text-purple-primary transition-colors truncate">
                      {user.display_name || user.username}
                    </h3>
                    <p className="font-ui text-[0.85rem] text-muted truncate">
                      @{user.username}
                    </p>
                  </div>
                  <span className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    {icons.message}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
