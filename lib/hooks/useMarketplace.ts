"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import type { ListingType, Product, ProductMedia, ProductPricing } from "../types/store";

// ============================================================================
// TYPES
// ============================================================================

export type MarketplaceSortOption = "newest" | "price_low" | "price_high" | "popular";

export interface MarketplaceFilters {
  listing_type?: ListingType;
  category?: string;
  subcategory?: string;
  delivery_type?: "physical" | "digital";
  min_price?: number;
  max_price?: number;
  max_delivery_days?: number;
  min_revisions?: number;
  sort_by: MarketplaceSortOption;
  keywords?: string[];
}

export interface MarketplacePagination {
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

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

  // Featured/Trending
  featuredProducts: Product[];
  categoryCounts: Record<string, number>;
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
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
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

  // Transform raw product data
  type RawProduct = Omit<Product, 'keywords'> & { keywords?: { keyword: string }[] };
  const transformProduct = useCallback((product: RawProduct): Product => {
    const media = (product.media || []).sort(
      (a: ProductMedia, b: ProductMedia) => a.position - b.position
    );
    const pricing = product.pricing || [];

    return {
      ...product,
      media,
      pricing,
      keywords: (product.keywords || []).map((k: { keyword: string }) => k.keyword),
      primary_image_url:
        media.find((m: ProductMedia) => m.is_primary)?.media_url || media[0]?.media_url,
      min_price:
        pricing.length > 0
          ? Math.min(...pricing.map((p: ProductPricing) => p.price))
          : undefined,
      max_price:
        pricing.length > 0
          ? Math.max(...pricing.map((p: ProductPricing) => p.price))
          : undefined,
    };
  }, []);

