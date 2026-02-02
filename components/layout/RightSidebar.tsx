"use client";

import { useState, useEffect, useRef } from "react";
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

function TrendingSection() {
  const { tags, loading } = useTrendingTags(5);

  if (loading) {
    return (
      <div className="bg-gray-50/80 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.04]">
          <h2 className="font-display text-lg font-bold text-ink">Trends for you</h2>
        </div>
        <div className="divide-y divide-black/[0.04]">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-4 py-3 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tags.length === 0) return null;

  return (
    <div className="bg-gray-50/80 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-black/[0.04]">
        <h2 className="font-display text-lg font-bold text-ink">Trends for you</h2>
      </div>
      <div className="divide-y divide-black/[0.04]">
        {tags.map((tag, index) => (
          <Link
            key={tag.name}
            href={`/tag/${encodeURIComponent(tag.name)}`}
            className="block px-4 py-3 hover:bg-black/[0.03] transition-colors"
          >
            <p className="text-xs text-muted font-body">
              {index + 1} · Trending
            </p>
            <p className="font-ui font-semibold text-ink text-[0.95rem] mt-0.5">
              #{tag.name}
            </p>
            <p className="text-xs text-muted font-body mt-0.5">
              {tag.post_count.toLocaleString()} posts
            </p>
          </Link>
        ))}
      </div>
      <Link
        href="/explore"
        className="block px-4 py-3 text-pink-vivid font-ui text-[0.9rem] hover:bg-black/[0.03] transition-colors"
      >
        Show more
      </Link>
    </div>
  );
}

function WhoToFollowSection() {
  const { user } = useAuth();
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) return;

    const fetchSuggestedUsers = async () => {
      try {
        setLoading(true);

        let query = supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, tagline")
          .limit(4);

        if (user) {
          const { data: followingData } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id);

          const ids = followingData?.map((f) => f.following_id) || [];
          ids.push(user.id);

          if (ids.length > 0) {
            query = query.not("id", "in", `(${ids.join(",")})`);
          }
        }

        const { data: users } = await query;

        const usersWithCounts = await Promise.all(
          (users || []).map(async (u) => {
            const { count } = await supabase
              .from("follows")
              .select("*", { count: "exact", head: true })
              .eq("following_id", u.id);
            return { ...u, followers_count: count || 0 };
          })
        );

        usersWithCounts.sort((a, b) => b.followers_count - a.followers_count);
        setSuggestedUsers(usersWithCounts);
        hasFetchedRef.current = true;
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestedUsers();
  }, [user?.id]);

  const handleFollow = async (userId: string) => {
    if (!user) return;

    const isFollowing = followingIds.has(userId);

    // Optimistic update
    setFollowingIds((prev) => {
      const newSet = new Set(prev);
      if (isFollowing) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });

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
    } catch (err) {
      // Revert on error
      setFollowingIds((prev) => {
        const newSet = new Set(prev);
        if (isFollowing) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50/80 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.04]">
          <h2 className="font-display text-lg font-bold text-ink">Who to follow</h2>
        </div>
        <div className="divide-y divide-black/[0.04]">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
                <div className="h-3 bg-gray-200 rounded w-16" />
              </div>
              <div className="h-8 w-20 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (suggestedUsers.length === 0) return null;

  return (
    <div className="bg-gray-50/80 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-black/[0.04]">
        <h2 className="font-display text-lg font-bold text-ink">Who to follow</h2>
      </div>
      <div className="divide-y divide-black/[0.04]">
        {suggestedUsers.map((suggestedUser) => {
          const isFollowing = followingIds.has(suggestedUser.id);
          return (
            <div
              key={suggestedUser.id}
              className="px-4 py-3 flex items-center gap-3 hover:bg-black/[0.03] transition-colors"
            >
              <Link href={`/studio/${suggestedUser.username}`} className="flex-shrink-0">
                <img
                  src={suggestedUser.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80"}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/studio/${suggestedUser.username}`}>
                  <p className="font-ui font-semibold text-ink text-[0.9rem] truncate hover:underline">
                    {suggestedUser.display_name || suggestedUser.username}
                  </p>
                  <p className="text-muted text-[0.8rem] font-body truncate">
                    @{suggestedUser.username}
                  </p>
                </Link>
              </div>
              {user && user.id !== suggestedUser.id && (
                <button
                  onClick={() => handleFollow(suggestedUser.id)}
                  className={`px-4 py-1.5 rounded-full font-ui text-sm font-bold transition-colors ${
                    isFollowing
                      ? "bg-transparent border border-gray-300 text-ink hover:border-red-300 hover:text-red-500"
                      : "bg-ink text-white hover:bg-ink/90"
                  }`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <Link
        href="/explore"
        className="block px-4 py-3 text-pink-vivid font-ui text-[0.9rem] hover:bg-black/[0.03] transition-colors"
      >
        Show more
      </Link>
    </div>
  );
}

function CommunitiesSection() {
  const { trending, loading } = useDiscoverCommunities({ limit: 3 });

  if (loading) {
    return (
      <div className="bg-gray-50/80 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.04]">
          <h2 className="font-display text-lg font-bold text-ink">Communities</h2>
        </div>
        <div className="divide-y divide-black/[0.04]">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
                <div className="h-3 bg-gray-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (trending.length === 0) return null;

  return (
    <div className="bg-gray-50/80 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-black/[0.04]">
        <h2 className="font-display text-lg font-bold text-ink">Communities</h2>
      </div>
      <div className="divide-y divide-black/[0.04]">
        {trending.map((community) => (
          <Link
            key={community.id}
            href={`/community/${community.slug}`}
            className="px-4 py-3 flex items-center gap-3 hover:bg-black/[0.03] transition-colors"
          >
            {community.avatar_url ? (
              <img
                src={community.avatar_url}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                <span className="font-ui text-sm font-bold text-white">
                  {community.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-ui font-semibold text-ink text-[0.9rem] truncate">
                {community.name}
              </p>
              <p className="text-muted text-[0.8rem] font-body">
                {(community.member_count || 0).toLocaleString()} members
              </p>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/community"
        className="block px-4 py-3 text-pink-vivid font-ui text-[0.9rem] hover:bg-black/[0.03] transition-colors"
      >
        Show more
      </Link>
    </div>
  );
}

export default function RightSidebar() {
  return (
    <aside className="hidden lg:block fixed right-0 top-0 bottom-0 w-[300px] border-l border-black/[0.04] overflow-y-auto z-[90]">
      <div className="p-4 space-y-4">
        {/* Trending */}
        <TrendingSection />

        {/* Who to Follow */}
        <WhoToFollowSection />

        {/* Communities */}
        <CommunitiesSection />

        {/* Footer */}
        <nav className="px-2 pt-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem] text-muted font-body">
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/about" className="hover:underline">About</Link>
            <Link href="/help" className="hover:underline">Help</Link>
          </div>
          <p className="text-[0.7rem] text-muted/60 font-body mt-2">
            © 2025 PinkQuill
          </p>
        </nav>
      </div>
    </aside>
  );
}
