"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useFollowList, FollowUser } from "@/lib/hooks";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: "followers" | "following";
  isOwnProfile: boolean;
}

const icons = {
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  verified: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </svg>
  ),
};

function UserCard({
  user,
  isOwnProfile,
  currentUserId,
  onUnfollow
}: {
  user: FollowUser;
  isOwnProfile: boolean;
  currentUserId?: string;
  onUnfollow: (userId: string) => void;
}) {
  const [unfollowLoading, setUnfollowLoading] = useState(false);

  const handleUnfollow = async () => {
    if (!currentUserId) return;
    setUnfollowLoading(true);
    try {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", user.id);
      onUnfollow(user.id);
    } catch (err) {
      console.error("Failed to unfollow:", err);
    } finally {
      setUnfollowLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-black/[0.02] rounded-xl transition-all">
      <Link href={`/studio/${user.username}`} className="flex-shrink-0">
        <img
          src={user.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"}
          alt={user.display_name || user.username}
          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/studio/${user.username}`} className="block">
          <div className="flex items-center gap-2">
            <span className="font-ui text-[0.95rem] font-medium text-ink truncate">
              {user.display_name || user.username}
            </span>
            {user.is_verified && (
              <span className="w-4 h-4 bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full flex items-center justify-center text-white flex-shrink-0">
                {icons.verified}
              </span>
            )}
          </div>
          <span className="font-ui text-[0.85rem] text-muted block">
            @{user.username}
          </span>
        </Link>
        {user.bio && (
          <p className="font-body text-[0.85rem] text-muted/80 mt-1 line-clamp-1">
            {user.bio}
          </p>
        )}
      </div>

      {isOwnProfile && (
        <button
          onClick={handleUnfollow}
          disabled={unfollowLoading}
          className="px-4 py-2 rounded-full border border-black/10 bg-white font-ui text-[0.85rem] text-muted hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
        >
          {unfollowLoading ? "..." : "Unfollow"}
        </button>
      )}
    </div>
  );
}

export default function FollowersModal({
  isOpen,
  onClose,
  userId,
  type,
  isOwnProfile,
}: FollowersModalProps) {
  const { user } = useAuth();
  const { users, loading } = useFollowList(userId, type);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  // Reset removed IDs when modal closes or type changes
  useEffect(() => {
    if (!isOpen) {
      setRemovedIds(new Set());
    }
  }, [isOpen]);

  const handleUnfollow = (unfollowedUserId: string) => {
    setRemovedIds((prev) => new Set([...prev, unfollowedUserId]));
  };

  if (!isOpen) return null;

  const displayUsers = users.filter((u) => !removedIds.has(u.id));

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex justify-center items-center animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-[95%] max-w-[480px] max-h-[70vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-black/[0.06]">
          <h2 className="font-display text-[1.3rem] text-ink capitalize">
            {type}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/[0.04] flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.08] transition-all hover:rotate-90"
          >
            {icons.close}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-purple-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayUsers.length === 0 ? (
            <div className="text-center py-12 px-6">
              <p className="font-body text-muted italic">
                {type === "followers"
                  ? "No followers yet"
                  : "Not following anyone yet"}
              </p>
            </div>
          ) : (
            <div className="p-2">
              {displayUsers.map((followUser) => (
                <UserCard
                  key={followUser.id}
                  user={followUser}
                  isOwnProfile={isOwnProfile && type === "following"}
                  currentUserId={user?.id}
                  onUnfollow={handleUnfollow}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
