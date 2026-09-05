"use client";

import { useId, useState } from "react";
import { useJoinCommunity } from "@/lib/hooks.legacy";
import type { Community } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { actionToast } from "@/lib/utils/toast";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { FieldLabel } from "@/components/create/pieces";

interface JoinButtonProps {
  community: Community;
  userId: string;
  onUpdate?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Where the viewer stands with a community, as one control:
 * Join / Request to join (primary), Joined / Requested (secondary, leaving or
 * cancelling asks first), Accept + Decline for an invitation, "Admin" for the
 * owner (ownership moves in settings). The request note lives on the shared
 * Sheet; leaving and cancelling use the shared confirmation.
 */
export default function JoinButton({ community, userId, onUpdate, size = "md", className = "" }: JoinButtonProps) {
  const { join, leave, requestJoin, cancelRequest, isJoining: loading } = useJoinCommunity();
  const [showRequest, setShowRequest] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [invitationLoading, setInvitationLoading] = useState(false);
  const noteId = useId();
  const buttonSize = size === "lg" ? "md" : size;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleJoin = async (e: React.MouseEvent) => {
    stop(e);
    if (loading) return;
    if (community.privacy === "private") {
      setShowRequest(true);
      return;
    }
    const result = await join(community.id, userId);
    if (result.success) {
      actionToast.joinedCommunity(community.name);
      onUpdate?.();
    } else {
      actionToast.membershipError(typeof result.error === "string" ? result.error : undefined);
    }
  };

  const handleLeave = async () => {
    const result = await leave(community.id, userId);
    setShowLeave(false);
    if (result.success) onUpdate?.();
    else actionToast.genericError("leave community");
  };

  const handleCancelRequest = async () => {
    const result = await cancelRequest(community.id, userId);
    setShowCancel(false);
    if (result.success) onUpdate?.();
    else actionToast.genericError("cancel request");
  };

  const handleSubmitRequest = async () => {
    const result = await requestJoin(community.id, userId, requestMessage.trim() || undefined);
    if (result.success) {
      actionToast.joinRequestSent();
      setShowRequest(false);
      setRequestMessage("");
      onUpdate?.();
    } else {
      actionToast.membershipError(typeof result.error === "string" ? result.error : undefined);
    }
  };

  const answerInvitation = async (e: React.MouseEvent, accept: boolean) => {
    stop(e);
    if (!community.pending_invitation_id) return;
    setInvitationLoading(true);
    try {
      const { data, error } = await supabase.rpc(accept ? "accept_community_invitation" : "decline_community_invitation", {
        p_invitation_id: community.pending_invitation_id,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string } | null;
      if (!result?.ok) {
        actionToast.membershipError(result?.error);
        return;
      }
      if (accept) actionToast.invitationAccepted(community.name);
      else actionToast.invitationDeclined();
      onUpdate?.();
    } catch (err) {
      console.error("[JoinButton] invitation error:", err);
      actionToast.membershipError();
    } finally {
      setInvitationLoading(false);
    }
  };

  if (community.is_member && community.user_role === "admin") {
    return (
      <Button variant="secondary" size={buttonSize} className={className} disabled aria-disabled="true" title="You run this community. Ownership moves in Settings.">
        Admin
      </Button>
    );
  }

  if (community.is_member) {
    return (
      <>
        <Button variant="secondary" size={buttonSize} className={className} onClick={(e) => { stop(e); setShowLeave(true); }} disabled={loading} aria-pressed="true">
          Joined
        </Button>
        <ConfirmationModal
          isOpen={showLeave}
          onClose={() => setShowLeave(false)}
          onConfirm={handleLeave}
          title={`Leave ${community.name}?`}
          description={community.privacy === "private" ? "You'll need to request again to come back." : "You can join again any time."}
          confirmText="Leave"
          isDanger
          loading={loading}
        />
      </>
    );
  }

  if (community.has_pending_request) {
    return (
      <>
        <Button variant="secondary" size={buttonSize} className={className} onClick={(e) => { stop(e); setShowCancel(true); }} disabled={loading}>
          Requested
        </Button>
        <ConfirmationModal
          isOpen={showCancel}
          onClose={() => setShowCancel(false)}
          onConfirm={handleCancelRequest}
          title="Withdraw your request?"
          description="The admins won't see it any more. You can ask again later."
          confirmText="Withdraw"
          loading={loading}
        />
      </>
    );
  }

  if (community.has_pending_invitation) {
    return (
      <div className={`flex items-center gap-2 ${className}`.trim()}>
        <Button variant="primary" size={buttonSize} onClick={(e) => answerInvitation(e, true)} loading={invitationLoading} loadingText="Joining…">
          Accept invite
        </Button>
        <Button variant="ghost" size={buttonSize} onClick={(e) => answerInvitation(e, false)} disabled={invitationLoading}>
          Decline
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button variant="primary" size={buttonSize} className={className} onClick={handleJoin} loading={loading} loadingText={community.privacy === "private" ? "Requesting…" : "Joining…"}>
        {community.privacy === "private" ? "Request to join" : "Join"}
      </Button>

      <Sheet
        isOpen={showRequest}
        onClose={() => { setShowRequest(false); setRequestMessage(""); }}
        title={`Request to join ${community.name}`}
        subtitle="The admins review requests. A short note helps."
        busy={loading}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowRequest(false); setRequestMessage(""); }} disabled={loading}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmitRequest} loading={loading} loadingText="Sending…">Send request</Button>
          </>
        }
      >
        <div>
          <FieldLabel htmlFor={noteId} hint={`(optional) ${requestMessage.length}/500`}>Note to the admins</FieldLabel>
          <textarea
            id={noteId}
            className="pq-field"
            value={requestMessage}
            onChange={(e) => setRequestMessage(e.target.value)}
            placeholder="Why you'd like to join, or what you make."
            rows={3}
            maxLength={500}
            disabled={loading}
          />
        </div>
      </Sheet>
    </>
  );
}
