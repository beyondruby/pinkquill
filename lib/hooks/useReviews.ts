"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import type { Review, SellerStats, ProductSeller } from "../types/store";

// ============================================================================
// useSubmitReview — Submit a review for a completed order
// ============================================================================

interface SubmitReviewData {
  order_id: string;
  rating: number;
  communication_rating?: number;
  quality_rating?: number;
  value_rating?: number;
  content?: string;
  is_public?: boolean;
}

interface UseSubmitReviewReturn {
  submitReview: (data: SubmitReviewData) => Promise<string | null>;
  submitting: boolean;
  error: string | null;
}

export function useSubmitReview(): UseSubmitReviewReturn {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitReview = useCallback(async (data: SubmitReviewData): Promise<string | null> => {
    setSubmitting(true);
    setError(null);

    try {
      const { data: reviewId, error: rpcError } = await supabase.rpc("submit_review", {
        p_order_id: data.order_id,
        p_rating: data.rating,
        p_communication_rating: data.communication_rating ?? null,
        p_quality_rating: data.quality_rating ?? null,
        p_value_rating: data.value_rating ?? null,
        p_content: data.content ?? null,
        p_is_public: data.is_public ?? true,
      });

      if (rpcError) throw rpcError;
      return reviewId as string;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit review";
      setError(message);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submitReview, submitting, error };
}

// ============================================================================
// useOrderReviews — Get reviews for a specific order
// ============================================================================

interface UseOrderReviewsReturn {
  reviews: Review[];
  myReview: Review | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useOrderReviews(orderId?: string, userId?: string): UseOrderReviewsReturn {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchReviews = useCallback(async () => {
    if (!orderId) {
      setReviews([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("reviews")
        .select(`
          *,
          reviewer:profiles!reviews_reviewer_id_fkey (
            id, username, display_name, avatar_url, is_verified
          )
        `)
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!mountedRef.current) return;

      setReviews((data || []) as Review[]);
    } catch (err) {
      console.error("[useOrderReviews] Error:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchReviews();
    return () => { mountedRef.current = false; };
  }, [fetchReviews]);

  const myReview = userId
    ? reviews.find((r) => r.reviewer_id === userId) ?? null
    : null;

  return { reviews, myReview, loading, refetch: fetchReviews };
}

// ============================================================================
// useSellerReviews — Get all public reviews for a seller (paginated)
// ============================================================================

interface UseSellerReviewsReturn {
  reviews: Review[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function useSellerReviews(sellerId?: string, pageSize = 10): UseSellerReviewsReturn {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(0);
  const mountedRef = useRef(true);

  const fetchPage = useCallback(async (page: number) => {
    if (!sellerId) {
      setReviews([]);
      setLoading(false);
      return;
    }

    try {
      if (page === 0) setLoading(true);
      setError(null);

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error: queryError } = await supabase
        .from("reviews")
        .select(`
          *,
          reviewer:profiles!reviews_reviewer_id_fkey (
            id, username, display_name, avatar_url, is_verified
          ),
          order:orders (
            order_number,
            product:products ( title )
          )
        `)
        .eq("reviewee_id", sellerId)
        .eq("is_public", true)
        .eq("is_revealed", true)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (queryError) throw queryError;
      if (!mountedRef.current) return;

      const fetched = (data || []) as Review[];
      setReviews((prev) => (page === 0 ? fetched : [...prev, ...fetched]));
      setHasMore(fetched.length === pageSize);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch reviews";
      if (mountedRef.current) setError(message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [sellerId, pageSize]);

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

  return { reviews, loading, error, hasMore, loadMore };
}

// ============================================================================
// useSellerStats — Get cached seller stats
// ============================================================================

interface UseSellerStatsReturn {
  stats: SellerStats | null;
  loading: boolean;
}

export function useSellerStats(sellerId?: string): UseSellerStatsReturn {
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!sellerId) {
      setStats(null);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from("seller_stats")
          .select("*")
          .eq("user_id", sellerId)
          .single();

        if (error && error.code !== "PGRST116") throw error;
        if (mountedRef.current) setStats(data as SellerStats | null);
      } catch (err) {
        console.error("[useSellerStats] Error:", err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => { mountedRef.current = false; };
  }, [sellerId]);

  return { stats, loading };
}

// ============================================================================
// useRespondToReview — Seller responds to a review
// ============================================================================

interface UseRespondToReviewReturn {
  respond: (reviewId: string, response: string) => Promise<boolean>;
  responding: boolean;
  error: string | null;
}

export function useRespondToReview(): UseRespondToReviewReturn {
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = useCallback(async (reviewId: string, response: string): Promise<boolean> => {
    setResponding(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc("respond_to_review", {
        p_review_id: reviewId,
        p_response: response,
      });

      if (rpcError) throw rpcError;
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to respond";
      setError(message);
      return false;
    } finally {
      setResponding(false);
    }
  }, []);

  return { respond, responding, error };
}
