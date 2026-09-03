"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";

/**
 * Seller analytics (Phase 2e): one server-side aggregation
 * (get_seller_analytics) over the seller's orders, refunds and message
 * threads. Money is in the listing currency (USD); rates are 0–1 or null
 * when there is nothing to measure.
 */

export interface SellerAnalytics {
  window_days: number;
  from: string;
  to: string;
  currency: string;
  totals: { paid_orders: number; gross: number; fees: number; net: number; refunded: number; avg_order: number; buyers: number };
  previous: { paid_orders: number; gross: number; net: number };
  revenue_by_week: Array<{ week: string; gross: number; net: number; orders: number }>;
  conversion: { requests: number; paid: number; declined: number; expired: number; waiting: number; cancelled_unpaid: number; rate: number | null };
  on_time: { delivered: number; on_time: number; rate: number | null; avg_days_early: number };
  response: { asked: number; answered: number; median_hours: number | null; avg_hours: number | null; within_24h: number; rate_24h: number | null };
  repeat: { buyers: number; repeat_buyers: number; rate: number | null; orders_from_repeat: number; orders: number };
  by_listing: Array<{ product_id: string; title: string | null; listing_type: string | null; orders: number; gross: number; net: number }>;
}

export function useSellerAnalytics(sellerId?: string, days = 90) {
  const [data, setData] = useState<SellerAnalytics | null>(null);
  const [loading, setLoading] = useState(Boolean(sellerId));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!sellerId) { setData(null); setLoading(false); return; }
    setLoading(true);
    const { data: result, error: rpcError } = await supabase.rpc("get_seller_analytics", { p_seller_id: sellerId, p_days: days });
    if (rpcError) { setError(rpcError.message); setData(null); }
    else { setError(null); setData(result as SellerAnalytics); }
    setLoading(false);
  }, [sellerId, days]);

  useEffect(() => {
    const timer = setTimeout(() => { void refetch(); }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch };
}
