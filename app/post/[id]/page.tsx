"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { toModalPost, type PostLike } from "@/lib/posts/toPostProps";
import type { ModalPost } from "@/components/feed/PostCard/types";
import LeftSidebar from "@/components/layout/LeftSidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import PostTags from "@/components/feed/PostTags";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { ModalErrorFallback } from "@/components/ui/ErrorFallbacks";
import { icons } from "@/components/ui/Icons";
import Loading from "@/components/ui/Loading";
import { getBackgroundStyle } from "@/lib/utils/background";
import { getPostPalette } from "@/components/feed/post-detail/palette";
import { usePostDetailActions } from "@/components/feed/post-detail/usePostDetailActions";
import { PostDetailHeader } from "@/components/feed/post-detail/PostDetailHeader";
import { PostBody } from "@/components/feed/post-detail/PostBody";
import { PostMediaGallery } from "@/components/feed/post-detail/PostMediaGallery";
import { ContentWarningOverlay } from "@/components/feed/post-detail/ContentWarningOverlay";
import { DetailActionRow } from "@/components/feed/post-detail/DetailActionRow";
import { DiscussionBody } from "@/components/feed/post-detail/DiscussionBody";
import { PostDetailDialogs } from "@/components/feed/post-detail/PostDetailDialogs";

const LOAD_FAILED = "Failed to load post";

interface TaggedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface CollaboratorUser {
  role?: string | null;
  user: TaggedUser;
}

interface MentionRow {
  user: TaggedUser | TaggedUser[] | null;
}

interface TagRow {
  tag: { name?: string | null } | Array<{ name?: string | null }> | null;
}

interface CollaboratorRow {
  role?: string | null;
  user: TaggedUser | TaggedUser[] | null;
}

/** The fetched row plus the joined lists, in the shape `toModalPost` reads. */
type PostRow = PostLike & {
  author_id: string;
  status?: string | null;
  flair?: ModalPost["flair"] | ModalPost["flair"][] | null;
  community?: PostLike["community"] | PostLike["community"][];
};

