"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import type {
  Dispute,
  DisputeReason,
  DisputeResolution,
  ProductSeller,
} from "../types/store";

// ============================================================================
// useCreateDispute — Open a dispute on an order
// ============================================================================

export function useCreateDispute() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDispute = useCallback(
    async (orderId: string, reason: DisputeReason, description: string) => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc("open_dispute", {
          p_order_id: orderId,
          p_reason: reason,
          p_description: description,
        });

        if (rpcError) throw rpcError;
        return data as Dispute;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to open dispute";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createDispute, loading, error };
}

// ============================================================================
// useOrderDispute — Fetch dispute for an order (if any)
// ============================================================================

export function useOrderDispute(orderId: string | undefined) {
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("disputes")
      .select(
        `
        *,
        initiator:profiles!disputes_initiated_by_fkey (
          id, username, display_name, avatar_url, is_verified
        )
      `
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setDispute(data as unknown as Dispute);
    } else {
      setDispute(null);
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Real-time updates on disputes
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`dispute-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "disputes",
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          fetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, fetch]);

  return { dispute, loading, refetch: fetch };
}

// ============================================================================
// useResolveDispute — Resolve a dispute (admin/service)
// ============================================================================

export function useResolveDispute() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveDispute = useCallback(
    async (
      disputeId: string,
      resolution: DisputeResolution,
      notes?: string,
      refundAmount?: number
    ) => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc("resolve_dispute", {
          p_dispute_id: disputeId,
          p_resolution: resolution,
          p_resolution_notes: notes ?? null,
          p_refund_amount: refundAmount ?? null,
        });

        if (rpcError) throw rpcError;
        return data as Dispute;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to resolve dispute";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { resolveDispute, loading, error };
}

// ============================================================================
// useRequestRefund — Request a refund via API
// ============================================================================

export function useRequestRefund() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestRefund = useCallback(async (orderId: string, reason?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, reason }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Refund request failed");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to request refund";
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { requestRefund, loading, error };
}
