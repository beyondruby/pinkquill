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

function SectionCard({
  title,
  children,
  showMoreHref,
  showMoreLabel = "Show more"
}: {
  title: string;
  children: React.ReactNode;
  showMoreHref?: string;
  showMoreLabel?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
      <div className="px-4 py-3">
        <h2 className="font-display text-base font-bold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
          {title}
        </h2>
      </div>
      <div className="border-t border-black/[0.04]">
        {children}
      </div>
      {showMoreHref && (
        <Link
          href={showMoreHref}
          className="block px-4 py-2.5 text-sm font-ui font-medium text-purple-primary hover:bg-purple-primary/5 transition-colors border-t border-black/[0.04]"
        >
          {showMoreLabel}
        </Link>
      )}
    </div>
  );
}

function TrendingSection() {
  const { tags, loading } = useTrendingTags(5);

  if (loading) {
    return (
      <SectionCard title="Trending">
        <div className="divide-y divide-black/[0.04]">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-4 py-3 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-20 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-28" />
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  if (tags.length === 0) return null;

  return (
    <SectionCard title="Trending" showMoreHref="/explore">
      <div className="divide-y divide-black/[0.04]">
        {tags.map((tag, index) => (
          <Link
            key={tag.name}
            href={`/tag/${encodeURIComponent(tag.name)}`}
            className="block px-4 py-3 hover:bg-gradient-to-r hover:from-purple-primary/5 hover:to-pink-vivid/5 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-ui font-semibold text-ink text-[0.9rem] group-hover:text-purple-primary transition-colors">
                  #{tag.name}
                </p>
                <p className="text-xs text-muted font-body mt-0.5">
                  {tag.post_count.toLocaleString()} posts
                </p>
              </div>
              <span className="text-xs font-ui text-muted/60">
                #{index + 1}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </SectionCard>
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
          .limit(3);

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
      <SectionCard title="Creators to follow">
        <div className="divide-y divide-black/[0.04]">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-100" />
              <div className="flex-1">
                <div className="h-4 bg-gray-100 rounded w-24 mb-1" />
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
              <div className="h-8 w-16 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  if (suggestedUsers.length === 0) return null;

  return (
    <SectionCard title="Creators to follow" showMoreHref="/explore" showMoreLabel="Discover more">
      <div className="divide-y divide-black/[0.04]">
        {suggestedUsers.map((suggestedUser) => {
          const isFollowing = followingIds.has(suggestedUser.id);
          return (
            <div
              key={suggestedUser.id}
              className="px-4 py-3 flex items-center gap-3"
            >
              <Link href={`/studio/${suggestedUser.username}`} className="flex-shrink-0">
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-orange-warm via-pink-vivid to-purple-primary rounded-full opacity-0 hover:opacity-100 transition-opacity" />
                  <img
                    src={suggestedUser.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80"}
                    alt=""
                    className="relative w-10 h-10 rounded-full object-cover border-2 border-white"
                  />
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/studio/${suggestedUser.username}`}>
                  <p className="font-ui font-semibold text-ink text-sm truncate hover:text-purple-primary transition-colors">
                    {suggestedUser.display_name || suggestedUser.username}
                  </p>
                  <p className="text-muted text-xs font-body truncate">
                    @{suggestedUser.username}
                  </p>
                </Link>
              </div>
              {user && user.id !== suggestedUser.id && (
                <button
                  onClick={() => handleFollow(suggestedUser.id)}
                  className={`px-3 py-1.5 rounded-full font-ui text-xs font-semibold transition-all ${
                    isFollowing
                      ? "bg-white border border-black/10 text-ink hover:border-red-300 hover:text-red-500"
                      : "bg-gradient-to-r from-purple-primary to-pink-vivid text-white hover:shadow-md hover:shadow-pink-vivid/20"
                  }`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function CommunitiesSection() {
  const { trending, loading } = useDiscoverCommunities({ limit: 3 });

  if (loading) {
    return (
      <SectionCard title="Communities">
        <div className="divide-y divide-black/[0.04]">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-gray-100" />
              <div className="flex-1">
                <div className="h-4 bg-gray-100 rounded w-24 mb-1" />
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  if (trending.length === 0) return null;

  return (
    <SectionCard title="Communities" showMoreHref="/community" showMoreLabel="Explore communities">
      <div className="divide-y divide-black/[0.04]">
        {trending.map((community) => (
          <Link
            key={community.id}
            href={`/community/${community.slug}`}
            className="px-4 py-3 flex items-center gap-3 hover:bg-gradient-to-r hover:from-purple-primary/5 hover:to-pink-vivid/5 transition-colors group"
          >
            {community.avatar_url ? (
              <img
                src={community.avatar_url}
                alt=""
                className="w-10 h-10 rounded-xl object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                <span className="font-ui text-sm font-bold text-white">
                  {community.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-ui font-semibold text-ink text-sm truncate group-hover:text-purple-primary transition-colors">
                {community.name}
              </p>
              <p className="text-muted text-xs font-body">
                {(community.member_count || 0).toLocaleString()} members
              </p>
            </div>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}

export default function RightSidebar() {
  return (
    <aside className="hidden lg:block fixed right-0 top-0 bottom-0 w-[280px] border-l border-black/[0.04] overflow-y-auto bg-gray-50/50">
      <div className="p-4 space-y-4">
        {/* Trending */}
        <TrendingSection />

        {/* Who to Follow */}
        <WhoToFollowSection />

        {/* Communities */}
        <CommunitiesSection />

        {/* Footer */}
        <nav className="px-1 pt-2">
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-[0.7rem] text-muted/70 font-body">
            <Link href="/terms" className="hover:text-purple-primary transition-colors">Terms</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-purple-primary transition-colors">Privacy</Link>
            <span>·</span>
            <Link href="/community-guidelines" className="hover:text-purple-primary transition-colors">Guidelines</Link>
            <span>·</span>
            <Link href="/marketplace-guidelines" className="hover:text-purple-primary transition-colors">Marketplace</Link>
            <span>·</span>
            <Link href="/about" className="hover:text-purple-primary transition-colors">About</Link>
            <span>·</span>
            <Link href="/help" className="hover:text-purple-primary transition-colors">Help</Link>
          </div>
          <p className="text-[0.65rem] text-muted/50 font-body mt-2">
            © 2025 PinkQuill
          </p>
        </nav>
      </div>
    </aside>
  );
}
