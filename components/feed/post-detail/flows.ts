"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useComments, type UseCommentsReturn } from "@/lib/hooks/useComments";
import { useBlock } from "@/lib/hooks/useInteractions";
import { submitReport, type ReportTarget } from "@/lib/reports";
import { actionToast } from "@/lib/utils/toast";
import type { EngagementKind } from "@/lib/engagement/store";

/**
 * The small state machines every detail surface repeats (profile audit 2f,
 * V-52): comments + composer, the report dialog, the block dialog. Posts
 * and takes, page, modal and cards all use these.
 */

export interface DiscussionApi extends UseCommentsReturn {
  text: string;
  setText: (value: string) => void;
  submitting: boolean;
  submit: () => Promise<void>;
  like: (commentId: string) => void;
  reply: (parentId: string, content: string, replyToUserId: string | null) => Promise<{ success: boolean }>;
  remove: (commentId: string) => void;
}

export function useDiscussion(
  kind: EngagementKind,
  id: string,
  options: { authorId?: string | null; enabled?: boolean } = {},
): DiscussionApi {
  const { user } = useAuth();
  const api = useComments(kind, id, { authorId: options.authorId, live: true, enabled: options.enabled ?? true });
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { addComment, toggleLike, deleteComment } = api;

  const submit = useCallback(async () => {
    if (!user) return;
    const value = text.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setText("");
    const result = await addComment(value);
    if (!result.success) {
      setText(value);
      actionToast.genericError("post comment");
    }
    setSubmitting(false);
  }, [user, text, submitting, addComment]);

  const like = useCallback((commentId: string) => { if (user) void toggleLike(commentId); }, [user, toggleLike]);
  const reply = useCallback(
    async (parentId: string, content: string, replyToUserId: string | null) => {
      if (!user) return { success: false };
      return addComment(content, { parentId, replyToUserId });
    },
    [user, addComment],
  );
  const remove = useCallback((commentId: string) => { deleteComment(commentId); }, [deleteComment]);

  return { ...api, text, setText, submitting, submit, like, reply, remove };
}

export interface ReportFlow {
  open: boolean;
  show: () => void;
  hide: () => void;
  submit: (reason: string, details?: string) => Promise<void>;
  submitting: boolean;
  submitted: boolean;
}

/** Report dialog state + submit (there were six copies of this). */
export function useReportFlow(target: ReportTarget | null): ReportFlow {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = useCallback(async (reason: string, details?: string) => {
    if (!user || !target) return;
    setSubmitting(true);
    try {
      const ok = await submitReport(target, user.id, reason, details);
      if (!ok) {
        actionToast.reportError();
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      actionToast.reportSubmitted();
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
      actionToast.reportError();
    }
    setSubmitting(false);
  }, [user, target]);

  return { open, show: () => setOpen(true), hide: () => setOpen(false), submit, submitting, submitted };
}

export interface BlockFlow {
  open: boolean;
  show: () => void;
  hide: () => void;
  confirm: () => Promise<void>;
  loading: boolean;
}

/** Block dialog state + the block write (there were four copies of this). */
export function useBlockFlow(targetUserId: string | null | undefined, onBlocked: (targetUserId: string) => void): BlockFlow {
  const { user } = useAuth();
  const { blockUser } = useBlock();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const confirm = useCallback(async () => {
    if (!user || !targetUserId) return;
    setLoading(true);
    try {
      const result = await blockUser(user.id, targetUserId);
      if (!result.success) {
        actionToast.blockError();
        return;
      }
      setOpen(false);
      onBlocked(targetUserId);
    } catch (err) {
      console.error("Failed to block user:", err);
      actionToast.blockError();
    } finally {
      setLoading(false);
    }
  }, [user, targetUserId, blockUser, onBlocked]);

  return { open, show: () => setOpen(true), hide: () => { if (!loading) setOpen(false); }, confirm, loading };
}
