"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import type { ShippingAddress } from "../types/store";

// ============================================================================
// Types
// ============================================================================

export interface SellerCustomer {
  buyer_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  total_orders: number;
  completed_orders: number;
  active_orders: number;
  total_spent: number;
  avg_order_value: number;
  buyer_phone: string | null;
  shipping_address: ShippingAddress | null;
  first_order_at: string;
  last_order_at: string;
  orders: CustomerOrder[];
}

export interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  amount: number;
  created_at: string;
  product_title: string | null;
  listing_type: string;
}

export interface SellerCustomerStats {
  total_customers: number;
  repeat_customers: number;
  total_revenue: number;
  avg_order_value: number;
}

// ============================================================================
// useSellerCustomers — the CRM aggregate, computed by the database (Phase 4b)
// ============================================================================

interface UseSellerCustomersReturn {
  customers: SellerCustomer[];
  stats: SellerCustomerStats;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY_STATS: SellerCustomerStats = { total_customers: 0, repeat_customers: 0, total_revenue: 0, avg_order_value: 0 };

export function useSellerCustomers(userId?: string): UseSellerCustomersReturn {
  const [customers, setCustomers] = useState<SellerCustomer[]>([]);
  const [stats, setStats] = useState<SellerCustomerStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchCustomers = useCallback(async () => {
    if (!userId) {
      setCustomers([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      // One round-trip: get_seller_customers groups, sums and orders on the server.
      const { data, error: rpcError } = await supabase.rpc("get_seller_customers", { p_seller_id: userId });
      if (rpcError) throw rpcError;
      if (!mountedRef.current) return;
      const result = (data ?? {}) as { customers?: SellerCustomer[]; stats?: SellerCustomerStats };
      setCustomers((result.customers ?? []).map((c) => ({ ...c, total_spent: Number(c.total_spent), avg_order_value: Number(c.avg_order_value), orders: (c.orders ?? []).map((o) => ({ ...o, amount: Number(o.amount) })) })));
      setStats(result.stats ? { ...EMPTY_STATS, ...result.stats, total_revenue: Number(result.stats.total_revenue), avg_order_value: Number(result.stats.avg_order_value) } : EMPTY_STATS);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useSellerCustomers] Error:", message);
      if (mountedRef.current) setError(message || "Failed to load customers");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchCustomers();
    return () => { mountedRef.current = false; };
  }, [fetchCustomers]);

  return { customers, stats, loading, error, refetch: fetchCustomers };
}
