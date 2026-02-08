"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import type {
  CommissionPackageFormState,
  CommissionWizardState,
  Product,
  ProductPricing,
  ProductPurchase,
  ProductSeller,
  PurchaseStatus,
} from "../types/store";
import { useSellerProducts } from "./useProducts";

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);
}

function transformProduct(product: Product): Product {
  const media = (product.media || []).sort((a, b) => a.position - b.position);
  const pricing = product.pricing || [];

  return {
    ...product,
    media,
    pricing,
    keywords: product.keywords || [],
    primary_image_url: media.find((m) => m.is_primary)?.media_url || media[0]?.media_url,
    min_price: pricing.length > 0 ? Math.min(...pricing.map((p) => p.price)) : undefined,
    max_price: pricing.length > 0 ? Math.max(...pricing.map((p) => p.price)) : undefined,
  };
}

interface UseCreateCommissionReturn {
  createCommission: (state: CommissionWizardState) => Promise<Product | null>;
  creating: boolean;
  error: string | null;
}

export function useCreateCommission(): UseCreateCommissionReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCommission = useCallback(async (state: CommissionWizardState): Promise<Product | null> => {
    setCreating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!state.category) {
        throw new Error("Please select a category");
      }

      const validPackages = state.packages.filter(
        (pkg): pkg is CommissionPackageFormState & { price: number } =>
          pkg.price !== null && pkg.price > 0
      );
      if (validPackages.length === 0) {
        throw new Error("Add at least one package with a price");
      }

      const baseSlug = generateSlug(state.title);
      let slug = baseSlug;
      let counter = 0;

      while (true) {
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("seller_id", user.id)
          .eq("slug", slug)
          .single();

        if (!existing) break;
        counter += 1;
        slug = `${baseSlug}-${counter}`;
      }

      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          seller_id: user.id,
          listing_type: "service",
          title: state.title,
          slug,
          description: state.description,
          delivery_type: "digital",
          category: state.category,
          subcategory: state.subcategory,
          attributes: {
            requirements: state.requirements,
          },
          service_metadata: {
            headline: state.headline,
            requirements: state.requirements,
            faqs: state.faqs,
          },
          status: "active",
        })
        .select()
        .single();

      if (productError) throw productError;

      if (state.mediaPreviews.length > 0) {
        const mediaRows = await Promise.all(
          state.mediaPreviews.map(async (preview, index) => {
            const fileExt = preview.file.name.split(".").pop();
            const fileName = `${user.id}/${product.id}/${Date.now()}-${index}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("product-images")
              .upload(fileName, preview.file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from("product-images")
              .getPublicUrl(fileName);

            return {
              product_id: product.id,
              media_url: publicUrl,
              media_type: preview.file.type.startsWith("video/") ? "video" : "image",
              is_primary: preview.isPrimary,
              position: index,
            };
          })
        );

        const { error: mediaError } = await supabase.from("product_media").insert(mediaRows);
        if (mediaError) throw mediaError;
      }

      const { error: pricingError } = await supabase
        .from("product_pricing")
        .insert(
          validPackages.map((pkg) => ({
            product_id: product.id,
            pricing_type: "service_package",
            variant_name: pkg.name,
            price: pkg.price,
            currency: "USD",
            stock: null,
            is_available: true,
            package_tier: pkg.tier,
            delivery_days: pkg.deliveryDays,
            revisions: pkg.revisions,
            package_features: pkg.features,
          }))
        );

      if (pricingError) throw pricingError;

      if (state.keywords.length > 0) {
        const { error: keywordsError } = await supabase
          .from("product_keywords")
          .insert(
            state.keywords.map((keyword) => ({ product_id: product.id, keyword }))
          );

        if (keywordsError) throw keywordsError;
      }

      return product as Product;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useCreateCommission] Error:", message);
      setError(message || "Failed to create commission");
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createCommission, creating, error };
}

interface UseSellerCommissionsReturn {
  commissions: Product[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSellerCommissions(sellerId?: string): UseSellerCommissionsReturn {
  const { products, loading, error, refetch } = useSellerProducts(sellerId, {
    listingType: "service",
  });

  return {
    commissions: products,
    loading,
    error,
    refetch,
  };
}

interface HireCommissionInput {
  productId: string;
  pricingId: string;
  amount: number;
  currency?: string;
  brief: string;
  requirements?: Record<string, string | string[]>;
  dueDate?: string;
}

interface UseHireCommissionReturn {
  hire: (payload: HireCommissionInput) => Promise<ProductPurchase | null>;
  hiring: boolean;
  error: string | null;
}

export function useHireCommission(): UseHireCommissionReturn {
  const [hiring, setHiring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hire = useCallback(async (payload: HireCommissionInput): Promise<ProductPurchase | null> => {
    setHiring(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to hire this creator");

      const { data: listing, error: listingError } = await supabase
        .from("products")
        .select("id, seller_id, listing_type")
        .eq("id", payload.productId)
        .single();

      if (listingError) throw listingError;
      if (!listing || listing.listing_type !== "service") {
        throw new Error("Service not found");
      }
      if (listing.seller_id === user.id) {
        throw new Error("You cannot hire your own service");
      }

      const { data: order, error: orderError } = await supabase
        .from("product_purchases")
        .insert({
          buyer_id: user.id,
          product_id: payload.productId,
          pricing_id: payload.pricingId,
          amount: payload.amount,
          currency: payload.currency || "USD",
          status: "paid",
          brief: payload.brief,
          requirements: payload.requirements || {},
          due_date: payload.dueDate || null,
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (orderError) throw orderError;
      return order as ProductPurchase;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useHireCommission] Error:", message);
      setError(message || "Failed to hire creator");
      return null;
    } finally {
      setHiring(false);
    }
  }, []);

  return { hire, hiring, error };
}

interface UseCommissionOrderReturn {
  order: ProductPurchase | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCommissionOrder(orderId?: string): UseCommissionOrderReturn {
  const [order, setOrder] = useState<ProductPurchase | null>(null);
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
        .from("product_purchases")
        .select(`
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
          buyer:profiles!product_purchases_buyer_id_fkey (
            id, username, display_name, avatar_url, is_verified
          ),
          pricing:product_pricing (*)
        `)
        .eq("id", orderId)
        .single();

      if (queryError) throw queryError;
      if (!mountedRef.current) return;

      const rawProduct = data.product as Product | undefined;
      const rawKeywords = (
        rawProduct as Product & { keywords?: Array<string | { keyword: string }> }
      )?.keywords || [];
      const normalizedKeywords = (rawKeywords as unknown[])
        .map((item) => {
          if (typeof item === "string") return item;
          if (
            item &&
            typeof item === "object" &&
            "keyword" in item &&
            typeof (item as { keyword?: unknown }).keyword === "string"
          ) {
            return (item as { keyword: string }).keyword;
          }
          return "";
        })
        .filter((item): item is string => item.length > 0);

      const transformedProduct = rawProduct ? transformProduct({
        ...rawProduct,
        keywords: normalizedKeywords,
      }) : undefined;

      const transformedOrder: ProductPurchase = {
        ...data,
        product: transformedProduct,
        buyer: data.buyer as ProductSeller,
        pricing: data.pricing as ProductPricing,
      };

      setOrder(transformedOrder);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useCommissionOrder] Error:", message);
      if (mountedRef.current) {
        setError(message || "Failed to fetch commission order");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [orderId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchOrder();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchOrder]);

  return { order, loading, error, refetch: fetchOrder };
}

interface UpdateCommissionOrderPayload {
  status: PurchaseStatus;
  delivery_note?: string;
  delivery_assets?: string[];
}

interface UseUpdateCommissionOrderReturn {
  updateOrder: (orderId: string, payload: UpdateCommissionOrderPayload) => Promise<boolean>;
  updating: boolean;
  error: string | null;
}

export function useUpdateCommissionOrder(): UseUpdateCommissionOrderReturn {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateOrder = useCallback(async (orderId: string, payload: UpdateCommissionOrderPayload) => {
    setUpdating(true);
    setError(null);

    try {
      const { data: existing, error: existingError } = await supabase
        .from("product_purchases")
        .select("revision_count")
        .eq("id", orderId)
        .single();

      if (existingError) throw existingError;

      const updates: Record<string, unknown> = {
        status: payload.status,
      };

      if (payload.delivery_note !== undefined) {
        updates.delivery_note = payload.delivery_note;
      }

      if (payload.delivery_assets !== undefined) {
        updates.delivery_assets = payload.delivery_assets;
      }

      if (payload.status === "in_progress") {
        updates.started_at = new Date().toISOString();
      }

      if (payload.status === "submitted") {
        updates.submitted_at = new Date().toISOString();
      }

      if (payload.status === "completed") {
        updates.completed_at = new Date().toISOString();
      }

      if (payload.status === "revision_requested") {
        updates.revision_count = (existing?.revision_count || 0) + 1;
      }

      const { error: updateError } = await supabase
        .from("product_purchases")
        .update(updates)
        .eq("id", orderId);

      if (updateError) throw updateError;
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useUpdateCommissionOrder] Error:", message);
      setError(message || "Failed to update order");
      return false;
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updateOrder, updating, error };
}
