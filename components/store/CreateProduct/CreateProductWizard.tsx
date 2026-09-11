"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { ProductWizardState, initialWizardState, ProductDelivery, Product, ProductPricing, ProductMedia } from "@/lib/types/store";
import { getCategoryConfig } from "@/lib/store/categories";
import { useCreateProduct, useUpdateProductListing } from "@/lib/hooks/useProducts";
import { showToast } from "@/lib/utils/toast";
import Loading from "@/components/ui/Loading";
import ListingShell, { SignInGate, type ListingHeadline } from "@/components/listing/ListingShell";
import TypeStep from "./steps/TypeStep";
import MediaStep from "./steps/MediaStep";
import DetailsStep, { TITLE_MAX } from "./steps/DetailsStep";
import PricingStep from "./steps/PricingStep";
import PreviewStep from "./steps/PreviewStep";

/**
 * The product listing wizard. Five short steps on the shared listing shell,
 * a draft you can leave and come back to, and a preview before publishing.
 */

const STEPS = ["Type", "Photos", "Details", "Pricing", "Preview"] as const;
const HEADLINES: ListingHeadline[] = [
  { prefix: "Let's create your", highlight: "product" },
  { prefix: "Show your", highlight: "work" },
  { prefix: "Tell us", highlight: "about it" },
  { prefix: "Set your", highlight: "price" },
  { prefix: "Here's your", highlight: "listing" },
];

function mapProductToWizardState(product: Product): ProductWizardState {
  const sortedMedia = [...(product.media || [])]
    .sort((a: ProductMedia, b: ProductMedia) => a.position - b.position)
    .map((item) => ({ id: item.id, file: null, url: item.media_url, isPrimary: Boolean(item.is_primary), mediaType: item.media_type }));
  if (sortedMedia.length > 0 && !sortedMedia.some((item) => item.isPrimary)) sortedMedia[0].isPrimary = true;

  const pricingRows = product.pricing || [];
  const originalPricing = pricingRows.find((row) => row.pricing_type === "original");
  const digitalPricing = pricingRows.find((row) => row.pricing_type === "digital_download");
  const pwywFloor = (row: ProductPricing | undefined): number | null => {
    if (!row) return null;
    const price = Number(row.price || 0);
    const min = Number(row.min_price ?? row.price ?? 0);
    return min < price ? min : null;
  };
  const reproductions = pricingRows
    .filter((row) => row.pricing_type === "reproduction")
    .map((row: ProductPricing, index) => ({ type: row.variant_name || `reproduction-${index + 1}`, price: Number(row.price || 0), min: pwywFloor(row) }));

  return {
    deliveryType: product.delivery_type,
    category: product.category || null,
    subcategory: product.subcategory || null,
    mediaFiles: [],
    mediaPreviews: sortedMedia,
    digitalFiles: (product.files || []).map((file) => ({ id: file.id, file: null, name: file.file_name, type: file.file_type || undefined, size: file.file_size || 0, url: file.file_url })),
    title: product.title || "",
    description: product.description || "",
    yearCreated: product.year_created || null,
    attributes: product.attributes || {},
    sellOriginal: !!originalPricing,
    originalPrice: originalPricing ? Number(originalPricing.price || 0) : null,
    originalMin: pwywFloor(originalPricing),
    hasReproductions: reproductions.length > 0,
    reproductions,
    hasDigitalDownload: !!digitalPricing,
    digitalPrice: digitalPricing ? Number(digitalPricing.price || 0) : null,
    digitalMin: pwywFloor(digitalPricing),
    digitalFormat: digitalPricing?.variant_name || null,
    shipping: {
      dimensions_unit: product.shipping?.dimensions_unit || "cm",
      height: product.shipping?.height || undefined,
      width: product.shipping?.width || undefined,
      thickness: product.shipping?.thickness || undefined,
      weight: product.shipping?.weight || undefined,
      weight_unit: product.shipping?.weight_unit || "kg",
      shipping_services: product.shipping?.shipping_services || [],
      shipping_locations: product.shipping?.shipping_locations || [],
      packaging: product.shipping?.packaging || undefined,
      processing_days: product.shipping?.processing_days || undefined,
      shipping_cost: Number(product.shipping?.shipping_cost || 0),
    },
    keywords: product.keywords || [],
  };
}

