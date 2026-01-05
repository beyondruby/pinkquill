"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useCommunityMembers, useCommunityModeration } from "@/lib/hooks";
import InviteModal from "@/components/communities/InviteModal";

type RoleFilter = 'all' | 'admin' | 'moderator' | 'member';

export default function CommunityMembersPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community } = useCommunity(slug, user?.id);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState("");

  const { members, loading, refetch } = useCommunityMembers(
    community?.id || '',
    { role: roleFilter === 'all' ? undefined : roleFilter }
  );

  const { promoteUser, demoteUser, muteUser, banUser } = useCommunityModeration(community?.id || '');
  const [actionLoading, setActionLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

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

  const handleMute = async (userId: string, hours: number) => {
    if (!user?.id) return;
    setActionLoading(true);
    const mutedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    const result = await muteUser(userId, user.id, mutedUntil);
    if (result.success) refetch();
    setActionLoading(false);
  };

  const handleBan = async (userId: string) => {
    if (!user?.id) return;
    if (confirm('Are you sure you want to ban this user? They will be removed from the community.')) {
      setActionLoading(true);
      const result = await banUser(userId, user.id);
      if (result.success) refetch();
      setActionLoading(false);
    }
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

      {/* Role Filters */}
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

      {/* Members List */}
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
                      src={member.profile.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
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
                        onClick={() => handleMute(member.user_id, 24)}
                        disabled={actionLoading}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-ui text-ink hover:bg-purple-primary/5 transition-colors disabled:opacity-50"
                      >
                        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                        Mute (24h)
                      </button>
                    )}
                    <button
                      onClick={() => handleBan(member.user_id)}
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
    </div>
  );
}