  // Fetch products based on current filters
  const fetchProducts = useCallback(
    async (page: number, append: boolean = false) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        if (!append) setLoading(true);
        setError(null);

        // Build base query - only active products
        let query = supabase
          .from("products")
          .select(
            `
            *,
            seller:profiles!products_seller_id_fkey (
              id, username, display_name, avatar_url, is_verified
            ),
            media:product_media (*),
            pricing:product_pricing (*),
            keywords:product_keywords (keyword)
          `,
            { count: "exact" }
          )
          .eq("status", "active");

        if (filters.listing_type) {
          query = query.eq("listing_type", filters.listing_type);
        }

        // Apply category filter
        if (filters.category) {
          query = query.eq("category", filters.category);
        }
        if (filters.subcategory) {
          query = query.eq("subcategory", filters.subcategory);
        }

        // Apply delivery type filter
        if (filters.delivery_type) {
          query = query.or(
            `delivery_type.eq.${filters.delivery_type},delivery_type.eq.both`
          );
        }

        // Apply sorting
        switch (filters.sort_by) {
          case "newest":
            query = query.order("created_at", { ascending: false });
            break;
          case "price_low":
          case "price_high":
          case "popular":
            // These need post-processing for computed fields
            query = query.order("created_at", { ascending: false });
            break;
        }

        // Pagination
        const rangeStart = page * pageSize;
        const rangeEnd = rangeStart + pageSize - 1;

        const { data, count, error: queryError } = await query.range(rangeStart, rangeEnd);

        if (queryError) throw queryError;
        if (!mountedRef.current) return;

        // Transform products
        let transformedProducts: Product[] = (data || []).map(transformProduct);

        // Apply price range filter (post-query filtering for computed min_price)
        if (filters.min_price !== undefined || filters.max_price !== undefined) {
          transformedProducts = transformedProducts.filter((p) => {
            const price = p.min_price;
            if (price === undefined) return false;
            if (filters.min_price !== undefined && price < filters.min_price) return false;
            if (filters.max_price !== undefined && price > filters.max_price) return false;
            return true;
          });
        }

        if (filters.max_delivery_days !== undefined) {
          transformedProducts = transformedProducts.filter((p) => {
            if (p.listing_type !== "service") return true;
            return (p.pricing || []).some((pkg) =>
              pkg.delivery_days !== null &&
              pkg.delivery_days !== undefined &&
              pkg.delivery_days <= filters.max_delivery_days!
            );
          });
        }

        if (filters.min_revisions !== undefined) {
          transformedProducts = transformedProducts.filter((p) => {
            if (p.listing_type !== "service") return true;
            return (p.pricing || []).some((pkg) =>
              pkg.revisions !== null &&
              pkg.revisions !== undefined &&
              pkg.revisions >= filters.min_revisions!
            );
          });
        }

        // Apply client-side price sorting
        if (filters.sort_by === "price_low") {
          transformedProducts.sort((a, b) => (a.min_price || 0) - (b.min_price || 0));
        } else if (filters.sort_by === "price_high") {
          transformedProducts.sort((a, b) => (b.min_price || 0) - (a.min_price || 0));
        }

        // Search filter (client-side full-text on title, description, keywords)
        if (filters.keywords && filters.keywords.length > 0) {
          const searchTerms = filters.keywords.map((k) => k.toLowerCase());
          transformedProducts = transformedProducts.filter((p) => {
            const searchableText = [p.title, p.description, ...(p.keywords || [])]
              .join(" ")
              .toLowerCase();
            return searchTerms.some((term) => searchableText.includes(term));
          });
        }

        // Update state
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
        console.error("[useMarketplace] Error:", err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to fetch products");
        }
      } finally {
        fetchingRef.current = false;
        if (mountedRef.current) setLoading(false);
      }
    },
    [pageSize, filters, transformProduct]
  );

  // Fetch featured products
  const fetchFeaturedProducts = useCallback(async () => {
    try {
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
        `
        )
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8);

      if (filters.listing_type) {
        query = query.eq("listing_type", filters.listing_type);
      }

      const { data } = await query;

      if (data && mountedRef.current) {
        setFeaturedProducts(data.map(transformProduct));
      }
    } catch (err) {
      console.error("[useMarketplace] Failed to fetch featured:", err);
    }
  }, [transformProduct, filters.listing_type]);

  // Fetch category counts
  const fetchCategoryCounts = useCallback(async () => {
    try {
      let query = supabase
        .from("products")
        .select("category")
        .eq("status", "active");

      if (filters.listing_type) {
        query = query.eq("listing_type", filters.listing_type);
      }

      const { data } = await query;

      if (data && mountedRef.current) {
        const counts: Record<string, number> = {};
        data.forEach((p: { category: string }) => {
          counts[p.category] = (counts[p.category] || 0) + 1;
        });
        setCategoryCounts(counts);
      }
    } catch (err) {
      console.error("[useMarketplace] Failed to fetch category counts:", err);
    }
  }, [filters.listing_type]);

  // Filter setters
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
    setProducts([]);
    setPagination((prev) => ({ ...prev, page: 0, has_more: true }));
  }, []);

  const setCategory = useCallback((category: string | undefined) => {
    setFilters((prev) => ({ ...prev, category, subcategory: undefined }));
    setProducts([]);
    setPagination((prev) => ({ ...prev, page: 0, has_more: true }));
  }, []);

  const setSubcategory = useCallback((subcategory: string | undefined) => {
    setFilters((prev) => ({ ...prev, subcategory }));
    setProducts([]);
    setPagination((prev) => ({ ...prev, page: 0, has_more: true }));
  }, []);

  const setDeliveryType = useCallback(
    (delivery_type: "physical" | "digital" | undefined) => {
      setFilters((prev) => ({ ...prev, delivery_type }));
      setProducts([]);
      setPagination((prev) => ({ ...prev, page: 0, has_more: true }));
    },
    []
  );

  const setPriceRange = useCallback((min?: number, max?: number) => {
    setFilters((prev) => ({ ...prev, min_price: min, max_price: max }));
    setProducts([]);
    setPagination((prev) => ({ ...prev, page: 0, has_more: true }));
  }, []);

  const setMaxDeliveryDays = useCallback((max_delivery_days: number | undefined) => {
    setFilters((prev) => ({ ...prev, max_delivery_days }));
    setProducts([]);
    setPagination((prev) => ({ ...prev, page: 0, has_more: true }));
  }, []);

  const setMinRevisions = useCallback((min_revisions: number | undefined) => {
    setFilters((prev) => ({ ...prev, min_revisions }));
    setProducts([]);
    setPagination((prev) => ({ ...prev, page: 0, has_more: true }));
  }, []);

  const setSortBy = useCallback((sort_by: MarketplaceSortOption) => {
    setFilters((prev) => ({ ...prev, sort_by }));
    setProducts([]);
    setPagination((prev) => ({ ...prev, page: 0, has_more: true }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    const keywords = query.trim() ? query.trim().split(/\s+/) : undefined;
    setFilters((prev) => ({ ...prev, keywords }));
    setProducts([]);
    setPagination((prev) => ({ ...prev, page: 0, has_more: true }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({
      sort_by: "newest",
      listing_type: prev.listing_type,
    }));
    setProducts([]);
    setPagination((prev) => ({ ...prev, page: 0, has_more: true }));
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
    fetchFeaturedProducts();
    fetchCategoryCounts();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchProducts, fetchFeaturedProducts, fetchCategoryCounts]);

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
    featuredProducts,
    categoryCounts,
  };
}

// ============================================================================
// useFeaturedProducts - Standalone hook for featured products
// ============================================================================

export function useFeaturedProducts(limit: number = 6) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const { data } = await supabase
          .from("products")
          .select(
            `
            *,
            seller:profiles!products_seller_id_fkey (
              id, username, display_name, avatar_url, is_verified
            ),
            media:product_media (*),
            pricing:product_pricing (*)
          `
          )
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (data) {
          type RawProductData = Omit<Product, 'media' | 'pricing'> & { media?: ProductMedia[]; pricing?: ProductPricing[] };
          const transformed = data.map((p: RawProductData) => {
            const media = (p.media || []).sort(
              (a: ProductMedia, b: ProductMedia) => a.position - b.position
            );
            const pricing = p.pricing || [];
            return {
              ...p,
              media,
              pricing,
              primary_image_url:
                media.find((m: ProductMedia) => m.is_primary)?.media_url ||
                media[0]?.media_url,
              min_price:
                pricing.length > 0
                  ? Math.min(...pricing.map((pr: ProductPricing) => pr.price))
                  : undefined,
            };
          });
          setProducts(transformed);
        }
      } catch (err) {
        console.error("[useFeaturedProducts] Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [limit]);

  return { products, loading };
}
