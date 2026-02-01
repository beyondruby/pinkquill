"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import type {
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

// ============================================================================
// useSellerProducts - Fetch all products for a seller
// ============================================================================

interface UseSellerProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSellerProducts(sellerId?: string): UseSellerProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

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
          keywords:product_keywords (keyword)
        `)
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data
      const transformedProducts: Product[] = (data || []).map((product: any) => ({
        ...product,
        media: product.media || [],
        pricing: product.pricing || [],
        shipping: product.shipping?.[0] || null,
        keywords: (product.keywords || []).map((k: any) => k.keyword),
        primary_image_url: product.media?.find((m: ProductMedia) => m.is_primary)?.media_url
          || product.media?.[0]?.media_url,
        min_price: product.pricing?.length > 0
          ? Math.min(...product.pricing.map((p: ProductPricing) => p.price))
          : undefined,
        max_price: product.pricing?.length > 0
          ? Math.max(...product.pricing.map((p: ProductPricing) => p.price))
          : undefined,
      }));

      setProducts(transformedProducts);
      fetchedRef.current = true;
    } catch (err: any) {
      console.error("[useSellerProducts] Error:", err?.message || err);
      setError(err?.message || "Failed to fetch products");
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    fetchProducts();
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

      if (fetchError) throw fetchError;

      const transformedProduct: Product = {
        ...data,
        media: (data.media || []).sort((a: ProductMedia, b: ProductMedia) => a.position - b.position),
        pricing: data.pricing || [],
        shipping: data.shipping?.[0] || null,
        files: data.files || [],
        keywords: (data.keywords || []).map((k: any) => k.keyword),
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
    } catch (err: any) {
      console.error("[useProduct] Error:", err?.message || err);
      setError(err?.message || "Failed to fetch product");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProduct();
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
    } catch (err: any) {
      console.error("[useCreateProduct] Error:", err?.message || err);
      setError(err?.message || "Failed to create product");
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
        .eq("id", productId);

      if (updateError) throw updateError;
      return true;
    } catch (err: any) {
      console.error("[useUpdateProduct] Error:", err?.message || err);
      setError(err?.message || "Failed to update product");
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
      // Delete will cascade to media, pricing, shipping, files, keywords
      const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (deleteError) throw deleteError;
      return true;
    } catch (err: any) {
      console.error("[useDeleteProduct] Error:", err?.message || err);
      setError(err?.message || "Failed to delete product");
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
      const { error: updateError } = await supabase
        .from("products")
        .update({ status })
        .eq("id", productId);

      if (updateError) throw updateError;
      return true;
    } catch (err: any) {
      console.error("[useUpdateProductStatus] Error:", err?.message || err);
      setError(err?.message || "Failed to update product status");
      return false;
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updateStatus, updating, error };
}
