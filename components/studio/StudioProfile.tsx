"use client";

import "./studio.css";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getOrCreateConversation } from "@/lib/messaging/conversations";
import { fetchCollaboratedPosts, useCommunities, COLLAB_SELF_REMOVED_EVENT } from "@/lib/hooks.legacy";
import type { CollabSelfRemovedDetail } from "@/lib/hooks.legacy";
import { useCollections, useToggleCollectionCollapse, useReorderCollections } from "@/lib/hooks/useCollections";
import { useRelays } from "@/lib/hooks/useFeed";
import { useBlock } from "@/lib/hooks/useInteractions";
import { usePinnedPosts } from "@/lib/hooks/usePinnedPosts";
import { useProfile, useFollow } from "@/lib/hooks/useProfile";
import type { FollowStatus } from "@/lib/types";
import ConfirmationModal from "@/components/ui/ConfirmationModal";

// Type for follows table real-time payload
import { useUserTakes, useRelayedTakes } from "@/lib/hooks/useTakes";
import { useTrackProfileView } from "@/lib/hooks/useTracking";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUserEvent } from "@/components/providers/UserEventsProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import FollowersModal from "./FollowersModal";
import ShareModal from "@/components/ui/ShareModal";
import ActionMenu from "@/components/ui/ActionMenu";
import TakePostCard from "@/components/takes/TakePostCard";
import { Spinner } from "@/components/ui/Loading";
import { TabRow } from "@/components/ui/Tabs";
import { PageFrame } from "@/components/layout/PageFrame";
import ReportModal from "@/components/ui/ReportModal";
import Sheet from "@/components/ui/Sheet";
import StudioHeader from "./StudioHeader";
import StudioWorks from "./StudioWorks";
import StudioRelays from "./StudioRelays";
import CollectionCard from "./CollectionCard";
import StoreTab from "@/components/store/StoreTab";
import CommissionsTab from "@/components/commissions/CommissionsTab";
import { useHasCommissions } from "@/lib/hooks/useCommissions";
import type { Post } from "@/lib/types";

type StudioTab = "posts" | "takes" | "relays" | "store" | "commissions" | "collections";

interface StudioProfileProps {
  username: string;
}

