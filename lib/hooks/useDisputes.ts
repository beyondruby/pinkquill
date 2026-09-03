"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { usePollOnFocus } from "./usePollOnFocus";
import type {
  Dispute,
  DisputeReason,
  DisputeResolution,
  OrderFileInput,
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

    try {
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
    } catch (err) {
      // A thrown fetch timeout must not leave the section spinning forever.
      console.warn("[useOrderDispute] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Dispute changes are low-frequency; refresh on focus instead of holding a
  // postgres_changes subscription open per order view.
  usePollOnFocus(fetch);

  return { dispute, loading, refetch: fetch };
}

// ============================================================================
// useResolveDispute — Resolve a dispute (admin/service)

// ============================================================================
// useRequestRefund — Buyer requests a refund (status → refund_requested)
// ============================================================================

export function useRequestRefund() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** amount in listing currency (USD); omit for a full refund */
  const requestRefund = useCallback(async (orderId: string, reason?: string, amount?: number) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/payments/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ order_id: orderId, reason, amount, action: "request" }),
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

// ============================================================================
// useDeclineRefund — Seller declines a buyer's refund request
// ============================================================================

export function useDeclineRefund() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const declineRefund = useCallback(async (orderId: string, reason?: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/payments/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ order_id: orderId, reason, action: "decline" }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to decline refund");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to decline refund";
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { declineRefund, loading, error };
}

// ============================================================================
// useApproveRefund — Seller approves/issues a refund (processes Stripe refund)
// ============================================================================

export function useApproveRefund() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approveRefund = useCallback(async (orderId: string, reason?: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/payments/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ order_id: orderId, reason, action: "approve" }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Refund approval failed");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to process refund";
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { approveRefund, loading, error };
}

// ============================================================================
// Phase 1d: cancel / issue refund / server-decided actions
// ============================================================================
async function postRefundAction(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; result?: unknown }> {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch("/api/payments/refund", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify(body),
  });
  let json: { error?: string; result?: unknown } = {};
  try { json = await response.json(); } catch { /* non-JSON error page */ }
  if (!response.ok) return { ok: false, error: json.error || `Request failed (${response.status})` };
  return { ok: true, result: json.result };
}

export function useCancelOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelOrder = useCallback(async (orderId: string, reason?: string) => {
    setLoading(true); setError(null);
    const r = await postRefundAction({ order_id: orderId, action: "cancel", reason });
    if (!r.ok) setError(r.error || "Failed to cancel order");
    setLoading(false);
    return r.ok ? (r.result as { outcome: string; refund?: boolean }) : null;
  }, []);
  return { cancelOrder, loading, error };
}

export function useIssueRefund() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** amount in listing currency (USD); omit for a full refund */
  const issueRefund = useCallback(async (orderId: string, amount?: number, reason?: string) => {
    setLoading(true); setError(null);
    const r = await postRefundAction({ order_id: orderId, action: "issue", amount, reason });
    if (!r.ok) setError(r.error || "Failed to issue refund");
    setLoading(false);
    return r.ok;
  }, []);
  return { issueRefund, loading, error };
}

/** Add a statement and/or files to an open dispute (add_dispute_evidence). */
export function useAddDisputeEvidence() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addEvidence = useCallback(async (disputeId: string, text: string, attachments: OrderFileInput[]) => {
    setLoading(true); setError(null);
    const { data, error: rpcError } = await supabase.rpc("add_dispute_evidence", {
      p_dispute_id: disputeId, p_text: text.trim() || null, p_attachments: attachments,
    });
    if (rpcError) { setError(rpcError.message); setLoading(false); return null; }
    setLoading(false);
    return data as { outcome: string; evidence_count: number };
  }, []);
  return { addEvidence, loading, error };
}

export interface OrderActions {
  role: "buyer" | "seller" | "admin";
  status: string;
  payment_status: string;
  is_late: boolean;
  can_accept: boolean; can_decline: boolean; can_start: boolean; can_deliver: boolean; can_ship: boolean; can_mark_delivered: boolean;
  can_pay: boolean; can_accept_delivery: boolean; can_request_revision: boolean; revisions_left: number | null;
  can_cancel: boolean; cancel_mode: "free" | "refund" | "request" | null;
  can_request_refund: boolean; can_issue_refund: boolean; can_decide_refund: boolean;
  can_open_dispute: boolean; can_add_evidence: boolean;
  seller_share_remaining_listing_cents: number;
  paid_out: boolean;
  payout: { status: string; amount_cents: number; currency: string; listing_amount_cents: number | null; sent_at: string | null; block_reason: string | null } | null;
  release_at: string | null;
  auto_complete_at: string | null;
  refund: { id: string; status: string; kind: "full" | "partial"; amount_cents: number; currency: string; listing_amount_cents: number | null; initiator_role: string; reason: string | null } | null;
  dispute: { id: string; kind: string; status: string; reason: string; evidence_due_by: string | null; evidence_count: number } | null;
}

/** What the current user may do on this order — decided by the server (get_order_actions). */
export function useOrderActions(orderId?: string, version?: unknown) {
  const [actions, setActions] = useState<OrderActions | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(orderId));
  const refetch = useCallback(async () => {
    if (!orderId) return;
    const { data, error: rpcError } = await supabase.rpc("get_order_actions", { p_order_id: orderId });
    if (rpcError) { console.error("[useOrderActions]", rpcError.message); setActions(null); }
    else setActions(data as OrderActions);
    setLoading(false);
  }, [orderId]);
  useEffect(() => {
    if (!orderId) return;
    // Deferred so the fetch (and its setState) never runs synchronously in the effect.
    const t = setTimeout(() => { void refetch(); }, 0);
    return () => clearTimeout(t);
  }, [refetch, version, orderId]);
  return { actions, loading, refetch };
}
