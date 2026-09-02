"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildAuthenticatedHeaders } from "@/lib/auth-client";
import { supabase } from "../supabase";
import { safeResponseJson } from "../utils/fetch";
import type { SellerAccount, SellerEarnings, Transaction } from "../types/store";

// ============================================================================
// SELLER ONBOARDING
// ============================================================================

interface UseSellerOnboardingReturn {
  account: SellerAccount | null;
  loading: boolean;
  error: string | null;
  startOnboarding: (country?: string) => Promise<void>;
  checkStatus: () => Promise<void>;
  openDashboard: () => Promise<void>;
}

// The status route calls Stripe (accounts.retrieve) and writes seller_accounts
// on every request. Two components mount this hook on the seller dashboard,
// so share one result for a few minutes and dedupe concurrent calls.
const SELLER_STATUS_TTL_MS = 5 * 60 * 1000;
let sellerStatusCache: { data: Record<string, unknown>; fetchedAt: number } | null = null;
let sellerStatusInFlight: Promise<Record<string, unknown>> | null = null;

async function loadSellerStatus(force = false): Promise<Record<string, unknown>> {
  if (!force && sellerStatusCache && Date.now() - sellerStatusCache.fetchedAt < SELLER_STATUS_TTL_MS) {
    return sellerStatusCache.data;
  }
  if (sellerStatusInFlight) return sellerStatusInFlight;
  sellerStatusInFlight = (async () => {
    const res = await fetch("/api/stripe/connect/status", {
      headers: await buildAuthenticatedHeaders(),
    });
    const data = await safeResponseJson<Record<string, unknown>>(res);
    if (!res.ok) throw new Error((data.error as string) || `Request failed (${res.status})`);
    sellerStatusCache = { data, fetchedAt: Date.now() };
    return data;
  })();
  try {
    return await sellerStatusInFlight;
  } finally {
    sellerStatusInFlight = null;
  }
}

export function useSellerOnboarding(): UseSellerOnboardingReturn {
  const [account, setAccount] = useState<SellerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async (force = false) => {
    try {
      setError(null);
      const data = await loadSellerStatus(force);

      if (data.has_account) {
        setAccount({
          id: data.id || `seller-${data.user_id || "placeholder"}`,
          user_id: data.user_id || "",
          stripe_account_id: data.account_id || null,
          onboarding_complete: Boolean(data.onboarding_complete),
          charges_enabled: Boolean(data.charges_enabled),
          payouts_enabled: Boolean(data.payouts_enabled),
          card_payments_enabled: Boolean(data.card_payments_enabled),
          transfers_enabled: Boolean(data.transfers_enabled),
          default_currency: data.default_currency || "usd",
          country: data.country || null,
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
          provider: data.provider || "placeholder",
          placeholder_mode: Boolean(data.placeholder_mode),
        } as SellerAccount);
      } else {
        setAccount(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to check seller status";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const startOnboarding = useCallback(async (country?: string) => {
    try {
      setError(null);
      setLoading(true);

      sellerStatusCache = null;
      const res = await fetch("/api/stripe/connect/onboard", {
        method: "POST",
        headers: await buildAuthenticatedHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(country ? { country } : {}),
      });
      const data = await safeResponseJson<Record<string, unknown>>(res);

      if (!res.ok) throw new Error((data.error as string) || `Request failed (${res.status})`);

      // Redirect to Stripe Connect onboarding
      window.location.href = data.url as string;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start onboarding";
      setError(message);
      setLoading(false);
    }
  }, []);

  const openDashboard = useCallback(async () => {
    try {
      setError(null);

      const res = await fetch("/api/stripe/connect/dashboard", {
        method: "POST",
        headers: await buildAuthenticatedHeaders({ "Content-Type": "application/json" }),
      });
      const data = await safeResponseJson<Record<string, unknown>>(res);

      if (!res.ok) throw new Error((data.error as string) || `Request failed (${res.status})`);

      window.open(data.url as string, "_blank");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open dashboard";
      setError(message);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return { account, loading, error, startOnboarding, checkStatus, openDashboard };
}

// ============================================================================
// SELLER EARNINGS
// ============================================================================

interface UseSellerEarningsReturn {
  earnings: SellerEarnings | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSellerEarnings(userId?: string): UseSellerEarningsReturn {
  const [earnings, setEarnings] = useState<SellerEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchEarnings = useCallback(async () => {
    if (!userId) {
      setEarnings(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc("get_seller_earnings", {
        p_user_id: userId,
      });

      if (rpcError) throw rpcError;
      if (!mountedRef.current) return;

      setEarnings(data as SellerEarnings);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch earnings";
      if (mountedRef.current) setError(message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchEarnings();
    return () => { mountedRef.current = false; };
  }, [fetchEarnings]);

  return { earnings, loading, error, refetch: fetchEarnings };
}

// ============================================================================
// TRANSACTION HISTORY
// ============================================================================

interface UseTransactionHistoryReturn {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function useTransactionHistory(
  userId?: string,
  pageSize = 20
): UseTransactionHistoryReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(0);
  const mountedRef = useRef(true);

  const fetchPage = useCallback(async (page: number) => {
    if (!userId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      if (page === 0) setLoading(true);
      setError(null);

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error: queryError } = await supabase
        .from("transactions")
        .select(`
          *,
          order:orders!inner (
            id, order_number, buyer_id, seller_id
          )
        `)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`, { referencedTable: "orders" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (queryError) throw queryError;
      if (!mountedRef.current) return;

      const txns = (data || []) as Transaction[];
      setTransactions((prev) => (page === 0 ? txns : [...prev, ...txns]));
      setHasMore(txns.length === pageSize);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch transactions";
      if (mountedRef.current) setError(message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId, pageSize]);

  const loadMore = useCallback(async () => {
    pageRef.current += 1;
    await fetchPage(pageRef.current);
  }, [fetchPage]);

  useEffect(() => {
    mountedRef.current = true;
    pageRef.current = 0;
    fetchPage(0);
    return () => { mountedRef.current = false; };
  }, [fetchPage]);

  return { transactions, loading, error, hasMore, loadMore };
}