export default function StudioProfile({ username }: StudioProfileProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { openPostModal } = useModal();
  const [activeTab, setActiveTab] = useState<StudioTab>("posts");
  const [relaySubTab, setRelaySubTab] = useState<"posts" | "takes">("posts");
  const shouldLoadTakes = activeTab === "takes";
  const shouldLoadRelayPosts = activeTab === "relays";
  const shouldLoadRelayTakes = activeTab === "relays" && relaySubTab === "takes";
  const shouldLoadCollections = activeTab === "collections";
  const { profile, posts, loading, error, isBlockedByUser, isPrivateAccount, refetch: refetchProfile } = useProfile(username, user?.id);
  const { checkFollowStatus, follow, unfollow } = useFollow();
  const { checkIsBlocked, blockUser, unblockUser } = useBlock();
  const { relays, loading: relaysLoading } = useRelays(shouldLoadRelayPosts ? username : "");
  const { takes: userTakes, loading: takesLoading } = useUserTakes(shouldLoadTakes ? username : "", user?.id);
  const { takes: relayedTakes, loading: relayedTakesLoading } = useRelayedTakes(shouldLoadRelayTakes ? username : "", user?.id);
  const { communities: userCommunities } = useCommunities(profile?.id, 'joined');
  const { collections, loading: collectionsLoading, refetch: refetchCollections } = useCollections(shouldLoadCollections ? profile?.id : undefined);
  const { toggleCollapse } = useToggleCollectionCollapse();
  const { reorderCollections } = useReorderCollections();
  const { pinnedPostIds, canPin, pinPost, unpinPost } = usePinnedPosts(profile?.id);
  const [showCommunitiesModal, setShowCommunitiesModal] = useState(false);
  const [followStatus, setFollowStatus] = useState<FollowStatus>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<"followers" | "following">("followers");
  const [showShareModal, setShowShareModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [collaboratedPosts, setCollaboratedPosts] = useState<Post[]>([]);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "posts" || tab === "takes" || tab === "relays" || tab === "store" || tab === "commissions" || tab === "collections") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/studio/${username}` : `/studio/${username}`;

  // Track profile views (only for other people's profiles)
  const isOwnProfile = user?.id === profile?.id;
  // Phase 3b: the Commissions tab exists only for profiles that sell (owners always see it).
  const { hasCommissions } = useHasCommissions(profile?.id);
  const showCommissionsTab = isOwnProfile || hasCommissions === true;
  useEffect(() => {
    if (activeTab === "commissions" && hasCommissions === false && !isOwnProfile) setActiveTab("posts");
  }, [activeTab, hasCommissions, isOwnProfile]);
  useTrackProfileView(isOwnProfile ? undefined : profile?.id, "direct");

  useEffect(() => {
    const checkFollow = async () => {
      if (user && profile && !isOwnProfile) {
        const status = await checkFollowStatus(user.id, profile.id);
        setFollowStatus(status);
      }
    };
    checkFollow();
  }, [user, profile, isOwnProfile]);

  // Follow-status changes (e.g. a request being accepted/rejected) arrive on the
  // per-user broadcast channel instead of a dedicated postgres_changes subscription.
  useUserEvent("follow_change", (payload) => {
    if (!user || !profile || isOwnProfile) return;
    if (payload.follower_id !== user.id || payload.following_id !== profile.id) return;

    if (payload.op === "DELETE") {
      setFollowStatus(null);
      return;
    }

    const newStatus = payload.status ?? null;
    setFollowStatus(newStatus);
    // If the follow was just accepted, refetch the full profile to load gated data.
    if (newStatus === "accepted") {
      refetchProfile();
    }
  });

  // Check if blocked
  useEffect(() => {
    const checkBlock = async () => {
      if (user && profile && !isOwnProfile) {
        const blocked = await checkIsBlocked(user.id, profile.id);
        setIsBlocked(blocked);
      }
    };
    checkBlock();
  }, [user, profile, isOwnProfile]);

  // Fetch collaborated posts
  useEffect(() => {
    const loadCollaboratedPosts = async () => {
      if (profile?.id) {
        try {
          const collabPosts = await fetchCollaboratedPosts(profile.id);
          setCollaboratedPosts(collabPosts);
        } catch (error) {
          console.error("Error fetching collaborated posts:", error);
        }
      }
    };
    loadCollaboratedPosts();
  }, [profile?.id]);

  // Drop a post from the collaborated-posts grid as soon as the profile owner
  // removes themselves from it. The PostCard / PostDetailModal dispatches a
  // browser CustomEvent on success.
  useEffect(() => {
    if (!profile?.id) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CollabSelfRemovedDetail>).detail;
      if (!detail || detail.userId !== profile.id) return;
      setCollaboratedPosts((prev) => prev.filter((p) => p.id !== detail.postId));
    };
    window.addEventListener(COLLAB_SELF_REMOVED_EVENT, handler);
    return () => window.removeEventListener(COLLAB_SELF_REMOVED_EVENT, handler);
  }, [profile?.id]);

  const handleBlock = async () => {
    if (!user || !profile) return;

    setBlockLoading(true);
    if (isBlocked) {
      const result = await unblockUser(user.id, profile.id);
      if (result.success) {
        setIsBlocked(false);
      }
    } else {
      const result = await blockUser(user.id, profile.id);
      if (result.success) {
        setIsBlocked(true);
        setFollowStatus(null);
        setShowBlockConfirm(false);
        // Redirect to home after blocking
        router.push('/');
      }
    }
    setBlockLoading(false);
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user || !profile) return;
    setReportLoading(true);
    try {
      await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_user_id: profile.id,
        reason: details?.trim() ? `${reason}: ${details.trim()}` : reason,
        type: "user",
      });
      setReportSuccess(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!user || !profile || messageLoading) return;
    setMessageLoading(true);
    try {
      const conversationId = await getOrCreateConversation(profile.id);
      router.push(`/messages?conversation=${conversationId}`);
    } catch (err) {
      console.error("Failed to start conversation:", err);
      setMessageLoading(false);
    }
  };

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!user || !profile || isOwnProfile) return;
    setFollowLoading(true);

    if (followStatus === 'accepted' || followStatus === 'pending') {
      // Unfollow or cancel request
      await unfollow(user.id, profile.id);
      setFollowStatus(null);
    } else {
      // Follow or send request
      const newStatus = await follow(user.id, profile.id);
      setFollowStatus(newStatus);
    }

    setFollowLoading(false);
  };

  // Derived state for easier rendering
  const isFollowing = followStatus === 'accepted';

  // Refetch profile when follow status changes to 'accepted' (to get full profile data)
  useEffect(() => {
    if (isFollowing && isPrivateAccount) {
      // User just got accepted as a follower of a private account - refetch to get full data
      refetchProfile();
    }
  }, [isFollowing, isPrivateAccount, refetchProfile]);

  if (loading) {
    return (
      <PageFrame width="wide" className="pq-studio">
        <div className="pq-feed-state" role="status" aria-label="Loading studio"><Spinner size="lg" /></div>
      </PageFrame>
    );
  }

  if (error || !profile || isBlockedByUser) {
    return (
      <PageFrame width="wide" className="pq-studio">
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">No studio here</p>
          <p className="pq-feed-state__text">This person doesn&rsquo;t exist, or their studio isn&rsquo;t available to you.</p>
          <div className="pq-feed-state__actions">
            <Link href="/explore" className="pq-button pq-button--md pq-button--secondary">Explore instead</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <div className="pq-studio">
      <PageFrame width="wide">
        <StudioHeader
          profile={profile}
          isOwnProfile={isOwnProfile}
          signedIn={!!user}
          followStatus={followStatus}
          followLoading={followLoading}
          onFollow={handleFollow}
          messageLoading={messageLoading}
          onMessage={handleMessage}
          isBlocked={isBlocked}
          onBlock={() => { if (isBlocked) void handleBlock(); else setShowBlockConfirm(true); }}
          onReport={() => setShowReportModal(true)}
          onShare={() => setShowShareModal(true)}
          onCopyLink={() => { void navigator.clipboard.writeText(profileUrl); }}
          onOpenFollowers={(type) => { setFollowersModalTab(type); setShowFollowersModal(true); }}
          communities={userCommunities || []}
          onOpenCommunities={() => setShowCommunitiesModal(true)}
          gated={isPrivateAccount && !isOwnProfile && !isFollowing}
        />

        {/* Tabs and Content - Only show for public accounts or if following */}
        {(!isPrivateAccount || isOwnProfile || isFollowing) && (
          <>
        <TabRow<StudioTab>
          className="pq-studio-tabs"
          ariaLabel="Studio sections"
          items={[
            { id: "posts", label: "Posts" },
            { id: "takes", label: "Takes" },
            { id: "relays", label: "Relays" },
            { id: "store", label: "Store" },
            ...(showCommissionsTab ? [{ id: "commissions" as StudioTab, label: "Commissions" }] : []),
            { id: "collections", label: "Collections" },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        {/* Posts Section */}
        {activeTab === "posts" && (
          <StudioWorks
            profile={profile}
            posts={posts}
            collaboratedPosts={collaboratedPosts}
            isOwnProfile={isOwnProfile}
            pins={{ pinnedPostIds, canPin, pinPost, unpinPost }}
          />
        )}

        {/* Takes Section */}
        {activeTab === "takes" && (
          <div className="pq-studio-section" role="tabpanel">
            {takesLoading ? (
              <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
            ) : userTakes.length === 0 ? (
              <div className="pq-feed-state pq-feed-state--card"><p className="pq-feed-state__title">No takes yet</p></div>
            ) : (
              <div className="takes-grid">
                {userTakes.map((take) => (
                  <TakePostCard key={take.id} take={take} variant="grid" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Relays Section */}
        {activeTab === "relays" && (
          <StudioRelays
            username={profile.username}
            displayName={profile.display_name}
            sub={relaySubTab}
            onSub={setRelaySubTab}
            relays={relays}
            relaysLoading={relaysLoading}
            relayedTakes={relayedTakes}
            relayedTakesLoading={relayedTakesLoading}
          />
        )}

        {/* Store Section */}
        {activeTab === "store" && profile && (
          <StoreTab
            userId={profile.id}
            isOwnProfile={isOwnProfile}
          />
        )}

        {/* Commissions Section */}
        {activeTab === "commissions" && profile && showCommissionsTab && (
          <CommissionsTab
            userId={profile.id}
            isOwnProfile={isOwnProfile}
          />
        )}

        {/* Collections Section */}
        {activeTab === "collections" && (
          <div className="pq-studio-section" role="tabpanel">
            {collectionsLoading ? (
              <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
            ) : collections.length === 0 ? (
              <div className="pq-feed-state pq-feed-state--card">
                <p className="pq-feed-state__title">No collections yet</p>
                <p className="pq-feed-state__text">
                  {isOwnProfile
                    ? "Collections group your work. Pick one when you post, and it shows up here."
                    : `${profile?.display_name || profile?.username} hasn't put anything into a collection yet.`}
                </p>
              </div>
            ) : (
              <div className="pq-collections">
                {collections.map((collection, index) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    isOwnProfile={isOwnProfile}
                    username={username}
                    index={index}
                    totalCount={collections.length}
                    onMoveUp={async () => {
                      if (index === 0) return;
                      const newOrder = [...collections];
                      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                      await reorderCollections(newOrder.map(c => c.id));
                      refetchCollections();
                    }}
                    onMoveDown={async () => {
                      if (index === collections.length - 1) return;
                      const newOrder = [...collections];
                      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                      await reorderCollections(newOrder.map(c => c.id));
                      refetchCollections();
                    }}
                    onToggleCollapse={async () => {
                      await toggleCollapse(collection.id, collection.is_collapsed);
                      refetchCollections();
                    }}
                    onDelete={async () => {
                      const { error } = await supabase.from("collections").delete().eq("id", collection.id);
                      if (!error) refetchCollections();
                    }}
                    onDeleteItem={async (itemId: string) => {
                      const { error } = await supabase.from("collection_items").delete().eq("id", itemId);
                      if (!error) refetchCollections();
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
          </>
        )}

      </PageFrame>

      {/* Followers Modal */}
      <FollowersModal
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        userId={profile.id}
        type={followersModalTab}
        isOwnProfile={isOwnProfile}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={profileUrl}
        title={`${profile.display_name || profile.username}'s Profile`}
        description={profile.bio || `Check out ${profile.display_name || profile.username}'s creative work on PinkQuill`}
        type="profile"
        authorName={profile.display_name || profile.username}
      />

      <ConfirmationModal
        isOpen={showBlockConfirm}
        onClose={() => setShowBlockConfirm(false)}
        onConfirm={handleBlock}
        title={`Block @${profile.username}?`}
        description="Their posts leave your feed and yours leave theirs. They can't follow or message you, and we don't tell them."
        confirmText="Block"
        isDanger
        loading={blockLoading}
      />

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        submitting={reportLoading}
        submitted={reportSuccess}
        title={`Report @${profile.username}`}
        placeholder="What's going on with this account?"
      />

      <Sheet
        isOpen={showCommunitiesModal && !!userCommunities && userCommunities.length > 0}
        onClose={() => setShowCommunitiesModal(false)}
        title="Communities"
        subtitle={`${profile.display_name || profile.username} is part of ${userCommunities?.length === 1 ? "one community" : `${userCommunities?.length ?? 0} communities`}.`}
        bodyClassName="pq-dialog__body--flush"
      >
        {(userCommunities || []).map((community) => {
          const role = community.user_role === "admin" ? "Admin" : community.user_role === "moderator" ? "Moderator" : null;
          const members = `${community.member_count || 0} ${community.member_count === 1 ? "member" : "members"}`;
          return (
            <Link key={community.id} href={`/community/${community.slug || community.id}`} className="pq-studio-community" onClick={() => setShowCommunitiesModal(false)}>
              <span className="pq-studio-community__mark" aria-hidden="true">
                {community.avatar_url ? <img src={community.avatar_url} alt="" /> : community.name?.charAt(0).toUpperCase()}
              </span>
              <span className="pq-studio-community__text">
                <span className="pq-studio-community__name">{community.name}</span>
                <span className="pq-studio-community__meta">{role ? `${members} · ${role}` : members}</span>
              </span>
            </Link>
          );
        })}
      </Sheet>
    </div>
  );
}
