"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { safeResponseJson } from "../utils/fetch";
import type { SellerAccount, SellerEarnings, Transaction } from "../types/store";

async function buildAuthHeaders(initial?: HeadersInit): Promise<Headers> {
  const headers = new Headers(initial);
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return headers;
}

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
      const res = await fetch("/api/payments/connect/status", {
        headers: await buildAuthHeaders(),
      });
      const data = await safeResponseJson<Record<string, unknown>>(res);

      if (!res.ok) throw new Error((data.error as string) || `Request failed (${res.status})`);

      if (data.has_account) {
        setAccount({
          id: data.id || `seller-${data.user_id || "placeholder"}`,
          user_id: data.user_id || "",
          stripe_account_id: data.account_id || null,
          onboarding_complete: Boolean(data.onboarding_complete),
          charges_enabled: Boolean(data.charges_enabled),
          payouts_enabled: Boolean(data.payouts_enabled),
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

  const startOnboarding = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const res = await fetch("/api/payments/connect/onboard", {
        method: "POST",
        headers: await buildAuthHeaders({ "Content-Type": "application/json" }),
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

      const res = await fetch("/api/payments/connect/dashboard", {
        method: "POST",
        headers: await buildAuthHeaders({ "Content-Type": "application/json" }),
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
// CHECKOUT
// ============================================================================

export type CheckoutMode = "stripe" | "placeholder";

interface UseCheckoutReturn {
  mode: CheckoutMode;
  clientSecret: string | null;
  loading: boolean;
  error: string | null;
  createCheckout: (orderId: string) => Promise<string | null>;
  confirmPayment: (orderId: string, captchaToken?: string | null) => Promise<boolean>;
  /** @deprecated Use confirmPayment instead */
  confirmPlaceholderPayment: (orderId: string, captchaToken?: string | null) => Promise<boolean>;
}

export function useCheckout(): UseCheckoutReturn {
  const [mode, setMode] = useState<CheckoutMode>("placeholder");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCheckout = useCallback(async (orderId: string): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: await buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ order_id: orderId }),
      });

      const data = await safeResponseJson<Record<string, unknown>>(res);

      if (!res.ok) throw new Error((data.error as string) || `Request failed (${res.status})`);

      const checkoutMode = (data.mode || "placeholder") as CheckoutMode;
      setMode(checkoutMode);
      setClientSecret((data.client_secret as string) || null);
      return (data.client_secret as string) || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create checkout";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmPayment = useCallback(async (orderId: string, captchaToken?: string | null): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: await buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          order_id: orderId,
          captcha_token: captchaToken || null,
        }),
      });

      const data = await safeResponseJson<Record<string, unknown>>(res);
      if (!res.ok) throw new Error((data.error as string) || "Failed to confirm payment");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to confirm payment";
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    mode,
    clientSecret,
    loading,
    error,
    createCheckout,
    confirmPayment,
    confirmPlaceholderPayment: confirmPayment,
  };
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
