"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useCommunityMembers, useCommunityModeration, useJoinRequests } from "@/lib/hooks.legacy";
import type { CommunityMember, ModeratorPermissions } from "@/lib/types";
import InviteModal from "@/components/communities/InviteModal";
import ModeratorPermissionsModal from "@/components/communities/ModeratorPermissionsModal";
import ModerationSheet, { type ModerationDecision } from "@/components/communities/ModerationSheet";
import { PersonRow, formatDay, roleWord } from "@/components/communities/pieces";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import Button from "@/components/ui/Button";
import { TabRow } from "@/components/ui/Tabs";
import { actionToast } from "@/lib/utils/toast";
import { Spinner } from "@/components/ui/Loading";
import { icons } from "@/components/ui/Icons";
import "@/components/create/composer.css";
import "@/components/communities/communities.css";

type RoleFilter = 'all' | 'admin' | 'moderator' | 'member';
type ModerationTab = 'members' | 'muted' | 'banned';

export default function CommunityMembersPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community } = useCommunity(slug, user?.id);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [moderationTab, setModerationTab] = useState<ModerationTab>('members');

  const { members, loading, refetch } = useCommunityMembers(
    community?.id || '',
    { role: roleFilter === 'all' ? undefined : roleFilter }
  );

  // Fetch muted and banned members
  const { members: mutedMembers, loading: mutedLoading, refetch: refetchMuted } = useCommunityMembers(
    community?.id || '',
    { status: 'muted' }
  );

  const { members: bannedMembers, loading: bannedLoading, refetch: refetchBanned } = useCommunityMembers(
    community?.id || '',
    { status: 'banned' }
  );

  const { promoteUser, demoteUser, muteUser, banUser, unmuteUser, unbanUser, checkExpiredMutes, updateModeratorPermissions } = useCommunityModeration(community?.id || '');
  const { requests: joinRequests, approve: approveRequest, reject: rejectRequest, refetch: refetchRequests } = useJoinRequests(community?.id || '');
  const [actionLoading, setActionLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [unbanTarget, setUnbanTarget] = useState<string | null>(null);

  // Moderator permissions modal state
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsTargetUser, setPermissionsTargetUser] = useState<{ id: string; name: string } | null>(null);
  const [editingPermissions, setEditingPermissions] = useState(false);
  const [existingPermissions, setExistingPermissions] = useState<ModeratorPermissions | undefined>(undefined);

  // Check and auto-unmute expired mutes on page load
  useEffect(() => {
    if (community?.id) {
      checkExpiredMutes().then(() => {
        refetchMuted();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [community?.id]);

  const [muteTarget, setMuteTarget] = useState<{ id: string; name: string } | null>(null);
  const [banTarget, setBanTarget] = useState<{ id: string; name: string } | null>(null);
  const [demoteTarget, setDemoteTarget] = useState<{ id: string; name: string } | null>(null);

  if (!community) return null;

  const isAdmin = community.user_role === 'admin';
  const isMod = community.user_role === 'moderator';
  const canManage = isAdmin || isMod;

  const filteredMembers = searchQuery.trim()
    ? members.filter(m =>
        m.profile?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.profile?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : members;

  // Open permissions modal to set moderator permissions before promoting
  const openPermissionsModal = (userId: string, userName: string, currentPermissions?: ModeratorPermissions) => {
    setPermissionsTargetUser({ id: userId, name: userName });
    setExistingPermissions(currentPermissions);
    setEditingPermissions(!!currentPermissions);
    setShowPermissionsModal(true);
  };

  // Handle promoting with selected permissions
  const handlePromoteWithPermissions = async (permissions: ModeratorPermissions) => {
    if (!permissionsTargetUser) return;
    setActionLoading(true);

    let result;
    if (editingPermissions) {
      // Just updating permissions for existing moderator
      result = await updateModeratorPermissions(permissionsTargetUser.id, permissions);
    } else {
      // Promoting to moderator with permissions
      result = await promoteUser(permissionsTargetUser.id, 'moderator', permissions);
    }

    if (result.success) {
      refetch();
      setShowPermissionsModal(false);
      setPermissionsTargetUser(null);
      setExistingPermissions(undefined);
      setEditingPermissions(false);
    }
    setActionLoading(false);
  };

  // Promote directly to admin (no permissions modal needed - admins have all permissions)
  const _handlePromoteToAdmin = async (userId: string) => {
    setActionLoading(true);
    const result = await promoteUser(userId, 'admin');
    if (result.success) refetch();
    setActionLoading(false);
  };
  void _handlePromoteToAdmin; // Reserved for future use

  const handleDemote = async () => {
    if (!demoteTarget) return;
    setActionLoading(true);
    const result = await demoteUser(demoteTarget.id);
    if (result.success) refetch();
    setActionLoading(false);
    setDemoteTarget(null);
  };

  const handleMuteConfirm = async ({ hours, reason }: ModerationDecision) => {
    if (!user?.id || !muteTarget) return;
    setActionLoading(true);
    const mutedUntil = hours && hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000) : undefined;
    const result = await muteUser(muteTarget.id, { mutedUntil, reason });
    if (result.success) {
      refetch();
      refetchMuted();
      setMuteTarget(null);
    }
    setActionLoading(false);
  };

  const handleBanConfirm = async ({ hours, reason }: ModerationDecision) => {
    if (!user?.id || !banTarget) return;
    setActionLoading(true);
    const bannedUntil = hours && hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000) : undefined;
    const result = await banUser(banTarget.id, { bannedUntil, reason });
    if (result.success) {
      refetch();
      refetchBanned();
      setBanTarget(null);
    }
    setActionLoading(false);
  };

  const handleUnmute = async (userId: string) => {
    setActionLoading(true);
    const result = await unmuteUser(userId);
    if (result.success) {
      refetchMuted();
      refetch();
    }
    setActionLoading(false);
  };

  const handleUnban = async () => {
    if (!unbanTarget) return;
    setActionLoading(true);
    const result = await unbanUser(unbanTarget);
    if (result.success) {
      refetchBanned();
    }
    setActionLoading(false);
    setUnbanTarget(null);
  };

  const handleApproveRequest = async (requestId: string, userId: string) => {
    if (!user?.id) return;
    setActionLoading(true);
    const result = await approveRequest(requestId, userId, user.id);
    if (result.success) {
      actionToast.joinRequestApproved();
      refetchRequests();
      refetch(); // Refetch members list too
    } else {
      actionToast.membershipError(typeof result.error === "string" ? result.error : undefined);
    }
    setActionLoading(false);
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!user?.id) return;
    setActionLoading(true);
    const result = await rejectRequest(requestId, user.id);
    if (result.success) {
      actionToast.joinRequestRejected();
      refetchRequests();
    } else {
      actionToast.membershipError(typeof result.error === "string" ? result.error : undefined);
    }
    setActionLoading(false);
  };

  const nameOf = (m: CommunityMember) => m.profile?.display_name || m.profile?.username || "this member";
  const memberMenu = (member: CommunityMember): ActionMenuItem[] => [
    { label: "Make moderator", hidden: !(isAdmin && member.role === "member"), onSelect: () => openPermissionsModal(member.user_id, nameOf(member)), icon: icons.edit },
    { label: "Change what they can do", hidden: !(isAdmin && member.role === "moderator"), onSelect: () => openPermissionsModal(member.user_id, nameOf(member), member.permissions || undefined), icon: icons.edit },
    { label: "Remove moderator role", hidden: !(isAdmin && member.role === "moderator"), onSelect: () => setDemoteTarget({ id: member.user_id, name: nameOf(member) }) },
    { label: "Mute", hidden: member.status === "muted", onSelect: () => setMuteTarget({ id: member.user_id, name: nameOf(member) }), sectionLabel: "Moderation", dividerBefore: true, tone: "warning" },
    { label: "Ban", onSelect: () => setBanTarget({ id: member.user_id, name: nameOf(member) }), tone: "danger" },
  ];

  const tabItems = [
    { id: "members" as ModerationTab, label: "Members", count: members.length },
    { id: "muted" as ModerationTab, label: "Muted", count: mutedMembers.length },
    { id: "banned" as ModerationTab, label: "Banned", count: bannedMembers.length },
  ];
  const showMembers = !canManage || moderationTab === "members";

  return (
    <div className="grid gap-5">
      <div className="pq-community-toolbar__row">
        <div className="pq-search flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input type="search" className="pq-field pq-field--ui" placeholder="Search members" aria-label="Search members" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        {community.is_member && user?.id && (
          <Button variant="secondary" onClick={() => setShowInviteModal(true)}>Invite people</Button>
        )}
      </div>

      {community.privacy === "private" && canManage && joinRequests.length > 0 && (
        <section className="pq-side-card" style={{ padding: 0 }} aria-labelledby="requests-heading">
          <h2 id="requests-heading" className="pq-side-card__title px-4 pt-4">
            Asking to join <span className="pq-tab__count ml-1">{joinRequests.length}</span>
          </h2>
          <div className="pq-list border-0 rounded-none">
            {joinRequests.map((request) => (
              <PersonRow key={request.id} person={request.profile} meta={`Asked ${formatDay(request.created_at)}`}>
                {request.message && <p className="pq-person__note">{request.message}</p>}
                <div className="pq-person__actions">
                  <Button variant="primary" size="sm" onClick={() => handleApproveRequest(request.id, request.user_id)} disabled={actionLoading}>Let them in</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleRejectRequest(request.id)} disabled={actionLoading}>Decline</Button>
                </div>
              </PersonRow>
            ))}
          </div>
        </section>
      )}

      {canManage && (
        <TabRow<ModerationTab> ariaLabel="Member lists" items={tabItems} value={moderationTab} onChange={setModerationTab} />
      )}

      {showMembers && (
        <>
          <div className="pq-chip-row" role="group" aria-label="Role">
            {([
              { id: "all" as RoleFilter, label: "Everyone" },
              { id: "admin" as RoleFilter, label: "Admins" },
              { id: "moderator" as RoleFilter, label: "Moderators" },
              { id: "member" as RoleFilter, label: "Members" },
            ]).map((role) => (
              <button key={role.id} type="button" className="pq-chip" aria-pressed={roleFilter === role.id} onClick={() => setRoleFilter(role.id)}>
                {role.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="pq-feed-state" role="status" aria-label="Loading members"><Spinner size="lg" /></div>
          ) : filteredMembers.length > 0 ? (
            <div className="pq-list">
              {filteredMembers.map((member) => (
                <PersonRow
                  key={member.id}
                  person={member.profile}
                  word={[roleWord(member.role), member.status === "muted" ? "Muted" : null].filter(Boolean).join(" · ") || undefined}
                  meta={`Joined ${formatDay(member.joined_at)}`}
                  trailing={
                    canManage && member.user_id !== user?.id && member.role !== "admin" ? (
                      <ActionMenu
                        label={`Actions for ${nameOf(member)}`}
                        items={memberMenu(member)}
                        buttonClassName="pq-icon-button"
                        buttonAriaLabel={`Actions for ${nameOf(member)}`}
                        widthClassName="w-64"
                        buttonDisabled={actionLoading}
                        portal
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <div className="pq-feed-state pq-feed-state--card">
              <p className="pq-feed-state__title">{searchQuery ? "No one by that name" : "No members yet"}</p>
              <p className="pq-feed-state__text">{searchQuery ? "Try a different name or handle." : "Invite the first people in."}</p>
            </div>
          )}
        </>
      )}

      {canManage && moderationTab === "muted" && (
        mutedLoading ? (
          <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
        ) : mutedMembers.length > 0 ? (
          <div className="pq-list">
            {mutedMembers.map((member) => (
              <PersonRow
                key={member.id}
                person={member.profile}
                word="Muted"
                meta={`${member.muted_until ? `Until ${formatDay(member.muted_until, true)}` : "No end set"}${member.mute_reason ? ` · ${member.mute_reason}` : ""}`}
                trailing={<Button variant="secondary" size="sm" onClick={() => handleUnmute(member.user_id)} disabled={actionLoading}>Unmute</Button>}
              />
            ))}
          </div>
        ) : (
          <div className="pq-feed-state pq-feed-state--card">
            <p className="pq-feed-state__title">Nobody is muted</p>
            <p className="pq-feed-state__text">Muted members stay in the community but can&rsquo;t post or comment until the mute ends.</p>
          </div>
        )
      )}

      {canManage && moderationTab === "banned" && (
        bannedLoading ? (
          <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
        ) : bannedMembers.length > 0 ? (
          <div className="pq-list">
            {bannedMembers.map((member) => (
              <PersonRow
                key={member.id}
                person={member.profile}
                word="Banned"
                meta={`${member.banned_until ? `Until ${formatDay(member.banned_until)}` : "For good"}${member.ban_reason ? ` · ${member.ban_reason}` : ""}`}
                trailing={<Button variant="secondary" size="sm" onClick={() => setUnbanTarget(member.user_id)} disabled={actionLoading}>Lift ban</Button>}
              />
            ))}
          </div>
        ) : (
          <div className="pq-feed-state pq-feed-state--card">
            <p className="pq-feed-state__title">Nobody is banned</p>
            <p className="pq-feed-state__text">Banned people are removed and can&rsquo;t rejoin until the ban ends.</p>
          </div>
        )
      )}

      {user?.id && (
        <InviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          communityId={community.id}
          communityName={community.name}
          inviterId={user.id}
          existingMemberIds={members.map((m) => m.user_id)}
        />
      )}

      <ModerationSheet key={`mute-${muteTarget?.id ?? "none"}`} kind="mute" isOpen={!!muteTarget} targetName={muteTarget?.name || ""} onClose={() => setMuteTarget(null)} onConfirm={handleMuteConfirm} loading={actionLoading} />
      <ModerationSheet key={`ban-${banTarget?.id ?? "none"}`} kind="ban" isOpen={!!banTarget} targetName={banTarget?.name || ""} onClose={() => setBanTarget(null)} onConfirm={handleBanConfirm} loading={actionLoading} />

      <ModeratorPermissionsModal
        key={`${permissionsTargetUser?.id ?? "none"}-${editingPermissions ? "edit" : "new"}`}
        isOpen={showPermissionsModal}
        onClose={() => {
          setShowPermissionsModal(false);
          setPermissionsTargetUser(null);
          setExistingPermissions(undefined);
          setEditingPermissions(false);
        }}
        onConfirm={handlePromoteWithPermissions}
        userName={permissionsTargetUser?.name || ""}
        initialPermissions={existingPermissions}
        loading={actionLoading}
        isEditing={editingPermissions}
      />

      <ConfirmationModal
        isOpen={!!demoteTarget}
        onClose={() => setDemoteTarget(null)}
        onConfirm={handleDemote}
        title={`Remove ${demoteTarget?.name || "this moderator"} as moderator?`}
        description="They stay a member and lose the moderation tools. You can make them a moderator again later."
        confirmText="Remove role"
        isDanger
        loading={actionLoading}
      />

      <ConfirmationModal
        isOpen={!!unbanTarget}
        onClose={() => setUnbanTarget(null)}
        onConfirm={handleUnban}
        title="Lift this ban?"
        description="They'll be able to find and rejoin the community."
        confirmText="Lift ban"
        loading={actionLoading}
      />
    </div>
  );
}
