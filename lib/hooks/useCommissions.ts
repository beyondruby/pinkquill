"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { generateSlug } from "@/lib/utils/slug";
import type {
  CommissionAvailabilityInfo,
  CommissionPackageFormState,
  CommissionWizardState,
  IntakeFieldDraft,
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

/** Availability & slots settings (Phase 2a) → `commission_listings` row. */
/** The seller-editable columns of commission_listings (the trigger owns product_id / seller_id / slots_used). */
function listingSettingsFromState(state: CommissionWizardState) {
  const scheduled = state.availability === "scheduled";
  const opensAt = scheduled && state.opensAt ? new Date(`${state.opensAt}T00:00:00`) : null;
  if (scheduled && (!opensAt || Number.isNaN(opensAt.getTime()))) {
    throw new Error("Pick the date this commission opens");
  }
  const slots = state.slotsTotal === null || state.slotsTotal === undefined
    ? null
    : Math.min(500, Math.max(1, Math.round(Number(state.slotsTotal))));
  return {
    availability: state.availability,
    opens_at: opensAt ? opensAt.toISOString() : null,
    slots_total: slots,
    lead_time_days: Math.min(365, Math.max(0, Math.round(Number(state.leadTimeDays || 0)))),
    turnaround_starts: state.turnaroundStarts,
    terms: state.terms.trim() ? state.terms.trim().slice(0, 5000) : null,
    accepts_custom_quotes: Boolean(state.acceptsCustomQuotes),
  };
}

/** Clean wizard intake drafts → rows for listing_intake_fields. */
function intakeRowsFromState(fields: IntakeFieldDraft[], productId: string, sellerId: string) {
  return fields
    .map((field, index) => ({
      id: field.id,
      product_id: productId,
      seller_id: sellerId,
      position: index,
      label: field.label.trim().slice(0, 200),
      help_text: field.help_text.trim() ? field.help_text.trim().slice(0, 500) : null,
      field_type: field.field_type,
      options: ["select", "multi_select"].includes(field.field_type)
        ? field.options.map((o) => o.trim()).filter(Boolean).slice(0, 20)
        : [],
      required: Boolean(field.required),
    }))
    .filter((row) => row.label.length > 0);
}

/**
 * Replace a listing's intake questions with the wizard state: existing ids
 * are updated in place (answers on past orders keep pointing at them),
 * removed ones are deleted, new ones inserted.
 */
async function syncIntakeFields(fields: IntakeFieldDraft[], productId: string, sellerId: string) {
  const rows = intakeRowsFromState(fields, productId, sellerId);
  const { data: existing, error: existingError } = await supabase
    .from("listing_intake_fields")
    .select("id")
    .eq("product_id", productId);
  if (existingError) throw existingError;
  const keep = new Set(rows.map((r) => r.id).filter((id): id is string => Boolean(id)));
  const toDelete = (existing || []).map((r) => r.id as string).filter((id) => !keep.has(id));
  if (toDelete.length > 0) {
    const { error } = await supabase.from("listing_intake_fields").delete().in("id", toDelete);
    if (error) throw error;
  }
  for (const row of rows) {
    if (row.id) {
      const { id, ...rest } = row;
      const { error } = await supabase.from("listing_intake_fields").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    } else {
      const { id: _unused, ...rest } = row;
      void _unused;
      const { error } = await supabase.from("listing_intake_fields").insert(rest);
      if (error) throw error;
    }
  }
}

export interface SaveCommissionOptions {
  /** `draft` saves what exists without the publish checks; `active` publishes. */
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
    const status = options.status ?? "active";

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!state.category) {
        throw new Error("Please select a category");
      }
      if (!state.title.trim()) throw new Error("Give the listing a title");

      // Drafts keep whatever is filled in; packages without a price are not written yet.
      const validPackages = state.packages.filter(
        (pkg): pkg is CommissionPackageFormState & { price: number } =>
          pkg.price !== null && pkg.price > 0 && pkg.name.trim().length > 0
      );
      if (validPackages.length === 0 && status === "active") {
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
          attributes: {},
          service_metadata: {
            headline: state.headline,
            // kept as plain labels for older readers; the typed questions live in listing_intake_fields
            requirements: state.intakeFields.map((f) => f.label.trim()).filter(Boolean),
            faqs: state.faqs.filter((f) => f.question.trim() && f.answer.trim()),
            includes: state.includes.map((v) => v.trim()).filter(Boolean),
            excludes: state.excludes.map((v) => v.trim()).filter(Boolean),
          },
          status,
        })
        .select()
        .single();

      if (productError) throw productError;

      {
        // The products trigger creates the commission_listings row; clients may only UPDATE
        // the settings columns (an upsert would also try to set product_id/seller_id).
        const { error: listingError } = await supabase
          .from("commission_listings")
          .update(listingSettingsFromState(state))
          .eq("product_id", product.id);
        if (listingError) throw listingError;
      }
      await syncIntakeFields(state.intakeFields, product.id, user.id);

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

      const { error: pricingError } = validPackages.length === 0 ? { error: null } : await supabase
        .from("product_pricing")
        .insert(
          validPackages.map((pkg) => ({
            product_id: product.id,
            pricing_type: "service_package",
            variant_name: pkg.name,
            price: pkg.price,
            // Commission packages are fixed-price. min_price == price keeps
            // the row out of PWYW mode in create_marketplace_order and
            // satisfies the >= 5 floor enforced for service_package rows.
            min_price: pkg.price,
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

      const normalizedKeywords = Array.from(
        new Set(
          state.keywords
            .map((keyword) => keyword.trim().toLowerCase())
            .filter((keyword) => keyword.length > 0)
        )
      );
      if (normalizedKeywords.length > 0) {
        const { error: keywordsError } = await supabase
          .from("product_keywords")
          .insert(
            normalizedKeywords.map((keyword) => ({ product_id: product.id, keyword }))
          );

        if (keywordsError) throw keywordsError;
      }

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

  const updateCommission = useCallback(async (productId: string, state: CommissionWizardState, options: SaveCommissionOptions = {}): Promise<boolean> => {
    setUpdating(true);
    setError(null);
    const publishing = options.status === "active";

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!state.category) throw new Error("Select a commission category");
      if (!state.title.trim()) throw new Error("Service title is required");
      if (publishing && !state.description.trim()) throw new Error("Service description is required");

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

      if (normalizedPackages.length === 0 && options.status !== "draft") {
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

      const normalizedRequirements = state.intakeFields
        .map((field) => field.label.trim())
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
          attributes: {},
          service_metadata: {
            ...existingServiceMetadata,
            headline: state.headline.trim() || null,
            requirements: normalizedRequirements,
            faqs: normalizedFaqs,
            includes: state.includes.map((v) => v.trim()).filter(Boolean),
            excludes: state.excludes.map((v) => v.trim()).filter(Boolean),
          },
          ...(options.status ? { status: options.status } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId)
        .eq("seller_id", user.id);
      if (productUpdateError) throw productUpdateError;

      {
        const { error: listingError } = await supabase
          .from("commission_listings")
          .update(listingSettingsFromState(state))
          .eq("product_id", productId);
        if (listingError) throw listingError;
      }
      await syncIntakeFields(state.intakeFields, productId, user.id);

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
              min_price: pkg.price,
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
            min_price: pkg.price,
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
      const { count, error } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", userId)
        .eq("listing_type", "service")
        .eq("status", "active");
      if (cancelled) return;
      setHasCommissions(error ? null : (count ?? 0) > 0);
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
