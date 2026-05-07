"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity } from "@/lib/hooks";
import FlairManager from "@/components/communities/FlairManager";

export default function CommunityFlairsSettingsPage() {
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

  // Only admins can manage flairs
  if (community.user_role !== "admin") {
    router.push(`/community/${slug}`);
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href={`/community/${slug}/settings`}
        className="inline-flex items-center gap-2 text-muted hover:text-ink transition-colors mb-6"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Settings
      </Link>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-ink mb-2">
          Post Flairs
        </h1>
        <p className="text-muted">
          Create categories to help organize posts in your community. Members
          can add a flair when creating posts.
        </p>
      </div>

      {/* Flair Manager */}
      <div className="bg-surface rounded-xl border border-border-light p-6">
        <FlairManager communityId={community.id} />
      </div>
    </div>
  );
}
