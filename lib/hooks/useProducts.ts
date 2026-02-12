"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import type {
  ListingType,
  Product,
  ProductMedia,
  ProductPricing,
  ProductShipping,
  ProductFile,
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
          .single();

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
      if (wizardState.mediaPreviews.length > 0) {
        const mediaInserts = await Promise.all(
          wizardState.mediaPreviews.map(async (preview, index) => {
            // Upload to storage
            const fileExt = preview.file.name.split(".").pop();
            const fileName = `${user.id}/${product.id}/${Date.now()}-${index}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("product-images")
              .upload(fileName, preview.file, { upsert: true });

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
              media_type: preview.file.type.startsWith("video/") ? "video" : "image",
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
      if (wizardState.digitalFiles.length > 0) {
        const fileInserts = await Promise.all(
          wizardState.digitalFiles.map(async (file) => {
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
              file_name: file.name,
              file_type: file.type || file.name.split(".").pop() || null,
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

      const { error: updateError, count } = await supabase
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
  deleteProduct: (productId: string) => Promise<boolean>;
  deleting: boolean;
  error: string | null;
}

export function useDeleteProduct(): UseDeleteProductReturn {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteProduct = useCallback(async (productId: string): Promise<boolean> => {
    setDeleting(true);
    setError(null);

    try {
      // SECURITY: Verify current user owns this product
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Delete will cascade to media, pricing, shipping, files, keywords
      const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("seller_id", user.id); // SECURITY: Only delete if user owns this product

      if (deleteError) throw deleteError;
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useDeleteProduct] Error:", message);
      setError(message || "Failed to delete product");
      return false;
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
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return !!data;
    } catch (err) {
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
