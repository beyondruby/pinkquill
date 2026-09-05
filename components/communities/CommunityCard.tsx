"use client";

import Link from "next/link";
import type { Community } from "@/lib/types";
import { formatMemberCount, memberWord } from "@/lib/communities/categories";
import "./communities.css";

interface CommunityCardProps {
  community: Community;
  /** Featured cards show their cover when there is one. */
  variant?: "default" | "featured";
}

export function CommunityMark({ community, size = "md" }: { community: Pick<Community, "name" | "avatar_url">; size?: "sm" | "md" | "lg" }) {
  const cls = `pq-community-mark ${size === "lg" ? "pq-community-mark--lg" : size === "sm" ? "pq-community-mark--sm" : ""}`.trim();
  return (
    <span className={cls} aria-hidden="true">
      {community.avatar_url ? <img src={community.avatar_url} alt="" /> : community.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** One line for where the viewer stands with this community, or nothing. */
export function membershipWord(community: Community): string | null {
  if (community.is_member) {
    if (community.user_role === "admin") return "You run this";
    if (community.user_role === "moderator") return "You moderate";
    return "Joined";
  }
  if (community.has_pending_request) return "Requested";
  if (community.has_pending_invitation) return "Invited";
  return null;
}

/**
 * A community in a list: mark, name, privacy, members, two lines of what it is
 * for, and where you stand with it. One quiet card; the identity page carries
 * the rest.
 */
export default function CommunityCard({ community, variant = "default" }: CommunityCardProps) {
  const count = community.member_count || 0;
  const state = membershipWord(community);
  return (
    <Link href={`/community/${community.slug}`} className="pq-community-card" aria-label={`${community.name}, ${count} ${memberWord(count)}`}>
      {variant === "featured" && community.cover_url && (
        <img src={community.cover_url} alt="" className="pq-community-card__cover" loading="lazy" />
      )}
      <div className="pq-community-card__body">
        <div className="pq-community-card__head">
          <CommunityMark community={community} />
          <div className="min-w-0">
            <h3 className="pq-community-card__name">{community.name}</h3>
            <p className="pq-community-card__meta">
              <span>{community.privacy === "private" ? "Private" : "Public"}</span>
              <span aria-hidden="true">·</span>
              <span>{formatMemberCount(count)} {memberWord(count)}</span>
            </p>
          </div>
        </div>
        {community.description && <p className="pq-community-card__text">{community.description}</p>}
        {state && (
          <div className="pq-community-card__foot">
            <span className="pq-community-card__state">{state}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
