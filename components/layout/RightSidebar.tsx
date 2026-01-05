"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

interface SuggestedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  tagline: string | null;
  followers_count: number;
}

const icons = {
  userPlus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  sparkles: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
};

function FollowButton({ userId, onFollow }: { userId: string; onFollow: () => void }) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkFollowing = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", userId)
        .single();
      setIsFollowing(!!data);
    };
    checkFollowing();
  }, [user, userId]);

  const handleFollow = async () => {
    if (!user) return;
    setLoading(true);

    try {
      if (isFollowing) {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", userId);
      } else {
        await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: userId,
        });
      }
      setIsFollowing(!isFollowing);
      onFollow();
    } catch (err) {
      console.error("Failed to follow:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.id === userId) return null;

  return (
    <button
      onClick={handleFollow}
      disabled={loading}
      className={`px-3.5 py-1.5 rounded-full font-ui text-[0.75rem] font-medium transition-all flex items-center gap-1 ${
        isFollowing
          ? "bg-purple-primary text-white"
          : "border-[1.5px] border-purple-primary text-purple-primary hover:bg-purple-primary hover:text-white"
      } disabled:opacity-50`}
    >
      {loading ? (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : isFollowing ? (
        icons.check
      ) : (
        icons.userPlus
      )}
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

export default function RightSidebar() {
  const { user } = useAuth();
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggestedUsers = async () => {
    try {
      setLoading(true);
      
      // Get users that the current user is not following
      let query = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, tagline")
        .limit(5);

      if (user) {
        // Get IDs of users already following
        const { data: followingData } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);

        const followingIds = followingData?.map((f) => f.following_id) || [];
        followingIds.push(user.id); // Exclude self

        if (followingIds.length > 0) {
          query = query.not("id", "in", `(${followingIds.join(",")})`);
        }
      }

      const { data: users } = await query;

      // Get follower counts for each user
      const usersWithCounts = await Promise.all(
        (users || []).map(async (u) => {
          const { count } = await supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", u.id);
          return { ...u, followers_count: count || 0 };
        })
      );

      // Sort by followers count
      usersWithCounts.sort((a, b) => b.followers_count - a.followers_count);

      setSuggestedUsers(usersWithCounts);
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestedUsers();
  }, [user]);

  return (
    <aside className="fixed right-0 top-0 bottom-0 w-[280px] bg-white/60 backdrop-blur-md border-l border-black/[0.04] flex flex-col p-6 overflow-y-auto z-[100]">
      {/* Suggested Users */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4 pl-1">
          <span className="text-purple-primary">{icons.sparkles}</span>
          <h3 className="font-ui text-[0.7rem] font-semibold tracking-[0.12em] uppercase text-muted">
            Discover Creators
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : suggestedUsers.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-body text-[0.85rem] text-muted italic">
              {user ? "You're following everyone!" : "Sign in to see suggestions"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {suggestedUsers.map((suggestedUser) => (
              <div
                key={suggestedUser.id}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-purple-primary/5 transition-all group"
              >
                <Link href={`/studio/${suggestedUser.username}`} className="flex-shrink-0">
                  <img
                    src={suggestedUser.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"}
                    alt={suggestedUser.display_name || suggestedUser.username}
                    className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm group-hover:border-purple-primary/30 transition-all"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/studio/${suggestedUser.username}`}>
                    <div className="font-ui text-[0.9rem] font-medium text-ink truncate group-hover:text-purple-primary transition-colors">
                      {suggestedUser.display_name || suggestedUser.username}
                    </div>
                    <div className="font-body text-[0.75rem] text-muted truncate">
                      {suggestedUser.followers_count} followers
                    </div>
                  </Link>
                </div>
                <FollowButton userId={suggestedUser.id} onFollow={fetchSuggestedUsers} />
              </div>
            ))}
          </div>
        )}

        {suggestedUsers.length > 0 && (
          <Link
            href="/explore"
            className="block mt-4 text-center font-ui text-[0.85rem] text-purple-primary hover:text-pink-vivid transition-colors"
          >
            See more creators
          </Link>
        )}
      </div>

      {/* Trending Tags */}
      <div className="mb-8">
        <h3 className="font-ui text-[0.7rem] font-semibold tracking-[0.12em] uppercase text-muted mb-4 pl-1">
          Trending Topics
        </h3>
        <div className="flex flex-wrap gap-2">
          {["poetry", "art", "thoughts", "creativity", "writing"].map((tag) => (
            <span
              key={tag}
              className="px-3 py-1.5 rounded-full bg-purple-primary/10 text-purple-primary font-ui text-[0.8rem] cursor-pointer hover:bg-purple-primary hover:text-white transition-all"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6 border-t border-black/[0.06]">
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
          <Link href="/about" className="font-ui text-[0.75rem] text-muted hover:text-purple-primary transition-colors">
            About
          </Link>
          <Link href="/privacy" className="font-ui text-[0.75rem] text-muted hover:text-purple-primary transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="font-ui text-[0.75rem] text-muted hover:text-purple-primary transition-colors">
            Terms
          </Link>
          <Link href="/help" className="font-ui text-[0.75rem] text-muted hover:text-purple-primary transition-colors">
            Help
          </Link>
        </div>
        <p className="font-ui text-[0.7rem] text-muted/50">
          © 2025 PinkQuill. All rights reserved.
        </p>
      </div>
    </aside>
  );
}