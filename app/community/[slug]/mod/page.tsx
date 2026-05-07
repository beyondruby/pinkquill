"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity } from "@/lib/hooks";
import { ModQueuePage } from "@/components/communities/ModQueue";

export default function CommunityModQueuePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, loading } = useCommunity(slug, user?.id);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-3 border-purple-primary/20 border-t-purple-primary" />
      </div>
    );
  }

  if (!community) {
    return null;
  }

  // Only admins and moderators can access the mod queue
  if (community.user_role !== "admin" && community.user_role !== "moderator") {
    router.push(`/community/${slug}`);
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted mb-4">
          <Link
            href={`/community/${slug}`}
            className="hover:text-accent transition-colors"
          >
            {community.name}
          </Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span>Mod Queue</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-ink">
              Moderation Queue
            </h1>
            <p className="text-muted mt-1">
              Review and manage reported content in your community
            </p>
          </div>

          <Link
            href={`/community/${slug}/settings`}
            className="flex items-center gap-2 px-4 py-2 text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
        </div>
      </div>

      {/* Mod Queue Content */}
      <ModQueuePage communityId={community.id} />
    </div>
  );
}
