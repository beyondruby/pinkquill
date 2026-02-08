"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import type { SellerAccount, SellerEarnings, Transaction } from "../types/store";

// ============================================================================
// SELLER ONBOARDING
// ============================================================================

interface UseSellerOnboardingReturn {
  account: SellerAccount | null;
  loading: boolean;
  error: string | null;
  startOnboarding: () => Promise<void>;
  checkStatus: () => Promise<void>;
  openDashboard: () => Promise<void>;
}

export function useSellerOnboarding(): UseSellerOnboardingReturn {
  const [account, setAccount] = useState<SellerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/stripe/connect/status");
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      if (data.has_account) {
        // Fetch full account from DB
        const { data: dbAccount } = await supabase
          .from("seller_accounts")
          .select("*")
          .single();

        if (dbAccount) {
          setAccount({
            ...dbAccount,
            onboarding_complete: data.onboarding_complete,
            charges_enabled: data.charges_enabled,
            payouts_enabled: data.payouts_enabled,
          } as SellerAccount);
        }
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

  const startOnboarding = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start onboarding";
      setError(message);
      setLoading(false);
    }
  }, []);

  const openDashboard = useCallback(async () => {
    try {
      setError(null);

      const res = await fetch("/api/stripe/connect/dashboard", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      window.open(data.url, "_blank");
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
// CHECKOUT
// ============================================================================

interface UseCheckoutReturn {
  clientSecret: string | null;
  loading: boolean;
  error: string | null;
  createCheckout: (orderId: string) => Promise<string | null>;
}

export function useCheckout(): UseCheckoutReturn {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCheckout = useCallback(async (orderId: string): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setClientSecret(data.client_secret);
      return data.client_secret;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create checkout";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { clientSecret, loading, error, createCheckout };
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

      // Transactions are visible via RLS to order participants
      // We fetch transactions for orders where the user is buyer or seller
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
