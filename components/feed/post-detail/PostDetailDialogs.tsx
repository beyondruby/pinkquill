"use client";

import dynamic from "next/dynamic";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import type { ModalPost } from "@/components/feed/PostCard/types";
import type { PostDetailActions } from "./usePostDetailActions";
import { BLOCK_COPY, DELETE_POST_COPY } from "./copy";

const ShareModal = dynamic(() => import("@/components/ui/ShareModal"), { ssr: false });
const ReportModal = dynamic(() => import("@/components/ui/ReportModal"), { ssr: false });
const CollectionPickerSheet = dynamic(() => import("@/components/collections/CollectionPickerSheet"), { ssr: false });

interface Props {
  post: ModalPost;
  actions: PostDetailActions;
}

/** Share, delete, remove-collaborator, block and report dialogs — one copy each (V-4). */
export function PostDetailDialogs({ post, actions }: Props) {
  const { dialogs } = actions;
  const handle = post.author.handle.replace("@", "");
  const postUrl = typeof window !== "undefined" ? `${window.location.origin}/post/${post.id}` : `/post/${post.id}`;
  const visual = (post.media || []).filter((m) => m.media_type !== "audio");
  return (
    <>
      <ShareModal
        isOpen={dialogs.share.open}
        onClose={dialogs.share.hide}
        url={postUrl}
        title={post.title || post.content.substring(0, 150)}
        description={post.content}
        type={post.type}
        authorName={post.author.name}
        authorUsername={post.author.handle}
        authorAvatar={post.author.avatar}
        imageUrl={visual.length > 0 ? visual[0].media_url : ""}
      />

      {dialogs.collection.open && <CollectionPickerSheet isOpen onClose={dialogs.collection.hide} postId={post.id} />}

      <ConfirmationModal
        isOpen={dialogs.del.open}
        onClose={dialogs.del.hide}
        onConfirm={dialogs.del.confirm}
        title={DELETE_POST_COPY.title}
        description={DELETE_POST_COPY.description}
        confirmText={DELETE_POST_COPY.confirm}
        isDanger
        loading={dialogs.del.loading}
      />

      <ConfirmationModal
        isOpen={dialogs.removeCollab.open}
        onClose={() => !dialogs.removeCollab.loading && dialogs.removeCollab.hide()}
        onConfirm={dialogs.removeCollab.confirm}
        title="Remove yourself from this collab?"
        description={`This post will no longer appear on your profile, and @${handle} will be notified. The post itself will stay published.`}
        confirmText="Remove me"
        cancelText="Cancel"
        isDanger
        loading={dialogs.removeCollab.loading}
      />

      <ConfirmationModal
        isOpen={dialogs.block.open}
        onClose={() => !dialogs.block.loading && dialogs.block.hide()}
        onConfirm={dialogs.block.confirm}
        title={BLOCK_COPY.title(handle)}
        description={BLOCK_COPY.description}
        confirmText={BLOCK_COPY.confirm}
        isDanger
        loading={dialogs.block.loading}
      />

      {dialogs.report.open && (
        <ReportModal isOpen={dialogs.report.open} onClose={dialogs.report.hide} onSubmit={dialogs.report.submit} submitting={dialogs.report.submitting} submitted={dialogs.report.submitted} />
      )}
    </>
  );
}
