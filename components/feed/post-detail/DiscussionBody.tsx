"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CommentItem from "@/components/feed/CommentItem";
import CommentComposer from "@/components/feed/CommentComposer";
import { CommentSkeleton } from "@/components/ui/Skeleton";
import type { EngagementKind } from "@/lib/engagement/store";
import type { DiscussionApi } from "./flows";

interface Props {
  kind: EngagementKind;
  contentId: string;
  discussion: DiscussionApi;
  /** Signed-in viewer; null renders the sign-in prompt instead of the composer. */
  currentUserId?: string | null;
  avatarUrl?: string | null;
  /** The content's author (and moderators) may delete any comment. */
  canDeleteAny?: boolean;
  canModerateDeleteComments?: boolean;
  onModeratorDeleteComment?: (commentId: string, reason?: string) => Promise<void>;
  listClassName?: string;
  composerClassName?: string;
  /** Lets the page focus the composer from the Comment pill. */
  composerId?: string;
}

/** Comment list, load-more, composer or sign-in prompt — posts and takes (V-52: five copies). */
export function DiscussionBody({
  kind,
  contentId,
  discussion: comments,
  currentUserId,
  avatarUrl,
  canDeleteAny = false,
  canModerateDeleteComments,
  onModeratorDeleteComment,
  listClassName = "discussion-list flex-1 overflow-y-auto p-6",
  composerClassName = "p-3 md:p-4 bg-elevated border-t border-border-light",
  composerId,
}: Props) {
  const pathname = usePathname();
  const signInHref = `/login?redirect=${encodeURIComponent(pathname || "/")}`;
  return (
    <>
      <div className={listClassName}>
        {comments.loading ? (
          <div className="space-y-1" aria-busy="true" aria-label="Loading comments">
            <CommentSkeleton />
            <CommentSkeleton />
            <CommentSkeleton />
          </div>
        ) : comments.comments.length === 0 ? (
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
          <div className="space-y-5">
            {comments.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                kind={kind}
                contentId={contentId}
                currentUserId={currentUserId ?? undefined}
                canDeleteAny={canDeleteAny}
                onLike={comments.like}
                onReply={comments.reply}
                onLoadReplies={comments.fetchReplies}
                onDelete={comments.remove}
                canModerateDelete={canModerateDeleteComments}
                onModeratorDelete={onModeratorDeleteComment}
              />
            ))}
            {comments.hasMore && (
              <button
                onClick={() => void comments.loadMore()}
                disabled={comments.loadingMore}
                className="w-full py-2 rounded-full font-ui text-[0.8rem] text-purple-primary hover:bg-purple-primary/5 transition-colors disabled:opacity-50"
              >
                {comments.loadingMore ? "Loading…" : "Load more comments"}
              </button>
            )}
          </div>
        )}
      </div>

      {currentUserId ? (
        <div className={`discussion-composer ${composerClassName}`} id={composerId}>
          <CommentComposer value={comments.text} onChange={comments.setText} onSubmit={comments.submit} submitting={comments.submitting} showAvatar avatarUrl={avatarUrl} />
        </div>
      ) : (
        <div className="discussion-composer p-4 bg-elevated border-t border-border-light text-center">
          <p className="font-ui text-[0.9rem] text-muted">
            <Link href={signInHref} className="text-purple-primary hover:underline">Sign in</Link> to comment
          </p>
        </div>
      )}
    </>
  );
}
