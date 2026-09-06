"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useDeleteCommunity } from "@/lib/hooks.legacy";
import { Spinner } from "@/components/ui/Loading";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import { FieldLabel } from "@/components/create/pieces";
import { CommunitySettingsFrame, settingsSections } from "@/components/communities/pieces";
import "@/components/create/composer.css";
import "@/components/communities/communities.css";

export default function CommunitySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, loading } = useCommunity(slug, user?.id);

  // Role gate: redirect from an effect (a router.push during render is a
  // React error and can loop). The proxy already requires a session; the
  // real authorization lives in RLS and the moderation RPCs.
  useEffect(() => {
    if (community && (community.user_role !== "admin" && community.user_role !== "moderator")) {
      router.replace(`/community/${slug}`);
    }
  }, [community, router, slug]);
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
    return <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>;
  }

  if (!community) return null;

  const isAdmin = community.user_role === "admin";
  const isMod = community.user_role === "moderator";
  if (!isAdmin && !isMod) return null;

  const descriptions: Record<string, string> = {
    General: "Name, description, images and who can join.",
    Rules: "What members agree to when they join.",
    Chat: "Welcome message and the community chat.",
    Flairs: "Labels members can put on their posts.",
    "Roles and requests": "Moderators and people asking to join.",
    "Moderation log": "What moderators removed, and who is muted or banned.",
    Reports: "Content members have flagged for review.",
  };
  const sections = settingsSections(slug).filter((s) => !s.exact && (!s.adminOnly || isAdmin));

  return (
    <CommunitySettingsFrame community={community} title="Settings" lede={`Everything about how ${community.name} runs, in one place.`}>
      <div className="pq-list">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="pq-list-row">
            <span className="pq-list-row__text">
              <span className="pq-list-row__title">{section.label}</span>
              <span className="pq-list-row__meta">{descriptions[section.label]}</span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <section className="pq-danger" aria-labelledby="danger-heading">
          <h3 id="danger-heading" className="pq-danger__title">Delete this community</h3>
          <p className="pq-danger__text">Removes {community.name}, its posts, members and settings for good. There is no undo.</p>
          <div>
            <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>Delete community</Button>
          </div>
        </section>
      )}

      <Sheet
        isOpen={showDeleteModal}
        onClose={() => { if (!deleting) { setShowDeleteModal(false); setConfirmName(""); } }}
        title={`Delete ${community.name}?`}
        subtitle="Every post, member and setting goes with it. Type the name to confirm."
        busy={deleting}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowDeleteModal(false); setConfirmName(""); }} disabled={deleting}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} disabled={confirmName !== community.name} loading={deleting} loadingText="Deleting…">Delete for good</Button>
          </>
        }
      >
        <div>
          <FieldLabel htmlFor="confirm-community-name">Community name</FieldLabel>
          <input id="confirm-community-name" type="text" className="pq-field pq-field--ui" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={community.name} disabled={deleting} autoComplete="off" />
        </div>
      </Sheet>
    </CommunitySettingsFrame>
  );
}
