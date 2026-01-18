"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import { createNotification } from "./useNotifications";
import type { CollaborationInvite } from "../types";

// ============================================================================
// useCollaborationInvites - Fetch collaboration invites for a user
// ============================================================================

interface UseCollaborationInvitesReturn {
  invites: CollaborationInvite[];
  loading: boolean;
  accept: (postId: string, authorId: string) => Promise<{ success: boolean; error?: unknown }>;
  decline: (postId: string, authorId: string) => Promise<{ success: boolean; error?: unknown }>;
  refetch: () => Promise<void>;
}

export function useCollaborationInvites(userId?: string): UseCollaborationInvitesReturn {
  const [invites, setInvites] = useState<CollaborationInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const fetchInvites = useCallback(async () => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) {
      if (mountedRef.current) {
        setInvites([]);
        setLoading(false);
      }
      return;
    }

    try {
      if (mountedRef.current) setLoading(true);

      const { data, error } = await supabase
        .from("post_collaborators")
        .select(
          `
          *,
          post:posts (
            id,
            title,
            type,
            content,
            status,
            author:profiles!posts_author_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          )
        `
        )
        .eq("user_id", currentUserId)
        .eq("status", "pending")
        .order("invited_at", { ascending: false });

      if (!mountedRef.current) return;

      if (error) {
        // Table might not exist yet - silently ignore
        if (
          error.code === "42P01" ||
          error.message?.includes("relation") ||
          error.message?.includes("does not exist")
        ) {
          setInvites([]);
          return;
        }
        throw error;
      }

      setInvites((data as CollaborationInvite[]) || []);
    } catch (err: unknown) {
      // Silently handle table doesn't exist errors and network errors
      const errMsg = err instanceof Error ? err.message : "";
      const errCode = (err as { code?: string })?.code;
      const isTableError = errCode === "42P01";
      const isNetworkError =
        errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError");

      if (!isTableError && !isNetworkError) {
        console.error("[useCollaborationInvites] Error:", errMsg || err);
      }
      if (mountedRef.current) {
        setInvites([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (userId) {
      fetchInvites();
    } else {
      setInvites([]);
      setLoading(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [userId, fetchInvites]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`collab-invites-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_collaborators",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (mountedRef.current) {
            fetchInvites();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchInvites]);

  const accept = async (postId: string, authorId: string) => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) return { success: false };

    try {
      const { error } = await supabase
        .from("post_collaborators")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
        })
        .eq("post_id", postId)
        .eq("user_id", currentUserId);

      if (error) throw error;

      await createNotification(authorId, currentUserId, "collaboration_accepted", postId);

      // Update local state
      if (mountedRef.current) {
        setInvites((prev) => prev.filter((inv) => inv.post_id !== postId));
      }

      return { success: true };
    } catch (err) {
      console.error("[useCollaborationInvites] accept Error:", err);
      return { success: false, error: err };
    }
  };

  const decline = async (postId: string, authorId: string) => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) return { success: false };

    try {
      const { error } = await supabase
        .from("post_collaborators")
        .update({
          status: "declined",
          responded_at: new Date().toISOString(),
        })
        .eq("post_id", postId)
        .eq("user_id", currentUserId);

      if (error) throw error;

      await createNotification(authorId, currentUserId, "collaboration_declined", postId);

      // Update local state
      if (mountedRef.current) {
        setInvites((prev) => prev.filter((inv) => inv.post_id !== postId));
      }

      return { success: true };
    } catch (err) {
      console.error("[useCollaborationInvites] decline Error:", err);
      return { success: false, error: err };
    }
  };

  return { invites, loading, accept, decline, refetch: fetchInvites };
}
