"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity } from "@/lib/hooks.legacy";
import FlairManager from "@/components/communities/FlairManager";
import { CommunitySettingsFrame } from "@/components/communities/pieces";
import { Spinner } from "@/components/ui/Loading";
import "@/components/create/composer.css";
import "@/components/communities/communities.css";

export default function CommunityFlairsSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, loading } = useCommunity(slug, user?.id);

  // Role gate from an effect; RLS and the flair RPCs hold the real authority.
  useEffect(() => {
    if (community && community.user_role !== "admin") router.replace(`/community/${slug}`);
  }, [community, router, slug]);

  if (loading) return <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>;
  if (!community || community.user_role !== "admin") return null;

  return (
    <CommunitySettingsFrame community={community} title="Flairs" lede="Labels members can put on a post so the feed sorts itself: Question, Work in progress, Finished piece.">
      <FlairManager communityId={community.id} />
    </CommunitySettingsFrame>
  );
}
