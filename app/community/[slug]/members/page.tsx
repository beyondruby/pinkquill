"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useCommunityMembers, useCommunityModeration, useJoinRequests } from "@/lib/hooks";
import InviteModal from "@/components/communities/InviteModal";
import { getOptimizedAvatarUrl } from "@/lib/utils/image";

type RoleFilter = 'all' | 'admin' | 'moderator' | 'member';
type ModerationTab = 'members' | 'muted' | 'banned';

// Duration options for mute/ban (null = custom)
const muteDurations = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
  { label: "Custom", hours: -1 },
];

const banDurations = [
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
  { label: "Permanent", hours: null },
  { label: "Custom", hours: -1 },
];

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

  const { promoteUser, demoteUser, muteUser, banUser, unmuteUser, unbanUser, checkExpiredMutes } = useCommunityModeration(community?.id || '');
  const { requests: joinRequests, loading: requestsLoading, approve: approveRequest, reject: rejectRequest, refetch: refetchRequests } = useJoinRequests(community?.id || '');
  const [actionLoading, setActionLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Check and auto-unmute expired mutes on page load
  useEffect(() => {
    if (community?.id) {
      checkExpiredMutes().then(() => {
        refetchMuted();
      });
    }
  }, [community?.id]);

  // Mute modal state
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [muteTargetUser, setMuteTargetUser] = useState<{ id: string; name: string } | null>(null);
  const [selectedMuteDuration, setSelectedMuteDuration] = useState<number | null>(24);
  const [muteReason, setMuteReason] = useState("");
  const [customMuteHours, setCustomMuteHours] = useState("");

  // Ban modal state
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTargetUser, setBanTargetUser] = useState<{ id: string; name: string } | null>(null);
  const [selectedBanDuration, setSelectedBanDuration] = useState<number | null>(null);
  const [banReason, setBanReason] = useState("");
  const [customBanHours, setCustomBanHours] = useState("");

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

  const handlePromote = async (userId: string, newRole: 'moderator' | 'admin') => {
    setActionLoading(true);
    const result = await promoteUser(userId, newRole);
    if (result.success) refetch();
    setActionLoading(false);
  };

  const handleDemote = async (userId: string) => {
    setActionLoading(true);
    const result = await demoteUser(userId);
    if (result.success) refetch();
    setActionLoading(false);
  };

  const openMuteModal = (userId: string, userName: string) => {
    setMuteTargetUser({ id: userId, name: userName });
    setSelectedMuteDuration(24);
    setMuteReason("");
    setCustomMuteHours("");
    setShowMuteModal(true);
  };

  const handleMuteConfirm = async () => {
    if (!user?.id || !muteTargetUser) return;
    setActionLoading(true);

    // Calculate muted until time
    let mutedUntil: Date | undefined;
    if (selectedMuteDuration === -1 && customMuteHours) {
      // Custom duration
      mutedUntil = new Date(Date.now() + parseFloat(customMuteHours) * 60 * 60 * 1000);
    } else if (selectedMuteDuration && selectedMuteDuration > 0) {
      mutedUntil = new Date(Date.now() + selectedMuteDuration * 60 * 60 * 1000);
    }

    const result = await muteUser(muteTargetUser.id, {
      mutedUntil,
      reason: muteReason.trim() || undefined,
    });
    if (result.success) {
      refetch();
      refetchMuted();
      setShowMuteModal(false);
      setMuteTargetUser(null);
      setMuteReason("");
      setCustomMuteHours("");
    }
    setActionLoading(false);
  };

  const openBanModal = (userId: string, userName: string) => {
    setBanTargetUser({ id: userId, name: userName });
    setSelectedBanDuration(null);
    setBanReason("");
    setCustomBanHours("");
    setShowBanModal(true);
  };

  const handleBanConfirm = async () => {
    if (!user?.id || !banTargetUser) return;
    setActionLoading(true);

    // Calculate banned until time
    let bannedUntil: Date | undefined;
    if (selectedBanDuration === -1 && customBanHours) {
      // Custom duration
      bannedUntil = new Date(Date.now() + parseFloat(customBanHours) * 60 * 60 * 1000);
    } else if (selectedBanDuration && selectedBanDuration > 0) {
      bannedUntil = new Date(Date.now() + selectedBanDuration * 60 * 60 * 1000);
    }
    // null = permanent (no bannedUntil)

    const result = await banUser(banTargetUser.id, {
      bannedUntil,
      reason: banReason.trim() || undefined,
    });
    if (result.success) {
      refetch();
      refetchBanned();
      setShowBanModal(false);
      setBanTargetUser(null);
      setBanReason("");
      setCustomBanHours("");
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

  const handleUnban = async (userId: string) => {
    if (confirm('Are you sure you want to unban this user? They will be able to rejoin the community.')) {
      setActionLoading(true);
      const result = await unbanUser(userId);
      if (result.success) {
        refetchBanned();
      }
      setActionLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string, userId: string) => {
    if (!user?.id) return;
    setActionLoading(true);
    const result = await approveRequest(requestId, userId, user.id);
    if (result.success) {
      refetchRequests();
      refetch(); // Refetch members list too
    }
    setActionLoading(false);
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!user?.id) return;
    setActionLoading(true);
    const result = await rejectRequest(requestId, user.id);
    if (result.success) {
      refetchRequests();
    }
    setActionLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-xl font-bold text-ink">
          Members ({community.member_count || 0})
        </h2>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-black/5 font-ui text-sm focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>

          {/* Invite Button - shown to all members */}
          {community.is_member && user?.id && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:shadow-lg hover:shadow-pink-vivid/20 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span className="hidden sm:inline">Invite</span>
            </button>
          )}
        </div>
      </div>

      {/* Join Requests Section - for private communities */}
      {community.privacy === 'private' && canManage && joinRequests.length > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-primary/5 to-pink-vivid/5 rounded-2xl border border-purple-primary/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-primary/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3 className="font-display font-semibold text-ink">
                Join Requests ({joinRequests.length})
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {joinRequests.map((request) => (
              <div
                key={request.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white rounded-xl border border-black/5"
              >
                {/* User Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Link
                    href={`/studio/${request.profile?.username}`}
                    className="flex-shrink-0"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-primary to-pink-vivid">
                      {request.profile?.avatar_url ? (
                        <img
                          src={getOptimizedAvatarUrl(request.profile.avatar_url, 40)}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                          {(request.profile?.display_name || request.profile?.username || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/studio/${request.profile?.username}`}
                      className="font-ui font-medium text-ink hover:text-purple-primary transition-colors"
                    >
                      {request.profile?.display_name || request.profile?.username}
                    </Link>
                    <p className="font-ui text-sm text-muted">@{request.profile?.username}</p>
                  </div>
                </div>

                {/* Message */}
                {request.message && (
                  <div className="flex-1 sm:max-w-[300px]">
                    <p className="font-body text-sm text-ink/80 bg-black/5 rounded-lg px-3 py-2 italic">
                      "{request.message}"
                    </p>
                  </div>
                )}

                {/* Request Time */}
                <div className="hidden md:block text-right flex-shrink-0">
                  <p className="font-ui text-xs text-muted">Requested</p>
                  <p className="font-ui text-sm text-ink">
                    {new Date(request.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleApproveRequest(request.id, request.user_id)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:shadow-lg hover:shadow-pink-vivid/20 transition-all disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-black/5 text-ink font-ui text-sm font-medium hover:bg-black/10 transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Tabs: Members / Muted / Banned (for admins/mods) */}
      {canManage && (
        <div className="flex items-center gap-1 mb-4 border-b border-black/5">
          <button
            onClick={() => setModerationTab('members')}
            className={`px-4 py-3 font-ui text-sm font-medium border-b-2 transition-colors ${
              moderationTab === 'members'
                ? 'text-purple-primary border-purple-primary'
                : 'text-muted border-transparent hover:text-ink hover:border-gray-300'
            }`}
          >
            Members ({members.length})
          </button>
          <button
            onClick={() => setModerationTab('muted')}
            className={`px-4 py-3 font-ui text-sm font-medium border-b-2 transition-colors ${
              moderationTab === 'muted'
                ? 'text-yellow-600 border-yellow-500'
                : 'text-muted border-transparent hover:text-ink hover:border-gray-300'
            }`}
          >
            Muted ({mutedMembers.length})
          </button>
          <button
            onClick={() => setModerationTab('banned')}
            className={`px-4 py-3 font-ui text-sm font-medium border-b-2 transition-colors ${
              moderationTab === 'banned'
                ? 'text-red-600 border-red-500'
                : 'text-muted border-transparent hover:text-ink hover:border-gray-300'
            }`}
          >
            Banned ({bannedMembers.length})
          </button>
        </div>
      )}

      {/* Role Filters - only show in members tab */}
      {(!canManage || moderationTab === 'members') && (
        <div className="flex items-center gap-2 mb-4 border-b border-black/5 pb-4">
          {(['all', 'admin', 'moderator', 'member'] as RoleFilter[]).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 rounded-full text-sm font-ui font-medium transition-colors ${
                roleFilter === role
                  ? 'bg-purple-primary text-white'
                  : 'bg-black/5 text-muted hover:bg-black/10 hover:text-ink'
              }`}
            >
              {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1)}s
            </button>
          ))}
        </div>
      )}

      {/* Members List - show when members tab is active or user is not a manager */}
      {(!canManage || moderationTab === 'members') && (
        <>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-purple-primary/20 border-t-purple-primary" />
            </div>
          ) : filteredMembers.length > 0 ? (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/5 hover:border-purple-primary/10 transition-colors"
                >
                  {/* Avatar */}
                  <Link
                    href={`/studio/${member.profile?.username}`}
                    className="flex-shrink-0"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-purple-primary to-pink-vivid">
                      {member.profile?.avatar_url ? (
                        <img
                          src={getOptimizedAvatarUrl(member.profile.avatar_url, 48)}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold">
                          {(member.profile?.display_name || member.profile?.username || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/studio/${member.profile?.username}`}
                        className="font-ui font-medium text-ink hover:text-purple-primary transition-colors truncate"
                      >
                        {member.profile?.display_name || member.profile?.username}
                      </Link>
                      {/* Role Badge */}
                      {member.role !== 'member' && (
                        <span className={`px-2 py-0.5 rounded text-[0.65rem] font-ui font-semibold uppercase ${
                          member.role === 'admin'
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {member.role}
                        </span>
                      )}
                      {/* Status Badge */}
                      {member.status === 'muted' && (
                        <span className="px-2 py-0.5 rounded text-[0.65rem] font-ui font-semibold uppercase bg-yellow-100 text-yellow-600">
                          Muted
                        </span>
                      )}
                    </div>
                    <p className="font-ui text-sm text-muted truncate">
                      @{member.profile?.username}
                    </p>
                  </div>

                  {/* Joined Date */}
                  <div className="hidden md:block text-right">
                    <p className="font-ui text-xs text-muted">Joined</p>
                    <p className="font-ui text-sm text-ink">
                      {new Date(member.joined_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>

                  {/* Actions */}
                  {canManage && member.user_id !== user?.id && member.role !== 'admin' && (
                    <div className="relative group">
                      <button className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-muted hover:text-ink transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>

                      {/* Dropdown */}
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-black/5 overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                        {isAdmin && member.role === 'member' && (
                          <button
                            onClick={() => handlePromote(member.user_id, 'moderator')}
                            disabled={actionLoading}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-ui text-ink hover:bg-purple-primary/5 transition-colors disabled:opacity-50"
                          >
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                            Make Moderator
                          </button>
                        )}
                        {isAdmin && member.role === 'moderator' && (
                          <button
                            onClick={() => handleDemote(member.user_id)}
                            disabled={actionLoading}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-ui text-ink hover:bg-purple-primary/5 transition-colors disabled:opacity-50"
                          >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                            Remove Mod Role
                          </button>
                        )}
                        {member.status !== 'muted' && (
                          <button
                            onClick={() => openMuteModal(member.user_id, member.profile?.display_name || member.profile?.username || 'User')}
                            disabled={actionLoading}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-ui text-ink hover:bg-purple-primary/5 transition-colors disabled:opacity-50"
                          >
                            <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                            Mute User
                          </button>
                        )}
                        <button
                          onClick={() => openBanModal(member.user_id, member.profile?.display_name || member.profile?.username || 'User')}
                          disabled={actionLoading}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-ui text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          Ban User
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-primary/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-ink mb-2">
                {searchQuery ? 'No members found' : 'No members yet'}
              </h3>
              <p className="font-body text-muted">
                {searchQuery ? 'Try a different search term' : 'Be the first to join!'}
              </p>
            </div>
          )}
        </>
      )}

      {/* Muted Members List */}
      {canManage && moderationTab === 'muted' && (
        <>
          {mutedLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-yellow-500/20 border-t-yellow-500" />
            </div>
          ) : mutedMembers.length > 0 ? (
            <div className="space-y-2">
              {mutedMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-yellow-200"
                >
                  {/* Avatar */}
                  <Link href={`/studio/${member.profile?.username}`} className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-primary to-pink-vivid">
                      {member.profile?.avatar_url ? (
                        <img src={getOptimizedAvatarUrl(member.profile.avatar_url, 40)} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                          {(member.profile?.display_name || member.profile?.username || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/studio/${member.profile?.username}`}
                      className="font-ui font-medium text-ink hover:text-purple-primary transition-colors"
                    >
                      {member.profile?.display_name || member.profile?.username}
                    </Link>
                    <p className="font-ui text-sm text-muted">@{member.profile?.username}</p>
                  </div>

                  {/* Mute Info */}
                  <div className="text-right max-w-[200px]">
                    {member.muted_until ? (
                      <>
                        <p className="font-ui text-xs text-muted">Muted until</p>
                        <p className="font-ui text-sm text-yellow-600">
                          {new Date(member.muted_until).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </>
                    ) : (
                      <p className="font-ui text-sm text-yellow-600">Indefinite</p>
                    )}
                    {member.mute_reason && (
                      <p className="font-ui text-xs text-muted mt-1 truncate" title={member.mute_reason}>
                        {member.mute_reason}
                      </p>
                    )}
                  </div>

                  {/* Unmute Button */}
                  <button
                    onClick={() => handleUnmute(member.user_id)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-yellow-100 text-yellow-700 font-ui text-sm font-medium hover:bg-yellow-200 transition-colors disabled:opacity-50"
                  >
                    Unmute
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-ink mb-2">No muted users</h3>
              <p className="font-body text-muted">No members are currently muted in this community.</p>
            </div>
          )}
        </>
      )}

      {/* Banned Members List */}
      {canManage && moderationTab === 'banned' && (
        <>
          {bannedLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-red-500/20 border-t-red-500" />
            </div>
          ) : bannedMembers.length > 0 ? (
            <div className="space-y-2">
              {bannedMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-red-200"
                >
                  {/* Avatar */}
                  <Link href={`/studio/${member.profile?.username}`} className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-primary to-pink-vivid">
                      {member.profile?.avatar_url ? (
                        <img src={getOptimizedAvatarUrl(member.profile.avatar_url, 40)} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                          {(member.profile?.display_name || member.profile?.username || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/studio/${member.profile?.username}`}
                      className="font-ui font-medium text-ink hover:text-purple-primary transition-colors"
                    >
                      {member.profile?.display_name || member.profile?.username}
                    </Link>
                    <p className="font-ui text-sm text-muted">@{member.profile?.username}</p>
                  </div>

                  {/* Ban Info */}
                  <div className="text-right max-w-[200px]">
                    {member.banned_until ? (
                      <>
                        <p className="font-ui text-xs text-muted">Banned until</p>
                        <p className="font-ui text-sm text-red-600">
                          {new Date(member.banned_until).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </>
                    ) : (
                      <p className="font-ui text-sm text-red-600">Permanent</p>
                    )}
                    {member.ban_reason && (
                      <p className="font-ui text-xs text-muted mt-1 truncate" title={member.ban_reason}>
                        {member.ban_reason}
                      </p>
                    )}
                  </div>

                  {/* Unban Button */}
                  <button
                    onClick={() => handleUnban(member.user_id)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-red-100 text-red-700 font-ui text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    Unban
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-ink mb-2">No banned users</h3>
              <p className="font-body text-muted">No users have been banned from this community.</p>
            </div>
          )}
        </>
      )}

      {/* Invite Modal */}
      {user?.id && (
        <InviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          communityId={community.id}
          communityName={community.name}
          inviterId={user.id}
          existingMemberIds={members.map(m => m.user_id)}
        />
      )}

      {/* Mute Modal */}
      {showMuteModal && muteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-black/5">
              <h3 className="font-display text-lg font-semibold text-ink">
                Mute {muteTargetUser.name}
              </h3>
              <p className="font-body text-sm text-muted mt-1">
                Muted members cannot post or comment in this community.
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Mute Duration */}
              <div>
                <label className="block font-ui text-sm font-medium text-ink mb-3">
                  Mute Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {muteDurations.map((duration) => (
                    <button
                      key={duration.hours ?? 'custom'}
                      type="button"
                      onClick={() => setSelectedMuteDuration(duration.hours)}
                      className={`px-4 py-3 rounded-xl font-ui text-sm font-medium transition-all ${
                        selectedMuteDuration === duration.hours
                          ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-400'
                          : 'bg-black/5 text-ink hover:bg-black/10'
                      }`}
                    >
                      {duration.label}
                    </button>
                  ))}
                </div>

                {/* Custom Duration Input */}
                {selectedMuteDuration === -1 && (
                  <div className="mt-3">
                    <label className="block font-ui text-xs text-muted mb-1">
                      Enter hours
                    </label>
                    <input
                      type="number"
                      value={customMuteHours}
                      onChange={(e) => setCustomMuteHours(e.target.value)}
                      placeholder="e.g. 48"
                      min="1"
                      className="w-full px-4 py-2.5 rounded-xl border border-yellow-300 bg-yellow-50 font-ui text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
                    />
                  </div>
                )}
              </div>

              {/* Mute Reason */}
              <div>
                <label className="block font-ui text-sm font-medium text-ink mb-2">
                  Reason <span className="text-muted font-normal">(shown to user)</span>
                </label>
                <textarea
                  value={muteReason}
                  onChange={(e) => setMuteReason(e.target.value)}
                  placeholder="Explain why this user is being muted..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white font-body text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-black/5 flex gap-3">
              <button
                onClick={() => {
                  setShowMuteModal(false);
                  setMuteTargetUser(null);
                  setMuteReason("");
                  setCustomMuteHours("");
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-black/10 font-ui text-sm font-medium text-ink hover:bg-black/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMuteConfirm}
                disabled={actionLoading || (selectedMuteDuration === -1 && !customMuteHours)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-yellow-500 text-white font-ui text-sm font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Muting...' : 'Mute User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {showBanModal && banTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-black/5">
              <h3 className="font-display text-lg font-semibold text-red-600">
                Ban {banTargetUser.name}
              </h3>
              <p className="font-body text-sm text-muted mt-1">
                Banned users will be removed from the community.
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Ban Duration */}
              <div>
                <label className="block font-ui text-sm font-medium text-ink mb-3">
                  Ban Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {banDurations.map((duration) => (
                    <button
                      key={duration.label}
                      type="button"
                      onClick={() => setSelectedBanDuration(duration.hours)}
                      className={`px-4 py-3 rounded-xl font-ui text-sm font-medium transition-all ${
                        selectedBanDuration === duration.hours
                          ? 'bg-red-100 text-red-700 ring-2 ring-red-400'
                          : 'bg-black/5 text-ink hover:bg-black/10'
                      }`}
                    >
                      {duration.label}
                    </button>
                  ))}
                </div>

                {/* Custom Duration Input */}
                {selectedBanDuration === -1 && (
                  <div className="mt-3">
                    <label className="block font-ui text-xs text-muted mb-1">
                      Enter hours
                    </label>
                    <input
                      type="number"
                      value={customBanHours}
                      onChange={(e) => setCustomBanHours(e.target.value)}
                      placeholder="e.g. 168 (7 days)"
                      min="1"
                      className="w-full px-4 py-2.5 rounded-xl border border-red-300 bg-red-50 font-ui text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-red-400/30"
                    />
                  </div>
                )}
              </div>

              {/* Ban Reason */}
              <div>
                <label className="block font-ui text-sm font-medium text-ink mb-2">
                  Reason <span className="text-muted font-normal">(shown to user)</span>
                </label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Explain why this user is being banned..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white font-body text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-black/5 flex gap-3">
              <button
                onClick={() => {
                  setShowBanModal(false);
                  setBanTargetUser(null);
                  setBanReason("");
                  setCustomBanHours("");
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-black/10 font-ui text-sm font-medium text-ink hover:bg-black/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBanConfirm}
                disabled={actionLoading || (selectedBanDuration === -1 && !customBanHours)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-ui text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Banning...' : 'Ban User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
