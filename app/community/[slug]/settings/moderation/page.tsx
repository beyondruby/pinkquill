"use client";

import React, { useState, useEffect } from "react";
import { getTimeAgo } from "@/lib/utils/time";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useCommunityMembers, useCommunityModeration, useModLog } from "@/lib/hooks.legacy";
import { stripHtml } from "@/lib/utils/sanitize";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { Spinner } from "@/components/ui/Loading";
import Button from "@/components/ui/Button";
import { TabRow } from "@/components/ui/Tabs";
import { CommunitySettingsFrame, PersonRow, PersonAvatar, formatDay, personName } from "@/components/communities/pieces";
import "@/components/communities/communities.css";

type TabType = 'mod-log' | 'muted' | 'banned';

export default function CommunityModerationSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community } = useCommunity(slug, user?.id);

  // Role gate: redirect from an effect (a router.push during render is a
  // React error and can loop). The proxy already requires a session; the
  // real authorization lives in RLS and the moderation RPCs.
  useEffect(() => {
    if (community && (community.user_role !== "admin" && community.user_role !== "moderator")) {
      router.replace(`/community/${slug}`);
    }
  }, [community, router, slug]);
  const [activeTab, setActiveTab] = useState<TabType>('mod-log');

  const { members: mutedMembers, loading: mutedLoading, refetch: refetchMuted } = useCommunityMembers(
    community?.id || '',
    { status: 'muted' }
  );

  const { members: bannedMembers, loading: bannedLoading, refetch: refetchBanned } = useCommunityMembers(
    community?.id || '',
    { status: 'banned' }
  );

  const { entries: modLogEntries, loading: modLogLoading, hasMore: modLogHasMore, loadMore: loadMoreModLog } = useModLog(
    community?.id || ''
  );

  const { checkExpiredMutes, unmuteUser, unbanUser } = useCommunityModeration(community?.id || '');
  const [actionLoading, setActionLoading] = useState(false);
  const [unbanTarget, setUnbanTarget] = useState<string | null>(null);

  // Check and auto-unmute expired mutes on page load
  useEffect(() => {
    if (community?.id) {
      checkExpiredMutes().then(() => {
        refetchMuted();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [community?.id]);

  if (!community) return null;

  const isAdmin = community.user_role === 'admin';
  const isMod = community.user_role === 'moderator';

  if (!isAdmin && !isMod) {
    return null;
  }

  const handleUnmute = async (userId: string) => {
    setActionLoading(true);
    const result = await unmuteUser(userId);
    if (result.success) refetchMuted();
    setActionLoading(false);
  };

  const handleUnban = async () => {
    if (!unbanTarget) return;
    setActionLoading(true);
    const result = await unbanUser(unbanTarget);
    if (result.success) refetchBanned();
    setActionLoading(false);
    setUnbanTarget(null);
  };

  const tabItems = [
    { id: "mod-log" as TabType, label: "Log" },
    { id: "muted" as TabType, label: "Muted", count: mutedMembers.length },
    { id: "banned" as TabType, label: "Banned", count: bannedMembers.length },
  ];

  return (
    <CommunitySettingsFrame community={community} title="Moderation log" lede="What moderators removed, and who is muted or banned right now.">
      <TabRow<TabType> ariaLabel="Moderation" items={tabItems} value={activeTab} onChange={setActiveTab} />

      {activeTab === "mod-log" && (
        modLogLoading ? (
          <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
        ) : modLogEntries.length > 0 ? (
          <>
            <div className="pq-list">
              {modLogEntries.map((entry) => (
                <div key={entry.id} className="pq-log">
                  <div className="flex items-center gap-3">
                    <PersonAvatar person={entry.moderator_profile} size="sm" />
                    <p className="pq-log__line">
                      <Link href={`/studio/${entry.moderator_profile?.username || ""}`}>{personName(entry.moderator_profile)}</Link>
                      {" "}removed a {entry.content_type === "post" ? "post" : "comment"}
                      {entry.author_profile && (
                        <>
                          {" "}by <Link href={`/studio/${entry.author_profile.username}`}>@{entry.author_profile.username}</Link>
                        </>
                      )}
                    </p>
                  </div>
                  {entry.content_snapshot && (
                    <div className="pq-log__snapshot">
                      {entry.content_snapshot.title && <strong>{entry.content_snapshot.title}</strong>}
                      <span className="line-clamp-3">{stripHtml(entry.content_snapshot.content || "").slice(0, 300)}</span>
                    </div>
                  )}
                  {entry.reason && <p className="pq-log__reason">Reason: {entry.reason}</p>}
                  <p className="pq-log__when">{getTimeAgo(entry.deleted_at)}</p>
                </div>
              ))}
            </div>
            {modLogHasMore && (
              <div className="flex justify-center">
                <Button variant="secondary" size="sm" onClick={loadMoreModLog}>Show older</Button>
              </div>
            )}
          </>
        ) : (
          <div className="pq-feed-state pq-feed-state--card">
            <p className="pq-feed-state__title">Nothing removed yet</p>
            <p className="pq-feed-state__text">When a moderator removes a post or comment, it&rsquo;s recorded here with the reason.</p>
          </div>
        )
      )}

      {(activeTab === "muted" || activeTab === "banned") && (() => {
        const list = activeTab === "muted" ? mutedMembers : bannedMembers;
        const isLoading = activeTab === "muted" ? mutedLoading : bannedLoading;
        if (isLoading) return <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>;
        if (list.length === 0) {
          return (
            <div className="pq-feed-state pq-feed-state--card">
              <p className="pq-feed-state__title">{activeTab === "muted" ? "Nobody is muted" : "Nobody is banned"}</p>
              <p className="pq-feed-state__text">{activeTab === "muted" ? "Muted members can read but not post or comment until the mute ends." : "Banned people are removed and can't rejoin until the ban ends."}</p>
            </div>
          );
        }
        return (
          <div className="pq-list">
            {list.map((member) => (
              <PersonRow
                key={member.id}
                person={member.profile}
                word={activeTab === "muted" ? "Muted" : "Banned"}
                meta={activeTab === "muted"
                  ? `${member.muted_until ? `Until ${formatDay(member.muted_until, true)}` : "No end set"}${member.mute_reason ? ` · ${member.mute_reason}` : ""}`
                  : `${member.banned_until ? `Until ${formatDay(member.banned_until)}` : "For good"}${member.ban_reason ? ` · ${member.ban_reason}` : ""}`}
                trailing={
                  activeTab === "muted"
                    ? <Button variant="secondary" size="sm" onClick={() => handleUnmute(member.user_id)} disabled={actionLoading}>Unmute</Button>
                    : <Button variant="secondary" size="sm" onClick={() => setUnbanTarget(member.user_id)} disabled={actionLoading}>Lift ban</Button>
                }
              />
            ))}
          </div>
        );
      })()}

      <ConfirmationModal
        isOpen={!!unbanTarget}
        onClose={() => setUnbanTarget(null)}
        onConfirm={handleUnban}
        title="Lift this ban?"
        description="They'll be able to find and rejoin the community."
        confirmText="Lift ban"
        loading={actionLoading}
      />
    </CommunitySettingsFrame>
  );
}
