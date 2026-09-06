"use client";

import { useState } from "react";
import { useFollowList } from "@/lib/hooks/useProfile";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Loading";
import { PersonRow } from "@/components/communities/pieces";

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: "followers" | "following";
  isOwnProfile: boolean;
}

function UnfollowButton({ userId, onDone }: { userId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const unfollow = async () => {
    if (!user?.id) return;
    setBusy(true);
    try {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
      onDone();
    } catch (err) {
      console.error("Failed to unfollow:", err);
    } finally {
      setBusy(false);
    }
  };
  return <Button variant="ghost" size="sm" onClick={unfollow} loading={busy} loadingText="Unfollowing…">Unfollow</Button>;
}

function FollowList({ userId, type, canUnfollow, onClose }: { userId: string; type: "followers" | "following"; canUnfollow: boolean; onClose: () => void }) {
  const { users, loading, hasMore, loadMore } = useFollowList(userId, type);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const shown = users.filter((u) => !removed.has(u.id));

  if (loading && users.length === 0) {
    return <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>;
  }
  if (shown.length === 0) {
    return (
      <div className="pq-feed-state">
        <p className="pq-feed-state__title">{type === "followers" ? "No followers yet" : "Not following anyone yet"}</p>
      </div>
    );
  }
  return (
    <div
      className="pq-list"
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest("a")) onClose();
      }}
    >
      {shown.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          meta={person.bio || undefined}
          trailing={canUnfollow ? <UnfollowButton userId={person.id} onDone={() => setRemoved((prev) => new Set([...prev, person.id]))} /> : undefined}
        />
      ))}
      {hasMore && (
        <div className="flex justify-center p-3">
          <Button variant="secondary" size="sm" onClick={loadMore} loading={loading} loadingText="Loading…">Show more</Button>
        </div>
      )}
    </div>
  );
}

/** Followers or following as a sheet of people; the owner can unfollow from the following list. */
export default function FollowersModal({ isOpen, onClose, userId, type, isOwnProfile }: FollowersModalProps) {
  if (!isOpen) return null;
  return (
    <Sheet isOpen onClose={onClose} title={type === "followers" ? "Followers" : "Following"} bodyClassName="pq-dialog__body--flush">
      <FollowList key={type} userId={userId} type={type} canUnfollow={isOwnProfile && type === "following"} onClose={onClose} />
    </Sheet>
  );
}
