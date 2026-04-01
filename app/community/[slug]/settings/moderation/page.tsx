"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useCommunityMembers, useCommunityModeration, useModLog } from "@/lib/hooks";
import { stripHtml } from "@/lib/utils/sanitize";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { CommentIcon } from "@/components/ui/Icons";

type TabType = 'mod-log' | 'muted' | 'banned';

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CommunityModerationSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community } = useCommunity(slug, user?.id);
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
    router.push(`/community/${slug}`);
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

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="font-display text-xl font-bold text-ink mb-2">Moderation</h2>
      <p className="font-body text-muted mb-6">
        View moderation activity and manage muted or banned users.
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-black/5">
        <button
          onClick={() => setActiveTab('mod-log')}
          className={`px-4 py-3 font-ui text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'mod-log'
              ? 'text-purple-primary border-purple-primary'
              : 'text-muted border-transparent hover:text-ink hover:border-black/[0.12]'
          }`}
        >
          Mod Log
        </button>
        <button
          onClick={() => setActiveTab('muted')}
          className={`px-4 py-3 font-ui text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'muted'
              ? 'text-yellow-600 border-yellow-500'
              : 'text-muted border-transparent hover:text-ink hover:border-black/[0.12]'
          }`}
        >
          Muted ({mutedMembers.length})
        </button>
        <button
          onClick={() => setActiveTab('banned')}
          className={`px-4 py-3 font-ui text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'banned'
              ? 'text-red-600 border-red-500'
              : 'text-muted border-transparent hover:text-ink hover:border-black/[0.12]'
          }`}
        >
          Banned ({bannedMembers.length})
        </button>
      </div>

      {/* Mod Log Tab */}
      {activeTab === 'mod-log' && (
        <>
          {modLogLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-purple-primary/20 border-t-purple-primary" />
            </div>
          ) : modLogEntries.length > 0 ? (
            <div className="space-y-3">
              {modLogEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 bg-white rounded-xl border border-black/5 hover:border-purple-primary/10 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Moderator Avatar */}
                    <Link
                      href={`/studio/${entry.moderator_profile?.username || ''}`}
                      className="flex-shrink-0"
                    >
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-purple-primary to-pink-vivid">
                        {entry.moderator_profile?.avatar_url ? (
                          <img
                            src={entry.moderator_profile.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs">
                            {(entry.moderator_profile?.display_name || entry.moderator_profile?.username || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Action line */}
                      <p className="font-ui text-sm text-ink">
                        <Link
                          href={`/studio/${entry.moderator_profile?.username || ''}`}
                          className="font-semibold hover:text-purple-primary transition-colors"
                        >
                          {entry.moderator_profile?.display_name || entry.moderator_profile?.username || 'Unknown'}
                        </Link>
                        {' '}deleted a{' '}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 text-purple-primary">
                          {entry.content_type === 'post' ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                          ) : (
                            <CommentIcon size="sm" className="w-3 h-3" />
                          )}
                          {entry.content_type === 'post' ? 'Post' : 'Comment'}
                        </span>
                        {entry.author_profile && (
                          <>
                            {' '}by{' '}
                            <Link
                              href={`/studio/${entry.author_profile.username}`}
                              className="font-medium text-ink hover:text-purple-primary transition-colors"
                            >
                              @{entry.author_profile.username}
                            </Link>
                          </>
                        )}
                      </p>

                      {/* Content Snapshot */}
                      {entry.content_snapshot && (
                        <div className="mt-2 px-3 py-2.5 rounded-lg bg-black/[0.02] border border-black/5">
                          {entry.content_snapshot.title && (
                            <p className="font-ui text-sm font-semibold text-ink/80 mb-1">
                              {entry.content_snapshot.title}
                            </p>
                          )}
                          <p className="font-body text-sm text-ink/60 line-clamp-3">
                            {stripHtml(entry.content_snapshot.content || "").slice(0, 300)}
                          </p>
                        </div>
                      )}

                      {/* Reason */}
                      {entry.reason && (
                        <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-orange-50/50 border border-orange-200/30">
                          <svg className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <p className="font-body text-sm text-orange-700/80">
                            {entry.reason}
                          </p>
                        </div>
                      )}

                      {/* Timestamp */}
                      <p className="font-ui text-xs text-muted mt-2">
                        {getTimeAgo(entry.deleted_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Load More */}
              {modLogHasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={loadMoreModLog}
                    className="px-5 py-2.5 rounded-full bg-black/5 text-ink font-ui text-sm font-medium hover:bg-black/10 transition-colors"
                  >
                    Load more
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-primary/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-ink mb-2">
                No moderation activity
              </h3>
              <p className="font-body text-muted">
                When posts or comments are removed by moderators, they will appear here.
              </p>
            </div>
          )}
        </>
      )}

      {/* Muted / Banned Tabs */}
      {(activeTab === 'muted' || activeTab === 'banned') && (() => {
        const currentMembers = activeTab === 'muted' ? mutedMembers : bannedMembers;
        const currentLoading = activeTab === 'muted' ? mutedLoading : bannedLoading;

        return currentLoading ? (
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
                )}

                {/* Actions */}
                <button
                  onClick={() => activeTab === 'muted' ? handleUnmute(member.user_id) : setUnbanTarget(member.user_id)}
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
        );
      })()}

      <div className="mt-8 flex justify-start">
        <button
          type="button"
          onClick={() => router.push(`/community/${slug}/settings`)}
          className="px-5 py-2.5 rounded-full bg-black/5 text-ink font-ui font-medium hover:bg-black/10 transition-colors"
        >
          Back to Settings
        </button>
      </div>

      <ConfirmationModal
        isOpen={!!unbanTarget}
        onClose={() => setUnbanTarget(null)}
        onConfirm={handleUnban}
        title="Unban User?"
        description="Are you sure you want to unban this user? They will be able to rejoin the community."
        confirmText="Unban"
        isDanger
        loading={actionLoading}
      />
    </div>
  );
}
