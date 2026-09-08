"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { type Take, type TakeTableRow, takeFromTableRow, TAKE_ROW_SELECT } from "@/lib/hooks/useTakes";
import PostTags from "@/components/feed/PostTags";
import LeftSidebar from "@/components/layout/LeftSidebar";
import Loading from "@/components/ui/Loading";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { CommentIcon } from "@/components/ui/Icons";
import { DetailActionRow } from "@/components/feed/post-detail/DetailActionRow";
import { DiscussionBody } from "@/components/feed/post-detail/DiscussionBody";
import { useTakeDetailActions } from "@/components/takes/take-detail/useTakeDetailActions";
import { takeMetadataFromRow, type TakeMetadata } from "@/components/takes/take-detail/useTakeMetadata";
import { TakeDetailHeader } from "@/components/takes/take-detail/TakeDetailHeader";
import { TakeVideoFrame } from "@/components/takes/take-detail/TakeVideoFrame";
import { TakeDetailDialogs } from "@/components/takes/take-detail/TakeDetailDialogs";

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
  const { user, status: authStatus } = useAuth();
  const [take, setTake] = useState<Take | null>(null);
  const [metadata, setMetadata] = useState<TakeMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const discussionRef = useRef<HTMLElement>(null);

  // Everything but the fetch and the layout is shared with TakeDetailModal.
  const leave = useCallback(() => router.push("/takes"), [router]);
  const actions = useTakeDetailActions(take, { takeId: id, source: "page", onDeleted: leave, onBlocked: leave });
  const { comments } = actions;
  const commentsLoading = comments.loading;
  const ensureCommentVisible = comments.ensureCommentVisible;

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

      // Blocks are enforced by the takes read policy (Phase 6): a blocked
      // viewer never receives the row, so no client-side check is needed.

      // Visibility (public / followers / private) is enforced by the
      // takes_select policy since phase 1b; a row we may not see is a
      // "not found" above.

      // The viewer's save / relay flags (follow status is the detail hook's).
      let flags: { is_saved?: boolean; is_relayed?: boolean } = {};
      if (user) {
        const [userSaveRes, userRelayRes] = await Promise.all([
          supabase.from("take_saves").select("take_id").eq("take_id", id).eq("user_id", user.id).maybeSingle(),
          supabase.from("take_relays").select("take_id").eq("take_id", id).eq("user_id", user.id).maybeSingle(),
        ]);
        flags = { is_saved: !!userSaveRes.data, is_relayed: !!userRelayRes.data };
      }

      setTake(takeFromTableRow(takeData, flags));
      setMetadata(takeMetadataFromRow(takeData));
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
  useEffect(() => {
    if (authStatus === "loading") return;
    fetchTake();
  }, [fetchTake, authStatus]);

  // The Comment pill brings the discussion into view and focuses the composer (V-4).
  const focusDiscussion = useCallback(() => {
    discussionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const field = document.querySelector<HTMLTextAreaElement | HTMLInputElement>("#take-discussion-composer textarea, #take-discussion-composer input");
    field?.focus({ preventScroll: true });
  }, []);

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
            <article className="bg-surface rounded-2xl shadow-sm border border-border-light overflow-hidden">
              <TakeDetailHeader take={take} actions={actions} className="p-4 md:p-6 border-b border-border-light" />

              <div className="p-6">
                {take.caption && <p className="font-body text-[1.05rem] text-ink leading-relaxed mb-4">{take.caption}</p>}

                <PostTags
                  hashtags={metadata?.hashtags}
                  collaborators={metadata?.collaborators}
                  mentions={metadata?.mentions}
                  kind="take"
                  contentId={id}
                  currentUserId={actions.user?.id}
                  className="mb-4"
                />

                <TakeVideoFrame take={take} actions={actions} isActive frameClassName="max-w-[400px] mx-auto" />
              </div>

              <DetailActionRow kind="take" contentId={id} actions={actions} onComment={focusDiscussion} pickerVariant="pill" className="px-4 md:px-6 py-3 md:py-4 border-t border-border-light" />
            </article>
          </div>

          {/* Right Column - Discussion */}
          <div className="w-full lg:w-[360px] flex-shrink-0">
            <section ref={discussionRef} className="bg-surface rounded-2xl shadow-sm border border-border-light overflow-hidden lg:sticky lg:top-[86px] scroll-mt-20">
              <div className="p-5 border-b border-border-light">
                <h2 className="font-ui text-[1rem] font-medium text-ink flex items-center gap-2">
                  <CommentIcon className="shrink-0" />
                  Discussion ({actions.commentsCount})
                </h2>
              </div>
              <DiscussionBody
                kind="take"
                contentId={id}
                discussion={actions.comments}
                currentUserId={actions.user?.id}
                avatarUrl={actions.profile?.avatar_url}
                canDeleteAny={actions.isOwner}
                listClassName="p-4 max-h-[calc(100vh-320px)] overflow-y-auto"
                composerClassName="p-3 md:p-4 border-t border-border-light bg-surface sticky bottom-0 z-10"
                composerId="take-discussion-composer"
              />
            </section>
          </div>
        </div>
      </main>

      <TakeDetailDialogs take={take} actions={actions} />
    </ErrorBoundary>
  );
}
