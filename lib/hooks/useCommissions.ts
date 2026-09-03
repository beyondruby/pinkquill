"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import type {
  CommissionAvailabilityInfo,
  CommissionWizardState,
  Product,
} from "../types/store";
import { useSellerProducts } from "./useProducts";


function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    const parts = [obj.message, obj.details, obj.hint]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (parts.length > 0) return parts.join(" — ");
  }
  return "Unknown error";
}

/**
 * Phase 4b: the wizard's ten writes are one transaction in the database
 * (save_commission_listing). The client only uploads new media files first
 * — storage has no transaction to join — then sends one payload.
 */
type MediaRow = { id?: string; url: string; media_type: "image" | "video"; is_primary: boolean };

async function uploadNewMedia(state: CommissionWizardState, userId: string, productKey: string): Promise<MediaRow[]> {
  const previews = state.mediaPreviews.map((p) => ({ ...p }));
  if (previews.length > 0 && !previews.some((p) => p.isPrimary)) previews[0].isPrimary = true;
  const rows: MediaRow[] = [];
  for (let index = 0; index < previews.length; index += 1) {
    const preview = previews[index];
    const mediaType = preview.mediaType || (preview.file?.type?.startsWith("video/") ? "video" : "image");
    if (preview.file instanceof File) {
      const ext = preview.file.name.split(".").pop();
      const fileName = `${userId}/${productKey}/${Date.now()}-${index}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, preview.file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(fileName);
      rows.push({ url: publicUrl, media_type: mediaType, is_primary: preview.isPrimary });
    } else {
      rows.push({ id: preview.id, url: preview.url, media_type: mediaType, is_primary: preview.isPrimary });
    }
  }
  return rows;
}

function listingPayload(state: CommissionWizardState, media: MediaRow[] | null, status?: "draft" | "active") {
  const scheduled = state.availability === "scheduled";
  const opensAt = scheduled && state.opensAt ? new Date(`${state.opensAt}T00:00:00`) : null;
  if (scheduled && (!opensAt || Number.isNaN(opensAt.getTime()))) throw new Error("Pick the date this commission opens");
  return {
    title: state.title.trim(),
    headline: state.headline.trim(),
    description: state.description.trim(),
    category: state.category,
    subcategory: state.subcategory || null,
    ...(status ? { status } : {}),
    settings: {
      availability: state.availability,
      opens_at: opensAt ? opensAt.toISOString() : null,
      slots_total: state.slotsTotal === null || state.slotsTotal === undefined ? null : Number(state.slotsTotal),
      lead_time_days: Number(state.leadTimeDays || 0),
      turnaround_starts: state.turnaroundStarts,
      terms: state.terms,
      accepts_custom_quotes: Boolean(state.acceptsCustomQuotes),
    },
    intake_fields: state.intakeFields.map((f) => ({ id: f.id, label: f.label, help_text: f.help_text, field_type: f.field_type, options: f.options, required: f.required })),
    keywords: state.keywords,
    includes: state.includes.map((v) => v.trim()).filter(Boolean),
    excludes: state.excludes.map((v) => v.trim()).filter(Boolean),
    faqs: state.faqs.map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })).filter((f) => f.question && f.answer),
    ...(media ? { media } : {}),
    packages: state.packages.map((pkg) => ({
      pricing_id: pkg.pricing_id, tier: pkg.tier, name: pkg.name.trim(), description: pkg.description.trim(),
      price: pkg.price === null ? null : Number(pkg.price), delivery_days: Math.max(1, Number(pkg.deliveryDays || 1)), revisions: Math.max(0, Number(pkg.revisions || 0)),
      features: pkg.features.map((f) => f.trim()).filter(Boolean),
    })),
  };
}

export interface SaveCommissionOptions {
  /** "draft" keeps the listing private; "active" publishes. Omitted on update = keep the current status. */
  status?: "draft" | "active";
}

interface UseCreateCommissionReturn {
  createCommission: (state: CommissionWizardState, options?: SaveCommissionOptions) => Promise<Product | null>;
  creating: boolean;
  error: string | null;
}

export function useCreateCommission(): UseCreateCommissionReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCommission = useCallback(async (state: CommissionWizardState, options: SaveCommissionOptions = {}): Promise<Product | null> => {
    setCreating(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!state.category) throw new Error("Please select a category");
      if (!state.title.trim()) throw new Error("Give the listing a title");

      // Files go to storage under a fresh key first; the row set is written in one transaction after.
      const media = await uploadNewMedia(state, user.id, crypto.randomUUID());
      const { data, error: rpcError } = await supabase.rpc("save_commission_listing", { p_product_id: null, p_payload: listingPayload(state, media, options.status ?? "active") });
      if (rpcError) throw rpcError;
      const productId = (data as { product_id: string }).product_id;
      const { data: product, error: fetchError } = await supabase.from("products").select("*").eq("id", productId).single();
      if (fetchError) throw fetchError;
      return product as Product;
    } catch (err: unknown) {
      const message = extractErrorMessage(err);
      console.error("[useCreateCommission] Error:", message, err);
      setError(message || "Failed to create commission");
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createCommission, creating, error };
}

interface UseUpdateCommissionReturn {
  updateCommission: (productId: string, state: CommissionWizardState, options?: SaveCommissionOptions) => Promise<boolean>;
  updating: boolean;
  error: string | null;
}

export function useUpdateCommission(): UseUpdateCommissionReturn {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCommission = useCallback(async (productId: string, state: CommissionWizardState, options: SaveCommissionOptions = {}): Promise<boolean> => {
    setUpdating(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!state.category) throw new Error("Select a commission category");
      if (!state.title.trim()) throw new Error("Service title is required");

      const media = await uploadNewMedia(state, user.id, productId);
      const { error: rpcError } = await supabase.rpc("save_commission_listing", { p_product_id: productId, p_payload: listingPayload(state, media, options.status) });
      if (rpcError) throw rpcError;
      return true;
    } catch (err: unknown) {
      const message = extractErrorMessage(err);
      console.error("[useUpdateCommission] Error:", message, err);
      setError(message || "Failed to update commission");
      return false;
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updateCommission, updating, error };
}

// ============================================================================
// useCommissionAvailability — live "can I order this right now?" (Phase 2a)
// ============================================================================
// Calls get_commission_availability(): listing settings + live slot count +
// the seller-level is_accepting_commissions switch, decided by the same
// function create_marketplace_order enforces.

interface UseCommissionAvailabilityReturn {
  availability: CommissionAvailabilityInfo | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useCommissionAvailability(productId?: string | null): UseCommissionAvailabilityReturn {
  const [availability, setAvailability] = useState<CommissionAvailabilityInfo | null>(null);
  const [loading, setLoading] = useState(Boolean(productId));

  const refetch = useCallback(async () => {
    if (!productId) {
      setAvailability(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_commission_availability", { p_product_id: productId });
      if (error) throw error;
      setAvailability((data as CommissionAvailabilityInfo | null) ?? null);
    } catch (err) {
      console.error("[useCommissionAvailability]", extractErrorMessage(err));
      setAvailability(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    const timer = setTimeout(() => { void refetch(); }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  return { availability, loading, refetch };
}

// ============================================================================
// useOrderQueuePosition — where a request sits in the creator's queue
// ============================================================================

export interface OrderQueuePosition {
  position: number;
  total_active: number;
  slots_total: number | null;
}

export function useOrderQueuePosition(orderId?: string | null, enabled = true): OrderQueuePosition | null {
  const [queue, setQueue] = useState<OrderQueuePosition | null>(null);

  useEffect(() => {
    if (!orderId || !enabled) {
      const timer = setTimeout(() => setQueue(null), 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("get_order_queue_position", { p_order_id: orderId });
      if (cancelled) return;
      if (error) {
        console.error("[useOrderQueuePosition]", error.message);
        setQueue(null);
        return;
      }
      setQueue((data as OrderQueuePosition | null) ?? null);
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [orderId, enabled]);

  return queue;
}

/**
 * Does this profile sell commissions? (active service listings > 0). Used by
 * the studio to show the Commissions tab only for sellers (Phase 3b).
 */
export function useHasCommissions(userId?: string | null): { hasCommissions: boolean | null; loading: boolean } {
  const [hasCommissions, setHasCommissions] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      const timer = setTimeout(() => { setHasCommissions(null); setLoading(false); }, 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id")
        .eq("seller_id", userId)
        .eq("listing_type", "service")
        .eq("status", "active")
        .limit(1);
      if (cancelled) return;
      setHasCommissions(error ? null : (data?.length ?? 0) > 0);
      setLoading(false);
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [userId]);

  return { hasCommissions, loading };
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

// NOTE: useHireCommission, useCommissionOrder, and useUpdateCommissionOrder
// were removed in 2026-04-26. They wrote to the legacy product_purchases
// table and bypassed the unified /api/orders/create + payment pipeline.
// The hire flow now goes through useCreateOrder; order viewing goes
// through /orders/[id] (OrderPage).
