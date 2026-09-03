"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { apiFetch } from "../api-client";
import type {
  BuyerOrderStats,
  CreateOrderData,
  ListingType,
  Order,
  OrderEvent,
  OrderFilters,
  OrderMessage,
  OrderStatus,
  Product,
  ProductMedia,
  ProductPricing,
  ProductSeller,
  ShippingAddress,
} from "../types/store";

// ============================================================================
// HELPERS
// ============================================================================

const ORDER_SELECT = `
  *,
  product:products (
    *,
    seller:profiles!products_seller_id_fkey (
      id, username, display_name, avatar_url, is_verified
    ),
    media:product_media (*),
    pricing:product_pricing (*),
    keywords:product_keywords (keyword)
  ),
  pricing:product_pricing!orders_pricing_id_fkey (*),
  buyer:profiles!orders_buyer_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  seller:profiles!orders_seller_id_fkey (
    id, username, display_name, avatar_url, is_verified
  )
`;

function transformOrder(raw: Record<string, unknown>): Order {
  const product = raw.product as (Product & { keywords?: Array<string | { keyword: string }> }) | undefined;

  if (product?.media) {
    product.media = (product.media as ProductMedia[]).sort((a, b) => a.position - b.position);
  }

  if (product?.keywords && Array.isArray(product.keywords)) {
    const rawKeywords = product.keywords as unknown[];
    product.keywords = rawKeywords
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "keyword" in item) {
          return (item as { keyword: string }).keyword;
        }
        return "";
      })
      .filter((s): s is string => s.length > 0) as string[];
  }

  if (product?.media) {
    const media = product.media as ProductMedia[];
    (product as Product).primary_image_url =
      media.find((m) => m.is_primary)?.media_url || media[0]?.media_url;
  }

  if (product?.pricing) {
    const pricing = product.pricing as ProductPricing[];
    (product as Product).min_price = pricing.length > 0
      ? Math.min(...pricing.map((p) => p.price))
      : undefined;
    (product as Product).max_price = pricing.length > 0
      ? Math.max(...pricing.map((p) => p.price))
      : undefined;
  }

  return {
    ...raw,
    product: product as Product | undefined,
    buyer: raw.buyer as ProductSeller | undefined,
    seller: raw.seller as ProductSeller | undefined,
    pricing: raw.pricing as ProductPricing | undefined,
  } as Order;
}

/** Stable key for a status filter that may be a list. */
function statusKeyOf(status: OrderFilters["status"]): string | undefined {
  if (!status) return undefined;
  return Array.isArray(status) ? status.join(",") : status;
}

function applyStatusFilter<Q extends { eq: (c: string, v: string) => Q; in: (c: string, v: string[]) => Q }>(query: Q, statusKey?: string): Q {
  if (!statusKey) return query;
  const list = statusKey.split(",");
  return list.length === 1 ? query.eq("status", list[0]) : query.in("status", list);
}

/** Escape a user search term for PostgREST `ilike` inside an `or()` filter. */
function searchPattern(term: string): string {
  return `%${term.replace(/[%_,()\\]/g, " ").trim()}%`;
}

// ============================================================================
// useCreateOrder — Create a new order
// ============================================================================

interface UseCreateOrderReturn {
  createOrder: (data: CreateOrderData) => Promise<Order | null>;
  creating: boolean;
  error: string | null;
}

export function useCreateOrder(): UseCreateOrderReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = useCallback(async (data: CreateOrderData): Promise<Order | null> => {
    setCreating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to place an order");

      const result = await apiFetch<{ order_id?: string }>("/api/orders/create", { json: data });
      if (!result.ok) throw new Error(result.error || "Failed to create order");

      const orderId = result.data.order_id;
      if (!orderId) {
        throw new Error("Order created but response was missing order_id");
      }

      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("id", orderId)
        .single();

      if (fetchError) throw fetchError;
      return transformOrder(order);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useCreateOrder] Error:", message);
      setError(message || "Failed to create order");
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createOrder, creating, error };
}

// ============================================================================
// useUpdateOrderDraft — Update buyer-provided details before payment
// ============================================================================

interface UpdateOrderDraftPayload {
  order_id: string;
  shipping_address?: ShippingAddress;
  buyer_phone?: string;
  buyer_note?: string;
  brief?: string;
  requirements?: Record<string, unknown>;
  due_date?: string;
}

interface UseUpdateOrderDraftReturn {
  updateDraft: (payload: UpdateOrderDraftPayload) => Promise<boolean>;
  updating: boolean;
  error: string | null;
}

