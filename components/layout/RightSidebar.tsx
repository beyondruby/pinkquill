"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useDiscoverCommunities } from "@/lib/hooks.legacy";
import { useTrendingTags } from "@/lib/hooks/useTags";
import Button from "@/components/ui/Button";
import { DEFAULT_AVATAR } from "@/lib/utils/image";

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
    <section className="bg-surface rounded-card border border-line overflow-hidden" aria-label={title}>
      <div className="px-4 pt-3.5 pb-2.5">
        <h2 className="font-ui text-[0.9375rem] font-semibold text-ink">{title}</h2>
      </div>
      <div>{children}</div>
      {showMoreHref && (
        <Link
          href={showMoreHref}
          className="flex items-center min-h-11 px-4 text-sm font-ui font-medium border-t border-line hover:bg-tint transition-colors"
          style={{ color: "var(--color-action-ink)" }}
        >
          {showMoreLabel}
        </Link>
      )}
    </section>
  );
}

function TrendingSection() {
  const { tags, loading } = useTrendingTags(5);

  if (loading) {
    return (
      <SectionCard title="Trending">
        <div className="divide-y divide-line">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-4 py-3 animate-pulse">
              <div className="h-3 bg-skeleton rounded w-20 mb-2" />
              <div className="h-4 bg-skeleton rounded w-28" />
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  if (tags.length === 0) return null;

  return (
    <SectionCard title="Trending" showMoreHref="/explore">
      <div className="divide-y divide-line">
        {tags.map((tag) => (
          <Link
            key={tag.name}
            href={`/tag/${encodeURIComponent(tag.name)}`}
            className="block px-4 py-3 hover:bg-tint transition-colors"
          >
            <p className="font-ui font-medium text-ink text-sm">#{tag.name}</p>
            <p className="text-xs text-subdued font-body mt-0.5">
              {tag.post_count.toLocaleString()} {tag.post_count === 1 ? "post" : "posts"}
            </p>
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
          .select(`
            id, username, display_name, avatar_url, tagline,
            followers:follows!follows_following_id_fkey(count)
          `)
          .eq("followers.status", "accepted")
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

        // Extract follower counts from aggregate result (no separate queries needed)
        const usersWithCounts = (users || []).map((u: Record<string, unknown>) => {
          const followers = u.followers as { count: number }[] | null;
          return {
            id: u.id as string,
            username: u.username as string,
            display_name: u.display_name as string | null,
            avatar_url: u.avatar_url as string | null,
            tagline: u.tagline as string | null,
            followers_count: Array.isArray(followers) && followers[0]?.count
              ? followers[0].count
              : 0,
          };
        });

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
        <div className="divide-y divide-line">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-skeleton" />
              <div className="flex-1">
                <div className="h-4 bg-skeleton rounded w-24 mb-1" />
                <div className="h-3 bg-skeleton rounded w-16" />
              </div>
              <div className="h-9 w-16 bg-skeleton rounded-control" />
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  if (suggestedUsers.length === 0) return null;

  return (
    <SectionCard title="Creators to follow" showMoreHref="/explore" showMoreLabel="Discover more">
      <div className="divide-y divide-line">
        {suggestedUsers.map((suggestedUser) => {
          const isFollowing = followingIds.has(suggestedUser.id);
          return (
            <div
              key={suggestedUser.id}
              className="px-4 py-3 flex items-center gap-3"
            >
              <Link href={`/studio/${suggestedUser.username}`} className="flex-shrink-0" aria-label={`${suggestedUser.display_name || suggestedUser.username}'s studio`}>
                <img
                  src={suggestedUser.avatar_url || DEFAULT_AVATAR}
                  alt=""
                  className="pq-avatar"
                  width={36}
                  height={36}
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/studio/${suggestedUser.username}`} className="block min-w-0">
                  <p className="font-ui font-medium text-ink text-sm truncate">
                    {suggestedUser.display_name || suggestedUser.username}
                  </p>
                  <p className="text-subdued text-xs font-body truncate">
                    @{suggestedUser.username}
                  </p>
                </Link>
              </div>
              {user && user.id !== suggestedUser.id && (
                <Button
                  size="sm"
                  variant={isFollowing ? "secondary" : "outline"}
                  onClick={() => handleFollow(suggestedUser.id)}
                  aria-pressed={isFollowing}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Button>
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
        <div className="divide-y divide-line">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-[0.625rem] bg-skeleton" />
              <div className="flex-1">
                <div className="h-4 bg-skeleton rounded w-24 mb-1" />
                <div className="h-3 bg-skeleton rounded w-16" />
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
      <div className="divide-y divide-line">
        {trending.map((community) => (
          <Link
            key={community.id}
            href={`/community/${community.slug}`}
            className="px-4 py-3 flex items-center gap-3 hover:bg-tint transition-colors"
          >
            {community.avatar_url ? (
              <img
                src={community.avatar_url}
                alt=""
                className="w-9 h-9 rounded-[0.625rem] object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-[0.625rem] flex items-center justify-center" style={{ background: "var(--color-action-soft)", color: "var(--color-action-ink)" }}>
                <span className="font-ui text-sm font-semibold">
                  {community.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-ui font-medium text-ink text-sm truncate">
                {community.name}
              </p>
              <p className="text-subdued text-xs font-body">
                {(community.member_count || 0).toLocaleString()} {community.member_count === 1 ? "member" : "members"}
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
    <aside className="hidden lg:block fixed right-0 top-(--pq-topbar) bottom-0 w-[280px] border-l border-line overflow-y-auto bg-canvas" aria-label="Discover">
      <div className="p-4 space-y-4">
        {/* Trending */}
        <TrendingSection />

        {/* Who to Follow */}
        <WhoToFollowSection />

        {/* Communities */}
        <CommunitiesSection />

        {/* Footer */}
        <nav className="px-1 pt-2">
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-subdued font-body">
            <Link href="/terms" className="hover:text-ink transition-colors">Terms</Link>
            <span aria-hidden="true">·</span>
            <Link href="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
            <span aria-hidden="true">·</span>
            <Link href="/community-guidelines" className="hover:text-ink transition-colors">Guidelines</Link>
            <span aria-hidden="true">·</span>
            <Link href="/marketplace-guidelines" className="hover:text-ink transition-colors">Marketplace</Link>
            <span aria-hidden="true">·</span>
            <Link href="/about" className="hover:text-ink transition-colors">About</Link>
            <span aria-hidden="true">·</span>
            <Link href="/help" className="hover:text-ink transition-colors">Help</Link>
          </div>
          <p className="text-xs text-subdued font-body mt-2">
            © {new Date().getFullYear()} Pinkquill
          </p>
        </nav>
      </div>
    </aside>
  );
}
