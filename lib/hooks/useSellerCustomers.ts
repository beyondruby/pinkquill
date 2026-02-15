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
// useSellerCustomers — Aggregated customer data for CRM
// ============================================================================

interface UseSellerCustomersReturn {
  customers: SellerCustomer[];
  stats: SellerCustomerStats;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ACTIVE_STATUSES = ["paid", "in_progress", "submitted", "revision_requested", "processing", "shipped"];
const COMPLETED_STATUSES = ["completed", "delivered"];
const REVENUE_STATUSES = [...ACTIVE_STATUSES, ...COMPLETED_STATUSES];

export function useSellerCustomers(userId?: string): UseSellerCustomersReturn {
  const [customers, setCustomers] = useState<SellerCustomer[]>([]);
  const [stats, setStats] = useState<SellerCustomerStats>({
    total_customers: 0,
    repeat_customers: 0,
    total_revenue: 0,
    avg_order_value: 0,
  });
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

      const { data, error: queryError } = await supabase
        .from("orders")
        .select(`
          id, order_number, status, amount, created_at, listing_type,
          buyer_phone, shipping_address, buyer_note,
          buyer:profiles!orders_buyer_id_fkey (
            id, username, display_name, avatar_url, is_verified
          ),
          product:products ( title )
        `)
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;
      if (!mountedRef.current) return;

      // Group orders by buyer_id
      const customerMap = new Map<string, {
        buyer: { id: string; username: string; display_name: string | null; avatar_url: string | null; is_verified: boolean };
        orders: Array<{
          id: string;
          order_number: string;
          status: string;
          amount: number;
          created_at: string;
          listing_type: string;
          buyer_phone: string | null;
          shipping_address: ShippingAddress | null;
          product_title: string | null;
        }>;
      }>();

      type BuyerProfile = { id: string; username: string; display_name: string | null; avatar_url: string | null; is_verified: boolean };

      for (const row of data || []) {
        const rawBuyer = row.buyer as unknown;
        const buyer: BuyerProfile | null = Array.isArray(rawBuyer) ? rawBuyer[0] ?? null : (rawBuyer as BuyerProfile | null);
        if (!buyer) continue;

        const existing = customerMap.get(buyer.id);
        const orderEntry = {
          id: row.id,
          order_number: row.order_number as string,
          status: row.status,
          amount: Number(row.amount) || 0,
          created_at: row.created_at,
          listing_type: row.listing_type as string,
          buyer_phone: row.buyer_phone as string | null,
          shipping_address: row.shipping_address as ShippingAddress | null,
          product_title: (() => {
            const rawProduct = row.product as unknown;
            const product = Array.isArray(rawProduct) ? rawProduct[0] : rawProduct;
            return (product as { title: string } | null)?.title || null;
          })(),
        };

        if (existing) {
          existing.orders.push(orderEntry);
        } else {
          customerMap.set(buyer.id, { buyer, orders: [orderEntry] });
        }
      }

      // Aggregate per customer
      const aggregated: SellerCustomer[] = [];
      let totalRevenue = 0;
      let totalRevenueOrders = 0;

      for (const [buyerId, { buyer, orders }] of customerMap) {
        const completedOrders = orders.filter((o) => COMPLETED_STATUSES.includes(o.status));
        const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
        const revenueOrders = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
        const spent = revenueOrders.reduce((sum, o) => sum + o.amount, 0);

        totalRevenue += spent;
        totalRevenueOrders += revenueOrders.length;

        // Get latest non-null contact info
        const latestPhone = orders.find((o) => o.buyer_phone)?.buyer_phone || null;
        const latestAddress = orders.find((o) => o.shipping_address)?.shipping_address || null;

        // Orders are already sorted desc by created_at
        const lastOrderAt = orders[0].created_at;
        const firstOrderAt = orders[orders.length - 1].created_at;

        aggregated.push({
          buyer_id: buyerId,
          username: buyer.username,
          display_name: buyer.display_name,
          avatar_url: buyer.avatar_url,
          is_verified: buyer.is_verified,
          total_orders: orders.length,
          completed_orders: completedOrders.length,
          active_orders: activeOrders.length,
          total_spent: Math.round(spent * 100) / 100,
          avg_order_value: revenueOrders.length > 0
            ? Math.round((spent / revenueOrders.length) * 100) / 100
            : 0,
          buyer_phone: latestPhone,
          shipping_address: latestAddress,
          first_order_at: firstOrderAt,
          last_order_at: lastOrderAt,
          orders: orders.map((o) => ({
            id: o.id,
            order_number: o.order_number,
            status: o.status,
            amount: o.amount,
            created_at: o.created_at,
            product_title: o.product_title,
            listing_type: o.listing_type,
          })),
        });
      }

      // Sort by total spent desc
      aggregated.sort((a, b) => b.total_spent - a.total_spent);

      setCustomers(aggregated);
      setStats({
        total_customers: aggregated.length,
        repeat_customers: aggregated.filter((c) => c.total_orders > 1).length,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        avg_order_value: totalRevenueOrders > 0
          ? Math.round((totalRevenue / totalRevenueOrders) * 100) / 100
          : 0,
      });
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
