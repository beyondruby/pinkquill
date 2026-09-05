"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity } from "@/lib/hooks.legacy";
import { CommunityProvider } from "@/components/communities/CommunityContext";
import CommunityHeader from "@/components/communities/CommunityHeader";
import JoinButton from "@/components/communities/JoinButton";
import { CommunityMark } from "@/components/communities/CommunityCard";
import { PageFrame } from "@/components/layout/PageFrame";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Loading";
import { formatMemberCount, memberWord } from "@/lib/communities/categories";
import "@/components/create/composer.css";
import "@/components/communities/communities.css";

/**
 * Fetches the community once for every page under /community/[slug], shows
 * the identity block and tabs, and handles the three gates: not found,
 * banned, and private-without-membership.
 */
export default function CommunityLayoutClient({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const communityState = useCommunity(slug, user?.id);
  const { community, tags, loading, error, refetch } = communityState;

  if (loading) {
    return (
      <PageFrame width="wide">
        <div className="pq-feed-state" role="status" aria-label="Opening the community">
          <Spinner size="lg" />
        </div>
      </PageFrame>
    );
  }

  if (error || !community) {
    return (
      <PageFrame width="narrow">
        <div className="pq-feed-state pq-feed-state--card" role="alert">
          <p className="pq-feed-state__title">This community isn&rsquo;t here</p>
          <p className="pq-feed-state__text">{error || "It may have been removed, or you may not have access to it."}</p>
          <div className="pq-feed-state__actions">
            <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
            <Link href="/community" className="pq-button pq-button--md pq-button--primary">Browse communities</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  if (community.user_status === "banned") {
    return (
      <PageFrame width="narrow">
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">You can&rsquo;t take part in {community.name}</p>
          <p className="pq-feed-state__text">The community&rsquo;s moderators have removed your access.</p>
          <div className="pq-feed-state__actions">
            <Link href="/community" className="pq-button pq-button--md pq-button--primary">Browse communities</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  if (community.privacy === "private" && !community.is_member && community.created_by !== user?.id) {
    const count = community.member_count || 0;
    return (
      <PageFrame width="narrow">
        <div className="pq-feed-state pq-feed-state--card">
          <CommunityMark community={community} size="lg" />
          <p className="pq-feed-state__title mt-3">{community.name}</p>
          {community.description && <p className="pq-feed-state__text">{community.description}</p>}
          <p className="pq-feed-state__text">
            A private community · {formatMemberCount(count)} {memberWord(count)} · {community.post_count || 0} posts.
            Members see the posts and the people; ask to join and the admins will answer.
          </p>
          <div className="pq-feed-state__actions">
            {user ? (
              <JoinButton community={community} userId={user.id} onUpdate={refetch} />
            ) : (
              <Link href={`/login?redirect=${encodeURIComponent(`/community/${slug}`)}`} className="pq-button pq-button--md pq-button--primary">Sign in to request access</Link>
            )}
            <Link href="/community" className="pq-button pq-button--md pq-button--ghost">Browse communities</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <CommunityProvider value={{ slug, ...communityState }}>
      <PageFrame width="wide">
        <CommunityHeader community={community} tags={tags} userId={user?.id} onUpdate={refetch} />
        {children}
      </PageFrame>
    </CommunityProvider>
  );
}