interface CreateProductWizardProps {
  mode?: "create" | "edit";
  productId?: string;
  initialProduct?: Product | null;
}

export default function CreateProductWizard({ mode = "create", productId, initialProduct = null }: CreateProductWizardProps = {}) {
  const router = useRouter();
  const mediaUrlsRef = useRef<string[]>([]);
  const { user, loading: authLoading } = useAuth();
  const { create, creating, error: createError } = useCreateProduct();
  const { updateListing, updating, error: updateError } = useUpdateProductListing();

  const isEdit = mode === "edit";
  const [savedId, setSavedId] = useState<string | null>(productId ?? initialProduct?.id ?? null);
  const [savedStatus, setSavedStatus] = useState<string | null>(initialProduct?.status ?? null);
  const [step, setStep] = useState(1);
  const [furthest, setFurthest] = useState(isEdit ? STEPS.length : 1);
  const [error, setError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [state, setState] = useState<ProductWizardState>(() => (isEdit && initialProduct ? mapProductToWizardState(initialProduct) : initialWizardState));

  const busy = creating || updating || savingDraft;
  const submitError = createError || updateError;
  const config = state.category ? getCategoryConfig(state.category) : undefined;

  // Object URLs minted by the picker live as long as the wizard does.
  useEffect(() => {
    mediaUrlsRef.current = state.mediaPreviews.filter((m) => m.file instanceof File).map((m) => m.url);
  }, [state.mediaPreviews]);
  useEffect(() => () => { mediaUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const update = useCallback((patch: Partial<ProductWizardState>) => { setState((prev) => ({ ...prev, ...patch })); setError(null); }, []);

  /** The publish checks, per step. Returns the first problem or null. */
  const problemFor = useCallback((target: number): string | null => {
    if (target === 1) {
      if (!state.deliveryType) return "Choose how it reaches the buyer.";
      if (!state.category) return "Pick a category.";
    }
    if (target === 2 && state.mediaPreviews.length === 0) return "Add at least one photo.";
    if (target === 3) {
      const title = state.title.trim();
      if (!title) return "Give the piece a title.";
      if (title.length < 3) return "The title needs at least 3 characters.";
      if (title.length > TITLE_MAX) return `The title must be ${TITLE_MAX} characters or fewer.`;
    }
    if (target === 4) {
      const priced =
        (state.sellOriginal && state.originalPrice !== null) ||
        (state.hasReproductions && state.reproductions.length > 0) ||
        (state.hasDigitalDownload && state.digitalPrice !== null);
      if (!priced) return "Set at least one price.";
      const floorProblem = (label: string, min: number | null, price: number | null) =>
        min !== null && price !== null && (min < 0 || min > price) ? `The minimum for ${label} must be between $0 and the suggested price.` : null;
      if (state.sellOriginal) { const p = floorProblem("the original", state.originalMin, state.originalPrice); if (p) return p; }
      if (state.hasDigitalDownload) { const p = floorProblem("the download", state.digitalMin, state.digitalPrice); if (p) return p; }
      if (state.hasReproductions) for (const rep of state.reproductions) { const p = floorProblem(rep.type, rep.min, rep.price); if (p) return p; }
    }
    return null;
  }, [state]);

  const scrollTop = () => { if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const goNext = () => {
    const problem = problemFor(step);
    if (problem) { setError(problem); scrollTop(); return; }
    const next = Math.min(STEPS.length, step + 1);
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    scrollTop();
  };
  const goBack = () => { setStep((s) => Math.max(1, s - 1)); scrollTop(); };
  const jump = (target: number) => { setStep(target); scrollTop(); };

  const canSaveDraft = Boolean(state.deliveryType && state.category && state.title.trim()) && (savedStatus === null || savedStatus === "draft");

  /** Save what exists as a draft: no publish checks, prices may be empty. */
  const saveDraft = async () => {
    if (!canSaveDraft) { setError("Pick a category and give the piece a title to save a draft."); scrollTop(); return; }
    setSavingDraft(true);
    setError(null);
    try {
      if (savedId) {
        const ok = await updateListing(savedId, state, { status: "draft" });
        if (ok) showToast.success("Draft saved");
        else scrollTop();
      } else {
        const created = await create(state, { status: "draft" });
        if (created) {
          setSavedId(created.id);
          setSavedStatus("draft");
          showToast.success("Draft saved", "Find it under Listings whenever you want to continue.");
          // Continue editing the saved row so later saves update instead of duplicating.
          window.history.replaceState(null, "", `/sell/edit/${created.id}`);
        } else scrollTop();
      }
    } finally {
      setSavingDraft(false);
    }
  };

  const publish = async () => {
    if (!user) { setError("Sign in to publish."); scrollTop(); return; }
    for (let i = 1; i < STEPS.length; i += 1) {
      const problem = problemFor(i);
      if (problem) { setError(problem); setStep(i); scrollTop(); return; }
    }
    if (savedId) {
      const ok = await updateListing(savedId, state, savedStatus === "active" ? {} : { status: "active" });
      if (!ok) { scrollTop(); return; }
      showToast.success(savedStatus === "active" ? "Changes saved" : "Published — your listing is live");
      router.push(`/product/${savedId}`);
      return;
    }
    const created = await create(state, { status: "active" });
    if (!created) { scrollTop(); return; }
    showToast.success("Published — your listing is live");
    router.push(`/product/${created.id}`);
  };

  if (isEdit && !initialProduct) {
    return <div className="min-h-[60vh] flex items-center justify-center px-6"><Loading text="Opening your listing" /></div>;
  }

  if (!authLoading && !user) {
    return <SignInGate title="Sign in to sell" description="List originals, prints and downloads, and let people who love your work buy it directly." redirect="/sell" />;
  }

  const isLive = savedStatus === "active";
  const eyebrow = isEdit ? (isLive ? "Edit listing" : "Draft") : savedId ? "Draft" : "New product";

  return (
    <ListingShell
      eyebrow={eyebrow}
      steps={STEPS}
      step={step}
      furthest={furthest}
      onJump={jump}
      headline={HEADLINES[step - 1]}
      error={error || submitError}
      onBack={goBack}
      onNext={goNext}
      onPublish={publish}
      onSaveDraft={saveDraft}
      canSaveDraft={canSaveDraft}
      savingDraft={savingDraft}
      publishing={creating || updating}
      busy={busy}
      isLive={isLive}
    >
      {step === 1 && (
        <TypeStep
          deliveryType={state.deliveryType}
          category={state.category}
          subcategory={state.subcategory}
          onDeliveryChange={(deliveryType) => update({ deliveryType, category: null, subcategory: null, attributes: {} })}
          onCategoryChange={(category) => update({ category, subcategory: null, attributes: {} })}
          onSubcategoryChange={(subcategory) => update({ subcategory })}
        />
      )}
      {step === 2 && (
        <MediaStep
          deliveryType={state.deliveryType as ProductDelivery}
          mediaPreviews={state.mediaPreviews}
          digitalFiles={state.digitalFiles}
          onMediaChange={(mediaPreviews) => update({ mediaPreviews })}
          onDigitalFilesChange={(digitalFiles) => update({ digitalFiles })}
          onError={setError}
        />
      )}
      {step === 3 && config && (
        <DetailsStep deliveryType={state.deliveryType as ProductDelivery} category={state.category!} subcategory={state.subcategory} categoryConfig={config} wizardState={state} updateState={update} />
      )}
      {step === 4 && config && (
        <PricingStep deliveryType={state.deliveryType as ProductDelivery} categoryConfig={config} wizardState={state} updateState={update} />
      )}
      {step === 5 && config && <PreviewStep wizardState={state} categoryConfig={config} isLive={isLive} />}
      {step >= 3 && !config && <p className="text-sm font-body text-muted text-center">Pick a category first.</p>}
    </ListingShell>
  );
}
