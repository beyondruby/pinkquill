"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMuted, useVolume, TakeReactionType, TakeReactionCounts } from "@/lib/hooks/useTakes";
import { useBlock } from "@/lib/hooks";
import { useTakeComments } from "@/lib/hooks/useTakes";
import TakeReactionPicker from "@/components/takes/TakeReactionPicker";
import TakeCommentItem from "@/components/takes/TakeCommentItem";
import PostTags from "@/components/feed/PostTags";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { icons } from "@/components/ui/Icons";

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

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function SingleTakePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, profile } = useAuth();
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
  const [showMenu, setShowMenu] = useState(false);
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

  const menuRef = useRef<HTMLDivElement>(null);
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

      // SECURITY CHECK: Blocking (Highest Priority)
      // If User A blocks User B, User B CANNOT see User A's takes (even via direct link)
      if (!isOwnerCheck && user) {
        // Check if the take author has blocked the current user
        const { data: blockedByAuthor } = await supabase
          .from("blocks")
          .select("id")
          .eq("blocker_id", takeData.author_id)
          .eq("blocked_id", user.id)
          .maybeSingle();

        if (blockedByAuthor) {
          // Author blocked this user - show as if take doesn't exist
          setError("Take not found");
          setLoading(false);
          return;
        }

        // Check if the current user has blocked the take author
        const { data: userBlockedAuthor } = await supabase
          .from("blocks")
          .select("id")
          .eq("blocker_id", user.id)
          .eq("blocked_id", takeData.author_id)
          .maybeSingle();

        if (userBlockedAuthor) {
          // User blocked the author - show as if take doesn't exist
          setError("Take not found");
          setLoading(false);
          return;
        }
      }

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
            .select("*", { count: "exact", head: true })
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
            .select("*", { count: "exact", head: true })
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
        supabase.from("take_saves").select("id", { count: "exact" }).eq("take_id", id),
        supabase.from("take_relays").select("id", { count: "exact" }).eq("take_id", id),
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
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id).eq("following_id", takeData.author_id),
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

  useEffect(() => {
    fetchTake();
  }, [fetchTake]);

  // Video control
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Click outside menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

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
      await Promise.all([
        supabase.from("take_reactions").delete().eq("take_id", take.id),
        supabase.from("take_comments").delete().eq("take_id", take.id),
        supabase.from("take_saves").delete().eq("take_id", take.id),
        supabase.from("take_relays").delete().eq("take_id", take.id),
      ]);

      await supabase.from("takes").delete().eq("id", take.id);
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

  // Loading state
  if (loading) {
    return (
      <>
        <LeftSidebar />
        <main className="ml-[220px] min-h-screen bg-[#fdfdfd]">
          <div className="max-w-[680px] mx-auto py-12 px-6">
            <div className="text-center py-20">
              <div className="w-8 h-8 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-body text-muted italic">Loading take...</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Error state
  if (error || !take) {
    return (
      <>
        <LeftSidebar />
        <main className="ml-[220px] min-h-screen bg-[#fdfdfd]">
          <div className="max-w-[680px] mx-auto py-12 px-6">
            <div className="text-center py-20">
              <h1 className="font-display text-2xl text-ink mb-4">Take not found</h1>
              <p className="font-body text-muted mb-6">This take may have been removed or doesn&apos;t exist.</p>
              <Link href="/takes" className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-white">
                Browse Takes
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <LeftSidebar />
      <main className="ml-[220px] min-h-screen bg-[#fdfdfd]">
        <div className="max-w-[1100px] mx-auto py-8 px-6 flex gap-6">
          {/* Left Column - Take */}
          <div className="flex-1 min-w-0">
            {/* Take Card */}
            <article className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden">
              {/* Author Header */}
              <div className="flex items-center gap-4 p-6 border-b border-black/[0.06]">
                <Link href={`/studio/${take.author.username}`}>
                  <img
                    src={take.author.avatar_url || "/defaultprofile.png"}
                    alt={take.author.display_name || take.author.username}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md hover:scale-110 transition-transform"
                  />
                </Link>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/studio/${take.author.username}`} className="font-ui text-[1rem] font-medium text-ink hover:text-purple-primary transition-colors">
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
                    className={`px-4 py-1.5 rounded-full font-ui text-sm font-medium transition-all ${
                      isFollowing
                        ? "bg-black/[0.04] text-ink hover:bg-black/[0.08]"
                        : "bg-gradient-to-r from-purple-primary to-pink-vivid text-white hover:scale-105"
                    }`}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                )}

                {/* Menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.04] transition-all"
                  >
                    {icons.moreHorizontal}
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-black/[0.08] overflow-hidden z-50 animate-fadeIn">
                      {isOwner ? (
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            setShowDeleteConfirm(true);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-red-500 hover:bg-red-50 transition-colors"
                        >
                          {icons.trash}
                          Delete
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setShowMenu(false);
                              setShowBlockConfirm(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-ink hover:bg-black/[0.04] transition-colors"
                          >
                            {icons.block}
                            Block
                          </button>
                          <button
                            onClick={() => {
                              setShowMenu(false);
                              setShowReportModal(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-red-500 hover:bg-red-50 transition-colors"
                          >
                            {icons.flag}
                            Report
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
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
                  className="mb-4"
                />

                {/* Video Player */}
                <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-w-[400px] mx-auto">
                  <video
                    ref={videoRef}
                    src={take.video_url}
                    className={`absolute inset-0 w-full h-full object-cover cursor-pointer ${take.content_warning && !showContent ? 'blur-xl' : ''}`}
                    loop
                    playsInline
                    muted={isMuted}
                    onClick={togglePlayPause}
                    poster={take.thumbnail_url || undefined}
                  />

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
                          className="px-6 py-2.5 rounded-full font-ui text-sm font-medium text-white bg-white/20 hover:bg-white/30 transition-colors"
                        >
                          Show Content
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Play/Pause Overlay */}
                  {!isPlaying && showContent && (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                      onClick={togglePlayPause}
                    >
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                        <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Volume Control */}
                  <button
                    onClick={toggleMute}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    {isMuted ? icons.volumeOff : icons.volumeOn}
                  </button>

                  {/* Duration Badge */}
                  {take.duration > 0 && (
                    <div className="absolute bottom-4 right-4 px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
                      <span className="font-ui text-xs text-white">
                        {Math.floor(take.duration / 60)}:{(take.duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 px-6 py-4 border-t border-black/[0.06]">
                {/* Reaction Picker */}
                <TakeReactionPicker
                  currentReaction={userReaction}
                  reactionCounts={reactionCounts}
                  onReact={handleReaction}
                  onRemoveReaction={handleRemoveReaction}
                  disabled={!user}
                  standardStyle
                />

                <button
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary transition-all"
                >
                  {icons.comment}
                  {comments.length > 0 && <span className="text-sm font-medium">{comments.length}</span>}
                </button>

                {!isOwner && (
                  <button
                    onClick={handleRelay}
                    disabled={!user}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full transition-all ${
                      isRelayed
                        ? "bg-green-500/10 text-green-600"
                        : "bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary"
                    } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {icons.relay}
                    {relaysCount > 0 && <span className="text-sm font-medium">{relaysCount}</span>}
                  </button>
                )}

                <div className="flex-1" />

                <button
                  onClick={() => setShowShareModal(true)}
                  className="w-10 h-10 rounded-full bg-black/[0.04] flex items-center justify-center text-muted hover:bg-purple-primary/10 hover:text-purple-primary transition-all"
                >
                  {icons.share}
                </button>

                <button
                  onClick={handleSave}
                  disabled={!user}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isSaved
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary"
                  } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSaved ? icons.bookmarkFilled : icons.bookmark}
                </button>
              </div>
            </article>
          </div>

          {/* Right Column - Discussion */}
          <div className="w-[360px] flex-shrink-0">
            <section className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden sticky top-[86px]">
              <div className="p-5 border-b border-black/[0.06]">
                <h2 className="font-ui text-[1rem] font-medium text-ink flex items-center gap-2">
                  {icons.comment}
                  Discussion ({comments.length})
                </h2>
              </div>

              {/* Comment Input */}
              {user ? (
                <div className="p-4 border-b border-black/[0.06] flex gap-3 items-center">
                  <img
                    src={profile?.avatar_url || "/defaultprofile.png"}
                    alt="You"
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1 flex items-center bg-[#f5f5f5] rounded-full px-4 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-primary transition-all">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                      placeholder="Add to the conversation..."
                      disabled={submitting}
                      className="flex-1 py-2.5 border-none bg-transparent outline-none font-body text-[0.9rem] text-ink placeholder:text-muted/60"
                    />
                  </div>
                  <button
                    onClick={handleAddComment}
                    disabled={submitting || !commentText.trim()}
                    className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {icons.send}
                  </button>
                </div>
              ) : (
                <div className="p-4 border-b border-black/[0.06] text-center">
                  <p className="font-ui text-[0.9rem] text-muted">
                    <Link href="/login" className="text-purple-primary hover:underline">Sign in</Link> to comment
                  </p>
                </div>
              )}

              {/* Comments List */}
              <div className="p-4 max-h-[calc(100vh-280px)] overflow-y-auto">
                {commentsLoading ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="font-body text-muted italic">No comments yet. Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <TakeCommentItem
                        key={comment.id}
                        comment={comment}
                        currentUserId={user?.id}
                        onLike={handleCommentLike}
                        onReply={handleCommentReply}
                        onDelete={handleCommentDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
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
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] animate-fadeIn"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white rounded-2xl shadow-2xl z-[1001] animate-scaleIn p-6">
            <h3 className="font-display text-[1.3rem] text-ink mb-3">Delete Take?</h3>
            <p className="font-body text-[0.95rem] text-muted mb-6">
              This action cannot be undone. This will permanently delete your take and remove all associated data including comments and reactions.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-5 py-2.5 rounded-full font-ui text-[0.9rem] text-muted bg-black/[0.04] hover:bg-black/[0.08] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2.5 rounded-full font-ui text-[0.9rem] text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 animate-scaleIn">
            <h3 className="font-display text-lg font-semibold text-ink mb-2">
              Block @{take.author.username}?
            </h3>
            <p className="font-body text-sm text-muted mb-6">
              They won&apos;t be able to see your posts, follow you, or message you. They won&apos;t be notified.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2.5 rounded-full border border-black/10 font-ui text-sm font-medium text-ink hover:bg-black/[0.03] transition-colors"
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
    </>
  );
}
