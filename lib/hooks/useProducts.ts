"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { deleteOwnListing, type DeleteListingResult } from "@/lib/content-client";
import { supabase } from "../supabase";
import type {
  ListingType,
  Product,
  ProductMedia,
  ProductPricing,
  ProductShipping,
  ProductWizardState,
  ProductStatus,
  CreatePricingData,
} from "../types/store";

// ============================================================================
// SLUG HELPER
// ============================================================================

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);
}

function normalizeShippingRelation(
  shipping: ProductShipping | ProductShipping[] | null | undefined
): ProductShipping | null {
  if (!shipping) return null;
  return Array.isArray(shipping) ? shipping[0] || null : shipping;
}

// ============================================================================
// useSellerProducts - Fetch all products for a seller
// ============================================================================

interface UseSellerProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseSellerProductsOptions {
  listingType?: ListingType;
}

export function useSellerProducts(
  sellerId?: string,
  options: UseSellerProductsOptions = {}
): UseSellerProductsReturn {
  const { listingType } = options;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchProducts = useCallback(async () => {
    if (!sellerId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      if (!fetchedRef.current) {
        setLoading(true);
      }
      setError(null);

      let query = supabase
        .from("products")
        .select(`
          *,
          seller:profiles!products_seller_id_fkey (
            id, username, display_name, avatar_url, is_verified
          ),
          media:product_media (*),
          pricing:product_pricing (*),
          shipping:product_shipping (*),
          keywords:product_keywords (keyword)
        `)
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });

      if (listingType) {
        query = query.eq("listing_type", listingType);
      }

      const { data, error: fetchError } = await query;

      if (!mountedRef.current) return;
      if (fetchError) throw fetchError;

      // Transform data
      type RawProduct = Omit<Product, 'keywords'> & {
        keywords?: { keyword: string }[];
        shipping?: ProductShipping | ProductShipping[] | null;
      };
      const transformedProducts: Product[] = (data || []).map((product: RawProduct) => ({
        ...product,
        media: product.media || [],
        pricing: product.pricing || [],
        shipping: normalizeShippingRelation(product.shipping),
        keywords: (product.keywords || []).map((k: { keyword: string }) => k.keyword),
        primary_image_url: product.media?.find((m: ProductMedia) => m.is_primary)?.media_url
          || product.media?.[0]?.media_url,
        min_price: (product.pricing?.length ?? 0) > 0
          ? Math.min(...(product.pricing ?? []).map((p: ProductPricing) => p.price))
          : undefined,
        max_price: (product.pricing?.length ?? 0) > 0
          ? Math.max(...(product.pricing ?? []).map((p: ProductPricing) => p.price))
          : undefined,
      }));

      setProducts(transformedProducts);
      fetchedRef.current = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useSellerProducts] Error:", message);
      if (mountedRef.current) {
        setError(message || "Failed to fetch products");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [sellerId, listingType]);

  useEffect(() => {
    mountedRef.current = true;
    fetchProducts();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}

// ============================================================================
// useProduct - Fetch a single product by ID
// ============================================================================

interface UseProductReturn {
  product: Product | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProduct(productId?: string): UseProductReturn {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchProduct = useCallback(async () => {
    if (!productId) {
      setProduct(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("products")
        .select(`
          *,
          seller:profiles!products_seller_id_fkey (
            id, username, display_name, avatar_url, is_verified
          ),
          media:product_media (*),
          pricing:product_pricing (*),
          shipping:product_shipping (*),
          files:product_files (*),
          keywords:product_keywords (keyword)
        `)
        .eq("id", productId)
        .single();

      if (!mountedRef.current) return;
      if (fetchError) throw fetchError;

      const transformedProduct: Product = {
        ...data,
        media: (data.media || []).sort((a: ProductMedia, b: ProductMedia) => a.position - b.position),
        pricing: data.pricing || [],
        shipping: normalizeShippingRelation(data.shipping as ProductShipping | ProductShipping[] | null | undefined),
        files: data.files || [],
        keywords: (data.keywords || []).map((k: { keyword: string }) => k.keyword),
        primary_image_url: data.media?.find((m: ProductMedia) => m.is_primary)?.media_url
          || data.media?.[0]?.media_url,
        min_price: data.pricing?.length > 0
          ? Math.min(...data.pricing.map((p: ProductPricing) => p.price))
          : undefined,
        max_price: data.pricing?.length > 0
          ? Math.max(...data.pricing.map((p: ProductPricing) => p.price))
          : undefined,
      };

      setProduct(transformedProduct);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useProduct] Error:", message);
      if (mountedRef.current) {
        setError(message || "Failed to fetch product");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [productId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchProduct();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchProduct]);

  return { product, loading, error, refetch: fetchProduct };
}

// ============================================================================
// useCreateProduct - Create a new product from wizard state
// ============================================================================

interface UseCreateProductReturn {
  create: (wizardState: ProductWizardState) => Promise<Product | null>;
  creating: boolean;
  error: string | null;
}

export function useCreateProduct(): UseCreateProductReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (wizardState: ProductWizardState): Promise<Product | null> => {
    setCreating(true);
    setError(null);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate slug
      const baseSlug = generateSlug(wizardState.title);
      let slug = baseSlug;
      let counter = 0;

      // Check for slug uniqueness
      while (true) {
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("seller_id", user.id)
          .eq("slug", slug)
          .maybeSingle();

        if (!existing) break;
        counter++;
        slug = `${baseSlug}-${counter}`;
      }

      // Create the product
      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          seller_id: user.id,
          listing_type: "product",
          service_metadata: {},
          title: wizardState.title,
          slug,
          description: wizardState.description || null,
          delivery_type: wizardState.deliveryType,
          category: wizardState.category,
          subcategory: wizardState.subcategory || null,
          attributes: wizardState.attributes,
          year_created: wizardState.yearCreated || null,
          status: "active", // Publish immediately
        })
        .select()
        .single();

      if (productError) throw productError;

      // Upload media files
      const uploadableMedia = wizardState.mediaPreviews.filter((preview) => preview.file instanceof File);
      if (uploadableMedia.length > 0) {
        const mediaInserts = await Promise.all(
          uploadableMedia.map(async (preview, index) => {
            const sourceFile = preview.file as File;
            // Upload to storage
            const fileExt = sourceFile.name.split(".").pop();
            const fileName = `${user.id}/${product.id}/${Date.now()}-${index}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("product-images")
              .upload(fileName, sourceFile, { upsert: true });

            if (uploadError) {
              console.error("Media upload error:", uploadError);
              throw uploadError;
            }

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

        const { error: mediaError } = await supabase
          .from("product_media")
          .insert(mediaInserts);

        if (mediaError) throw mediaError;
      }

      // Create pricing options
      const pricingInserts: CreatePricingData[] = [];

      if (wizardState.sellOriginal && wizardState.originalPrice !== null) {
        pricingInserts.push({
          pricing_type: "original",
          variant_name: "Original",
          price: wizardState.originalPrice,
          stock: 1,
        });
      }

      if (wizardState.hasReproductions) {
        wizardState.reproductions.forEach((rep) => {
          if (rep.price > 0) {
            pricingInserts.push({
              pricing_type: "reproduction",
              variant_name: rep.type,
              price: rep.price,
            });
          }
        });
      }

      if (wizardState.hasDigitalDownload && wizardState.digitalPrice !== null) {
        pricingInserts.push({
          pricing_type: "digital_download",
          variant_name: wizardState.digitalFormat || "Digital Download",
          price: wizardState.digitalPrice,
        });
      }

      if (pricingInserts.length > 0) {
        const { error: pricingError } = await supabase
          .from("product_pricing")
          .insert(
            pricingInserts.map((p) => ({
              product_id: product.id,
              ...p,
            }))
          );

        if (pricingError) throw pricingError;
      }

      // Create shipping info (for physical products)
      if (wizardState.deliveryType !== "digital") {
        const { error: shippingError } = await supabase
          .from("product_shipping")
          .insert({
            product_id: product.id,
            dimensions_unit: wizardState.shipping.dimensions_unit || "cm",
            height: wizardState.shipping.height || null,
            width: wizardState.shipping.width || null,
            thickness: wizardState.shipping.thickness || null,
            weight: wizardState.shipping.weight || null,
            weight_unit: wizardState.shipping.weight_unit || "kg",
            shipping_services: wizardState.shipping.shipping_services || [],
            shipping_locations: wizardState.shipping.shipping_locations || [],
            packaging: wizardState.shipping.packaging || null,
            processing_days: wizardState.shipping.processing_days || null,
            shipping_cost: wizardState.shipping.shipping_cost || 0,
          });

        if (shippingError) throw shippingError;
      }

      // Upload digital files
      const uploadableDigitalFiles = wizardState.digitalFiles.filter((item) => item.file instanceof File);
      if (uploadableDigitalFiles.length > 0) {
        const fileInserts = await Promise.all(
          uploadableDigitalFiles.map(async (digitalItem) => {
            const file = digitalItem.file as File;
            const fileName = `${user.id}/${product.id}/${file.name}`;

            const { error: uploadError } = await supabase.storage
              .from("product-files")
              .upload(fileName, file, { upsert: true });

            if (uploadError) {
              console.error("Digital file upload error:", uploadError);
              throw uploadError;
            }

            // Get signed URL (not public)
            const { data: signedData } = await supabase.storage
              .from("product-files")
              .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

            return {
              product_id: product.id,
              file_url: signedData?.signedUrl || fileName,
              file_name: digitalItem.name || file.name,
              file_type: digitalItem.type || file.type || file.name.split(".").pop() || null,
              file_size: file.size,
              is_preview: false,
            };
          })
        );

        const { error: filesError } = await supabase
          .from("product_files")
          .insert(fileInserts);

        if (filesError) throw filesError;
      }

      // Add keywords
      if (wizardState.keywords.length > 0) {
        const { error: keywordsError } = await supabase
          .from("product_keywords")
          .insert(
            wizardState.keywords.map((keyword) => ({
              product_id: product.id,
              keyword,
            }))
          );

        if (keywordsError) throw keywordsError;
      }

      return product as Product;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useCreateProduct] Error:", message);
      setError(message || "Failed to create product");
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  return { create, creating, error };
}

// ============================================================================
// useUpdateProductListing - Update a full product listing from wizard state
// ============================================================================

interface UseUpdateProductListingReturn {
  updateListing: (productId: string, wizardState: ProductWizardState) => Promise<boolean>;
  updating: boolean;
  error: string | null;
}

type ExistingMediaRow = {
  id: string;
  media_url: string;
  media_type: "image" | "video";
};

type ExistingPricingRow = {
  id: string;
  pricing_type: string;
  variant_name: string | null;
  currency: string;
};

type ExistingDigitalFileRow = {
  id: string;
  file_url: string;
};

type DesiredPricingRow = {
  pricing_type: "original" | "reproduction" | "digital_download";
  variant_name: string | null;
  price: number;
  currency: string;
  stock: number | null;
};

function normalizeVariantName(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function useUpdateProductListing(): UseUpdateProductListingReturn {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateListing = useCallback(async (productId: string, wizardState: ProductWizardState): Promise<boolean> => {
    setUpdating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!wizardState.deliveryType || !wizardState.category) {
        throw new Error("Delivery type and category are required");
      }

      const title = wizardState.title.trim();
      if (!title) {
        throw new Error("Title is required");
      }

      const desiredPricing: DesiredPricingRow[] = [];
      if (wizardState.sellOriginal && wizardState.originalPrice !== null) {
        desiredPricing.push({
          pricing_type: "original",
          variant_name: "Original",
          price: Math.max(0, Number(wizardState.originalPrice)),
          currency: "USD",
          stock: 1,
        });
      }

      if (wizardState.hasReproductions) {
        wizardState.reproductions.forEach((rep) => {
          if (rep.price > 0) {
            desiredPricing.push({
              pricing_type: "reproduction",
              variant_name: rep.type || "Reproduction",
              price: Number(rep.price),
              currency: "USD",
              stock: null,
            });
          }
        });
      }

      if (wizardState.hasDigitalDownload && wizardState.digitalPrice !== null) {
        desiredPricing.push({
          pricing_type: "digital_download",
          variant_name: wizardState.digitalFormat || "Digital Download",
          price: Math.max(0, Number(wizardState.digitalPrice)),
          currency: "USD",
          stock: null,
        });
      }

      if (desiredPricing.length === 0) {
        throw new Error("At least one pricing option is required");
      }

      const { data: existingProduct, error: existingProductError } = await supabase
        .from("products")
        .select("id")
        .eq("id", productId)
        .eq("seller_id", user.id)
        .maybeSingle();

      if (existingProductError) throw existingProductError;
      if (!existingProduct) throw new Error("Listing not found or not editable");

      const { error: productUpdateError } = await supabase
        .from("products")
        .update({
          title,
          description: wizardState.description.trim() || null,
          delivery_type: wizardState.deliveryType,
          category: wizardState.category,
          subcategory: wizardState.subcategory || null,
          attributes: wizardState.attributes || {},
          year_created: wizardState.yearCreated || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId)
        .eq("seller_id", user.id);

      if (productUpdateError) throw productUpdateError;

      const normalizedKeywords = Array.from(
        new Set(
          wizardState.keywords
            .map((keyword) => keyword.trim().toLowerCase())
            .filter((keyword) => keyword.length > 0)
        )
      );

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
        .select("id, media_url, media_type")
        .eq("product_id", productId);
      if (existingMediaError) throw existingMediaError;

      const existingMedia = (existingMediaRows || []) as ExistingMediaRow[];
      const existingMediaById = new Map(existingMedia.map((row) => [row.id, row]));
      const keptMediaIds = new Set<string>();
      const mediaPreviews = wizardState.mediaPreviews.map((preview) => ({ ...preview }));
      if (mediaPreviews.length > 0 && !mediaPreviews.some((preview) => preview.isPrimary)) {
        mediaPreviews[0].isPrimary = true;
      }

      for (let index = 0; index < mediaPreviews.length; index += 1) {
        const preview = mediaPreviews[index];
        const desiredType = preview.mediaType
          || (preview.file?.type?.startsWith("video/") ? "video" : "image");

        if (preview.id && existingMediaById.has(preview.id)) {
          const { error: updateMediaError } = await supabase
            .from("product_media")
            .update({
              media_url: preview.url,
              media_type: desiredType,
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
              media_type: desiredType,
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
              media_type: desiredType,
              is_primary: preview.isPrimary,
              position: index,
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
            media_type: desiredType,
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
        const { error: removeMediaError } = await supabase
          .from("product_media")
          .delete()
          .in("id", removableMediaIds);
        if (removeMediaError) throw removeMediaError;
      }

      const { data: existingPricingRows, error: existingPricingError } = await supabase
        .from("product_pricing")
        .select("id, pricing_type, variant_name, currency")
        .eq("product_id", productId);
      if (existingPricingError) throw existingPricingError;

      const remainingPricing = [...((existingPricingRows || []) as ExistingPricingRow[])];
      for (const desired of desiredPricing) {
        const matchIndex = remainingPricing.findIndex((row) => {
          if (row.pricing_type !== desired.pricing_type) return false;
          if (desired.pricing_type === "reproduction") {
            return normalizeVariantName(row.variant_name) === normalizeVariantName(desired.variant_name);
          }
          return true;
        });

        if (matchIndex >= 0) {
          const [matched] = remainingPricing.splice(matchIndex, 1);
          const { error: updatePricingError } = await supabase
            .from("product_pricing")
            .update({
              pricing_type: desired.pricing_type,
              variant_name: desired.variant_name,
              price: desired.price,
              currency: desired.currency,
              stock: desired.stock,
              is_available: true,
            })
            .eq("id", matched.id);
          if (updatePricingError) throw updatePricingError;
          continue;
        }

        const { error: insertPricingError } = await supabase
          .from("product_pricing")
          .insert({
            product_id: productId,
            pricing_type: desired.pricing_type,
            variant_name: desired.variant_name,
            price: desired.price,
            currency: desired.currency,
            stock: desired.stock,
            is_available: true,
          });
        if (insertPricingError) throw insertPricingError;
      }

      for (const orphanRow of remainingPricing) {
        const { error: deletePricingError } = await supabase
          .from("product_pricing")
          .delete()
          .eq("id", orphanRow.id);

        if (!deletePricingError) continue;
        if (deletePricingError.code === "23503") {
          const { error: disablePricingError } = await supabase
            .from("product_pricing")
            .update({ is_available: false })
            .eq("id", orphanRow.id);
          if (disablePricingError) throw disablePricingError;
          continue;
        }

        throw deletePricingError;
      }

      if (wizardState.deliveryType !== "digital") {
        const { error: upsertShippingError } = await supabase
          .from("product_shipping")
          .upsert({
            product_id: productId,
            dimensions_unit: wizardState.shipping.dimensions_unit || "cm",
            height: wizardState.shipping.height || null,
            width: wizardState.shipping.width || null,
            thickness: wizardState.shipping.thickness || null,
            weight: wizardState.shipping.weight || null,
            weight_unit: wizardState.shipping.weight_unit || "kg",
            shipping_services: wizardState.shipping.shipping_services || [],
            shipping_locations: wizardState.shipping.shipping_locations || [],
            packaging: wizardState.shipping.packaging || null,
            processing_days: wizardState.shipping.processing_days || null,
            shipping_cost: wizardState.shipping.shipping_cost || 0,
          }, { onConflict: "product_id" });
        if (upsertShippingError) throw upsertShippingError;
      } else {
        const { error: removeShippingError } = await supabase
          .from("product_shipping")
          .delete()
          .eq("product_id", productId);
        if (removeShippingError) throw removeShippingError;
      }

      if (wizardState.deliveryType === "digital" || wizardState.deliveryType === "both") {
        const { data: existingDigitalFilesRows, error: existingDigitalFilesError } = await supabase
          .from("product_files")
          .select("id, file_url")
          .eq("product_id", productId);
        if (existingDigitalFilesError) throw existingDigitalFilesError;

        const existingDigitalFiles = (existingDigitalFilesRows || []) as ExistingDigitalFileRow[];
        const existingDigitalById = new Map(existingDigitalFiles.map((row) => [row.id, row]));
        const keptDigitalIds = new Set<string>();

        for (const digitalFile of wizardState.digitalFiles) {
          if (digitalFile.id && existingDigitalById.has(digitalFile.id)) {
            const { error: updateDigitalError } = await supabase
              .from("product_files")
              .update({
                file_name: digitalFile.name,
                file_type: digitalFile.type || null,
                file_size: digitalFile.size || null,
              })
              .eq("id", digitalFile.id);
            if (updateDigitalError) throw updateDigitalError;
            keptDigitalIds.add(digitalFile.id);
            continue;
          }

          if (digitalFile.file instanceof File) {
            const fileName = `${user.id}/${productId}/${digitalFile.file.name}`;
            const { error: uploadDigitalError } = await supabase.storage
              .from("product-files")
              .upload(fileName, digitalFile.file, { upsert: true });
            if (uploadDigitalError) throw uploadDigitalError;

            const { data: signedData } = await supabase.storage
              .from("product-files")
              .createSignedUrl(fileName, 60 * 60 * 24 * 365);

            const { data: insertedDigital, error: insertDigitalError } = await supabase
              .from("product_files")
              .insert({
                product_id: productId,
                file_url: signedData?.signedUrl || fileName,
                file_name: digitalFile.name || digitalFile.file.name,
                file_type: digitalFile.type || digitalFile.file.type || null,
                file_size: digitalFile.file.size,
                is_preview: false,
              })
              .select("id")
              .single();
            if (insertDigitalError) throw insertDigitalError;
            if (insertedDigital?.id) keptDigitalIds.add(insertedDigital.id as string);
            continue;
          }

          const matchedExisting = existingDigitalFiles.find(
            (row) => row.file_url === digitalFile.url && !keptDigitalIds.has(row.id)
          );
          if (matchedExisting) {
            keptDigitalIds.add(matchedExisting.id);
          }
        }

        const removableDigitalIds = existingDigitalFiles
          .map((row) => row.id)
          .filter((id) => !keptDigitalIds.has(id));
        if (removableDigitalIds.length > 0) {
          const { error: removeDigitalError } = await supabase
            .from("product_files")
            .delete()
            .in("id", removableDigitalIds);
          if (removeDigitalError) throw removeDigitalError;
        }
      } else {
        const { error: deleteAllDigitalFilesError } = await supabase
          .from("product_files")
          .delete()
          .eq("product_id", productId);
        if (deleteAllDigitalFilesError) throw deleteAllDigitalFilesError;
      }

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useUpdateProductListing] Error:", message);
      setError(message || "Failed to update product listing");
      return false;
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updateListing, updating, error };
}

// ============================================================================
// useUpdateProduct - Update an existing product
// ============================================================================

interface UseUpdateProductReturn {
  update: (productId: string, updates: Partial<Product>) => Promise<boolean>;
  updating: boolean;
  error: string | null;
}

export function useUpdateProduct(): UseUpdateProductReturn {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (productId: string, updates: Partial<Product>): Promise<boolean> => {
    setUpdating(true);
    setError(null);

    try {
      // SECURITY: Verify current user owns this product
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      const { error: updateError } = await supabase
        .from("products")
        .update({
          title: updates.title,
          description: updates.description,
          category: updates.category,
          subcategory: updates.subcategory,
          attributes: updates.attributes,
          year_created: updates.year_created,
          status: updates.status,
        })
        .eq("id", productId)
        .eq("seller_id", user.id); // SECURITY: Only update if user owns this product

      if (updateError) throw updateError;
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useUpdateProduct] Error:", message);
      setError(message || "Failed to update product");
      return false;
    } finally {
      setUpdating(false);
    }
  }, []);

  return { update, updating, error };
}

// ============================================================================
// useDeleteProduct - Delete a product
// ============================================================================

interface UseDeleteProductReturn {
  deleteProduct: (productId: string) => Promise<DeleteListingResult | null>;
  deleting: boolean;
  error: string | null;
}

export function useDeleteProduct(): UseDeleteProductReturn {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteProduct = useCallback(async (productId: string): Promise<DeleteListingResult | null> => {
    setDeleting(true);
    setError(null);

    try {
      return await deleteOwnListing(productId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useDeleteProduct] Error:", message);
      setError(message || "Failed to delete product");
      return null;
    } finally {
      setDeleting(false);
    }
  }, []);

  return { deleteProduct, deleting, error };
}

// ============================================================================
// useUpdateProductStatus - Update product status (active, paused, archived)
// ============================================================================

interface UseUpdateProductStatusReturn {
  updateStatus: (productId: string, status: ProductStatus) => Promise<boolean>;
  updating: boolean;
  error: string | null;
}

export function useUpdateProductStatus(): UseUpdateProductStatusReturn {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = useCallback(async (productId: string, status: ProductStatus): Promise<boolean> => {
    setUpdating(true);
    setError(null);

    try {
      // SECURITY: Verify current user owns this product
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      const { error: updateError } = await supabase
        .from("products")
        .update({ status })
        .eq("id", productId)
        .eq("seller_id", user.id); // SECURITY: Only update if user owns this product

      if (updateError) throw updateError;
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useUpdateProductStatus] Error:", message);
      setError(message || "Failed to update product status");
      return false;
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updateStatus, updating, error };
}

// ============================================================================
// useToggleSaveProduct - Save/unsave a product
// ============================================================================

interface UseToggleSaveProductReturn {
  toggle: (productId: string, userId: string, isSaved: boolean) => Promise<boolean>;
  checkIsSaved: (productId: string, userId: string) => Promise<boolean>;
}

export function useToggleSaveProduct(): UseToggleSaveProductReturn {
  const toggle = useCallback(async (productId: string, userId: string, isSaved: boolean): Promise<boolean> => {
    try {
      if (isSaved) {
        // Unsave
        const { error } = await supabase
          .from("product_saves")
          .delete()
          .eq("product_id", productId)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        // Save
        const { error } = await supabase
          .from("product_saves")
          .insert({ product_id: productId, user_id: userId });

        if (error) throw error;
      }
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useToggleSaveProduct] Error:", message);
      return false;
    }
  }, []);

  const checkIsSaved = useCallback(async (productId: string, userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("product_saves")
        .select("id")
        .eq("product_id", productId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch {
      return false;
    }
  }, []);

  return { toggle, checkIsSaved };
}

// ============================================================================
// useSavedProducts - Fetch saved products for a user
// ============================================================================

interface UseSavedProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSavedProducts(userId?: string): UseSavedProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedProducts = useCallback(async () => {
    if (!userId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First get the saved product IDs
      const { data: saves, error: savesError } = await supabase
        .from("product_saves")
        .select("product_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (savesError) throw savesError;

      if (!saves || saves.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const productIds = saves.map((s) => s.product_id);

      // Fetch the products
      const { data, error: fetchError } = await supabase
        .from("products")
        .select(`
          *,
          seller:profiles!products_seller_id_fkey (
            id, username, display_name, avatar_url, is_verified
          ),
          media:product_media (*),
          pricing:product_pricing (*)
        `)
        .in("id", productIds)
        .eq("status", "active");

      if (fetchError) throw fetchError;

      // Transform and sort by save order
      type RawProductData = Omit<Product, 'media' | 'pricing'> & { media?: ProductMedia[]; pricing?: ProductPricing[] };
      const transformedProducts: Product[] = (data || []).map((product: RawProductData) => ({
        ...product,
        media: product.media || [],
        pricing: product.pricing || [],
        primary_image_url: product.media?.find((m: ProductMedia) => m.is_primary)?.media_url
          || product.media?.[0]?.media_url,
        min_price: (product.pricing?.length ?? 0) > 0
          ? Math.min(...(product.pricing ?? []).map((p: ProductPricing) => p.price))
          : undefined,
      }));

      // Sort by save order
      const sortedProducts = transformedProducts.sort((a, b) => {
        const aIndex = productIds.indexOf(a.id);
        const bIndex = productIds.indexOf(b.id);
        return aIndex - bIndex;
      });

      setProducts(sortedProducts);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useSavedProducts] Error:", message);
      setError(message || "Failed to fetch saved products");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSavedProducts();
  }, [fetchSavedProducts]);

  return { products, loading, error, refetch: fetchSavedProducts };
}
