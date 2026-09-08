"use client";

import { use, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getTimeAgo } from "@/lib/utils/time";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { followUserRecord, unfollowUserRecord } from "@/lib/hooks/useProfile";
import type { FollowStatus } from "@/lib/types";
import { submitReport } from "@/lib/reports";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMuted, useVolume, TakeReactionType, type Take, type TakeTableRow, takeFromTableRow, takeVideoStyle, TAKE_ROW_SELECT } from "@/lib/hooks/useTakes";
import TakePlayer from "@/components/takes/TakePlayer";
import { useTrackTakeImpression, useTrackTakeView } from "@/lib/hooks/useTracking";
import { useReaction } from "@/lib/engagement/reactions";
import { useBlock } from "@/lib/hooks/useInteractions";
import { useComments } from "@/lib/hooks/useComments";
import { actionToast } from "@/lib/utils/toast";
import { deleteOwnTake } from "@/lib/content-client";
import ReactionPicker from "@/components/feed/ReactionPicker";
import CommentItem from "@/components/feed/CommentItem";
import CommentComposer from "@/components/feed/CommentComposer";
import { CommentSkeleton } from "@/components/ui/Skeleton";
import PostTags from "@/components/feed/PostTags";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import LeftSidebar from "@/components/layout/LeftSidebar";
import Loading from "@/components/ui/Loading";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { CommentIcon, icons } from "@/components/ui/Icons";

const LOAD_FAILED = "Failed to load take";

type TakePageProfile = { id: string; username: string; display_name: string | null; avatar_url: string | null };
type TakePageRow = TakeTableRow & {
  tags: { tag: string }[] | null;
  collaborators: { role: string | null; status: string; user: TakePageProfile | null }[] | null;
  mentions: { user: TakePageProfile | null }[] | null;
};


interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SingleTakePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, profile, status: authStatus } = useAuth();
  const [take, setTake] = useState<Take | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction states
  const [relaysCount, setRelaysCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isRelayed, setIsRelayed] = useState(false);
  const [followStatus, setFollowStatus] = useState<FollowStatus>(null);
  const isFollowing = followStatus === "accepted";
  const isRequested = followStatus === "pending";

  // UI states
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  // Same player and tracking as the vertical feed (V-18, V-22).
  const videoStyle = useMemo(() => takeVideoStyle(take?.effects), [take?.effects]);
  const { startWatching, stopWatching, recordLoop, recordCompletion } = useTrackTakeView(id, take?.duration ?? 0, "page");
  useTrackTakeImpression(id, "page", !!take && showContent);
  const { blockUser } = useBlock();

  // Comments hook
  const {
    comments,
    loading: commentsLoading,
    hasMore: hasMoreComments,
    loadingMore: loadingMoreComments,
    loadMore: loadMoreComments,
    addComment,
    toggleLike,
    deleteComment,
    fetchReplies,
    ensureCommentVisible,
  } = useComments("take", id, { authorId: take?.author_id, live: true });

  // Deep link (?comment=, &reply=1): load the comment on any page, scroll
  // to it, and open its reply composer when a notification's Reply sent us.
  const searchParams = useSearchParams();
  const commentIdFromUrl = searchParams.get("comment");
  const replyFromUrl = searchParams.get("reply") === "1";
  const deepLinkDoneRef = useRef<string | null>(null);
  useEffect(() => {
    // Wait for auth too: the Reply toggle is disabled for signed-out viewers.
    if (!commentIdFromUrl || commentsLoading || authStatus === "loading" || deepLinkDoneRef.current === commentIdFromUrl) return;
    deepLinkDoneRef.current = commentIdFromUrl;
    let cancelled = false;
    (async () => {
      const { found, parentId } = await ensureCommentVisible(commentIdFromUrl);
      if (!found || cancelled) return;
      const scrollTo = (el: HTMLElement) => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Highlight the bubble itself, not the whole row with the avatar.
        const bubble = el.querySelector<HTMLElement>("[data-comment-bubble]") ?? el;
        bubble.classList.add("highlight-comment");
        setTimeout(() => bubble.classList.remove("highlight-comment"), 2000);
        if (replyFromUrl) {
          const toggle = el.querySelector<HTMLButtonElement>("[data-reply-toggle]");
          if (toggle && toggle.getAttribute("aria-expanded") !== "true") toggle.click();
        }
      };
      for (let attempt = 0; attempt < 20 && !cancelled; attempt++) {
        await new Promise((r) => setTimeout(r, 150));
        const el = document.getElementById(`comment-${commentIdFromUrl}`);
        if (el) {
          scrollTo(el);
          return;
        }
        if (parentId) {
          const parent = document.getElementById(`comment-${parentId}`);
          const toggle = parent?.querySelector<HTMLButtonElement>("[data-replies-toggle]");
          if (toggle && toggle.getAttribute("aria-expanded") !== "true") toggle.click();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commentIdFromUrl, replyFromUrl, commentsLoading, authStatus, ensureCommentVisible]);

  const isOwner = user?.id === take?.author_id;

  // Fetch take data
  const fetchTake = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch the take
      // One request for the take, its author, sound, tags, collaborators and
      // mentions (it used to be up to eleven, V-25).
      const { data: takeData, error: takeError } = await supabase
        .from("takes")
        .select(`${TAKE_ROW_SELECT}, tags:take_tags(tag), collaborators:take_collaborators(role, status, user:profiles!take_collaborators_user_id_fkey(id, username, display_name, avatar_url)), mentions:take_mentions(user:profiles!take_mentions_user_id_fkey(id, username, display_name, avatar_url))`)
        .eq("id", id)
        .single<TakePageRow>();

      if (takeError) {
        // supabase-js returns network failures as { error } too; only a
        // "no rows" result is a missing (or hidden) take (V-48).
        setError(takeError.code === "PGRST116" ? "Take not found" : LOAD_FAILED);
        setLoading(false);
        return;
      }

      if (!takeData) {
        setError("Take not found");
        setLoading(false);
        return;
      }

      const isOwnerCheck = user?.id === takeData.author_id;

      // Blocks are enforced by the takes read policy (Phase 6): a blocked
      // viewer never receives the row, so no client-side check is needed.

      // Visibility (public / followers / private) is enforced by the
      // takes_select policy since phase 1b; a row we may not see is a
      // "not found" above.

      setTake(takeFromTableRow(takeData));

      // Set content warning state
      setShowContent(!takeData.content_warning);

      setHashtags((takeData.tags || []).map((t) => t.tag));
      setCollaborators(
        (takeData.collaborators || [])
          .filter((c): c is typeof c & { user: TakePageProfile } => c.status === "accepted" && !!c.user)
          .map((c) => ({ role: c.role, user: c.user })),
      );
      setMentions((takeData.mentions || []).map((m) => m.user).filter((u): u is NonNullable<typeof u> => !!u));

      // Fetch user interactions
      if (user) {
        const [userSaveRes, userRelayRes, followRes] = await Promise.all([
          supabase.from("take_saves").select("take_id").eq("take_id", id).eq("user_id", user.id).maybeSingle(),
          supabase.from("take_relays").select("take_id").eq("take_id", id).eq("user_id", user.id).maybeSingle(),
          supabase.from("follows").select("status").eq("follower_id", user.id).eq("following_id", takeData.author_id).maybeSingle(),
        ]);

        setIsSaved(!!userSaveRes.data);
        setIsRelayed(!!userRelayRes.data);
        setFollowStatus((followRes.data?.status as FollowStatus) ?? null);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching take:", err);
      setError(LOAD_FAILED);
      setLoading(false);
    }
    // Only the user id matters: a refreshed session object must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  // One fetch per take/viewer: wait until auth has settled so the RLS-scoped
  // query runs once with the right session instead of anon-then-user (an
  // anon miss used to leave "Take not found" on screen).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (authStatus === "loading") return;
    fetchTake();
  }, [fetchTake, authStatus]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Reactions: shared store entry (counts + own reaction fetched on mount,
  // re-read on focus); the store owns optimistic update, RPC, revert, toast.
  const reaction = useReaction("take", id, {
    authorId: take?.author_id,
    refreshOnFocus: true,
    loadCounts: true,
    loadComments: true,
    live: true,
  });
  const commentsCount = reaction.comments;

  // Handlers
  const handleReaction = async (type: TakeReactionType) => {
    if (!take) return;
    await reaction.react(type);
  };

  const handleRemoveReaction = async () => {
    if (!take) return;
    await reaction.unreact();
  };

  const handleSave = async () => {
    if (!user || !take) return;

    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);

    const { error } = newIsSaved
      ? await supabase.from("take_saves").insert({ take_id: take.id, user_id: user.id })
      : await supabase.from("take_saves").delete().eq("take_id", take.id).eq("user_id", user.id);
    if (error) {
      setIsSaved(!newIsSaved);
      actionToast.genericError(newIsSaved ? "save take" : "unsave take");
    }
  };

  const handleRelay = async () => {
    if (!user || !take || isOwner) return;

    const newIsRelayed = !isRelayed;
    setIsRelayed(newIsRelayed);
    setRelaysCount((prev) => newIsRelayed ? prev + 1 : Math.max(0, prev - 1));

    const { error } = newIsRelayed
      ? await supabase.from("take_relays").insert({ take_id: take.id, user_id: user.id })
      : await supabase.from("take_relays").delete().eq("take_id", take.id).eq("user_id", user.id);
    if (error) {
      setIsRelayed(!newIsRelayed);
      setRelaysCount((prev) => newIsRelayed ? Math.max(0, prev - 1) : prev + 1);
      actionToast.genericError(newIsRelayed ? "relay take" : "remove relay");
    }
  };

  const handleFollow = async () => {
    if (!user || !take || isOwner) return;

    // Same helpers as the profile button (V-23): a private account gets a
    // pending request, not an instant "Following".
    const previous = followStatus;
    try {
      if (previous) {
        setFollowStatus(null);
        await unfollowUserRecord(user.id, take.author_id);
      } else {
        const status = await followUserRecord(user.id, take.author_id);
        setFollowStatus(status);
      }
    } catch {
      setFollowStatus(previous);
      if (previous) actionToast.unfollowError();
      else actionToast.followError();
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
      actionToast.genericError("delete take");
      setDeleting(false);
    }
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user || !take) return;

    setReportSubmitting(true);
    try {
      const ok = await submitReport(
        { type: "take", takeId: take.id, reportedUserId: take.author_id },
        user.id,
        reason,
        details,
      );
      if (!ok) {
        actionToast.reportError();
        setReportSubmitting(false);
        return;
      }
      setReportSubmitted(true);
      actionToast.reportSubmitted();
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Error reporting:", err);
      actionToast.reportError();
    }
    setReportSubmitting(false);
  };

  const handleBlock = async () => {
    if (!user || !take) return;

    setIsBlocking(true);
    try {
      const result = await blockUser(user.id, take.author_id);
      if (!result.success) {
        actionToast.blockError();
      } else {
        router.push("/takes");
      }
    } catch (err) {
      console.error("Error blocking:", err);
      actionToast.blockError();
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

  const handleAddComment = async () => {
    const text = commentText.trim();
    if (!text || !user || !take || submitting) return;

    setSubmitting(true);
    setCommentText("");
    const result = await addComment(text);
    if (!result.success) {
      setCommentText(text);
      actionToast.genericError("post comment");
    }
    setSubmitting(false);
  };

  const handleCommentLike = (commentId: string) => {
    if (!user) return;
    void toggleLike(commentId);
  };

  const handleCommentReply = async (parentId: string, content: string, replyToUserId: string | null) => {
    if (!user) return { success: false };
    return await addComment(content, { parentId, replyToUserId });
  };

  const handleCommentDelete = (commentId: string) => {
    deleteComment(commentId);
  };

  const takeUrl = typeof window !== "undefined" ? `${window.location.origin}/take/${id}` : `/take/${id}`;

  // Loading state
  if (loading) {
    return (
      <>
        <LeftSidebar />
        <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:ml-[72px] min-h-screen bg-canvas">
          <div className="max-w-[680px] mx-auto py-12 px-6">
            <div className="flex justify-center py-20">
              <Loading text="Loading the take" />
            </div>
          </div>
        </main>
      </>
    );
  }

  // Error state: a request failure gets a retry; a missing / hidden row is "not found" (V-48)
  if (error || !take) {
    const failed = error === LOAD_FAILED;
    return (
      <>
        <LeftSidebar />
        <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:ml-[72px] min-h-screen bg-canvas">
          <div className="max-w-[680px] mx-auto py-12 px-6">
            <div className="text-center py-20">
              <h1 className="font-display text-2xl text-ink mb-4">{failed ? "Couldn’t load this take" : "Take not found"}</h1>
              <p className="font-body text-muted mb-6">
                {failed ? "Check your connection and try again." : "This take may have been removed or doesn’t exist."}
              </p>
              {failed ? (
                <button
                  type="button"
                  onClick={() => fetchTake()}
                  className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-white"
                >
                  Try again
                </button>
              ) : (
                <Link href="/takes" className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-white">
                  Browse Takes
                </Link>
              )}
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <ErrorBoundary>
      <LeftSidebar />
      <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:ml-[72px] min-h-screen bg-canvas">
        <div className="max-w-[1100px] mx-auto py-4 md:py-8 px-3 md:px-6 flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* Left Column - Take */}
          <div className="flex-1 min-w-0">
            {/* Take Card */}
            <article className="bg-surface rounded-2xl shadow-sm border border-border-light overflow-hidden">
              {/* Author Header */}
              <div className="flex items-center gap-3 md:gap-4 p-4 md:p-6 border-b border-border-light">
                <Link href={`/studio/${take.author.username}`} className="flex-shrink-0">
                  <img
                    src={take.author.avatar_url || "/defaultprofile.png"}
                    alt={take.author.display_name || take.author.username}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md hover:scale-110 transition-transform"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/studio/${take.author.username}`} className="font-ui text-[1rem] font-medium text-ink hover:text-accent transition-colors truncate max-w-full">
                      {take.author.display_name || take.author.username}
                    </Link>
                    <span className="font-ui text-[0.85rem] text-muted">
                      shared a take
                    </span>
                  </div>
                  <span className="font-ui text-[0.8rem] text-muted">
                    {getTimeAgo(take.created_at)}
                  </span>
                </div>

                {/* Follow Button */}
                {!isOwner && user && (
                  <button
                    onClick={handleFollow}
                    className={`px-4 py-1.5 rounded-full font-ui text-sm font-medium transition-colors ${
                      isFollowing
                        ? "bg-skeleton/70 text-ink hover:bg-skeleton"
                        : "bg-gradient-to-r from-purple-primary to-pink-vivid text-white hover:scale-105"
                    }`}
                  >
                    {isFollowing ? "Following" : isRequested ? "Requested" : "Follow"}
                  </button>
                )}

                {(isOwner || user) && (
                  <ActionMenu
                    items={takeMenuItems}
                    buttonClassName="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-skeleton/60 transition-colors"
                    widthClassName="w-40"
                    buttonAriaLabel="Take options menu"
                  />
                )}
              </div>

              {/* Video Content */}
              <div className="p-6">
                {/* Caption */}
                {take.caption && (
                  <p className="font-body text-[1.05rem] text-ink leading-relaxed mb-4">
                    {take.caption}
                  </p>
                )}

                {/* Tags */}
                <PostTags
                  hashtags={hashtags}
                  collaborators={collaborators}
                  mentions={mentions}
                  kind="take"
                  contentId={id}
                  currentUserId={user?.id}
                  className="mb-4"
                />

                {/* Video Player */}
                <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-w-[400px] mx-auto">
                  <div className={`absolute inset-0 ${take.content_warning && !showContent ? "blur-xl" : ""}`}>
                    <TakePlayer
                      src={take.video_url}
                      isActive={showContent}
                      isMuted={isMuted}
                      volume={volume}
                      onToggleMute={toggleMute}
                      onPlayStart={startWatching}
                      onPauseStop={stopWatching}
                      onLoop={recordLoop}
                      onComplete={recordCompletion}
                      playbackRate={take.playback_speed}
                      videoStyle={videoStyle}
                      soundSrc={take.sound?.audio_url}
                      soundStartTime={take.sound_start_time}
                      soundVolume={take.added_sound_volume}
                      originalVolume={take.original_audio_volume}
                    />
                  </div>

                  {/* Content Warning Overlay */}
                  {take.content_warning && !showContent && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60">
                      <div className="flex flex-col items-center gap-4 p-6 max-w-[280px] text-center">
                        <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-ui text-base font-semibold text-white mb-1">Content Warning</h3>
                          <p className="font-ui text-sm text-white/70">{take.content_warning}</p>
                        </div>
                        <button
                          onClick={() => setShowContent(true)}
                          className="px-6 py-2.5 rounded-full font-ui text-sm font-medium text-white bg-surface/20 hover:bg-surface/30 transition-colors"
                        >
                          Show Content
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Volume Control (the player only offers mute while paused) */}
                  <button
                    onClick={toggleMute}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                    className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    {isMuted ? icons.volumeOff : icons.volumeOn}
                  </button>

                  {/* Duration Badge */}
                  {take.duration > 0 && (
                    <div className="absolute bottom-4 right-4 px-2 py-1 rounded bg-black/60 backdrop-blur-sm pointer-events-none">
                      <span className="font-ui text-xs text-white">
                        {Math.floor(take.duration / 60)}:{(take.duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-3 md:py-4 border-t border-border-light flex-wrap">
                {/* Reaction Picker */}
                <ReactionPicker
                  variant="pill"
                  kind="take"
                  id={id}
                  currentReaction={reaction.mine}
                  reactionCounts={reaction.counts}
                  countsLoaded={reaction.countsLoaded}
                  onOpen={reaction.loadCounts}
                  onReact={handleReaction}
                  onRemoveReaction={handleRemoveReaction}
                  disabled={!user}
                />

                <button
                  aria-label={commentsCount > 0 ? `Comments, ${commentsCount.toLocaleString()}` : "Comments"}
                  className="engage-pill text-ink hover:bg-subtle transition-colors"
                >
                  <CommentIcon className="shrink-0" />
                  {commentsCount > 0 && <span className="engage-pill-count">{commentsCount.toLocaleString()}</span>}
                </button>

                {!isOwner && (
                  <button
                    onClick={handleRelay}
                    disabled={!user}
                    aria-label={isRelayed ? `Remove relay (${relaysCount} relays)` : `Relay take (${relaysCount} relays)`}
                    aria-pressed={isRelayed}
                    className={`engage-pill transition-colors ${
                      isRelayed
                        ? "text-green-600"
                        : "text-ink hover:bg-subtle"
                    } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {icons.relay}
                    {relaysCount > 0 && <span className="engage-pill-count">{relaysCount.toLocaleString()}</span>}
                  </button>
                )}

                <div className="flex-1" />

                <button
                  onClick={() => setShowShareModal(true)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-ink hover:bg-subtle transition-colors"
                >
                  {icons.share}
                </button>

                <button
                  onClick={handleSave}
                  disabled={!user}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isSaved
                      ? "text-ink"
                      : "text-ink hover:bg-subtle"
                  } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSaved ? icons.bookmarkFilled : icons.bookmark}
                </button>
              </div>
            </article>
          </div>

          {/* Right Column - Discussion */}
          <div className="w-full lg:w-[360px] flex-shrink-0">
            <section className="bg-surface rounded-2xl shadow-sm border border-border-light overflow-hidden lg:sticky lg:top-[86px]">
              <div className="p-5 border-b border-border-light">
                <h2 className="font-ui text-[1rem] font-medium text-ink flex items-center gap-2">
                  <CommentIcon className="shrink-0" />
                  Discussion ({commentsCount})
                </h2>
              </div>

              {/* Comments List */}
              <div className="p-4 max-h-[calc(100vh-320px)] overflow-y-auto">
                {commentsLoading ? (
                  <div className="space-y-1" aria-busy="true" aria-label="Loading comments">
                    <CommentSkeleton />
                    <CommentSkeleton />
                    <CommentSkeleton />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center text-purple-primary">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 7l3.5-3.5H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v15z" />
                      </svg>
                    </div>
                    <p className="font-ui text-[0.95rem] text-ink mb-1">No comments yet</p>
                    <p className="font-body text-sm text-muted">Be the first to share what you think.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        kind="take"
                        contentId={id}
                        currentUserId={user?.id}
                        canDeleteAny={!!isOwner}
                        onLike={handleCommentLike}
                        onReply={handleCommentReply}
                        onLoadReplies={fetchReplies}
                        onDelete={handleCommentDelete}
                      />
                    ))}
                    {hasMoreComments && (
                      <button
                        onClick={() => void loadMoreComments()}
                        disabled={loadingMoreComments}
                        className="w-full py-2 rounded-full font-ui text-[0.8rem] text-purple-primary hover:bg-purple-primary/5 transition-colors disabled:opacity-50"
                      >
                        {loadingMoreComments ? "Loading…" : "Load more comments"}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {/* Composer — stays at the bottom of the discussion (Phase 6) */}
              {user ? (
                <div className="p-3 md:p-4 border-t border-border-light bg-surface sticky bottom-0">
                  <CommentComposer
                    value={commentText}
                    onChange={setCommentText}
                    onSubmit={handleAddComment}
                    submitting={submitting}
                    showAvatar
                    avatarUrl={profile?.avatar_url || "/defaultprofile.png"}
                  />
                </div>
              ) : (
                <div className="p-4 border-t border-border-light text-center">
                  <p className="font-ui text-[0.9rem] text-muted">
                    <Link href="/login" className="text-purple-primary hover:underline">Sign in</Link> to comment
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={takeUrl}
        title={take.caption || "Check out this Take"}
        description={take.caption || ""}
        type="take"
        authorName={take.author.display_name || take.author.username}
      />

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReport}
          submitting={reportSubmitting}
          submitted={reportSubmitted}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Take?"
        description="This action cannot be undone. This will permanently delete your take and remove all associated data including comments and reactions."
        confirmText="Delete"
        isDanger
        loading={deleting}
      />

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fadeIn">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full mx-4 animate-scaleIn">
            <h3 className="font-display text-lg font-semibold text-ink mb-2">
              Block @{take.author.username}?
            </h3>
            <p className="font-body text-sm text-muted mb-6">
              They won&apos;t be able to see your posts, follow you, or message you. They won&apos;t be notified.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2.5 rounded-full border border-border-light font-ui text-sm font-medium text-ink hover:bg-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                disabled={isBlocking}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white font-ui text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isBlocking ? "Blocking..." : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