export function useUpdateOrderDraft(): UseUpdateOrderDraftReturn {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDraft = useCallback(async (payload: UpdateOrderDraftPayload): Promise<boolean> => {
    setUpdating(true);
    setError(null);

    try {
      const result = await apiFetch("/api/orders/update-draft", { json: payload });
      if (!result.ok) throw new Error(result.error || "Failed to update order details");
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useUpdateOrderDraft] Error:", message);
      setError(message || "Failed to update order details");
      return false;
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updateDraft, updating, error };
}

// ============================================================================
// useOrder — Fetch a single order by ID with real-time updates
// ============================================================================

interface UseOrderReturn {
  order: Order | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrder(orderId?: string): UseOrderReturn {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("id", orderId)
        .single();

      if (queryError) throw queryError;
      if (!mountedRef.current) return;

      setOrder(transformOrder(data));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useOrder] Error:", message);
      if (mountedRef.current) {
        setError(message || "Failed to fetch order");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [orderId]);

  // Real-time subscription for order updates
  useEffect(() => {
    mountedRef.current = true;
    fetchOrder();

    if (!orderId) return;

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => { fetchOrder(); }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [orderId, fetchOrder]);

  return { order, loading, error, refetch: fetchOrder };
}

// ============================================================================
// useOrderList — the one server-filtered order list (Phase 4a): buyer or seller
// ============================================================================

interface UseOrderListReturn {
  orders: Order[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

export interface UseOrderListOptions {
  role: "buyer" | "seller";
  userId?: string;
  filters?: OrderFilters;
  pageSize?: number;
}

/**
 * Orders for one side of the marketplace, filtered and sorted on the server.
 * Search spans order number, listing title and the other party's name (the
 * latter two through small id lookups, since PostgREST cannot OR across
 * embedded tables). `due_before` and `sort: "due"` serve the seller studio.
 */
export function useOrderList({ role, userId, filters, pageSize = 20 }: UseOrderListOptions): UseOrderListReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const fetchingRef = useRef(false);
  const requestIdRef = useRef(0);

  // Stabilize filter values to avoid infinite re-fetch from new object refs
  const statusKey = statusKeyOf(filters?.status);
  const listingTypeFilter = filters?.listing_type;
  const dateFrom = filters?.date_from;
  const dateTo = filters?.date_to;
  const search = filters?.search?.trim() || "";
  const dueBefore = filters?.due_before;
  const sort = filters?.sort ?? "newest";

  const fetchOrders = useCallback(async (page: number, append = false) => {
    if (!userId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    if (append && fetchingRef.current) return;
    fetchingRef.current = true;
    const requestId = ++requestIdRef.current;

    try {
      if (!append) setLoading(true);
      setError(null);

      let query = supabase
        .from("orders")
        .select(ORDER_SELECT, { count: "exact" })
        .eq(role === "buyer" ? "buyer_id" : "seller_id", userId);
      query = sort === "due"
        ? query.order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
        : query.order("created_at", { ascending: false });

      query = applyStatusFilter(query, statusKey);
      if (listingTypeFilter) query = query.eq("listing_type", listingTypeFilter);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo);
      if (dueBefore) query = query.lt("due_date", dueBefore);

      if (search) {
        const pattern = searchPattern(search);
        const clauses = [`order_number.ilike.${pattern}`];
        const productQuery = supabase.from("products").select("id").ilike("title", pattern).limit(50);
        const [productsRes, peopleRes] = await Promise.all([
          role === "seller" ? productQuery.eq("seller_id", userId) : productQuery,
          supabase.from("profiles").select("id").or(`username.ilike.${pattern},display_name.ilike.${pattern}`).limit(20),
        ]);
        const productIds = (productsRes.data ?? []).map((r) => r.id);
        const peopleIds = (peopleRes.data ?? []).map((r) => r.id);
        if (productIds.length) clauses.push(`product_id.in.(${productIds.join(",")})`);
        if (peopleIds.length) clauses.push(`${role === "seller" ? "buyer_id" : "seller_id"}.in.(${peopleIds.join(",")})`);
        query = query.or(clauses.join(","));
      }

      const start = page * pageSize;
      const { data, count, error: queryError } = await query.range(start, start + pageSize - 1);

      if (queryError) throw queryError;
      // A newer fetch (filter change) superseded this one: drop the result.
      if (requestIdRef.current !== requestId) return;

      const transformed = (data || []).map(transformOrder);
      setOrders((prev) => (append ? [...prev, ...transformed] : transformed));
      pageRef.current = page;
      setHasMore(start + pageSize < (count ?? 0));
    } catch (err: unknown) {
      if (requestIdRef.current !== requestId) return;
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useOrderList]", message);
      setError(message);
    } finally {
      if (requestIdRef.current === requestId) {
        fetchingRef.current = false;
        setLoading(false);
      }
    }
  }, [role, userId, statusKey, listingTypeFilter, dateFrom, dateTo, search, dueBefore, sort, pageSize]);

  const loadMore = useCallback(async () => {
    if (!hasMore || fetchingRef.current) return;
    await fetchOrders(pageRef.current + 1, true);
  }, [fetchOrders, hasMore]);

  const refetch = useCallback(async () => {
    pageRef.current = 0;
    await fetchOrders(0);
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrders(0);
  }, [fetchOrders]);

  return { orders, loading, error, hasMore, loadMore, refetch };
}

// ============================================================================
// useUpdateOrderStatus — Update order status via SECURITY DEFINER RPCs
// ============================================================================

interface UseUpdateOrderStatusReturn {
  updateStatus: (
    orderId: string,
    status: OrderStatus,
    options?: {
      trackingNumber?: string;
      deliveryNote?: string;
      deliveryAssets?: string[];
      cancelReason?: string;
    }
  ) => Promise<Order | null>;
  updating: boolean;
  error: string | null;
}

// Transition rules live in the database (update_order_as_* / cancel_order / get_order_actions).

export function useUpdateOrderStatus(): UseUpdateOrderStatusReturn {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = useCallback(async (
    orderId: string,
    status: OrderStatus,
    options?: {
      trackingNumber?: string;
      deliveryNote?: string;
      deliveryAssets?: string[];
      cancelReason?: string;
    }
  ): Promise<Order | null> => {
    setUpdating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get order to determine role and current status
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("buyer_id, seller_id, status")
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      const isBuyer = order.buyer_id === user.id;
      const isSeller = order.seller_id === user.id;

      if (!isBuyer && !isSeller) throw new Error("Not authorized");

      let result: { data: unknown; error: { message: string } | null };

      if (isSeller) {
        result = await supabase.rpc("update_order_as_seller", {
          p_order_id: orderId,
          p_status: status,
          p_tracking_number: options?.trackingNumber || null,
          p_delivery_note: options?.deliveryNote || null,
          p_delivery_assets: options?.deliveryAssets ? JSON.stringify(options.deliveryAssets) : null,
        });
      } else {
        result = await supabase.rpc("update_order_as_buyer", {
          p_order_id: orderId,
          p_status: status,
          p_cancel_reason: options?.cancelReason || null,
        });
      }

      if (result.error) throw new Error(result.error.message);

      // Re-fetch the full order
      const { data: updated, error: fetchError } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("id", orderId)
        .single();

      if (fetchError) throw fetchError;
      return transformOrder(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useUpdateOrderStatus] Error:", message);
      setError(message || "Failed to update order");
      return null;
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updateStatus, updating, error };
}

// ============================================================================
// useAcceptOrder — Seller accepts a pending_acceptance order
// ============================================================================

interface UseAcceptOrderReturn {
  acceptOrder: (orderId: string) => Promise<boolean>;
  accepting: boolean;
  error: string | null;
}

export function useAcceptOrder(): UseAcceptOrderReturn {
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptOrder = useCallback(async (orderId: string): Promise<boolean> => {
    setAccepting(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc("accept_order", { p_order_id: orderId });
      if (rpcError) throw rpcError;
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useAcceptOrder] Error:", message);
      setError(message || "Failed to accept order");
      return false;
    } finally {
      setAccepting(false);
    }
  }, []);

  return { acceptOrder, accepting, error };
}

// ============================================================================
// useDeclineOrder — Seller declines a pending_acceptance order
// ============================================================================

interface UseDeclineOrderReturn {
  declineOrder: (orderId: string, reason?: string) => Promise<boolean>;
  declining: boolean;
  error: string | null;
}

export function useDeclineOrder(): UseDeclineOrderReturn {
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const declineOrder = useCallback(async (orderId: string, reason?: string): Promise<boolean> => {
    setDeclining(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc("decline_order", {
        p_order_id: orderId,
        p_reason: reason || null,
      });
      if (rpcError) throw rpcError;
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useDeclineOrder] Error:", message);
      setError(message || "Failed to decline order");
      return false;
    } finally {
      setDeclining(false);
    }
  }, []);

  return { declineOrder, declining, error };
}

// ============================================================================
// usePendingAcceptanceOrders — Fetch orders pending seller acceptance
// ============================================================================

interface UsePendingAcceptanceOrdersReturn {
  orders: Order[];
  loading: boolean;
  count: number;
  refetch: () => Promise<void>;
}

export function usePendingAcceptanceOrders(userId?: string): UsePendingAcceptanceOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchOrders = useCallback(async () => {
    if (!userId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error: queryError } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("seller_id", userId)
        .eq("status", "pending_acceptance")
        .order("created_at", { ascending: true });

      if (queryError) throw queryError;
      if (!mountedRef.current) return;

      setOrders((data || []).map(transformOrder));
    } catch (err) {
      console.error("[usePendingAcceptanceOrders] Error:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchOrders();

    if (!userId) return;

    // Real-time: listen for new pending_acceptance orders
    const channel = supabase
      .channel(`pending-orders-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `seller_id=eq.${userId}`,
        },
        () => { fetchOrders(); }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [userId, fetchOrders]);

  return { orders, loading, count: orders.length, refetch: fetchOrders };
}

// ============================================================================
// useOrderMessages — Real-time order messages
// ============================================================================

interface UseOrderMessagesReturn {
  messages: OrderMessage[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrderMessages(orderId?: string): UseOrderMessagesReturn {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchMessages = useCallback(async () => {
    if (!orderId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("order_messages")
        .select(`
          *,
          sender:profiles!order_messages_sender_id_fkey (
            id, username, display_name, avatar_url, is_verified
          )
        `)
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (queryError) throw queryError;
      if (!mountedRef.current) return;

      setMessages((data || []) as OrderMessage[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useOrderMessages] Error:", message);
      if (mountedRef.current) setError(message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchMessages();

    if (!orderId) return;

    // Subscribe to new messages
    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_messages",
          filter: `order_id=eq.${orderId}`,
        },
        async (payload) => {
          // Fetch the full message with sender
          const { data } = await supabase
            .from("order_messages")
            .select(`
              *,
              sender:profiles!order_messages_sender_id_fkey (
                id, username, display_name, avatar_url, is_verified
              )
            `)
            .eq("id", payload.new.id)
            .single();

          if (data && mountedRef.current) {
            setMessages((prev) => [...prev, data as OrderMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [orderId, fetchMessages]);

  return { messages, loading, error, refetch: fetchMessages };
}

// ============================================================================
// useSendOrderMessage — Send a message in an order thread
// ============================================================================

interface UseSendOrderMessageReturn {
  sendMessage: (orderId: string, content: string, attachments?: { url: string; name: string; type: string; size: number }[]) => Promise<boolean>;
  sending: boolean;
  error: string | null;
}

export function useSendOrderMessage(): UseSendOrderMessageReturn {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    orderId: string,
    content: string,
    attachments?: { url: string; name: string; type: string; size: number }[]
  ): Promise<boolean> => {
    setSending(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const messageType = attachments && attachments.length > 0 ? "file" : "text";

      const { error: insertError } = await supabase
        .from("order_messages")
        .insert({
          order_id: orderId,
          sender_id: user.id,
          content,
          message_type: messageType,
          attachments: attachments || [],
        });

      if (insertError) throw insertError;
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useSendOrderMessage] Error:", message);
      setError(message || "Failed to send message");
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  return { sendMessage, sending, error };
}

// ============================================================================
// useOrderEvents — Fetch order audit log
// ============================================================================

interface UseOrderEventsReturn {
  events: OrderEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * The order's event log (Phase 3a Activity tab). Participants already have a
 * SELECT policy on order_events; no RPC needed. Chat "message" events are left
 * out — the Messages tab is the place for those.
 */
export function useOrderEvents(orderId?: string): UseOrderEventsReturn {
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!orderId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("order_events")
      .select("id, order_id, actor_id, event_type, from_status, to_status, metadata, created_at")
      .eq("order_id", orderId)
      .neq("event_type", "message")
      .order("created_at", { ascending: true });
    if (queryError) {
      setError(queryError.message);
      setEvents([]);
    } else {
      setError(null);
      setEvents((data ?? []) as OrderEvent[]);
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    const timer = setTimeout(() => { void refetch(); }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { events, loading, error, refetch };
}

// ============================================================================
// useBuyerOrderStats — Aggregated stats for buyer dashboard
// ============================================================================

interface UseBuyerOrderStatsReturn {
  stats: BuyerOrderStats | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useBuyerOrderStats(userId?: string): UseBuyerOrderStatsReturn {
  const [stats, setStats] = useState<BuyerOrderStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Server-side aggregate (single round-trip) instead of fetching every order.
      const { data, error: queryError } = await supabase.rpc("get_buyer_order_stats");
      if (queryError) throw queryError;
      setStats((data as BuyerOrderStats) ?? null);
    } catch (err: unknown) {
      console.error("[useBuyerOrderStats] Error:", err);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
