"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { getTimeAgo } from "@/lib/utils/time";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMuted, useVolume, TakeReactionType, TakeReactionCounts } from "@/lib/hooks/useTakes";
import { useBlock } from "@/lib/hooks/useInteractions";
import { useTakeComments } from "@/lib/hooks/useTakes";
import { deleteOwnTake } from "@/lib/content-client";
import TakeReactionPicker from "@/components/takes/TakeReactionPicker";
import TakeCommentItem from "@/components/takes/TakeCommentItem";
import TakeStage from "@/components/takes/TakeStage";
import PostTags from "@/components/feed/PostTags";
import { PostDetailHeader, PostDetailActions, Discussion, getDetailTone, type DetailPost } from "@/components/feed/PostDetail";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import AppShell from "@/components/layout/AppShell";
import { PageFrame } from "@/components/layout/PageFrame";
import { NavIcon } from "@/components/layout/navigation";
import Button from "@/components/ui/Button";
import Loading from "@/components/ui/Loading";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { DEFAULT_AVATAR } from "@/lib/utils/image";
import { icons } from "@/components/ui/Icons";
import "@/components/takes/takes.css";

interface Take {
  id: string;
  author_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  duration: number;
  visibility: string;
  content_warning: string | null;
  sound_id: string | null;
  view_count: number;
  community_id: string | null;
  created_at: string;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SingleTakePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [take, setTake] = useState<Take | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction states
  const [reactionCounts, setReactionCounts] = useState<TakeReactionCounts>({
    admire: 0,
    snap: 0,
    ovation: 0,
    support: 0,
    inspired: 0,
    applaud: 0,
    total: 0,
  });
  const [savesCount, setSavesCount] = useState(0);
  const [relaysCount, setRelaysCount] = useState(0);
  const [userReaction, setUserReaction] = useState<TakeReactionType | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isRelayed, setIsRelayed] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  // UI states
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [collaborators, setCollaborators] = useState<Array<{
    role?: string | null;
    user: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  }>>([]);
  const [mentions, setMentions] = useState<Array<{
    id: string; username: string; display_name: string | null; avatar_url: string | null;
  }>>([]);
  const [showContent, setShowContent] = useState(true);

  const { isMuted, toggle: toggleMute } = useMuted();
  const { volume } = useVolume();
  const { blockUser } = useBlock();

  // Comments hook
  const { comments, loading: commentsLoading, addComment, toggleLike, deleteComment } = useTakeComments(id, user?.id);

  const isOwner = user?.id === take?.author_id;

  // Fetch take data
  const fetchTake = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch the take
      const { data: takeData, error: takeError } = await supabase
        .from("takes")
        .select("*")
        .eq("id", id)
        .single();

      if (takeError || !takeData) {
        setError("Take not found");
        setLoading(false);
        return;
      }

      const isOwnerCheck = user?.id === takeData.author_id;

      // Blocks are enforced by the takes read policy (Phase 6): a blocked
      // viewer never receives the row, so no client-side check is needed.

      // SECURITY CHECK: Enforce visibility rules
      const visibility = takeData.visibility;

      if (visibility === "private") {
        // Private takes: only the author can see
        if (!isOwnerCheck) {
          setError("This take is private");
          setLoading(false);
          return;
        }
      } else if (visibility === "followers") {
        // Followers-only takes: only the author or their followers can see
        if (!isOwnerCheck) {
          if (!user) {
            setError("You must be logged in to view this take");
            setLoading(false);
            return;
          }

          // Check if the current user follows the take author (must be accepted)
          const { count: followCount } = await supabase
            .from("follows")
            .select("follower_id", { count: "exact" })
            .eq("follower_id", user.id)
            .eq("following_id", takeData.author_id);

          if (!followCount || followCount === 0) {
            setError("This take is only visible to followers");
            setLoading(false);
            return;
          }
        }
      }

      // SECURITY CHECK: Private account check
      // If the author has a private account, only approved followers can see their takes
      if (!isOwnerCheck) {
        const { data: authorProfile } = await supabase
          .from("profiles")
          .select("is_private")
          .eq("id", takeData.author_id)
          .single();

        if (authorProfile?.is_private) {
          if (!user) {
            setError("This take is from a private account");
            setLoading(false);
            return;
          }

          // Check if user is an accepted follower
          const { count: followCount } = await supabase
            .from("follows")
            .select("follower_id", { count: "exact" })
            .eq("follower_id", user.id)
            .eq("following_id", takeData.author_id);

          if (!followCount || followCount === 0) {
            setError("This take is from a private account");
            setLoading(false);
            return;
          }
        }
      }

      // Fetch author
      const { data: authorData } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", takeData.author_id)
        .single();

      setTake({
        ...takeData,
        author: authorData || { username: "unknown", display_name: null, avatar_url: null },
      });

      // Set content warning state
      setShowContent(!takeData.content_warning);

      // Fetch counts, tags, collaborators, and mentions
      const [reactionsRes, savesRes, relaysRes, tagsRes, collabRes, mentionsRes] = await Promise.all([
        supabase.from("take_reactions").select("reaction_type").eq("take_id", id),
        supabase.from("take_saves").select("take_id", { count: "exact" }).eq("take_id", id),
        supabase.from("take_relays").select("take_id", { count: "exact" }).eq("take_id", id),
        supabase.from("take_tags").select("tag").eq("take_id", id),
        supabase.from("take_collaborators").select("role, user_id").eq("take_id", id).eq("status", "accepted"),
        supabase.from("take_mentions").select("user_id").eq("take_id", id),
      ]);

      // Calculate reaction counts by type
      const counts: TakeReactionCounts = {
        admire: 0,
        snap: 0,
        ovation: 0,
        support: 0,
        inspired: 0,
        applaud: 0,
        total: 0,
      };
      (reactionsRes.data || []).forEach((r: { reaction_type: TakeReactionType }) => {
        if (r.reaction_type in counts) {
          counts[r.reaction_type]++;
          counts.total++;
        }
      });
      setReactionCounts(counts);
      setSavesCount(savesRes.count || 0);
      setRelaysCount(relaysRes.count || 0);
      setHashtags(tagsRes.data?.map(t => t.tag) || []);

      // Fetch collaborator profiles
      if (collabRes.data && collabRes.data.length > 0) {
        const userIds = collabRes.data.map(c => c.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);

        if (profiles) {
          const profileMap = new Map(profiles.map(p => [p.id, p]));
          setCollaborators(collabRes.data.map(c => ({
            role: c.role,
            user: profileMap.get(c.user_id) || { id: c.user_id, username: "unknown", display_name: null, avatar_url: null },
          })));
        }
      } else {
        setCollaborators([]);
      }

      // Fetch mention profiles
      if (mentionsRes.data && mentionsRes.data.length > 0) {
        const userIds = mentionsRes.data.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);

        setMentions(profiles || []);
      } else {
        setMentions([]);
      }

      // Fetch user interactions
      if (user) {
        const [userReactionRes, userSaveRes, userRelayRes, followRes] = await Promise.all([
          supabase.from("take_reactions").select("reaction_type").eq("take_id", id).eq("user_id", user.id).maybeSingle(),
          supabase.from("take_saves").select("take_id").eq("take_id", id).eq("user_id", user.id).maybeSingle(),
          supabase.from("take_relays").select("take_id").eq("take_id", id).eq("user_id", user.id).maybeSingle(),
          supabase.from("follows").select("follower_id", { count: "exact" }).eq("follower_id", user.id).eq("following_id", takeData.author_id),
        ]);

        setUserReaction(userReactionRes.data?.reaction_type as TakeReactionType || null);
        setIsSaved(!!userSaveRes.data);
        setIsRelayed(!!userRelayRes.data);
        setIsFollowing((followRes.count ?? 0) > 0);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching take:", err);
      setError("Failed to load take");
      setLoading(false);
    }
  }, [id, user]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (authLoading) return;
    fetchTake();
  }, [fetchTake, authLoading]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Video control
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Handlers
  const handleReaction = async (type: TakeReactionType) => {
    if (!user || !take) return;

    const isSameReaction = userReaction === type;
    const previousReaction = userReaction;

    // Optimistic update
    if (isSameReaction) {
      // Removing reaction
      setUserReaction(null);
      setReactionCounts((prev) => ({
        ...prev,
        [type]: Math.max(0, prev[type] - 1),
        total: Math.max(0, prev.total - 1),
      }));
    } else {
      // Adding new reaction or changing reaction
      setUserReaction(type);
      setReactionCounts((prev) => {
        const newCounts = { ...prev, [type]: prev[type] + 1 };
        if (previousReaction) {
          // Changing from one reaction to another
          newCounts[previousReaction] = Math.max(0, newCounts[previousReaction] - 1);
        } else {
          // New reaction (total increases)
          newCounts.total = prev.total + 1;
        }
        return newCounts;
      });
    }

    // Database update
    if (isSameReaction) {
      await supabase.from("take_reactions").delete().eq("take_id", take.id).eq("user_id", user.id);
    } else {
      await supabase.from("take_reactions").upsert({
        take_id: take.id,
        user_id: user.id,
        reaction_type: type,
      });
    }
  };

  const handleRemoveReaction = async () => {
    if (!user || !take || !userReaction) return;
    const previousReaction = userReaction;
    setUserReaction(null);
    setReactionCounts((prev) => ({
      ...prev,
      [previousReaction]: Math.max(0, prev[previousReaction] - 1),
      total: Math.max(0, prev.total - 1),
    }));
    await supabase.from("take_reactions").delete().eq("take_id", take.id).eq("user_id", user.id);
  };

  const handleSave = async () => {
    if (!user || !take) return;

    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);
    setSavesCount((prev) => newIsSaved ? prev + 1 : Math.max(0, prev - 1));

    if (newIsSaved) {
      await supabase.from("take_saves").insert({ take_id: take.id, user_id: user.id });
    } else {
      await supabase.from("take_saves").delete().eq("take_id", take.id).eq("user_id", user.id);
    }
  };

  const handleRelay = async () => {
    if (!user || !take || isOwner) return;

    const newIsRelayed = !isRelayed;
    setIsRelayed(newIsRelayed);
    setRelaysCount((prev) => newIsRelayed ? prev + 1 : Math.max(0, prev - 1));

    if (newIsRelayed) {
      await supabase.from("take_relays").insert({ take_id: take.id, user_id: user.id });
    } else {
      await supabase.from("take_relays").delete().eq("take_id", take.id).eq("user_id", user.id);
    }
  };

  const handleFollow = async () => {
    if (!user || !take || isOwner) return;

    const newIsFollowing = !isFollowing;
    setIsFollowing(newIsFollowing);

    if (newIsFollowing) {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: take.author_id });
    } else {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", take.author_id);
    }
  };

  const handleDelete = async () => {
    if (!take || !user || !isOwner) return;

    setDeleting(true);
    try {
      await deleteOwnTake(take.id);
      router.push("/takes");
    } catch (err) {
      console.error("Error deleting take:", err);
      setDeleting(false);
    }
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user || !take) return;

    setReportSubmitting(true);
    try {
      await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_user_id: take.author_id,
        take_id: take.id,
        reason: reason + (details ? `: ${details}` : ""),
        type: "take",
      });
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Error reporting:", err);
    }
    setReportSubmitting(false);
  };

  const handleBlock = async () => {
    if (!user || !take) return;

    setIsBlocking(true);
    try {
      await blockUser(user.id, take.author_id);
      router.push("/takes");
    } catch (err) {
      console.error("Error blocking:", err);
    }
    setIsBlocking(false);
  };

  const takeMenuItems: ActionMenuItem[] = isOwner
    ? [
        {
          label: "Delete",
          onSelect: () => setShowDeleteConfirm(true),
          icon: icons.trash,
          tone: "danger",
        },
      ]
    : user
      ? [
          {
            label: "Block",
            onSelect: () => setShowBlockConfirm(true),
            icon: icons.block,
          },
          {
            label: "Report",
            onSelect: () => setShowReportModal(true),
            icon: icons.flag,
            tone: "danger",
          },
        ]
      : [];

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user || !take) return;

    setSubmitting(true);
    const result = await addComment(commentText.trim());
    if (result) {
      setCommentText("");
    }
    setSubmitting(false);
  };

  const handleCommentLike = (commentId: string) => {
    if (!user) return;
    toggleLike(commentId);
  };

  const handleCommentReply = async (content: string, parentId: string) => {
    if (!user) return null;
    return await addComment(content, parentId);
  };

  const handleCommentDelete = (commentId: string) => {
    deleteComment(commentId);
  };

  const takeUrl = typeof window !== "undefined" ? `${window.location.origin}/take/${id}` : `/take/${id}`;

  const commentInputRef = useRef<HTMLInputElement>(null);
  const focusConversation = () => {
    commentInputRef.current?.focus();
    commentInputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  // Loading state
  if (loading) {
    return (
      <AppShell>
        <PageFrame width="narrow">
          <div className="pq-feed-state" role="status">
            <Loading text="Loading the take" />
          </div>
        </PageFrame>
      </AppShell>
    );
  }

  // Error state
  if (error || !take) {
    return (
      <AppShell>
        <PageFrame width="narrow">
          <div className="pq-feed-state pq-feed-state--card">
            <p className="pq-feed-state__title">{error && error !== "Take not found" ? "You can\u2019t see this take" : "This take isn\u2019t here"}</p>
            <p className="pq-feed-state__text">{error && error !== "Take not found" ? error : "It may have been removed, or the link is wrong."}</p>
            <div className="pq-feed-state__actions">
              <Link href="/takes" className="pq-button pq-button--md pq-button--primary">Browse Takes</Link>
            </div>
          </div>
        </PageFrame>
      </AppShell>
    );
  }

  const authorName = take.author.display_name || take.author.username;
  const detail: DetailPost = {
    id: take.id,
    authorId: take.author_id,
    author: { name: authorName, handle: `@${take.author.username}`, avatar: take.author.avatar_url || DEFAULT_AVATAR },
    type: "take",
    timeAgo: getTimeAgo(take.created_at),
    createdAt: take.created_at,
    content: take.caption || "",
    media: [],
  };
  const tone = getDetailTone(null);

  return (
    <ErrorBoundary>
      <AppShell>
        <PageFrame width="wide">
          <Link href="/takes" className="pq-detail__back pq-button pq-button--sm pq-button--ghost">
            <NavIcon name="back" className="w-4 h-4" />
            Takes
          </Link>

          <div className="pq-detail">
            <article className="pq-detail__card" aria-label={`Take by ${authorName}`}>
              <PostDetailHeader
                post={detail}
                tone={tone}
                typeLabel="shared a take"
                trailing={
                  <>
                    {!isOwner && user && (
                      <Button
                        variant={isFollowing ? "secondary" : "primary"}
                        size="sm"
                        onClick={handleFollow}
                        aria-pressed={isFollowing}
                      >
                        {isFollowing ? "Following" : "Follow"}
                      </Button>
                    )}
                    {user && (
                      <ActionMenu
                        label="Take actions"
                        items={takeMenuItems}
                        buttonClassName="pq-icon-button"
                        widthClassName="w-64"
                        buttonAriaLabel="Take actions"
                        portal
                      />
                    )}
                  </>
                }
              />

              <div className="pq-take-detail">
                <TakeStage
                  videoRef={videoRef}
                  src={take.video_url}
                  poster={take.thumbnail_url}
                  isPlaying={isPlaying}
                  onTogglePlay={togglePlayPause}
                  isMuted={isMuted}
                  onToggleMute={toggleMute}
                  duration={take.duration}
                  contentWarning={take.content_warning}
                  revealed={showContent}
                  onReveal={() => setShowContent(true)}
                />
                <div className="pq-take-detail__text">
                  {take.caption && <p className="pq-detail__text pq-take-detail__caption">{take.caption}</p>}
                  <div className="pq-detail__tags">
                    <PostTags hashtags={hashtags} collaborators={collaborators} mentions={mentions} />
                  </div>
                </div>
              </div>

              <PostDetailActions
                signedIn={!!user}
                isOwner={!!isOwner}
                reactionControl={
                  <TakeReactionPicker
                    currentReaction={userReaction}
                    reactionCounts={reactionCounts}
                    onReact={handleReaction}
                    onRemoveReaction={handleRemoveReaction}
                    disabled={!user}
                    compact
                  />
                }
                commentCount={comments.length}
                onComment={focusConversation}
                relayCount={relaysCount}
                isRelayed={isRelayed}
                onRelay={handleRelay}
                onShare={() => setShowShareModal(true)}
                isSaved={isSaved}
                onSave={handleSave}
              />
            </article>

            <Discussion
              ref={commentInputRef}
              count={comments.length}
              thread={comments.map((comment) => (
                <TakeCommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={user?.id}
                  onLike={handleCommentLike}
                  onReply={handleCommentReply}
                  onDelete={handleCommentDelete}
                />
              ))}
              loading={commentsLoading}
              currentUserId={user?.id}
              currentUserAvatar={profile?.avatar_url}
              signedIn={!!user}
              signInHref={`/login?redirect=${encodeURIComponent(`/take/${id}`)}`}
              value={commentText}
              onValueChange={setCommentText}
              onSubmit={handleAddComment}
              submitting={submitting}
            />
          </div>
        </PageFrame>
      </AppShell>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={takeUrl}
        title={take.caption || "Check out this Take"}
        description={take.caption || ""}
        type="take"
        authorName={authorName}
        authorUsername={take.author.username}
      />

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        submitting={reportSubmitting}
        submitted={reportSubmitted}
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete this take?"
        description="This can't be undone. The take, its comments and reactions are removed for good."
        confirmText="Delete"
        isDanger
        loading={deleting}
      />

      <ConfirmationModal
        isOpen={showBlockConfirm}
        onClose={() => setShowBlockConfirm(false)}
        onConfirm={handleBlock}
        title={`Block @${take.author.username}?`}
        description="They won't be able to see your posts, follow you, or message you. They won't be notified."
        confirmText="Block"
        isDanger
        loading={isBlocking}
      />
    </ErrorBoundary>
  );
}
