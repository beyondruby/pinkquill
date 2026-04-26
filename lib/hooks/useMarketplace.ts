"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import { sanitizePostgrestSearchTerm } from "../utils/postgrest";
import type {
  ListingType,
  MarketplaceFilters,
  MarketplacePagination,
  MarketplaceSortOption,
  Product,
  ProductMedia,
  ProductPricing,
} from "../types/store";

// ============================================================================
// TYPES
// ============================================================================

export type { MarketplaceSortOption, MarketplaceFilters, MarketplacePagination };

export interface UseMarketplaceOptions {
  pageSize?: number;
  initialCategory?: string;
  initialDeliveryType?: "physical" | "digital";
  initialListingType?: ListingType;
}

export interface UseMarketplaceReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  pagination: MarketplacePagination;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;

  // Filters
  filters: MarketplaceFilters;
  setListingType: (listingType: ListingType | undefined) => void;
  setCategory: (category: string | undefined) => void;
  setSubcategory: (subcategory: string | undefined) => void;
  setDeliveryType: (type: "physical" | "digital" | undefined) => void;
  setPriceRange: (min?: number, max?: number) => void;
  setMaxDeliveryDays: (days: number | undefined) => void;
  setMinRevisions: (count: number | undefined) => void;
  setSortBy: (sort: MarketplaceSortOption) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
}

/**
 * Single source of truth for "how many filter dimensions are active".
 * Used by both the header (filter button badge) and the discovery strip.
 */
export function countActiveMarketplaceFilters(filters: MarketplaceFilters): number {
  return [
    filters.category,
    filters.subcategory,
    filters.delivery_type,
    filters.min_price !== undefined || filters.max_price !== undefined,
    filters.max_delivery_days !== undefined,
    filters.min_revisions !== undefined,
    Boolean(filters.keywords?.length),
  ].filter(Boolean).length;
}

export function hasActiveMarketplaceFilters(filters: MarketplaceFilters): boolean {
  return countActiveMarketplaceFilters(filters) > 0;
}

const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// useMarketplace HOOK
// ============================================================================

