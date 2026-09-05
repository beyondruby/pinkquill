"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePendingCollaborations } from "@/lib/hooks.legacy";
import { PageFrame, PageHeader } from "@/components/layout/PageFrame";
import { PostTypeChip } from "@/components/feed/PostTypeChip";
import { Spinner } from "@/components/ui/Loading";
import { formatDate } from "@/lib/utils/time";
import "./pending.css";

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

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
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
      <PageFrame width="narrow">
        <PageHeader title="Waiting on collaborators" />
        <div className="pq-feed-state" role="status" aria-label="Loading">
          <Spinner size="lg" />
        </div>
      </PageFrame>
    );
  }

  if (!user) {
    return (
      <PageFrame width="narrow">
        <PageHeader title="Waiting on collaborators" />
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">Sign in to see your drafts</p>
          <p className="pq-feed-state__text">Posts with invited collaborators stay here until everyone has answered.</p>
          <div className="pq-feed-state__actions">
            <Link href="/login?redirect=%2Fpending-collaborations" className="pq-button pq-button--md pq-button--primary">Sign in</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame width="narrow">
      <PageHeader
        title="Waiting on collaborators"
        lede="These posts stay as drafts until the people you invited accept. You can keep editing them in the meantime."
      />

      {justCreated && (
        <div className="pq-note mb-5" role="status">
          <div className="pq-note__text">
            <p className="pq-note__title">Invitations sent</p>
            <p>Your post publishes once your collaborators accept.</p>
          </div>
        </div>
      )}

      {pendingPosts.length === 0 ? (
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">Nothing waiting</p>
          <p className="pq-feed-state__text">
            Every collaboration invite has been answered, or you haven&rsquo;t made a post with collaborators yet.
          </p>
          <div className="pq-feed-state__actions">
            <Link href="/create" className="pq-button pq-button--md pq-button--primary">Share something</Link>
          </div>
        </div>
      ) : (
        <ul className="pq-pending-list" aria-label="Posts waiting on collaborators">
          {pendingPosts.map((post) => (
            <li key={post.id} className="pq-pending">
              <div className="pq-pending__head">
                <PostTypeChip type={post.type} variant="label" size="sm" />
                <span className="pq-pending__date">{formatDate(post.createdAt)}</span>
              </div>
              <h2 className="pq-pending__title">{post.title}</h2>
              <p className="pq-pending__counts">
                <span>{plural(post.pendingCount, "person", "people")} still to answer</span>
                {post.acceptedCount > 0 && <span>{post.acceptedCount} accepted</span>}
                {post.declinedCount > 0 && <span>{post.declinedCount} declined</span>}
              </p>
              <div className="pq-pending__actions">
                <Link href={`/create?edit=${post.id}`} className="pq-button pq-button--sm pq-button--secondary">Edit draft</Link>
                <Link href={`/post/${post.id}`} className="pq-button pq-button--sm pq-button--ghost">Open post</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}

function PendingCollaborationsFallback() {
  return (
    <PageFrame width="narrow">
      <PageHeader title="Waiting on collaborators" />
      <div className="pq-feed-state" role="status" aria-label="Loading">
        <Spinner size="lg" />
      </div>
    </PageFrame>
  );
}

export default function PendingCollaborationsPage() {
  return (
    <Suspense fallback={<PendingCollaborationsFallback />}>
      <PendingCollaborationsPageContent />
    </Suspense>
  );
}
