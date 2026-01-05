"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity } from "@/lib/hooks";
import CommunityHeader from "@/components/communities/CommunityHeader";
import JoinButton from "@/components/communities/JoinButton";

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, tags, loading, error, refetch } = useCommunity(slug, user?.id);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="relative mb-6">
          {/* Animated gradient background */}
          <div className="absolute -inset-8 bg-gradient-to-r from-purple-primary/20 via-pink-vivid/20 to-orange-warm/20 rounded-full blur-2xl animate-pulse" />

          {/* Spinner */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-purple-primary/20 border-t-purple-primary animate-spin" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-r-pink-vivid/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
        </div>
        <p className="font-ui text-sm text-muted animate-pulse">Loading community...</p>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="relative">
          {/* Decorative background */}
          <div className="absolute inset-0 -m-8 bg-gradient-to-br from-red-500/5 via-pink-vivid/5 to-purple-primary/5 rounded-3xl blur-xl" />

          <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl border border-red-200/50 p-10 shadow-xl">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-bold text-ink mb-3">Community Not Found</h1>
            <p className="font-body text-muted mb-8 max-w-sm mx-auto">
              This community doesn't exist or you don't have permission to view it.
            </p>
            <Link
              href="/community"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui font-semibold shadow-lg shadow-purple-primary/25 hover:shadow-xl hover:shadow-pink-vivid/30 hover:-translate-y-0.5 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Browse Communities
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if user can view private community
  if (community.privacy === 'private' && !community.is_member && community.created_by !== user?.id) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="relative">
          {/* Decorative background */}
          <div className="absolute inset-0 -m-8 bg-gradient-to-br from-purple-primary/10 via-pink-vivid/10 to-orange-warm/10 rounded-3xl blur-xl" />

          <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl border border-purple-primary/20 overflow-hidden shadow-2xl shadow-purple-primary/10">
            {/* Header decoration */}
            <div className="h-32 bg-gradient-to-br from-purple-primary via-pink-vivid/80 to-orange-warm/60 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <pattern id="private-pattern" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                      <circle cx="5" cy="5" r="1" fill="white" />
                    </pattern>
                  </defs>
                  <rect width="100" height="100" fill="url(#private-pattern)" />
                </svg>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 text-center">
              <h1 className="font-display text-2xl font-bold text-ink mb-2">{community.name}</h1>
              <p className="font-body text-muted mb-6">
                This is a private community. Request to join to see posts and members.
              </p>

              {/* Community preview stats */}
              <div className="flex items-center justify-center gap-6 mb-8">
                <div className="text-center">
                  <p className="font-display text-2xl font-bold text-ink">{community.member_count || 0}</p>
                  <p className="font-ui text-xs text-muted">members</p>
                </div>
                <div className="w-px h-10 bg-purple-primary/10" />
                <div className="text-center">
                  <p className="font-display text-2xl font-bold text-ink">{community.post_count || 0}</p>
                  <p className="font-ui text-xs text-muted">posts</p>
                </div>
              </div>

              {user ? (
                <JoinButton
                  community={community}
                  userId={user.id}
                  onUpdate={refetch}
                  size="lg"
                />
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui font-semibold shadow-lg shadow-purple-primary/25 hover:shadow-xl hover:shadow-pink-vivid/30 hover:-translate-y-0.5 transition-all"
                >
                  Sign in to Request Access
                </Link>
              )}

              <p className="font-ui text-xs text-muted mt-6">
                The community admin will review your request
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <CommunityHeader
        community={community}
        tags={tags}
        userId={user?.id}
        onUpdate={refetch}
      />
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-8">
        {children}
      </div>
    </div>
  );
}