export function useMarketplace(
  userId?: string,
  options: UseMarketplaceOptions = {}
): UseMarketplaceReturn {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    initialCategory,
    initialDeliveryType,
    initialListingType = "product",
  } = options;

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MarketplaceFilters>({
    sort_by: "newest",
    category: initialCategory,
    delivery_type: initialDeliveryType,
    listing_type: initialListingType,
  });
  const [pagination, setPagination] = useState<MarketplacePagination>({
    page: 0,
    per_page: pageSize,
    total: 0,
    has_more: true,
  });

  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  // Transform raw product data. min_price/max_price are read straight
  // from the cached columns on `products` (kept fresh by a trigger on
  // `product_pricing`). We only fall back to a client-side computation
  // for products that pre-date the cache.
  const transformProduct = useCallback((product: Product): Product => {
    const media = (product.media || []).sort(
      (a: ProductMedia, b: ProductMedia) => a.position - b.position
    );
    const pricing = product.pricing || [];

    const computedMin =
      pricing.length > 0 ? Math.min(...pricing.map((p: ProductPricing) => p.price)) : undefined;
    const computedMax =
      pricing.length > 0 ? Math.max(...pricing.map((p: ProductPricing) => p.price)) : undefined;

    return {
      ...product,
      media,
      pricing,
      primary_image_url:
        media.find((m: ProductMedia) => m.is_primary)?.media_url || media[0]?.media_url,
      min_price: product.min_price ?? computedMin,
      max_price: product.max_price ?? computedMax,
    };
  }, []);

  // Track in-flight requests so a slow earlier query can't overwrite a
  // newer one. Each new fetch increments requestIdRef and the response is
  // discarded if a later fetch has been started in the meantime.
  const requestIdRef = useRef(0);

  // Fetch products based on current filters. All filters and the price
  // sort are pushed to Postgres via cached aggregate columns on `products`
  // (min_price, min_delivery_days, max_revisions) so pagination.total and
  // has_more reflect what the user actually sees.
  const fetchProducts = useCallback(
    async (page: number, append: boolean = false) => {
      const requestId = ++requestIdRef.current;
      fetchingRef.current = true;

      try {
        if (!append) setLoading(true);
        setError(null);

        let query = supabase
          .from("products")
          .select(
            `
            *,
            seller:profiles!products_seller_id_fkey (
              id, username, display_name, avatar_url, is_verified
            ),
            media:product_media (*),
            pricing:product_pricing (*)
          `,
            { count: "exact" }
          )
          .eq("status", "active");

        if (filters.listing_type) {
          query = query.eq("listing_type", filters.listing_type);
        }

        if (filters.category) {
          query = query.eq("category", filters.category);
        }
        if (filters.subcategory) {
          query = query.eq("subcategory", filters.subcategory);
        }

        if (filters.delivery_type) {
          query = query.or(
            `delivery_type.eq.${filters.delivery_type},delivery_type.eq.both`
          );
        }

        // Server-side price filter via cached min_price column.
        if (filters.min_price !== undefined) {
          query = query.gte("min_price", filters.min_price);
        }
        if (filters.max_price !== undefined) {
          query = query.lte("min_price", filters.max_price);
        }

        // Server-side service filters via cached aggregates. Non-service
        // products are intentionally included when listing_type filter
        // isn't set to "service" — we don't want commissions filters to
        // hide products in the "all" view.
        if (filters.listing_type === "service") {
          if (filters.max_delivery_days !== undefined) {
            query = query.lte("min_delivery_days", filters.max_delivery_days);
          }
          if (filters.min_revisions !== undefined) {
            query = query.gte("max_revisions", filters.min_revisions);
          }
        }

        // Keyword search across title/description. The sanitizer strips
        // PostgREST control characters; `%` and `_` (ilike wildcards) are
        // also stripped to keep matches predictable for users.
        if (filters.keywords && filters.keywords.length > 0) {
          const rawTerm = sanitizePostgrestSearchTerm(filters.keywords.join(" "));
          const searchTerm = rawTerm.replace(/[%_]/g, " ").trim();
          if (searchTerm) {
            query = query.or(
              `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`
            );
          }
        }

        // Sorting — every option backed by an indexed column.
        switch (filters.sort_by) {
          case "price_low":
            query = query
              .order("min_price", { ascending: true, nullsFirst: false })
              .order("created_at", { ascending: false });
            break;
          case "price_high":
            query = query
              .order("min_price", { ascending: false, nullsFirst: false })
              .order("created_at", { ascending: false });
            break;
          case "newest":
          default:
            query = query.order("created_at", { ascending: false });
            break;
        }

        const rangeStart = page * pageSize;
        const rangeEnd = rangeStart + pageSize - 1;

        const { data, count, error: queryError } = await query.range(rangeStart, rangeEnd);

        // Drop late responses if a newer fetch is in flight or we unmounted.
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }
        if (queryError) throw queryError;

        let transformedProducts: Product[] = (data || []).map(transformProduct);

        // Batch-fetch which of these products the viewer has saved.
        // Replaces the previous N-queries-per-page pattern (one query per
        // card on initial render).
        if (userId && transformedProducts.length > 0) {
          const productIds = transformedProducts.map((p) => p.id);
          const { data: savedRows } = await supabase
            .from("product_saves")
            .select("product_id")
            .eq("user_id", userId)
            .in("product_id", productIds);

          if (requestId === requestIdRef.current) {
            const savedSet = new Set((savedRows || []).map((r) => r.product_id));
            transformedProducts = transformedProducts.map((p) => ({
              ...p,
              is_saved: savedSet.has(p.id),
            }));
          }
        }

        if (append) {
          setProducts((prev) => [...prev, ...transformedProducts]);
        } else {
          setProducts(transformedProducts);
        }

        setPagination({
          page,
          per_page: pageSize,
          total: count ?? 0,
          has_more: rangeEnd + 1 < (count ?? 0),
        });
      } catch (err: unknown) {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        console.error("[useMarketplace] Error:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch products");
      } finally {
        if (requestId === requestIdRef.current) {
          fetchingRef.current = false;
          if (mountedRef.current) setLoading(false);
        }
      }
    },
    [pageSize, filters, transformProduct, userId]
  );

  // Filter setters. Updating `filters` triggers the fetch effect which
  // refetches from page 0 and replaces `products` — no need to also
  // wipe state here (doing so caused a double-render and a flash of
  // empty state on every filter click).
  const setListingType = useCallback((listing_type: ListingType | undefined) => {
    setFilters((prev) => ({
      ...prev,
      listing_type,
      category: undefined,
      subcategory: undefined,
      delivery_type: undefined,
      max_delivery_days: undefined,
      min_revisions: undefined,
    }));
  }, []);

  const setCategory = useCallback((category: string | undefined) => {
    setFilters((prev) => ({ ...prev, category, subcategory: undefined }));
  }, []);

  const setSubcategory = useCallback((subcategory: string | undefined) => {
    setFilters((prev) => ({ ...prev, subcategory }));
  }, []);

  const setDeliveryType = useCallback(
    (delivery_type: "physical" | "digital" | undefined) => {
      setFilters((prev) => ({ ...prev, delivery_type }));
    },
    []
  );

  const setPriceRange = useCallback((min?: number, max?: number) => {
    setFilters((prev) => ({ ...prev, min_price: min, max_price: max }));
  }, []);

  const setMaxDeliveryDays = useCallback((max_delivery_days: number | undefined) => {
    setFilters((prev) => ({ ...prev, max_delivery_days }));
  }, []);

  const setMinRevisions = useCallback((min_revisions: number | undefined) => {
    setFilters((prev) => ({ ...prev, min_revisions }));
  }, []);

  const setSortBy = useCallback((sort_by: MarketplaceSortOption) => {
    setFilters((prev) => ({ ...prev, sort_by }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    const keywords = query.trim() ? query.trim().split(/\s+/) : undefined;
    setFilters((prev) => ({ ...prev, keywords }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({
      sort_by: "newest",
      listing_type: prev.listing_type,
    }));
  }, []);

  const loadMore = useCallback(async () => {
    if (!pagination.has_more || fetchingRef.current) return;
    await fetchProducts(pagination.page + 1, true);
  }, [fetchProducts, pagination.has_more, pagination.page]);

  const refresh = useCallback(async () => {
    await fetchProducts(0, false);
  }, [fetchProducts]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchProducts(0);

    return () => {
      mountedRef.current = false;
    };
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    pagination,
    loadMore,
    refresh,
    filters,
    setListingType,
    setCategory,
    setSubcategory,
    setDeliveryType,
    setPriceRange,
    setMaxDeliveryDays,
    setMinRevisions,
    setSortBy,
    setSearchQuery,
    clearFilters,
  };
}
