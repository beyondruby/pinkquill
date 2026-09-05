"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Community, CommunityTag } from "@/lib/types";
import JoinButton from "./JoinButton";
import { CommunityMark } from "./CommunityCard";
import ReportModal from "@/components/ui/ReportModal";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import { icons } from "@/components/ui/Icons";
import { supabase } from "@/lib/supabase";
import { formatMemberCount, memberWord } from "@/lib/communities/categories";
import "./communities.css";

interface CommunityHeaderProps {
  community: Community;
  tags: CommunityTag[];
  userId?: string;
  onUpdate?: () => void;
}

/**
 * Compact identity for a community: cover (when there is one) as a low band,
 * then mark, name, purpose and a meta line beside the membership control,
 * a Post entry for active members and a menu. A tab row underneath moves
 * between Posts, About, Members and (for staff) Settings. No banner, no
 * repeated stats.
 */
export default function CommunityHeader({ community, tags, userId, onUpdate }: CommunityHeaderProps) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const handleReportSubmit = async (reason: string, details?: string) => {
    if (!userId) return;
    setReportSubmitting(true);
    try {
      // Community reports carry the community in the reason (no reported_community_id column).
      const fullReason = `[Community: ${community.name} (${community.id})] ${reason}${details ? ` - ${details}` : ""}`;
      await supabase.from("reports").insert({ reporter_id: userId, reason: fullReason, type: "community", status: "pending" });
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isAdmin = community.user_role === "admin";
  const isMod = community.user_role === "moderator";
  const isStaff = isAdmin || isMod;
  const canPost = Boolean(community.is_member && community.user_status === "active");
  const count = community.member_count || 0;
  const base = `/community/${community.slug}`;
  const created = community.created_at ? new Date(community.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null;
  const purpose = tags.find((t) => t.tag_type === "type")?.tag;

  const menuItems: ActionMenuItem[] = [
    { label: copied ? "Link copied" : "Copy link", onSelect: handleCopy, tone: copied ? "success" : "default", icon: icons.share },
    { label: "Invite people", href: `${base}/members`, hidden: !community.is_member, icon: icons.send },
    { label: "Settings", href: `${base}/settings`, hidden: !isStaff, sectionLabel: "Manage", icon: icons.edit },
    { label: "Report community", onSelect: () => setShowReportModal(true), hidden: !userId || isAdmin, tone: "danger", dividerBefore: true, sectionLabel: "Safety", icon: icons.flag },
  ];

  const tabs = [
    { href: base, label: "Posts", active: pathname === base },
    { href: `${base}/about`, label: "About", active: pathname === `${base}/about` },
    { href: `${base}/members`, label: "Members", active: pathname === `${base}/members`, count },
    ...(isStaff ? [{ href: `${base}/settings`, label: "Settings", active: pathname.startsWith(`${base}/settings`) }] : []),
  ];

  return (
    <header>
      {community.cover_url && <img src={community.cover_url} alt="" className="pq-community-cover" />}

      <div className="pq-community-intro">
        <CommunityMark community={community} size="lg" />
        <div className="pq-community-intro__text">
          <h1 className="pq-community-intro__title">{community.name}</h1>
          {community.description && <p className="pq-community-intro__desc">{community.description}</p>}
          <p className="pq-community-intro__meta">
            <span>{community.privacy === "private" ? "Private community" : "Public community"}</span>
            <span aria-hidden="true">·</span>
            <Link href={`${base}/members`}>{formatMemberCount(count)} {memberWord(count)}</Link>
            {purpose && (
              <>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{purpose}</span>
              </>
            )}
            {created && (
              <>
                <span aria-hidden="true">·</span>
                <span>Since {created}</span>
              </>
            )}
          </p>
        </div>
        <div className="pq-community-intro__actions">
          {canPost && (
            <Link href={`/create?community=${community.slug}`} className="pq-button pq-button--md pq-button--secondary">
              Share here
            </Link>
          )}
          {userId ? (
            <JoinButton community={community} userId={userId} onUpdate={onUpdate} />
          ) : (
            <Link href={`/login?redirect=${encodeURIComponent(base)}`} className="pq-button pq-button--md pq-button--primary">
              Sign in to join
            </Link>
          )}
          <ActionMenu
            label="Community actions"
            items={menuItems}
            widthClassName="w-60"
            buttonAriaLabel="Community actions"
            buttonClassName="pq-icon-button pq-icon-button--filled"
            portal
          />
        </div>
      </div>

      <nav className="pq-community-nav" aria-label="Community sections">
        <div className="pq-tabs">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className="pq-tab" aria-selected={tab.active} aria-current={tab.active ? "page" : undefined}>
              {tab.label}
              {typeof tab.count === "number" && tab.count > 0 && <span className="pq-tab__count">{formatMemberCount(tab.count)}</span>}
            </Link>
          ))}
        </div>
      </nav>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => { setShowReportModal(false); setReportSubmitted(false); }}
        onSubmit={handleReportSubmit}
        submitting={reportSubmitting}
        submitted={reportSubmitted}
        title="Report this community"
        placeholder="What's wrong with this community…"
      />
    </header>
  );
}
