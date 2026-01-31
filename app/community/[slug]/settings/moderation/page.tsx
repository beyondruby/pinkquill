"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useCommunityMembers, useCommunityModeration } from "@/lib/hooks";

type TabType = 'muted' | 'banned';

export default function CommunityModerationSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community } = useCommunity(slug, user?.id);
  const [activeTab, setActiveTab] = useState<TabType>('muted');

  const { members: mutedMembers, loading: mutedLoading, refetch: refetchMuted } = useCommunityMembers(
    community?.id || '',
    { status: 'muted' }
  );

  const { members: bannedMembers, loading: bannedLoading, refetch: refetchBanned } = useCommunityMembers(
    community?.id || '',
    { status: 'banned' }
  );

  const { checkExpiredMutes, unmuteUser, unbanUser } = useCommunityModeration(community?.id || '');
  const [actionLoading, setActionLoading] = useState(false);

  // Check and auto-unmute expired mutes on page load
  useEffect(() => {
    if (community?.id) {
      checkExpiredMutes().then(() => {
        refetchMuted();
      });
    }
  }, [community?.id]);

  if (!community) return null;

  const isAdmin = community.user_role === 'admin';
  const isMod = community.user_role === 'moderator';

  if (!isAdmin && !isMod) {
    router.push(`/community/${slug}`);
    return null;
  }

  const handleUnmute = async (userId: string) => {
    setActionLoading(true);
    const result = await unmuteUser(userId);
    if (result.success) refetchMuted();
    setActionLoading(false);
  };

  const handleUnban = async (userId: string) => {
    if (confirm('Are you sure you want to unban this user? They will be able to rejoin the community.')) {
      setActionLoading(true);
      const result = await unbanUser(userId);
      if (result.success) refetchBanned();
      setActionLoading(false);
    }
  };

  const currentMembers = activeTab === 'muted' ? mutedMembers : bannedMembers;
  const currentLoading = activeTab === 'muted' ? mutedLoading : bannedLoading;

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="font-display text-xl font-bold text-ink mb-2">Moderation</h2>
      <p className="font-body text-muted mb-6">
        Manage muted and banned users in your community.
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-black/5">
        <button
          onClick={() => setActiveTab('muted')}
          className={`px-4 py-3 font-ui text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'muted'
              ? 'text-yellow-600 border-yellow-500'
              : 'text-muted border-transparent hover:text-ink hover:border-gray-300'
          }`}
        >
          Muted ({mutedMembers.length})
        </button>
        <button
          onClick={() => setActiveTab('banned')}
          className={`px-4 py-3 font-ui text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'banned'
              ? 'text-red-600 border-red-500'
              : 'text-muted border-transparent hover:text-ink hover:border-gray-300'
          }`}
        >
          Banned ({bannedMembers.length})
        </button>
      </div>

      {/* List */}
      {currentLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-purple-primary/20 border-t-purple-primary" />
        </div>
      ) : currentMembers.length > 0 ? (
        <div className="space-y-2">
          {currentMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/5"
            >
              {/* Avatar */}
              <Link
                href={`/studio/${member.profile?.username}`}
                className="flex-shrink-0"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-primary to-pink-vivid">
                  {member.profile?.avatar_url ? (
                    <img
                      src={member.profile.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
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

              {/* Muted Until */}
              {activeTab === 'muted' && member.muted_until && (
                <div className="text-right">
                  <p className="font-ui text-xs text-muted">Muted until</p>
                  <p className="font-ui text-sm text-yellow-600">
                    {new Date(member.muted_until).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}

              {/* Banned Info */}
              {activeTab === 'banned' && (
                <div className="text-right max-w-[200px]">
                  {(member as any).banned_until ? (
                    <>
                      <p className="font-ui text-xs text-muted">Banned until</p>
                      <p className="font-ui text-sm text-red-600">
                        {new Date((member as any).banned_until).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </>
                  ) : (
                    <p className="font-ui text-sm text-red-600">Permanent</p>
                  )}
                  {(member as any).ban_reason && (
                    <p className="font-ui text-xs text-muted mt-1 truncate" title={(member as any).ban_reason}>
                      {(member as any).ban_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <button
                onClick={() => activeTab === 'muted' ? handleUnmute(member.user_id) : handleUnban(member.user_id)}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-lg font-ui text-sm font-medium transition-colors disabled:opacity-50 ${
                  activeTab === 'muted'
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {activeTab === 'muted' ? 'Unmute' : 'Unban'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            activeTab === 'muted' ? 'bg-yellow-100' : 'bg-red-100'
          }`}>
            {activeTab === 'muted' ? (
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
          </div>
          <h3 className="font-display text-lg font-semibold text-ink mb-2">
            No {activeTab} users
          </h3>
          <p className="font-body text-muted">
            {activeTab === 'muted'
              ? 'No members are currently muted in this community.'
              : 'No users have been banned from this community.'}
          </p>
        </div>
      )}

      <div className="mt-8 flex justify-start">
        <button
          type="button"
          onClick={() => router.push(`/community/${slug}/settings`)}
          className="px-5 py-2.5 rounded-full bg-black/5 text-ink font-ui font-medium hover:bg-black/10 transition-colors"
        >
          Back to Settings
        </button>
      </div>
    </div>
  );
}
