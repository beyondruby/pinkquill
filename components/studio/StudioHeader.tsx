"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { FollowStatus, Profile } from "@/lib/types";
import Button from "@/components/ui/Button";
import ActionMenu from "@/components/ui/ActionMenu";
import { NavIcon } from "@/components/layout/navigation";
import { parseSocialLinks, getSocialUrl } from "@/lib/utils/social";
import { getOptimizedAvatarUrl, DEFAULT_AVATAR } from "@/lib/utils/image";
import { socialIcons } from "./socialIcons";

export interface StudioCommunity {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface StudioHeaderProps {
  profile: Profile;
  isOwnProfile: boolean;
  /** Whether a viewer is signed in; guests see no social actions. */
  signedIn: boolean;
  followStatus: FollowStatus;
  followLoading: boolean;
  onFollow: () => void;
  messageLoading: boolean;
  onMessage: () => void;
  isBlocked: boolean;
  onBlock: () => void;
  onReport: () => void;
  onShare: () => void;
  onCopyLink: () => void;
  onOpenFollowers: (type: "followers" | "following") => void;
  communities: StudioCommunity[];
  onOpenCommunities: () => void;
  /** True when the studio is private and the viewer is not let in. */
  gated: boolean;
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const factIcons = {
  role: <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></svg>,
  location: <svg viewBox="0 0 24 24" {...stroke}><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" /><circle cx="12" cy="10" r="2.5" /></svg>,
  education: <svg viewBox="0 0 24 24" {...stroke}><path d="M2 9l10-5 10 5-10 5-10-5z" /><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" /></svg>,
  languages: <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>,
  calendar: <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  share: <svg viewBox="0 0 24 24" {...stroke}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5" /></svg>,
  link: <svg viewBox="0 0 24 24" {...stroke}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>,
  brush: <svg viewBox="0 0 24 24" {...stroke}><path d="M15 4l5 5-9 9H6v-5l9-9z" /><path d="M13 6l5 5" /></svg>,
  block: <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>,
  flag: <svg viewBox="0 0 24 24" {...stroke}><path d="M5 21V4M5 4h11l-1.5 4L16 12H5" /></svg>,
  lock: <svg viewBox="0 0 24 24" {...stroke}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
};

export function formatStudioCount(num: number | null): string {
  if (num === null) return "–";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(num);
}

/** What the follow button says for a given state. */
export function followWord(status: FollowStatus, isPrivate: boolean): string {
  if (status === "accepted") return "Following";
  if (status === "pending") return "Requested";
  return isPrivate ? "Ask to follow" : "Follow";
}

function joinedWord(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function Metric({ value, word, onClick }: { value: string | number; word: string; onClick?: () => void }) {
  const inner = <><strong>{value}</strong> {word}</>;
  return onClick
    ? <button type="button" className="pq-studio-metric" onClick={onClick}>{inner}</button>
    : <span className="pq-studio-metric">{inner}</span>;
}

/**
 * The top of a studio: cover, avatar, name, what they do, the social actions,
 * four counts and the About card. Owner and visitor see the same shape; only
 * the actions differ. A gated private studio shows a short note instead of
 * the counts and About.
 */
export default function StudioHeader({
  profile, isOwnProfile, signedIn, followStatus, followLoading, onFollow, messageLoading, onMessage,
  isBlocked, onBlock, onReport, onShare, onCopyLink, onOpenFollowers, communities, onOpenCommunities, gated,
}: StudioHeaderProps) {
  const name = profile.display_name || profile.username;
  const isFollowing = followStatus === "accepted";
  const links = profile.website ? parseSocialLinks(profile.website) : [];
  const facts: { icon: ReactNode; text: string }[] = [];
  if (profile.role) facts.push({ icon: factIcons.role, text: profile.role });
  if (profile.location) facts.push({ icon: factIcons.location, text: profile.location });
  if (profile.education) facts.push({ icon: factIcons.education, text: profile.education });
  if (profile.languages) facts.push({ icon: factIcons.languages, text: profile.languages });
  const hasAbout = Boolean(profile.bio || facts.length || links.length || communities.length);
  const shown = communities.length > 4 ? communities.slice(0, 3) : communities.slice(0, 4);

  return (
    <div className="pq-studio-top">
      {profile.cover_url && <img src={profile.cover_url} alt="" className="pq-studio-cover" />}

      <header className={`pq-studio-head ${profile.cover_url ? "pq-studio-head--overlap" : ""}`}>
        <img
          src={getOptimizedAvatarUrl(profile.avatar_url) || DEFAULT_AVATAR}
          alt=""
          className="pq-studio-avatar"
          width={128}
          height={128}
        />
        <div className="pq-studio-id">
          <h1 className="pq-studio-name">
            <span>{name}</span>
            {profile.is_verified && (
              <span className="pq-studio-verified" role="img" aria-label="Verified">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
              </span>
            )}
          </h1>
          <p className="pq-studio-handle">@{profile.username}</p>
          {profile.tagline && <p className="pq-studio-tagline">{profile.tagline}</p>}
        </div>

        <div className="pq-studio-actions">
          {!isOwnProfile && signedIn && (
            <>
              <Button
                variant={isFollowing || followStatus === "pending" ? "secondary" : "primary"}
                onClick={onFollow}
                loading={followLoading}
                loadingText={followWord(followStatus, profile.is_private)}
                aria-pressed={isFollowing}
              >
                {followWord(followStatus, profile.is_private)}
              </Button>
              <Button variant="secondary" onClick={onMessage} loading={messageLoading} loadingText="Opening…">
                <NavIcon name="message" />
                Message
              </Button>
            </>
          )}
          {isOwnProfile && (
            <Link href="/settings" className="pq-button pq-button--md pq-button--secondary">Edit profile</Link>
          )}
          <ActionMenu
            portal
            buttonAriaLabel="More about this studio"
            buttonClassName="pq-icon-button"
            widthClassName="w-56"
            items={[
              { label: "Share", onSelect: onShare, icon: factIcons.share },
              { label: "Copy link", onSelect: onCopyLink, icon: factIcons.link },
              { label: "Appearance", href: "/settings/appearance", hidden: !isOwnProfile, sectionLabel: "Settings", icon: factIcons.brush },
              { label: `${isBlocked ? "Unblock" : "Block"} @${profile.username}`, onSelect: onBlock, hidden: isOwnProfile || !signedIn, tone: "warning", dividerBefore: true, sectionLabel: "Safety", icon: factIcons.block },
              { label: `Report @${profile.username}`, onSelect: onReport, hidden: isOwnProfile || !signedIn, tone: "danger", icon: factIcons.flag },
            ]}
          />
        </div>
      </header>

      {gated ? (
        <div className="pq-feed-state pq-feed-state--card pq-studio-private">
          <span className="pq-studio-private__mark" aria-hidden="true">{factIcons.lock}</span>
          <p className="pq-feed-state__title">This studio is private</p>
          <p className="pq-feed-state__text">
            {followStatus === "pending"
              ? `You've asked to follow. Once ${name} says yes, their work shows up here.`
              : signedIn
                ? `Follow ${name} to see their posts, takes and collections.`
                : `Sign in and follow ${name} to see their posts, takes and collections.`}
          </p>
          {(profile.followers_count !== null || profile.following_count !== null) && (
            <div className="pq-studio-metrics pq-studio-metrics--centered">
              {profile.followers_count !== null && <Metric value={formatStudioCount(profile.followers_count)} word="followers" />}
              {profile.following_count !== null && <Metric value={formatStudioCount(profile.following_count)} word="following" />}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="pq-studio-metrics">
            <Metric value={profile.works_count} word={profile.works_count === 1 ? "post" : "posts"} />
            <Metric value={formatStudioCount(profile.followers_count)} word={profile.followers_count === 1 ? "follower" : "followers"} onClick={() => onOpenFollowers("followers")} />
            <Metric value={formatStudioCount(profile.following_count)} word="following" onClick={() => onOpenFollowers("following")} />
            <Metric value={formatStudioCount(profile.admires_count)} word="admires" />
          </div>

          {hasAbout && (
            <section className="pq-studio-about" aria-label="About">
              {profile.bio && <p className="pq-studio-bio">{profile.bio}</p>}
              {facts.length > 0 && (
                <ul className="pq-studio-facts">
                  {facts.map((fact) => <li key={fact.text}>{fact.icon}<span>{fact.text}</span></li>)}
                </ul>
              )}
              <div className="pq-studio-about__foot">
                <div className="pq-studio-links">
                  {links.map((link, index) => {
                    const mark = socialIcons[link.platform] || socialIcons.website;
                    return (
                      <a key={index} href={getSocialUrl(link)} target="_blank" rel="noopener noreferrer" title={link.url} aria-label={link.platform}>
                        {mark.icon}
                      </a>
                    );
                  })}
                </div>
                {communities.length > 0 && (
                  <button type="button" className="pq-studio-communities" onClick={onOpenCommunities}>
                    <span className="pq-studio-stack" aria-hidden="true">
                      {shown.map((community) => (
                        community.avatar_url
                          ? <img key={community.id} src={community.avatar_url} alt="" />
                          : <span key={community.id}>{community.name.charAt(0).toUpperCase()}</span>
                      ))}
                      {communities.length > 4 && <span>+{communities.length - 3}</span>}
                    </span>
                    <span>{communities.length === 1 ? "1 community" : `${communities.length} communities`}</span>
                  </button>
                )}
                <span className="pq-studio-joined">{factIcons.calendar}Joined {joinedWord(profile.created_at)}</span>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
