"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity } from "@/lib/hooks.legacy";
import { ModQueuePage } from "@/components/communities/ModQueue";
import { CommunitySettingsFrame } from "@/components/communities/pieces";
import { Spinner } from "@/components/ui/Loading";

export default function CommunityModQueuePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, loading } = useCommunity(slug, user?.id);

  // Role gate from an effect; RLS and the moderation RPCs hold the real authority.
  useEffect(() => {
    if (community && community.user_role !== "admin" && community.user_role !== "moderator") {
      router.replace(`/community/${slug}`);
    }
  }, [community, router, slug]);

  if (loading) return <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>;
  if (!community || (community.user_role !== "admin" && community.user_role !== "moderator")) return null;

  return (
    <CommunitySettingsFrame community={community} title="Reports" lede="What members have flagged. Resolve each one with the least action that fixes it.">
      <ModQueuePage communityId={community.id} />
    </CommunitySettingsFrame>
  );
}
