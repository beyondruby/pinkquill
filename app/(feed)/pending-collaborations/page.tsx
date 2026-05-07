"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePendingCollaborations } from "@/lib/hooks";

interface RawCollaborator {
  status?: string;
  user?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  }[];
}

function PendingCollaborationsPageContent() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { posts, loading } = usePendingCollaborations(user?.id);
  const justCreated = searchParams.get("created") === "1";

  const pendingPosts = useMemo(() => {
    return (posts || []).map((post) => {
      const collaborators = Array.isArray(post.collaborators)
        ? (post.collaborators as RawCollaborator[])
        : [];
      const pendingCount = collaborators.filter((collab) => collab.status === "pending").length;
      const acceptedCount = collaborators.filter((collab) => collab.status === "accepted").length;
      const declinedCount = collaborators.filter((collab) => collab.status === "declined").length;

      return {
        id: post.id,
        title: post.title || "Untitled post",
        type: post.type,
        createdAt: post.created_at,
        pendingCount,
        acceptedCount,
        declinedCount,
      };
    }).filter((post) => post.pendingCount + post.acceptedCount + post.declinedCount > 0);
  }, [posts]);

  if (authLoading || loading) {
    return (
      <div className="max-w-[720px] mx-auto py-10 px-6">
        <div className="w-8 h-8 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-body text-muted text-center italic">Loading pending collaborations...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-[720px] mx-auto py-10 px-6 text-center">
        <h1 className="font-display text-[2rem] text-ink mb-3">Pending Collaborations</h1>
        <p className="font-body text-muted mb-6">Sign in to review posts waiting on collaborator approval.</p>
        <Link
          href="/login"
          className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-white"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto py-10 px-6">
      <div className="mb-6">
        <h1 className="font-display text-[2rem] text-ink mb-2">Pending Collaborations</h1>
        <p className="font-body text-muted">
          These posts are saved as drafts until collaborators accept your invitations.
        </p>
      </div>
      {justCreated && (
        <div className="mb-6 rounded-2xl border border-amber-300/60 bg-amber-50 p-4">
          <p className="font-ui text-[0.9rem] text-amber-700">
            Collaboration invite sent. Your post will publish after collaborators accept.
          </p>
        </div>
      )}

      {pendingPosts.length === 0 ? (
        <div className="rounded-2xl border border-border-light bg-surface p-8 text-center">
          <h2 className="font-display text-[1.3rem] text-ink mb-2">No pending collaboration drafts</h2>
          <p className="font-body text-muted mb-6">
            All collaboration requests are resolved or you have not created any collaboration posts yet.
          </p>
          <Link
            href="/create"
            className="inline-block px-5 py-2.5 rounded-full border border-border-light font-ui text-[0.9rem] text-muted hover:border-accent hover:text-accent transition-all"
          >
            Create Post
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingPosts.map((post) => (
            <article key={post.id} className="rounded-2xl border border-border-light bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-ui text-[0.75rem] uppercase tracking-wide text-muted mb-1">{post.type}</p>
                  <h2 className="font-display text-[1.2rem] text-ink mb-2">{post.title}</h2>
                  <p className="font-body text-[0.85rem] text-muted">
                    Created {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-ui text-[0.8rem] text-amber-600">{post.pendingCount} pending</p>
                  <p className="font-ui text-[0.8rem] text-emerald-600">{post.acceptedCount} accepted</p>
                  <p className="font-ui text-[0.8rem] text-rose-500">{post.declinedCount} declined</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <Link
                  href={`/create?edit=${post.id}`}
                  className="px-4 py-2 rounded-full border border-border-light font-ui text-[0.85rem] text-muted hover:border-accent hover:text-accent transition-all"
                >
                  Edit Draft
                </Link>
                <Link
                  href={`/post/${post.id}`}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.85rem] font-medium text-white"
                >
                  Open Post
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingCollaborationsFallback() {
  return (
    <div className="max-w-[720px] mx-auto py-10 px-6">
      <div className="w-8 h-8 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="font-body text-muted text-center italic">Loading pending collaborations...</p>
    </div>
  );
}

export default function PendingCollaborationsPage() {
  return (
    <Suspense fallback={<PendingCollaborationsFallback />}>
      <PendingCollaborationsPageContent />
    </Suspense>
  );
}
