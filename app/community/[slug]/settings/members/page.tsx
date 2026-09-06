"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useCommunityMembers, useJoinRequests, useCommunityModeration } from "@/lib/hooks.legacy";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { Spinner } from "@/components/ui/Loading";
import Button from "@/components/ui/Button";
import { TabRow } from "@/components/ui/Tabs";
import { CommunitySettingsFrame, PersonRow, formatDay } from "@/components/communities/pieces";
import "@/components/create/composer.css";
import "@/components/communities/communities.css";

type TabType = 'moderators' | 'requests';

export default function CommunityMembersSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, refetch: refetchCommunity } = useCommunity(slug, user?.id);
  const [activeTab, setActiveTab] = useState<TabType>('moderators');

  const { members: moderators, loading: modsLoading, refetch: refetchMods } = useCommunityMembers(
    community?.id || '',
    { role: 'moderator' }
  );

  const { requests, loading: requestsLoading, approve, reject, refetch: refetchRequests } = useJoinRequests(community?.id || '');

  const { promoteUser, demoteUser } = useCommunityModeration(community?.id || '');
  const [actionLoading, setActionLoading] = useState(false);
  const [demoteTarget, setDemoteTarget] = useState<string | null>(null);

  const isAdmin = community?.user_role === 'admin';

  // Admin-only; redirect from an effect, never during render.
  useEffect(() => {
    if (community && !isAdmin) router.replace(`/community/${slug}/settings`);
  }, [community, isAdmin, router, slug]);

  if (!community || !isAdmin) return null;

  const _handlePromote = async (userId: string) => {
    setActionLoading(true);
    const result = await promoteUser(userId, 'moderator');
    if (result.success) refetchMods();
    setActionLoading(false);
  };
  void _handlePromote; // Reserved for future use

  const handleDemote = async () => {
    if (!demoteTarget) return;
    setActionLoading(true);
    const result = await demoteUser(demoteTarget);
    if (result.success) refetchMods();
    setActionLoading(false);
    setDemoteTarget(null);
  };

  const handleApprove = async (requestId: string, userId: string) => {
    if (!user?.id) return;
    const result = await approve(requestId, userId, user.id);
    if (result.success) {
      refetchRequests();
      refetchCommunity();
    }
  };

  const handleReject = async (requestId: string) => {
    if (!user?.id) return;
    const result = await reject(requestId, user.id);
    if (result.success) refetchRequests();
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');

  const tabItems = [
    { id: "moderators" as TabType, label: "Moderators", count: moderators.length },
    ...(community.privacy === "private" ? [{ id: "requests" as TabType, label: "Asking to join", count: pendingRequests.length }] : []),
  ];

  return (
    <CommunitySettingsFrame
      community={community}
      title="Roles and requests"
      lede="Who moderates, and who is waiting to get in."
      actions={<Link href={`/community/${slug}/members`} className="pq-button pq-button--sm pq-button--secondary">Members list</Link>}
    >
      <TabRow<TabType> ariaLabel="Roles and requests" items={tabItems} value={activeTab} onChange={setActiveTab} />

      {activeTab === "moderators" && (
        modsLoading ? (
          <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
        ) : moderators.length > 0 ? (
          <div className="pq-list">
            {moderators.map((member) => (
              <PersonRow
                key={member.id}
                person={member.profile}
                word="Moderator"
                trailing={<Button variant="ghost" size="sm" onClick={() => setDemoteTarget(member.user_id)} disabled={actionLoading}>Remove role</Button>}
              />
            ))}
          </div>
        ) : (
          <div className="pq-feed-state pq-feed-state--card">
            <p className="pq-feed-state__title">No moderators yet</p>
            <p className="pq-feed-state__text">Open the members list, pick someone, and choose &ldquo;Make moderator&rdquo; from their menu.</p>
            <div className="pq-feed-state__actions">
              <Link href={`/community/${slug}/members`} className="pq-button pq-button--md pq-button--secondary">Members list</Link>
            </div>
          </div>
        )
      )}

      {activeTab === "requests" && (
        requestsLoading ? (
          <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
        ) : pendingRequests.length > 0 ? (
          <div className="pq-list">
            {pendingRequests.map((request) => (
              <PersonRow key={request.id} person={request.profile} meta={`Asked ${formatDay(request.created_at)}`}>
                {request.message && <p className="pq-person__note">{request.message}</p>}
                <div className="pq-person__actions">
                  <Button variant="primary" size="sm" onClick={() => handleApprove(request.id, request.user_id)}>Let them in</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleReject(request.id)}>Decline</Button>
                </div>
              </PersonRow>
            ))}
          </div>
        ) : (
          <div className="pq-feed-state pq-feed-state--card">
            <p className="pq-feed-state__title">Nobody is waiting</p>
            <p className="pq-feed-state__text">Requests to join show up here for you to answer.</p>
          </div>
        )
      )}

      <ConfirmationModal
        isOpen={!!demoteTarget}
        onClose={() => setDemoteTarget(null)}
        onConfirm={handleDemote}
        title="Remove this moderator?"
        description="They stay a member and lose the moderation tools. You can make them a moderator again later."
        confirmText="Remove role"
        isDanger
        loading={actionLoading}
      />
    </CommunitySettingsFrame>
  );
}
