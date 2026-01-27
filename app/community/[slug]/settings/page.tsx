"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useDeleteCommunity } from "@/lib/hooks";

export default function CommunitySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, loading } = useCommunity(slug, user?.id);
  const { delete: deleteCommunity, deleting } = useDeleteCommunity();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const handleDelete = async () => {
    if (!community || confirmName !== community.name) return;

    const result = await deleteCommunity(community.id);
    if (result.success) {
      router.push('/community');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-3 border-purple-primary/20 border-t-purple-primary" />
      </div>
    );
  }

  if (!community) return null;

  const isAdmin = community.user_role === 'admin';
  const isMod = community.user_role === 'moderator';

  if (!isAdmin && !isMod) {
    router.push(`/community/${slug}`);
    return null;
  }

  const settingsOptions = [
    {
      title: 'General',
      description: 'Edit community name, description, avatar, and cover image',
      href: `/community/${slug}/settings/general`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      adminOnly: false,
    },
    {
      title: 'Rules',
      description: 'Manage community guidelines and rules',
      href: `/community/${slug}/settings/rules`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      adminOnly: false,
    },
    {
      title: 'Moderation',
      description: 'View moderation log, muted and banned users',
      href: `/community/${slug}/settings/moderation`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      adminOnly: false,
    },
    {
      title: 'Members',
      description: 'Manage member roles and permissions',
      href: `/community/${slug}/settings/members`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      adminOnly: true,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="font-display text-xl font-bold text-ink mb-6">Settings</h2>

      <div className="space-y-3">
        {settingsOptions
          .filter(option => !option.adminOnly || isAdmin)
          .map((option) => (
            <Link
              key={option.title}
              href={option.href}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/5 hover:border-purple-primary/20 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-primary/10 flex items-center justify-center text-purple-primary group-hover:bg-purple-primary group-hover:text-white transition-colors">
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-ui font-semibold text-ink group-hover:text-purple-primary transition-colors">
                  {option.title}
                </h3>
                <p className="font-body text-sm text-muted">{option.description}</p>
              </div>
              <svg className="w-5 h-5 text-muted group-hover:text-purple-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
      </div>

      {/* Danger Zone - Admin Only */}
      {isAdmin && (
        <div className="mt-8 p-4 rounded-xl border border-red-200 bg-red-50/50">
          <h3 className="font-ui font-semibold text-red-600 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Danger Zone
          </h3>
          <p className="font-body text-sm text-red-600/80 mb-4">
            These actions are permanent and cannot be undone.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 rounded-lg bg-red-500 text-white font-ui text-sm font-medium hover:bg-red-600 transition-colors"
          >
            Delete Community
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => !deleting && setShowDeleteModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] bg-white rounded-2xl shadow-2xl z-[1001] p-6">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="font-display text-xl text-ink text-center mb-2">Delete Community?</h3>
            <p className="font-body text-sm text-muted text-center mb-6">
              This will permanently delete <span className="font-semibold text-ink">{community?.name}</span> and all its posts, members, and data. This action cannot be undone.
            </p>

            <div className="mb-6">
              <label className="block font-ui text-sm text-muted mb-2">
                Type <span className="font-semibold text-ink">{community?.name}</span> to confirm
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-black/10 font-body text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
                placeholder="Community name"
                disabled={deleting}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmName('');
                }}
                disabled={deleting}
                className="px-5 py-2.5 rounded-full font-ui text-sm text-muted bg-black/[0.04] hover:bg-black/[0.08] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || confirmName !== community?.name}
                className="px-5 py-2.5 rounded-full font-ui text-sm text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Forever"
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
