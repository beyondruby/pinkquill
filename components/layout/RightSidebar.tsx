"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTrendingTags, useDiscoverCommunities } from "@/lib/hooks";

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
  community: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
};

function TrendingTagsSection() {
  const { tags, loading } = useTrendingTags(8);

  if (loading) {
    return (
      <div className="mb-8">
        <h3 className="font-ui text-[0.7rem] font-semibold tracking-[0.12em] uppercase text-muted mb-4 pl-1">
          Trending Topics
        </h3>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-gray-100" />
              <div className="flex-1">
                <div className="h-3.5 bg-gray-100 rounded w-20 mb-1" />
                <div className="h-2.5 bg-gray-100 rounded w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="mb-8">
        <h3 className="font-ui text-[0.7rem] font-semibold tracking-[0.12em] uppercase text-muted mb-4 pl-1">
          Trending Topics
        </h3>
        <p className="font-body text-[0.85rem] text-muted italic pl-1">
          No trending topics yet
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="font-ui text-[0.7rem] font-semibold tracking-[0.12em] uppercase text-muted mb-4 pl-1">
        Trending Topics
      </h3>
      <div className="space-y-1">
        {tags.map((tag, index) => (
          <Link
            key={tag.name}
            href={`/tag/${encodeURIComponent(tag.name)}`}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-purple-primary/5 transition-all group"
          >
            {/* Rank Badge */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-ui text-sm font-semibold ${
              index === 0
                ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white"
                : index === 1
                ? "bg-purple-primary/20 text-purple-primary"
                : index === 2
                ? "bg-purple-primary/10 text-purple-primary/80"
                : "bg-black/[0.04] text-muted"
            }`}>
              {index + 1}
            </div>

            {/* Tag Info */}
            <div className="flex-1 min-w-0">
              <div className="font-ui text-[0.9rem] font-medium text-ink truncate group-hover:text-purple-primary transition-colors">
                #{tag.name}
              </div>
              <div className="font-body text-[0.7rem] text-muted">
                {tag.post_count} {tag.post_count === 1 ? "post" : "posts"}
                {tag.recent_posts > 0 && (
                  <span className="text-purple-primary ml-1">
                    +{tag.recent_posts} this week
                  </span>
                )}
              </div>
            </div>

            {/* Arrow */}
            <svg className="w-4 h-4 text-muted/40 group-hover:text-purple-primary group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>

      <Link
        href="/explore"
        className="block mt-4 text-center font-ui text-[0.85rem] text-purple-primary hover:text-pink-vivid transition-colors"
      >
        Explore all topics
      </Link>
    </div>
  );
}

function DiscoverCommunitiesSection() {
  const { trending, loading } = useDiscoverCommunities({ limit: 5 });

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4 pl-1">
          <span className="text-purple-primary">{icons.community}</span>
          <h3 className="font-ui text-[0.7rem] font-semibold tracking-[0.12em] uppercase text-muted">
            Discover Communities
          </h3>
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-gray-100" />
              <div className="flex-1">
                <div className="h-3.5 bg-gray-100 rounded w-24 mb-1" />
                <div className="h-2.5 bg-gray-100 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (trending.length === 0) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4 pl-1">
          <span className="text-purple-primary">{icons.community}</span>
          <h3 className="font-ui text-[0.7rem] font-semibold tracking-[0.12em] uppercase text-muted">
            Discover Communities
          </h3>
        </div>
        <div className="text-center py-6">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-black/[0.03] flex items-center justify-center">
            {icons.community}
          </div>
          <p className="font-body text-[0.85rem] text-muted">
            No communities yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 pl-1">
        <span className="text-purple-primary">{icons.community}</span>
        <h3 className="font-ui text-[0.7rem] font-semibold tracking-[0.12em] uppercase text-muted">
          Discover Communities
        </h3>
      </div>
      <div className="space-y-1">
        {trending.slice(0, 4).map((community) => (
          <Link
            key={community.id}
            href={`/community/${community.slug}`}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-purple-primary/5 transition-all group"
          >
            {/* Community Avatar */}
            <div className="relative flex-shrink-0">
              {community.avatar_url ? (
                <img
                  src={community.avatar_url}
                  alt={community.name}
                  className="w-10 h-10 rounded-xl object-cover border border-black/[0.04]"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-primary/20 to-pink-vivid/20 flex items-center justify-center">
                  <span className="font-ui text-sm font-semibold text-purple-primary">
                    {community.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Community Info */}
            <div className="flex-1 min-w-0">
              <div className="font-ui text-[0.9rem] font-medium text-ink truncate group-hover:text-purple-primary transition-colors">
                {community.name}
              </div>
              <div className="font-body text-[0.7rem] text-muted">
                {community.member_count || 0} {(community.member_count || 0) === 1 ? "member" : "members"}
              </div>
            </div>

            {/* Arrow */}
            <svg className="w-4 h-4 text-muted/40 group-hover:text-purple-primary group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>

      <Link
        href="/community"
        className="block mt-4 text-center font-ui text-[0.85rem] text-purple-primary hover:text-pink-vivid transition-colors"
      >
        Explore all communities
      </Link>
    </div>
  );
}

function FollowButton({ userId, onFollow }: { userId: string; onFollow: () => void }) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkFollowing = async () => {
      if (!user) return;
      const { count } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", user.id)
        .eq("following_id", userId);
      setIsFollowing((count ?? 0) > 0);
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
          <div className="text-center py-6">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-black/[0.03] flex items-center justify-center">
              <svg className="w-5 h-5 text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="font-body text-[0.85rem] text-muted">
              {user ? "No suggested creators" : "Sign in to see suggestions"}
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
      <TrendingTagsSection />

      {/* Discover Communities */}
      <DiscoverCommunitiesSection />

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