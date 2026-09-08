"use client";

import dynamic from "next/dynamic";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { BLOCK_COPY, DELETE_TAKE_COPY } from "@/components/feed/post-detail/copy";
import type { Take } from "@/lib/hooks/useTakes";
import type { TakeDetailActions } from "./useTakeDetailActions";

const ShareModal = dynamic(() => import("@/components/ui/ShareModal"), { ssr: false });
const ReportModal = dynamic(() => import("@/components/ui/ReportModal"), { ssr: false });

interface Props {
  take: Take;
  actions: TakeDetailActions;
}

/** Share, delete, block and report dialogs for a take — one copy each (V-4). */
export function TakeDetailDialogs({ take, actions }: Props) {
  const { dialogs } = actions;
  const takeUrl = typeof window !== "undefined" ? `${window.location.origin}/take/${take.id}` : `/take/${take.id}`;
  return (
    <>
      <ShareModal
        isOpen={dialogs.share.open}
        onClose={dialogs.share.hide}
        url={takeUrl}
        title={take.caption || "Check out this Take"}
        description={take.caption || ""}
        type="take"
        authorName={take.author.display_name || take.author.username}
      />

      <ConfirmationModal
        isOpen={dialogs.del.open}
        onClose={dialogs.del.hide}
        onConfirm={dialogs.del.confirm}
        title={DELETE_TAKE_COPY.title}
        description={DELETE_TAKE_COPY.description}
        confirmText={DELETE_TAKE_COPY.confirm}
        isDanger
        loading={dialogs.del.loading}
      />

      <ConfirmationModal
        isOpen={dialogs.block.open}
        onClose={dialogs.block.hide}
        onConfirm={dialogs.block.confirm}
        title={BLOCK_COPY.title(take.author.username)}
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
