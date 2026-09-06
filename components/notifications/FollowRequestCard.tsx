"use client";

import { useState } from "react";
import { getTimeAgoCompact } from "@/lib/utils/time";
import type { FollowRequest } from "@/lib/types";
import Button from "@/components/ui/Button";
import { PersonRow } from "@/components/communities/pieces";
import "./notifications.css";

interface FollowRequestCardProps {
  request: FollowRequest;
  onAccept: (requesterId: string) => Promise<void>;
  onDecline: (requesterId: string) => Promise<void>;
}

/** Someone wants to follow a private account: who, when, and two answers. */
export default function FollowRequestCard({ request, onAccept, onDecline }: FollowRequestCardProps) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const requester = request.requester;

  const answer = async (kind: "accept" | "decline") => {
    setBusy(kind);
    try {
      if (kind === "accept") await onAccept(request.follower_id);
      else await onDecline(request.follower_id);
    } catch (err) {
      console.error(`Failed to ${kind} follow request:`, err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pq-notif-card">
      <PersonRow person={requester} meta={`Asked to follow you · ${getTimeAgoCompact(request.requested_at)}`} />
      {requester.bio && <p className="pq-notif-card__quote">{requester.bio}</p>}
      <div className="pq-notif-card__actions">
        <Button variant="primary" size="sm" onClick={() => answer("accept")} disabled={busy !== null} loading={busy === "accept"} loadingText="Accepting…">Accept</Button>
        <Button variant="ghost" size="sm" onClick={() => answer("decline")} disabled={busy !== null} loading={busy === "decline"} loadingText="Declining…">Decline</Button>
      </div>
    </div>
  );
}
