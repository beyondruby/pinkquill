"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useCommunityMembers, useJoinRequests, useCommunityModeration } from "@/lib/hooks";

type TabType = 'moderators' | 'requests';

export default function CommunityMembersSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, refetch: refetchCommunity } = useCommunity(slug, user?.id);
  const [activeTab, setActiveTab] = useState<TabType>('moderators');

  console.log("[MembersPage] Render - community:", community?.id, "privacy:", community?.privacy, "user_role:", community?.user_role);

  const { members: moderators, loading: modsLoading, refetch: refetchMods } = useCommunityMembers(
    community?.id || '',
    { role: 'moderator' }
  );

  const { requests, loading: requestsLoading, approve, reject, refetch: refetchRequests } = useJoinRequests(community?.id || '');
  console.log("[MembersPage] Join requests:", requests.length, "loading:", requestsLoading);

  const { promoteUser, demoteUser } = useCommunityModeration(community?.id || '');
  const [actionLoading, setActionLoading] = useState(false);

  if (!community) return null;

  const isAdmin = community.user_role === 'admin';

  if (!isAdmin) {
    router.push(`/community/${slug}/settings`);
    return null;
  }

  const handlePromote = async (userId: string) => {
    setActionLoading(true);
    const result = await promoteUser(userId, 'moderator');
    if (result.success) refetchMods();
    setActionLoading(false);
  };

  const handleDemote = async (userId: string) => {
    if (confirm('Are you sure you want to remove moderator role from this user?')) {
      setActionLoading(true);
      const result = await demoteUser(userId);
      if (result.success) refetchMods();
      setActionLoading(false);
    }
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

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="font-display text-xl font-bold text-ink mb-2">Member Management</h2>
      <p className="font-body text-muted mb-6">
        Manage moderators and join requests for your community.
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-black/5">
        <button
          onClick={() => setActiveTab('moderators')}
          className={`px-4 py-3 font-ui text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'moderators'
              ? 'text-blue-600 border-blue-500'
              : 'text-muted border-transparent hover:text-ink hover:border-gray-300'
          }`}
        >
          Moderators ({moderators.length})
        </button>
        {community.privacy === 'private' && (
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-3 font-ui text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === 'requests'
                ? 'text-purple-primary border-purple-primary'
                : 'text-muted border-transparent hover:text-ink hover:border-gray-300'
            }`}
          >
            Join Requests
            {pendingRequests.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[0.65rem] font-semibold">
                {pendingRequests.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Moderators Tab */}
      {activeTab === 'moderators' && (
        <>
          {modsLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-purple-primary/20 border-t-purple-primary" />
            </div>
          ) : moderators.length > 0 ? (
            <div className="space-y-2">
              {moderators.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/5"
                >
                  <Link
                    href={`/studio/${member.profile?.username}`}
                    className="flex-shrink-0"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-primary to-pink-vivid">
                      {member.profile?.avatar_url ? (
                        <img src={member.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                          {(member.profile?.display_name || member.profile?.username || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/studio/${member.profile?.username}`}
                        className="font-ui font-medium text-ink hover:text-purple-primary transition-colors"
                      >
                        {member.profile?.display_name || member.profile?.username}
                      </Link>
                      <span className="px-2 py-0.5 rounded text-[0.65rem] font-ui font-semibold uppercase bg-blue-100 text-blue-600">
                        Moderator
                      </span>
                    </div>
                    <p className="font-ui text-sm text-muted">@{member.profile?.username}</p>
                  </div>

                  <button
                    onClick={() => handleDemote(member.user_id)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-red-100 text-red-700 font-ui text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-ink mb-2">No moderators yet</h3>
              <p className="font-body text-muted">
                Promote members to help manage the community.
              </p>
            </div>
          )}

          <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="font-body text-sm text-blue-700">
              <strong>Tip:</strong> To promote a member to moderator, visit the{' '}
              <Link href={`/community/${slug}/members`} className="underline hover:no-underline">
                members page
              </Link>{' '}
              and use the action menu on their profile.
            </p>
          </div>
        </>
      )}

      {/* Join Requests Tab */}
      {activeTab === 'requests' && (
        <>
          {requestsLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-purple-primary/20 border-t-purple-primary" />
            </div>
          ) : pendingRequests.length > 0 ? (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 bg-white rounded-xl border border-black/5"
                >
                  <div className="flex items-start gap-4">
                    <Link
                      href={`/studio/${request.profile?.username}`}
                      className="flex-shrink-0"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-purple-primary to-pink-vivid">
                        {request.profile?.avatar_url ? (
                          <img src={request.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-bold">
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

                      {request.message && (
                        <div className="mt-2 p-3 rounded-lg bg-black/[0.02] border border-black/5">
                          <p className="font-body text-sm text-ink">{request.message}</p>
                        </div>
                      )}

                      <p className="font-ui text-xs text-muted mt-2">
                        Requested {new Date(request.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-black/5">
                    <button
                      onClick={() => handleApprove(request.id, request.user_id)}
                      className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:shadow-lg transition-all"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      className="flex-1 px-4 py-2 rounded-lg bg-black/5 text-ink font-ui text-sm font-medium hover:bg-black/10 transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-primary/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-ink mb-2">No pending requests</h3>
              <p className="font-body text-muted">
                New join requests will appear here for review.
              </p>
            </div>
          )}
        </>
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
