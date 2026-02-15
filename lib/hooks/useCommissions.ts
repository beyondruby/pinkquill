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
          .maybeSingle();

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

      const uploadableMedia = state.mediaPreviews.filter((preview) => preview.file instanceof File);
      if (uploadableMedia.length > 0) {
        const mediaRows = await Promise.all(
          uploadableMedia.map(async (preview, index) => {
            const sourceFile = preview.file as File;
            const fileExt = sourceFile.name.split(".").pop();
            const fileName = `${user.id}/${product.id}/${Date.now()}-${index}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("product-images")
              .upload(fileName, sourceFile, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from("product-images")
              .getPublicUrl(fileName);

            return {
              product_id: product.id,
              media_url: publicUrl,
              media_type: preview.mediaType || (sourceFile.type.startsWith("video/") ? "video" : "image"),
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
            reproduction_options: { description: pkg.description },
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

interface UseUpdateCommissionReturn {
  updateCommission: (productId: string, state: CommissionWizardState) => Promise<boolean>;
  updating: boolean;
  error: string | null;
}

type ExistingCommissionMediaRow = {
  id: string;
  media_url: string;
};

type ExistingCommissionPackageRow = {
  id: string;
  package_tier: CommissionPackageFormState["tier"] | null;
  variant_name: string | null;
};

function normalizeLabel(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function useUpdateCommission(): UseUpdateCommissionReturn {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCommission = useCallback(async (productId: string, state: CommissionWizardState): Promise<boolean> => {
    setUpdating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!state.category) throw new Error("Select a commission category");
      if (!state.title.trim()) throw new Error("Service title is required");
      if (!state.description.trim()) throw new Error("Service description is required");

      const normalizedPackages = state.packages
        .map((pkg) => ({
          ...pkg,
          name: pkg.name.trim(),
          description: pkg.description.trim(),
          price: pkg.price !== null ? Number(pkg.price) : null,
          deliveryDays: Math.max(1, Number(pkg.deliveryDays || 1)),
          revisions: Math.max(0, Number(pkg.revisions || 0)),
          features: pkg.features.map((feature) => feature.trim()).filter((feature) => feature.length > 0),
        }))
        .filter((pkg) => pkg.price !== null && pkg.price > 0 && pkg.name.length > 0);

      if (normalizedPackages.length === 0) {
        throw new Error("Add at least one package with price and title");
      }

      const { data: existingProduct, error: existingProductError } = await supabase
        .from("products")
        .select("id, service_metadata")
        .eq("id", productId)
        .eq("seller_id", user.id)
        .eq("listing_type", "service")
        .maybeSingle();

      if (existingProductError) throw existingProductError;
      if (!existingProduct) throw new Error("Commission not found or not editable");

      const existingServiceMetadata =
        existingProduct.service_metadata
        && typeof existingProduct.service_metadata === "object"
        && !Array.isArray(existingProduct.service_metadata)
          ? (existingProduct.service_metadata as Record<string, unknown>)
          : {};

      const normalizedRequirements = state.requirements
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      const normalizedFaqs = state.faqs
        .map((faq) => ({
          question: faq.question.trim(),
          answer: faq.answer.trim(),
        }))
        .filter((faq) => faq.question.length > 0 && faq.answer.length > 0);

      const normalizedKeywords = Array.from(
        new Set(
          state.keywords
            .map((keyword) => keyword.trim().toLowerCase())
            .filter((keyword) => keyword.length > 0)
        )
      );

      const { error: productUpdateError } = await supabase
        .from("products")
        .update({
          title: state.title.trim(),
          description: state.description.trim(),
          delivery_type: "digital",
          category: state.category,
          subcategory: state.subcategory || null,
          attributes: {
            requirements: normalizedRequirements,
          },
          service_metadata: {
            ...existingServiceMetadata,
            headline: state.headline.trim() || null,
            requirements: normalizedRequirements,
            faqs: normalizedFaqs,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId)
        .eq("seller_id", user.id);
      if (productUpdateError) throw productUpdateError;

      const { error: deleteKeywordsError } = await supabase
        .from("product_keywords")
        .delete()
        .eq("product_id", productId);
      if (deleteKeywordsError) throw deleteKeywordsError;

      if (normalizedKeywords.length > 0) {
        const { error: insertKeywordsError } = await supabase
          .from("product_keywords")
          .insert(normalizedKeywords.map((keyword) => ({ product_id: productId, keyword })));
        if (insertKeywordsError) throw insertKeywordsError;
      }

      const { data: existingMediaRows, error: existingMediaError } = await supabase
        .from("product_media")
        .select("id, media_url")
        .eq("product_id", productId);
      if (existingMediaError) throw existingMediaError;

      const existingMedia = (existingMediaRows || []) as ExistingCommissionMediaRow[];
      const existingMediaById = new Map(existingMedia.map((row) => [row.id, row]));
      const keptMediaIds = new Set<string>();
      const mediaPreviews = state.mediaPreviews.map((preview) => ({ ...preview }));
      if (mediaPreviews.length > 0 && !mediaPreviews.some((preview) => preview.isPrimary)) {
        mediaPreviews[0].isPrimary = true;
      }

      for (let index = 0; index < mediaPreviews.length; index += 1) {
        const preview = mediaPreviews[index];
        const mediaType = preview.mediaType
          || (preview.file?.type?.startsWith("video/") ? "video" : "image");

        if (preview.id && existingMediaById.has(preview.id)) {
          const { error: updateMediaError } = await supabase
            .from("product_media")
            .update({
              media_url: preview.url,
              media_type: mediaType,
              is_primary: preview.isPrimary,
              position: index,
            })
            .eq("id", preview.id);
          if (updateMediaError) throw updateMediaError;
          keptMediaIds.add(preview.id);
          continue;
        }

        if (preview.file instanceof File) {
          const fileExt = preview.file.name.split(".").pop();
          const fileName = `${user.id}/${productId}/${Date.now()}-${index}.${fileExt}`;

          const { error: uploadMediaError } = await supabase.storage
            .from("product-images")
            .upload(fileName, preview.file, { upsert: true });
          if (uploadMediaError) throw uploadMediaError;

          const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(fileName);
          const { data: insertedMedia, error: insertMediaError } = await supabase
            .from("product_media")
            .insert({
              product_id: productId,
              media_url: publicUrl,
              media_type: mediaType,
              is_primary: preview.isPrimary,
              position: index,
            })
            .select("id")
            .single();
          if (insertMediaError) throw insertMediaError;
          if (insertedMedia?.id) keptMediaIds.add(insertedMedia.id as string);
          continue;
        }

        const matchedExisting = existingMedia.find(
          (row) => row.media_url === preview.url && !keptMediaIds.has(row.id)
        );
        if (matchedExisting) {
          const { error: updateMediaError } = await supabase
            .from("product_media")
            .update({
              is_primary: preview.isPrimary,
              position: index,
              media_type: mediaType,
            })
            .eq("id", matchedExisting.id);
          if (updateMediaError) throw updateMediaError;
          keptMediaIds.add(matchedExisting.id);
          continue;
        }

        const { data: insertedMedia, error: insertMediaError } = await supabase
          .from("product_media")
          .insert({
            product_id: productId,
            media_url: preview.url,
            media_type: mediaType,
            is_primary: preview.isPrimary,
            position: index,
          })
          .select("id")
          .single();
        if (insertMediaError) throw insertMediaError;
        if (insertedMedia?.id) keptMediaIds.add(insertedMedia.id as string);
      }

      const removableMediaIds = existingMedia
        .map((row) => row.id)
        .filter((id) => !keptMediaIds.has(id));
      if (removableMediaIds.length > 0) {
        const { error: deleteMediaError } = await supabase
          .from("product_media")
          .delete()
          .in("id", removableMediaIds);
        if (deleteMediaError) throw deleteMediaError;
      }

      const { data: existingPackagesRows, error: existingPackagesError } = await supabase
        .from("product_pricing")
        .select("id, package_tier, variant_name")
        .eq("product_id", productId)
        .eq("pricing_type", "service_package");
      if (existingPackagesError) throw existingPackagesError;

      const remainingPackages = [...((existingPackagesRows || []) as ExistingCommissionPackageRow[])];
      const packageById = new Map(remainingPackages.map((row) => [row.id, row]));

      for (const pkg of normalizedPackages) {
        let matched: ExistingCommissionPackageRow | undefined;

        if (pkg.pricing_id && packageById.has(pkg.pricing_id)) {
          matched = packageById.get(pkg.pricing_id);
          const index = remainingPackages.findIndex((row) => row.id === pkg.pricing_id);
          if (index >= 0) remainingPackages.splice(index, 1);
        }

        if (!matched) {
          const byTierIndex = remainingPackages.findIndex(
            (row) =>
              row.package_tier === pkg.tier
              || normalizeLabel(row.variant_name) === normalizeLabel(pkg.name)
          );
          if (byTierIndex >= 0) {
            [matched] = remainingPackages.splice(byTierIndex, 1);
          }
        }

        if (matched) {
          const { error: updatePackageError } = await supabase
            .from("product_pricing")
            .update({
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
              reproduction_options: { description: pkg.description },
            })
            .eq("id", matched.id);
          if (updatePackageError) throw updatePackageError;
          continue;
        }

        const { error: insertPackageError } = await supabase
          .from("product_pricing")
          .insert({
            product_id: productId,
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
            reproduction_options: { description: pkg.description },
          });
        if (insertPackageError) throw insertPackageError;
      }

      for (const orphanPackage of remainingPackages) {
        const { error: deletePackageError } = await supabase
          .from("product_pricing")
          .delete()
          .eq("id", orphanPackage.id);

        if (!deletePackageError) continue;
        if (deletePackageError.code === "23503") {
          const { error: disablePackageError } = await supabase
            .from("product_pricing")
            .update({ is_available: false })
            .eq("id", orphanPackage.id);
          if (disablePackageError) throw disablePackageError;
          continue;
        }

        throw deletePackageError;
      }

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useUpdateCommission] Error:", message);
      setError(message || "Failed to update commission");
      return false;
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updateCommission, updating, error };
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
      // Use SECURITY DEFINER RPCs for safe status transitions
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Determine if user is buyer or seller for this purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from("product_purchases")
        .select("buyer_id, product:products!inner(seller_id)")
        .eq("id", orderId)
        .single();

      if (purchaseError) throw purchaseError;

      const productData = purchase.product as unknown as { seller_id: string } | null;
      const isBuyer = purchase.buyer_id === user.id;
      const isSeller = productData?.seller_id === user.id;

      if (!isBuyer && !isSeller) {
        throw new Error("Not authorized to update this order");
      }

      if (isSeller) {
        const { error: rpcError } = await supabase.rpc("update_purchase_as_seller", {
          p_purchase_id: orderId,
          p_status: payload.status,
          p_delivery_note: payload.delivery_note || null,
          p_delivery_assets: payload.delivery_assets ? JSON.stringify(payload.delivery_assets) : null,
        });
        if (rpcError) throw rpcError;
      } else {
        const { error: rpcError } = await supabase.rpc("update_purchase_as_buyer", {
          p_purchase_id: orderId,
          p_status: payload.status,
        });
        if (rpcError) throw rpcError;
      }
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