const NEUTRAL_PALETTE = getPostPalette(null);

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = params.id as string;
  const commentIdFromUrl = searchParams.get('comment');
  const replyFromUrl = searchParams.get('reply') === '1';
  const mediaFailedFromUrl = searchParams.get("media_failed");
  const { user, status: authStatus } = useAuth();

  const [post, setPost] = useState<ModalPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const discussionRef = useRef<HTMLElement>(null);

  // Everything but the fetch and the layout is shared with PostDetailModal.
  const leave = useCallback(() => router.push("/"), [router]);
  const actions = usePostDetailActions(post, { postId, onDeleted: leave, onBlocked: leave });
  const { comments } = actions;
  const commentsLoading = comments.loading;
  const ensureCommentVisible = comments.ensureCommentVisible;

  // Deep link (?comment=): make sure the comment is loaded (any page, any
  // reply), then scroll to it. Replies render only when their parent thread
  // is expanded, so a reply link expands the parent through the DOM id of
  // the "View replies" toggle by retrying until the node exists.
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
          // Expand the parent thread if its toggle is present and collapsed.
          const parent = document.getElementById(`comment-${parentId}`);
          const toggle = parent?.querySelector<HTMLButtonElement>("button[data-replies-toggle]");
          if (toggle && toggle.getAttribute("aria-expanded") !== "true") toggle.click();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commentIdFromUrl, replyFromUrl, commentsLoading, authStatus, ensureCommentVisible]);

  // Single fetch function for all data
  const fetchData = useCallback(async () => {
    if (!postId) {
      setError("No post ID");
      setLoading(false);
      return;
    }

    try {
      // A retry from the failure screen must clear the previous error
      // and show the loading state again.
      setLoading(true);
      setError(null);

      // Fetch post
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select(`
          *,
          author:profiles!posts_author_id_fkey (
            username,
            display_name,
            avatar_url
          ),
          media:post_media (
            id,
            media_url,
            media_type,
            caption,
            position
          ),
          community:communities (
            id,
            slug,
            name,
            avatar_url
          ),
          flair:community_flairs (
            id,
            community_id,
            name,
            color,
            emoji,
            position,
            created_at
          )
        `)
        .eq("id", postId)
        .single();

      if (postError) {
        // supabase-js returns network failures as { error } too; only a
        // "no rows" result is a missing post (V-48).
        setError(postError.code === "PGRST116" ? "Post not found" : LOAD_FAILED);
        setLoading(false);
        return;
      }

      if (!postData) {
        setError("Post not found");
        setLoading(false);
        return;
      }

      // SECURITY CHECK: Blocking (Highest Priority - Rule Set 1)
      // If User A blocks User B, User B CANNOT see User A's posts (even via direct link)
      const isOwner = user?.id === postData.author_id;
      const postStatus = postData.status || "published";

      // Only the author and invited collaborators can view unpublished drafts via direct URL.
      if (postStatus !== "published" && !isOwner) {
        if (!user) {
          setError("Post not found");
          setLoading(false);
          return;
        }

        const { data: collaboration } = await supabase
          .from("post_collaborators")
          .select("status")
          .eq("post_id", postId)
          .eq("user_id", user.id)
          .maybeSingle();

        const canViewUnpublished =
          collaboration?.status === "pending" || collaboration?.status === "accepted";

        if (!canViewUnpublished) {
          setError("Post not found");
          setLoading(false);
          return;
        }

      }

      // Visibility, private accounts and blocks are enforced by the posts
      // read policy (`can_view_post`, Phase 4): a viewer who may not see the
      // post never receives the row, so no client-side checks are needed.

      // Fetch mentions, hashtags, collaborators, and the viewer's relay/save flags in parallel
      const mentionsPromise = supabase
        .from("post_mentions")
        .select(`
          user:profiles!post_mentions_user_id_fkey (
            id, username, display_name, avatar_url
          )
        `)
        .eq("post_id", postId);

      const tagsPromise = supabase
        .from("post_tags")
        .select("tag:tags(name)")
        .eq("post_id", postId);

      const collabPromise = supabase
        .from("post_collaborators")
        .select(`
          role,
          user:profiles!post_collaborators_user_id_fkey (
            id, username, display_name, avatar_url
          )
        `)
        .eq("post_id", postId)
        .eq("status", "accepted");

      const relayPromise = user
        ? supabase
            .from("relays")
            .select("user_id")
            .eq("post_id", postId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const savePromise = user
        ? supabase
            .from("saves")
            .select("user_id")
            .eq("post_id", postId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [mentionsRes, tagsRes, collabRes, relaysResult, saveResult] = await Promise.all([
        mentionsPromise, tagsPromise, collabPromise, relayPromise, savePromise,
      ]);

      const mentions: TaggedUser[] = mentionsRes.data
        ? (mentionsRes.data as MentionRow[])
            .map((m) => {
              const u = Array.isArray(m.user) ? m.user[0] : m.user;
              return u as TaggedUser | null;
            })
            .filter((u): u is TaggedUser => u !== null && u !== undefined)
        : [];

      const hashtags: string[] = tagsRes.data
        ? (tagsRes.data as TagRow[])
            .map((t) => {
              const tag = Array.isArray(t.tag) ? t.tag[0] : t.tag;
              return tag?.name;
            })
            .filter((name): name is string => !!name)
        : [];

      const collaborators: CollaboratorUser[] = collabRes.data
        ? (collabRes.data as CollaboratorRow[])
            .map((c) => {
              const u = Array.isArray(c.user) ? c.user[0] : c.user;
              return u ? { role: c.role, user: u } as CollaboratorUser : null;
            })
            .filter((c): c is CollaboratorUser => c !== null)
        : [];

      const row = postData as PostRow;
      const normalizedFlair = Array.isArray(row.flair) ? row.flair[0] : row.flair;
      const normalizedCommunity = Array.isArray(row.community) ? row.community[0] : row.community;
      setPost(
        toModalPost(
          {
            ...row,
            flair: normalizedFlair || null,
            community: normalizedCommunity || null,
            mentions: mentions.map((u) => ({ user: u })),
            hashtags,
            collaborators: collaborators.map((c) => ({ status: "accepted", role: c.role, user: c.user })),
          },
          { isSaved: !!saveResult.data, isRelayed: !!relaysResult.data },
        ),
      );
      setCurrentMediaIndex(0);
      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(LOAD_FAILED);
      setLoading(false);
    }
    // Only the user id matters: a refreshed session object must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user?.id]);

  // One fetch per post/viewer: wait until auth has settled so the RLS-scoped
  // query runs once with the right session instead of anon-then-user.
  useEffect(() => {
    if (authStatus === "loading") return;
    fetchData();
  }, [fetchData, authStatus]);

  // The Comment pill on the page brings the discussion into view and focuses the composer (V-4).
  const focusDiscussion = useCallback(() => {
    discussionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const field = document.querySelector<HTMLTextAreaElement | HTMLInputElement>("#post-discussion-composer textarea, #post-discussion-composer input");
    field?.focus({ preventScroll: true });
  }, []);

  // Loading state
  if (loading) {
    return (
      <>
        <MobileHeader />
        <LeftSidebar />
        <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:ml-[72px] min-h-screen bg-canvas">
          <div className="max-w-[680px] mx-auto py-12 px-4 md:px-6">
            <div className="flex justify-center py-20">
              <Loading text="Unfolding the page" />
            </div>
          </div>
        </main>
        <MobileBottomNav />
      </>
    );
  }

  // Error state: a request failure gets a retry; a missing / hidden row is "not found" (V-48)
  if (error || !post) {
    const failed = error === LOAD_FAILED;
    return (
      <>
        <MobileHeader />
        <LeftSidebar />
        <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:ml-[72px] min-h-screen bg-canvas">
          <div className="max-w-[680px] mx-auto py-12 px-4 md:px-6">
            <div className="text-center py-20">
              <h1 className="font-display text-2xl text-ink mb-4">{failed ? "Couldn’t load this post" : "Post not found"}</h1>
              <p className="font-body text-muted mb-6">
                {failed ? "Check your connection and try again." : "This post may have been removed or doesn’t exist."}
              </p>
              {failed ? (
                <button
                  type="button"
                  onClick={() => fetchData()}
                  className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-white"
                >
                  Try again
                </button>
              ) : (
                <Link href="/" className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-white">
                  Back to feed
                </Link>
              )}
            </div>
          </div>
        </main>
        <MobileBottomNav />
      </>
    );
  }

  const media = (post.media || []).filter((m) => m.media_type !== "audio");
  const mediaIndex = Math.min(currentMediaIndex, Math.max(0, media.length - 1));
  const failedMediaCount = mediaFailedFromUrl ? Number(mediaFailedFromUrl) : 0;
  const hasFailedMediaNotice = Number.isFinite(failedMediaCount) && failedMediaCount > 0;
  const palette = getPostPalette(post.styling);
  const { hasBackground } = palette;

  return (
    <ErrorBoundary
      section="PostDetail"
      fallback={({ reset }) => <ModalErrorFallback onRetry={reset} />}
    >
      <MobileHeader />
      <LeftSidebar />
      <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:ml-[72px] min-h-screen bg-canvas">
        <div className="max-w-[1100px] mx-auto py-6 px-4 md:py-8 md:px-6 flex flex-col lg:flex-row gap-6">
          {/* Left Column - Post */}
          <div className="flex-1 min-w-0">
            <article className="bg-surface rounded-2xl shadow-sm border border-border-light overflow-hidden">
              <PostDetailHeader post={post} palette={NEUTRAL_PALETTE} menuItems={actions.menuItems} className="p-4 md:p-6 border-b border-border-light" />

              {hasFailedMediaNotice && (
                <div className="mx-4 md:mx-6 mt-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3">
                  <p className="font-ui text-[0.85rem] text-amber-700">
                    {failedMediaCount} media file{failedMediaCount === 1 ? "" : "s"} failed to upload when this post was published.
                  </p>
                </div>
              )}

              <div className="p-4 md:p-6">
                <div className={`relative ${hasBackground ? "rounded-xl overflow-hidden" : ""}`}>
                  {hasBackground && (
                    <div
                      className="absolute inset-0"
                      style={{
                        ...getBackgroundStyle(post.styling?.background),
                        opacity: post.styling?.background?.type === "image" ? (post.styling.background.opacity ?? 1) : 1,
                        filter: post.styling?.background?.type === "image" && post.styling.background.blur ? `blur(${post.styling.background.blur}px)` : undefined,
                      }}
                    />
                  )}
                  {post.styling?.background?.type === "image" && <div className="absolute inset-0 bg-black/30" />}
                  <div className={hasBackground ? "relative z-10 p-4 md:p-6" : ""}>
                    <PostBody post={post} palette={palette} titleAs="h1" />
                    {media.length > 0 && (
                      <PostMediaGallery media={media} index={mediaIndex} onIndexChange={setCurrentMediaIndex} title={post.title || undefined} palette={palette} maxHeight={500} />
                    )}
                  </div>
                  {post.contentWarning && !actions.showContent && (
                    <ContentWarningOverlay warning={post.contentWarning} palette={palette} onShow={actions.revealContent} className="z-20" />
                  )}
                </div>
              </div>

              <div className="px-6">
                <PostTags
                  collaborators={post.collaborators}
                  mentions={post.mentions}
                  kind="post"
                  contentId={post.id}
                  currentUserId={actions.user?.id}
                  hashtags={post.hashtags}
                />
              </div>

              <DetailActionRow kind="post" contentId={post.id} actions={actions} onComment={focusDiscussion} className="px-4 md:px-6 py-3 md:py-4 border-t border-border-light" />
            </article>
          </div>

          {/* Right Column - Discussion */}
          <div className="w-full lg:w-[360px] flex-shrink-0">
            <section ref={discussionRef} className="bg-surface rounded-2xl shadow-sm border border-border-light overflow-hidden lg:sticky lg:top-[86px] scroll-mt-20">
              <div className="p-4 md:p-5 border-b border-border-light">
                <h2 className="font-ui text-[0.9rem] md:text-[1rem] font-medium text-ink flex items-center gap-2">
                  {icons.comment}
                  Discussion ({actions.commentsCount})
                </h2>
              </div>
              <DiscussionBody
                kind="post"
                contentId={post.id}
                discussion={actions.comments}
                currentUserId={actions.user?.id}
                avatarUrl={actions.profile?.avatar_url}
                canDeleteAny={actions.isOwner}
                listClassName="p-4 max-h-[calc(100vh-320px)] overflow-y-auto"
                composerClassName="p-3 md:p-4 border-t border-border-light bg-surface sticky bottom-16 md:bottom-0 z-20"
                composerId="post-discussion-composer"
              />
            </section>
          </div>
        </div>
      </main>

      <PostDetailDialogs post={post} actions={actions} />

      <MobileBottomNav />
    </ErrorBoundary>
  );
}
