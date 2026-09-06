"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCommunityModeration } from "@/lib/hooks.legacy";
import { sanitizePostgrestSearchTerm } from "@/lib/utils/postgrest";
import { actionToast } from "@/lib/utils/toast";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Loading";
import { PersonRow } from "./pieces";

interface User {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  communityName: string;
  inviterId: string;
  existingMemberIds: string[];
}

/** Find people and invite them, one at a time, on the shared Sheet. */
export default function InviteModal({ isOpen, onClose, communityId, communityName, inviterId, existingMemberIds }: InviteModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());
  const { inviteUser } = useCommunityModeration(communityId);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      const sanitizedQuery = sanitizePostgrestSearchTerm(searchQuery);
      if (!sanitizedQuery) {
        setSearchResults([]);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .or(`username.ilike.%${sanitizedQuery}%,display_name.ilike.%${sanitizedQuery}%`)
          .limit(10);
        if (error) throw error;
        setSearchResults((data || []).filter((u) => !existingMemberIds.includes(u.id) && u.id !== inviterId));
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    };
    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, existingMemberIds, inviterId]);

  const handleInvite = async (userId: string) => {
    setInviting(userId);
    const target = searchResults.find((u) => u.id === userId);
    const result = await inviteUser(inviterId, userId);
    if (result.success) {
      setInvitedUsers((prev) => new Set(prev).add(userId));
      actionToast.invitationSent(target?.username);
    } else {
      actionToast.membershipError(typeof result.error === "string" ? result.error : undefined);
    }
    setInviting(null);
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={`Invite people to ${communityName}`} subtitle="They get a notification and can accept or decline." size="tall">
      <input
        type="search"
        className="pq-field pq-field--ui"
        placeholder="Search by name or handle"
        aria-label="Search people"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {loading ? (
        <div className="pq-discussion__state" role="status" aria-label="Searching"><Spinner size="md" /></div>
      ) : searchQuery.length < 2 ? (
        <p className="pq-discussion__state">Type at least two letters.</p>
      ) : searchResults.length === 0 ? (
        <p className="pq-discussion__state">No one by that name who isn&rsquo;t already here.</p>
      ) : (
        <div className="pq-list">
          {searchResults.map((user) => (
            <PersonRow
              key={user.id}
              person={user}
              trailing={
                invitedUsers.has(user.id) ? (
                  <span className="pq-person__word">Invited</span>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => handleInvite(user.id)} loading={inviting === user.id} loadingText="Inviting…">
                    Invite
                  </Button>
                )
              }
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
