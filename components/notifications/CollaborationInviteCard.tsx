"use client";

import { useState } from "react";
import Link from "next/link";
import type { CollaborationInvite } from "@/lib/hooks.legacy";
import { getTimeAgoCompact } from "@/lib/utils/time";
import { getPostTypePhrase } from "@/lib/feed-view/post-type-theme";
import Button from "@/components/ui/Button";
import { PersonRow } from "@/components/communities/pieces";
import "./notifications.css";

interface CollaborationInviteCardProps {
  invite: CollaborationInvite;
  onAccept: (postId: string, authorId: string) => Promise<void>;
  onDecline: (postId: string, authorId: string) => Promise<void>;
}

function getExcerpt(content: string, maxLength = 120): string {
  const text = content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return text.length <= maxLength ? text : `${text.substring(0, maxLength)}…`;
}

/** An invitation to be named on someone's work: who, what, a preview, and two answers. */
export default function CollaborationInviteCard({ invite, onAccept, onDecline }: CollaborationInviteCardProps) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const author = invite.post.author;
  const phrase = getPostTypePhrase(invite.post.type).replace(/^(wrote|shared|recorded|published)\s(a|an|in their)\s?/, "");

  const answer = async (kind: "accept" | "decline") => {
    setBusy(kind);
    try {
      if (kind === "accept") await onAccept(invite.post_id, author.id);
      else await onDecline(invite.post_id, author.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pq-notif-card">
      <PersonRow person={author} meta={`Invited you to collaborate on their ${phrase || "post"} · ${getTimeAgoCompact(invite.invited_at)}`} />
      <div className="pq-notif-card__quote">
        {invite.post.title && <strong>{invite.post.title}</strong>}
        {getExcerpt(invite.post.content)}
      </div>
      <div className="pq-notif-card__actions">
        <Button variant="primary" size="sm" onClick={() => answer("accept")} disabled={busy !== null} loading={busy === "accept"} loadingText="Accepting…">Accept</Button>
        <Button variant="ghost" size="sm" onClick={() => answer("decline")} disabled={busy !== null} loading={busy === "decline"} loadingText="Declining…">Decline</Button>
        <Link href={`/post/${invite.post_id}?preview=true`} className="pq-button pq-button--sm pq-button--ghost">Preview</Link>
      </div>
    </div>
  );
}
