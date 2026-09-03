"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { Order } from "../types/store";

/**
 * Reads behind the receipt and the payout statement (Phase 2e). All of it is
 * existing tables under existing policies: order participants can read
 * `payments`, `refunds` and `order_events`; sellers can read their `payouts`.
 */

export interface PaymentRecord {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  charge_id: string | null;
  payment_intent_id: string | null;
  stripe_fee_cents: number | null;
  refunded_cents: number | null;
  created_at: string;
}

export interface RefundRecord {
  id: string;
  kind: "full" | "partial";
  status: string;
  amount_cents: number;
  currency: string;
  listing_amount_cents: number | null;
  listing_currency: string | null;
  seller_share_cents: number | null;
  initiator_role: string;
  reason: string | null;
  created_at: string;
  decided_at: string | null;
}

export function useOrderMoneyRecords(orderId?: string) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));

  const refetch = useCallback(async () => {
    if (!orderId) { setLoading(false); return; }
    const [p, r, e] = await Promise.all([
      supabase.from("payments").select("id, amount_cents, currency, status, charge_id, payment_intent_id, stripe_fee_cents, refunded_cents, created_at").eq("order_id", orderId).order("created_at"),
      supabase.from("refunds").select("id, kind, status, amount_cents, currency, listing_amount_cents, listing_currency, seller_share_cents, initiator_role, reason, created_at, decided_at").eq("order_id", orderId).order("created_at"),
      supabase.from("order_events").select("created_at").eq("order_id", orderId).eq("event_type", "payment").order("created_at").limit(1),
    ]);
    setPayments((p.data ?? []) as PaymentRecord[]);
    setRefunds((r.data ?? []) as RefundRecord[]);
    setPaidAt(e.data?.[0]?.created_at ?? null);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    const timer = setTimeout(() => { void refetch(); }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { payments, refunds, paidAt, loading, refetch };
}

export interface PayoutRecord {
  id: string;
  order_id: string;
  seller_id: string;
  amount_cents: number;
  currency: string;
  listing_amount_cents: number | null;
  listing_currency: string | null;
  status: "pending" | "processing" | "sent" | "failed" | "blocked" | "reversed" | "cancelled";
  block_reason: string | null;
  last_error: string | null;
  attempts: number;
  transfer_id: string | null;
  destination_account_id: string | null;
  reversed_cents: number | null;
  eligible_at: string;
  sent_at: string | null;
  created_at: string;
  order: Pick<Order, "id" | "order_number" | "listing_type" | "amount" | "platform_fee" | "seller_amount" | "buyer_fee" | "total_amount" | "currency" | "status" | "payment_status" | "completed_at" | "created_at" | "charge_currency" | "charge_amount_cents" | "seller_amount_charge_cents" | "fx_rate" | "shipping_cost" | "discount_amount" | "original_amount"> & {
    product?: { title: string } | null;
    buyer?: { id: string; username: string; display_name: string | null } | null;
  };
}

export function usePayoutStatement(payoutId?: string) {
  const [payout, setPayout] = useState<PayoutRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(payoutId));

  const refetch = useCallback(async () => {
    if (!payoutId) { setLoading(false); return; }
    const { data, error: queryError } = await supabase
      .from("payouts")
      .select("id, order_id, seller_id, amount_cents, currency, listing_amount_cents, listing_currency, status, block_reason, last_error, attempts, transfer_id, destination_account_id, reversed_cents, eligible_at, sent_at, created_at, order:orders!payouts_order_id_fkey (id, order_number, listing_type, amount, platform_fee, seller_amount, buyer_fee, total_amount, currency, status, payment_status, completed_at, created_at, charge_currency, charge_amount_cents, seller_amount_charge_cents, fx_rate, shipping_cost, discount_amount, original_amount, product:products (title), buyer:profiles!orders_buyer_id_fkey (id, username, display_name))")
      .eq("id", payoutId)
      .maybeSingle();
    if (queryError) setError(queryError.message);
    else if (!data) setError("Payout not found");
    else setPayout(data as unknown as PayoutRecord);
    setLoading(false);
  }, [payoutId]);

  useEffect(() => {
    const timer = setTimeout(() => { void refetch(); }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { payout, loading, error, refetch };
}
