"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import type {
  CreateOrderData,
  ListingType,
  Order,
  OrderEvent,
  OrderFilters,
  OrderMessage,
  OrderStats,
  OrderStatus,
  Product,
  ProductMedia,
  ProductPricing,
  ProductSeller,
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
  buyer:profiles!orders_buyer_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  seller:profiles!orders_seller_id_fkey (
    id, username, display_name, avatar_url, is_verified
  ),
  pricing:product_pricing (*)
`;

function transformOrder(raw: Record<string, unknown>): Order {
  const product = raw.product as (Product & { keywords?: Array<string | { keyword: string }> }) | undefined;

  if (product?.media) {
    product.media = (product.media as ProductMedia[]).sort((a, b) => a.position - b.position);
  }

  if (product?.keywords) {
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

      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create order");
      }

      const orderId = payload.order_id as string | undefined;
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
// useBuyerOrders — Fetch all orders for the current buyer
// ============================================================================

interface UseOrderListReturn {
  orders: Order[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useBuyerOrders(
  userId?: string,
  filters?: OrderFilters,
  pageSize = 20
): UseOrderListReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const fetchingRef = useRef(false);

  const fetchOrders = useCallback(async (page: number, append = false) => {
    if (!userId || fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      if (!append) setLoading(true);
      setError(null);

      let query = supabase
        .from("orders")
        .select(ORDER_SELECT, { count: "exact" })
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.listing_type) query = query.eq("listing_type", filters.listing_type);
      if (filters?.date_from) query = query.gte("created_at", filters.date_from);
      if (filters?.date_to) query = query.lte("created_at", filters.date_to);

      const start = page * pageSize;
      const { data, count, error: queryError } = await query.range(start, start + pageSize - 1);

      if (queryError) throw queryError;

      const transformed = (data || []).map(transformOrder);

      if (append) {
        setOrders((prev) => [...prev, ...transformed]);
      } else {
        setOrders(transformed);
      }

      pageRef.current = page;
      setHasMore(start + pageSize < (count ?? 0));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useBuyerOrders] Error:", message);
      setError(message);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [userId, filters, pageSize]);

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
// useSellerOrders — Fetch all orders for the current seller
// ============================================================================

export function useSellerOrders(
  userId?: string,
  filters?: OrderFilters,
  pageSize = 20
): UseOrderListReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const fetchingRef = useRef(false);

  const fetchOrders = useCallback(async (page: number, append = false) => {
    if (!userId || fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      if (!append) setLoading(true);
      setError(null);

      let query = supabase
        .from("orders")
        .select(ORDER_SELECT, { count: "exact" })
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.listing_type) query = query.eq("listing_type", filters.listing_type);
      if (filters?.date_from) query = query.gte("created_at", filters.date_from);
      if (filters?.date_to) query = query.lte("created_at", filters.date_to);

      const start = page * pageSize;
      const { data, count, error: queryError } = await query.range(start, start + pageSize - 1);

      if (queryError) throw queryError;

      const transformed = (data || []).map(transformOrder);

      if (append) {
        setOrders((prev) => [...prev, ...transformed]);
      } else {
        setOrders(transformed);
      }

      pageRef.current = page;
      setHasMore(start + pageSize < (count ?? 0));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useSellerOrders] Error:", message);
      setError(message);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [userId, filters, pageSize]);

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

      // Get order to determine role
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("buyer_id, seller_id")
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
}

export function useOrderEvents(orderId?: string): UseOrderEventsReturn {
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    async function fetch() {
      try {
        setLoading(true);
        const { data, error: queryError } = await supabase
          .from("order_events")
          .select(`
            *,
            actor:profiles (
              id, username, display_name, avatar_url, is_verified
            )
          `)
          .eq("order_id", orderId)
          .order("created_at", { ascending: true });

        if (queryError) throw queryError;
        setEvents((data || []) as OrderEvent[]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[useOrderEvents] Error:", message);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [orderId]);

  return { events, loading, error };
}

// ============================================================================
// useOrderStats — Aggregated stats for seller dashboard
// ============================================================================

interface UseOrderStatsReturn {
  stats: OrderStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrderStats(userId?: string): UseOrderStatsReturn {
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("orders")
        .select("status, amount, seller_amount")
        .eq("seller_id", userId);

      if (queryError) throw queryError;

      const orders = data || [];
      const active = ["paid", "in_progress", "submitted", "revision_requested", "processing", "shipped"];
      const completed = ["completed", "delivered"];
      const cancelled = ["cancelled", "refunded"];

      const totalRevenue = orders
        .filter((o) => completed.includes(o.status))
        .reduce((sum, o) => sum + (o.seller_amount || 0), 0);

      const pendingRevenue = orders
        .filter((o) => active.includes(o.status))
        .reduce((sum, o) => sum + (o.seller_amount || 0), 0);

      setStats({
        total_orders: orders.length,
        active_orders: orders.filter((o) => active.includes(o.status)).length,
        completed_orders: orders.filter((o) => completed.includes(o.status)).length,
        cancelled_orders: orders.filter((o) => cancelled.includes(o.status)).length,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        pending_revenue: Math.round(pendingRevenue * 100) / 100,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useOrderStats] Error:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
