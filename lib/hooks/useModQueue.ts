/**
 * Mod Queue Hooks
 * Handles community report/moderation queue functionality
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Report, ReportStatus, ReportType, ResolutionAction } from "@/lib/types";

// ============================================================================
// useModQueue - Fetch and manage reports for a community
// ============================================================================

interface ModQueueFilters {
  status?: ReportStatus;
  type?: ReportType;
}

interface ModQueueStats {
  pending: number;
  resolvedThisWeek: number;
}

export function useModQueue(communityId: string, filters?: ModQueueFilters) {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ModQueueStats>({ pending: 0, resolvedThisWeek: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchReports = useCallback(async () => {
    if (!communityId) return;

    setLoading(true);
    setError(null);

    try {
      // Query reports directly by community_id (set when reports are created)
      // Use column-name disambiguation for FK joins to profiles/posts
      let query = supabase
        .from("reports")
        .select(`
          *,
          reporter:profiles!reporter_id (
            username,
            display_name,
            avatar_url
          ),
          reported_user:profiles!reported_user_id (
            username,
            display_name,
            avatar_url
          ),
          reported_post:posts!reported_post_id (
            id,
            title,
            content,
            type
          ),
          resolver:profiles!resolved_by (
            username,
            display_name
          )
        `)
        .eq("community_id", communityId)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.type) {
        query = query.eq("type", filters.type);
      }

      const { data, error: fetchError } = await query;

      if (!mountedRef.current) return;

      if (fetchError) throw fetchError;

      setReports(data || []);

      // Calculate stats
      const pending = (data || []).filter(r => r.status === "pending").length;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const resolvedThisWeek = (data || []).filter(
        r => r.status === "resolved" && new Date(r.resolved_at || "") > weekAgo
      ).length;

      setStats({ pending, resolvedThisWeek });
    } catch (err) {
      console.error("Error fetching mod queue:", err);
      if (mountedRef.current) {
        setError("Failed to load reports");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [communityId, filters?.status, filters?.type]);

  useEffect(() => {
    mountedRef.current = true;
    fetchReports();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchReports]);

  return { reports, stats, loading, error, refetch: fetchReports };
}

// ============================================================================
// useResolveReport - Resolve/dismiss reports
// ============================================================================

export function useResolveReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(
    async (
      reportId: string,
      resolverId: string,
      action: ResolutionAction,
      notes?: string
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from("reports")
          .update({
            status: "resolved" as ReportStatus,
            resolved_by: resolverId,
            resolved_at: new Date().toISOString(),
            resolution_action: action,
            resolution_notes: notes || null,
          })
          .eq("id", reportId);

        if (updateError) throw updateError;

        return true;
      } catch (err) {
        console.error("Error resolving report:", err);
        setError("Failed to resolve report");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const dismiss = useCallback(
    async (reportId: string, resolverId: string, notes?: string): Promise<boolean> => {
      return resolve(reportId, resolverId, "dismissed", notes);
    },
    [resolve]
  );

  const markReviewed = useCallback(
    async (reportId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from("reports")
          .update({ status: "reviewed" as ReportStatus })
          .eq("id", reportId);

        if (updateError) throw updateError;

        return true;
      } catch (err) {
        console.error("Error marking report as reviewed:", err);
        setError("Failed to update report");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { resolve, dismiss, markReviewed, loading, error };
}

// ============================================================================
// useModerationActions - Perform moderation actions on users/content
// ============================================================================

export function useModerationActions(communityId: string) {
  const [loading, setLoading] = useState(false);

  const muteUser = useCallback(
    async (userId: string, reason: string, durationDays?: number): Promise<boolean> => {
      setLoading(true);

      try {
        const mutedUntil = durationDays
          ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const { error } = await supabase
          .from("community_members")
          .update({
            status: "muted",
            muted_until: mutedUntil,
            mute_reason: reason,
          })
          .eq("community_id", communityId)
          .eq("user_id", userId);

        if (error) throw error;

        return true;
      } catch (err) {
        console.error("Error muting user:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [communityId]
  );

  const banUser = useCallback(
    async (userId: string, reason: string, durationDays?: number): Promise<boolean> => {
      setLoading(true);

      try {
        const bannedUntil = durationDays
          ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const { error } = await supabase
          .from("community_members")
          .update({
            status: "banned",
            banned_until: bannedUntil,
            ban_reason: reason,
          })
          .eq("community_id", communityId)
          .eq("user_id", userId);

        if (error) throw error;

        return true;
      } catch (err) {
        console.error("Error banning user:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [communityId]
  );

  const deleteContent = useCallback(
    async (postId: string): Promise<boolean> => {
      setLoading(true);

      try {
        const { error } = await supabase
          .from("posts")
          .update({ status: "archived" })
          .eq("id", postId);

        if (error) throw error;

        return true;
      } catch (err) {
        console.error("Error deleting content:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { muteUser, banUser, deleteContent, loading };
}
