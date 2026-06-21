"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import type { Review, ReviewRole, SellerStats } from "../types/store";

// Blind-reveal: a review is visible only once revealed — either the counterpart
// also reviewed (mutual reveal) or the blind-reveal deadline has passed.
// PostgREST OR-filter used on public read queries.
const revealedOrFilter = () =>
  `revealed_at.not.is.null,reveal_deadline.lte.${new Date().toISOString()}`;

function isReviewVisible(r: { revealed_at: string | null; reveal_deadline: string | null }): boolean {
  if (r.revealed_at) return true;
  if (r.reveal_deadline && new Date(r.reveal_deadline).getTime() <= Date.now()) return true;
  return false;
}

// ============================================================================
// useSubmitReview — Submit a quill review for a completed order
// ============================================================================

interface SubmitReviewData {
  order_id: string;
  quill_score: number;
  title?: string;
  content: string;
  highlights?: string[];
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
      const { data: reviewId, error: rpcError } = await supabase.rpc("submit_order_review", {
        p_order_id: data.order_id,
        p_quill_score: data.quill_score,
        p_title: data.title?.trim() || null,
        p_content: data.content.trim(),
        p_highlights: data.highlights || [],
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
        .from("order_reviews")
        .select(`
          *,
          reviewer:profiles!order_reviews_reviewer_id_fkey (
            id, username, display_name, avatar_url, is_verified
          ),
          reviewee:profiles!order_reviews_reviewee_id_fkey (
            id, username, display_name, avatar_url, is_verified
          ),
          order:orders (
            order_number,
            product:products ( id, title )
          )
        `)
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!mountedRef.current) return;

      // Blind-reveal: each participant always sees their OWN review, but the
      // counterpart's only once it has been revealed.
      const all = (data || []) as Review[];
      const visible = all.filter((r) => r.reviewer_id === userId || isReviewVisible(r));
      setReviews(visible);
    } catch (err) {
      console.error("[useOrderReviews] Error:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [orderId, userId]);

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
// useProductReviews — Public product reviews for a product page
// ============================================================================

interface UseProductReviewsReturn {
  reviews: Review[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function useProductReviews(productId?: string, pageSize = 8): UseProductReviewsReturn {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(0);
  const mountedRef = useRef(true);

  const fetchPage = useCallback(async (page: number) => {
    if (!productId) {
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
        .from("order_reviews")
        .select(`
          *,
          reviewer:profiles!order_reviews_reviewer_id_fkey (
            id, username, display_name, avatar_url, is_verified
          ),
          order:orders (
            order_number,
            product:products ( id, title )
          )
        `)
        .eq("product_id", productId)
        .eq("listing_type", "product")
        .eq("reviewee_role", "seller")
        .eq("is_public", true)
        .or(revealedOrFilter())
        .order("created_at", { ascending: false })
        .range(from, to);

      if (queryError) throw queryError;
      if (!mountedRef.current) return;

      const fetched = (data || []) as Review[];
      setReviews((prev) => (page === 0 ? fetched : [...prev, ...fetched]));
      setHasMore(fetched.length === pageSize);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch product reviews";
      if (mountedRef.current) setError(message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [productId, pageSize]);

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
// useCommissionReviews — Public commission reviews by reviewee role
// ============================================================================

interface UseCommissionReviewsReturn {
  reviews: Review[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function useCommissionReviews(
  revieweeId?: string,
  role: ReviewRole = "seller",
  pageSize = 8
): UseCommissionReviewsReturn {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(0);
  const mountedRef = useRef(true);

  const fetchPage = useCallback(async (page: number) => {
    if (!revieweeId) {
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
        .from("order_reviews")
        .select(`
          *,
          reviewer:profiles!order_reviews_reviewer_id_fkey (
            id, username, display_name, avatar_url, is_verified
          ),
          order:orders (
            order_number,
            product:products ( id, title )
          )
        `)
        .eq("reviewee_id", revieweeId)
        .eq("listing_type", "service")
        .eq("reviewee_role", role)
        .eq("is_public", true)
        .or(revealedOrFilter())
        .order("created_at", { ascending: false })
        .range(from, to);

      if (queryError) throw queryError;
      if (!mountedRef.current) return;

      const fetched = (data || []) as Review[];
      setReviews((prev) => (page === 0 ? fetched : [...prev, ...fetched]));
      setHasMore(fetched.length === pageSize);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch commission reviews";
      if (mountedRef.current) setError(message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [revieweeId, role, pageSize]);

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
// useSellerReviews — Get all public reviews for a seller (all listing types)
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
        .from("order_reviews")
        .select(`
          *,
          reviewer:profiles!order_reviews_reviewer_id_fkey (
            id, username, display_name, avatar_url, is_verified
          ),
          order:orders (
            order_number,
            product:products ( id, title )
          )
        `)
        .eq("reviewee_id", sellerId)
        .eq("reviewee_role", "seller")
        .eq("is_public", true)
        .or(revealedOrFilter())
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
// useSellerStats — Aggregated seller quill stats
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
    setLoading(true);

    if (!sellerId) {
      setStats(null);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Server-side aggregate (single round-trip; correct for any viewer since
        // the SECURITY DEFINER RPC isn't limited by the caller's order RLS).
        const { data, error } = await supabase.rpc("get_seller_stats", {
          p_seller_id: sellerId,
        });
        if (error) throw error;
        if (mountedRef.current) {
          setStats((data as SellerStats) ?? null);
        }
      } catch (err) {
        console.error("[useSellerStats] Error:", err);
        if (mountedRef.current) setStats(null);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => { mountedRef.current = false; };
  }, [sellerId]);

  return { stats, loading };
}
