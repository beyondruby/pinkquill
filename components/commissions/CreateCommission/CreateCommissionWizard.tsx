"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCreateCommission, useUpdateCommission } from "@/lib/hooks/useCommissions";
import {
  type CommissionPackageFormState,
  type CommissionWizardState,
  type Product,
  initialCommissionWizardState,
} from "@/lib/types/store";
import {
  COMMISSION_CATEGORIES,
  getAllCommissionCategories,
} from "@/lib/commissions/categories";

const MAX_MEDIA = 10;
const ACCEPTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
];

// Mirror the marketplace product limits. The product-images bucket caps
// images at 10 MB server-side; videos are larger but we still want a
// client-side ceiling so users get fast feedback before the upload.
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB

const STEP_LABELS = [
  "Your Craft",
  "Packages & Pricing",
  "Portfolio & Details",
  "Review & Publish",
];

const STEP_TITLES: Record<number, { prefix: string; highlight1: string; highlight2: string }> = {
  1: { prefix: "Tell us about", highlight1: "your", highlight2: "creative gift" },
  2: { prefix: "Shape", highlight1: "offerings", highlight2: "people will love" },
  3: { prefix: "Show", highlight1: "your best", highlight2: "work" },
  4: { prefix: "Review and", highlight1: "share", highlight2: "with the world" },
};

const PACKAGE_PRESETS: Array<{ tier: CommissionPackageFormState["tier"]; name: string }> = [
  { tier: "basic", name: "Basic" },
  { tier: "standard", name: "Standard" },
  { tier: "premium", name: "Premium" },
];

const TIER_STYLES: Record<
  CommissionPackageFormState["tier"],
  {
    badge: string;
    card: string;
    chip: string;
  }
> = {
  basic: {
    badge: "from-slate-500 to-slate-700",
    card: "from-slate-100/80 via-white to-slate-50/90",
    chip: "bg-slate-100 text-slate-700",
  },
  standard: {
    badge: "from-purple-primary to-pink-vivid",
    card: "from-purple-primary/10 via-white to-pink-vivid/10",
    chip: "bg-accent/15 text-purple-primary",
  },
  premium: {
    badge: "from-orange-warm to-pink-vivid",
    card: "from-orange-warm/10 via-white to-pink-vivid/10",
    chip: "bg-orange-100 text-orange-700",
  },
  custom: {
    badge: "from-blue-500 to-indigo-600",
    card: "from-blue-500/10 via-white to-indigo-500/10",
    chip: "bg-blue-100 text-blue-700",
  },
};

function isVideoMedia(preview: { file?: File | null; mediaType?: string; url: string }): boolean {
  if (preview.mediaType) return preview.mediaType === "video";
  if (preview.file?.type) return preview.file.type.startsWith("video/");
  return /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(preview.url);
}

function mapProductToCommissionState(product: Product): CommissionWizardState {
  const serviceMetadata =
    product.service_metadata && typeof product.service_metadata === "object"
      ? product.service_metadata
      : {};

  const requirements = Array.isArray(serviceMetadata.requirements)
    ? serviceMetadata.requirements.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  const faqs = Array.isArray(serviceMetadata.faqs)
    ? serviceMetadata.faqs
      .filter((item): item is { question: string; answer: string } => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as { question?: unknown; answer?: unknown };
        return typeof candidate.question === "string" && typeof candidate.answer === "string";
      })
      .map((faq) => ({ question: faq.question, answer: faq.answer }))
    : [];

  const packages = (product.pricing || [])
    .filter((pricing) => pricing.pricing_type === "service_package")
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .map((pricing, index) => {
      const packageMeta =
        pricing.reproduction_options
        && typeof pricing.reproduction_options === "object"
        && !Array.isArray(pricing.reproduction_options)
          ? pricing.reproduction_options as { description?: unknown }
          : {};

      return {
        id: pricing.id,
        pricing_id: pricing.id,
        tier: pricing.package_tier || PACKAGE_PRESETS[index]?.tier || "custom",
        name: pricing.variant_name || PACKAGE_PRESETS[index]?.name || `Package ${index + 1}`,
        description: typeof packageMeta.description === "string" ? packageMeta.description : "",
        price: Number(pricing.price || 0),
        deliveryDays: pricing.delivery_days || 7,
        revisions: pricing.revisions || 0,
        features: Array.isArray(pricing.package_features)
          ? pricing.package_features.filter((feature): feature is string => typeof feature === "string" && feature.trim().length > 0)
          : [],
      } satisfies CommissionPackageFormState;
    });

  const mediaPreviews = [...(product.media || [])]
    .sort((a, b) => a.position - b.position)
    .map((media) => ({
      id: media.id,
      file: null,
      url: media.media_url,
      isPrimary: Boolean(media.is_primary),
      mediaType: media.media_type,
    }));

  if (mediaPreviews.length > 0 && !mediaPreviews.some((media) => media.isPrimary)) {
    mediaPreviews[0].isPrimary = true;
  }

  return {
    category: product.category || null,
    subcategory: product.subcategory || null,
    title: product.title || "",
    headline: typeof serviceMetadata.headline === "string" ? serviceMetadata.headline : "",
    description: product.description || "",
    mediaPreviews,
    packages: packages.length > 0 ? packages : initialCommissionWizardState.packages,
    requirements,
    faqs,
    keywords: Array.isArray(product.keywords) ? product.keywords : [],
  };
}

interface CreateCommissionWizardProps {
  mode?: "create" | "edit";
  productId?: string;
  initialProduct?: Product | null;
}

export default function CreateCommissionWizard({
  mode = "create",
  productId,
  initialProduct = null,
}: CreateCommissionWizardProps = {}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaUrlsRef = useRef<string[]>([]);
  const { user, profile } = useAuth();
  const { createCommission, creating: creatingCommission, error: createError } = useCreateCommission();
  const { updateCommission, updating: updatingCommission, error: updateError } = useUpdateCommission();

  const isEditMode = mode === "edit";
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<CommissionWizardState>(() => (
    mode === "edit" && initialProduct
      ? mapProductToCommissionState(initialProduct)
      : initialCommissionWizardState
  ));
  const submitting = isEditMode ? updatingCommission : creatingCommission;
  const submitError = isEditMode ? updateError : createError;

  const categories = useMemo(() => getAllCommissionCategories(), []);
  const selectedCategory = state.category ? COMMISSION_CATEGORIES[state.category] : null;
  const progressPercent = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100;
  const stepTitle = STEP_TITLES[step] || STEP_TITLES[1];

  useEffect(() => {
    mediaUrlsRef.current = state.mediaPreviews
      .filter((item) => item.file instanceof File)
      .map((item) => item.url);
  }, [state.mediaPreviews]);

  useEffect(() => {
    return () => {
      mediaUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const updateState = useCallback((updates: Partial<CommissionWizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
    setError(null);
  }, []);

  const updatePackage = useCallback((id: string, updates: Partial<CommissionPackageFormState>) => {
    setState((prev) => ({
      ...prev,
      packages: prev.packages.map((pkg) =>
        pkg.id === id ? { ...pkg, ...updates } : pkg
      ),
    }));
    setError(null);
  }, []);

  const addPackage = useCallback(() => {
    if (state.packages.length >= 3) return;

    const nextPreset = PACKAGE_PRESETS[state.packages.length];
    const nextPackage: CommissionPackageFormState = {
      // Unique id so React keys don't collide if two packages happen to
      // share a tier (e.g., custom tiers added in the future).
      id: typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${nextPreset.tier}-${Date.now()}`,
      tier: nextPreset.tier,
      name: nextPreset.name,
      description: "",
      price: null,
      deliveryDays: 7,
      revisions: 1,
      features: [],
    };

    updateState({ packages: [...state.packages, nextPackage] });
  }, [state.packages, updateState]);

  const removePackage = useCallback((id: string) => {
    if (state.packages.length <= 1) return;
    updateState({ packages: state.packages.filter((pkg) => pkg.id !== id) });
  }, [state.packages, updateState]);

  const handleMediaUpload = useCallback((files: FileList | null) => {
    if (!files) return;

    const currentCount = state.mediaPreviews.length;
    const accepted: CommissionWizardState["mediaPreviews"] = [];
    setError(null);

    for (const file of Array.from(files)) {
      if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
        setError("Use JPG, PNG, WEBP, GIF, or MP4/MOV media only.");
        continue;
      }

      const isVideo = file.type.startsWith("video/");
      const sizeLimit = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      if (file.size > sizeLimit) {
        const limitMb = Math.round(sizeLimit / (1024 * 1024));
        setError(
          isVideo
            ? `Videos must be under ${limitMb} MB.`
            : `Images must be under ${limitMb} MB.`
        );
        continue;
      }

      if (currentCount + accepted.length >= MAX_MEDIA) {
        setError(`Maximum ${MAX_MEDIA} media files allowed.`);
        break;
      }

      accepted.push({
        file,
        url: URL.createObjectURL(file),
        isPrimary: currentCount === 0 && accepted.length === 0,
        mediaType: isVideo ? "video" : "image",
      });
    }

    if (accepted.length > 0) {
      updateState({ mediaPreviews: [...state.mediaPreviews, ...accepted] });
    }
  }, [state.mediaPreviews, updateState]);

  const setPrimaryMedia = useCallback((index: number) => {
    updateState({
      mediaPreviews: state.mediaPreviews.map((item, idx) => ({
        ...item,
        isPrimary: idx === index,
      })),
    });
  }, [state.mediaPreviews, updateState]);

  const removeMedia = useCallback((index: number) => {
    const item = state.mediaPreviews[index];
    if (item?.file) URL.revokeObjectURL(item.url);

    const nextMedia = state.mediaPreviews.filter((_, idx) => idx !== index);
    if (nextMedia.length > 0 && !nextMedia.some((media) => media.isPrimary)) {
      nextMedia[0].isPrimary = true;
    }
    updateState({ mediaPreviews: nextMedia });
  }, [state.mediaPreviews, updateState]);

  const validateStep = useCallback((targetStep: number): boolean => {
    if (targetStep === 1) {
      if (!state.category) {
        setError("Select a commission category.");
        return false;
      }
      if (!state.title.trim()) {
        setError("Add a service title.");
        return false;
      }
      if (!state.description.trim()) {
        setError("Describe your service clearly before continuing.");
        return false;
      }
    }

    if (targetStep === 2) {
      const hasUnderpriced = state.packages.some(
        (pkg) => pkg.price !== null && pkg.price > 0 && pkg.price < 5
      );
      if (hasUnderpriced) {
        setError("Each package must be priced at $5 or more.");
        return false;
      }

      const hasValidPackage = state.packages.some(
        (pkg) =>
          pkg.name.trim().length > 0 &&
          pkg.price !== null &&
          pkg.price >= 5 &&
          pkg.description.trim().length > 0
      );

      if (!hasValidPackage) {
        setError("Add at least one package with description and price.");
        return false;
      }
    }

    if (targetStep === 3) {
      if (state.mediaPreviews.length === 0) {
        setError("Upload at least one portfolio image or video.");
        return false;
      }
    }

    return true;
  }, [state]);

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(4, prev + 1));
  };

  const goBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const publishService = useCallback(async () => {
    if (!user || !profile) {
      setError(`Please sign in to ${isEditMode ? "edit" : "publish"} your service.`);
      return;
    }

    for (let idx = 1; idx <= 3; idx += 1) {
      if (!validateStep(idx)) {
        setStep(idx);
        return;
      }
    }

    if (isEditMode) {
      const targetProductId = productId || initialProduct?.id;
      if (!targetProductId) {
        setError("Missing commission id for edit.");
        return;
      }
      const success = await updateCommission(targetProductId, state);
      if (success) {
        router.push(`/studio/${profile.username}?tab=commissions`);
      }
      return;
    }

    const created = await createCommission(state);
    if (created) {
      router.push(`/studio/${profile.username}?tab=commissions`);
    }
  }, [createCommission, initialProduct?.id, isEditMode, productId, profile, router, state, updateCommission, user, validateStep]);

  const priceFrom = useMemo(() => {
    const values = state.packages
      .map((pkg) => pkg.price)
      .filter((value): value is number => typeof value === "number" && value > 0);
    return values.length > 0 ? Math.min(...values) : null;
  }, [state.packages]);

  if (isEditMode && !initialProduct) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/60 via-white to-pink-50/50 flex items-center justify-center px-6">
        <div className="w-10 h-10 rounded-full border-2 border-border-strong border-t-[var(--color-pink-vivid)] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/60 via-white to-pink-50/50 flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-[28px] bg-gradient-to-br from-purple-primary/20 to-pink-vivid/25 border border-white shadow-lg flex items-center justify-center">
            <svg className="w-10 h-10 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="font-display text-3xl text-ink mb-3">Sign in to share your creative gifts</h1>
          <p className="font-body text-muted">
            Open commissions, set your own terms, and let people who love your work hire you directly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-center text-sm font-ui text-muted uppercase tracking-wider mb-4">
          STEP {step}
        </p>

        <h1 className="text-center text-3xl md:text-4xl font-display font-bold text-ink mb-8">
          {stepTitle.prefix}{" "}
          <span className="bg-gradient-to-r from-orange-warm to-pink-vivid bg-clip-text text-transparent">
            {stepTitle.highlight1}
          </span>{" "}
          <span className="bg-gradient-to-r from-pink-vivid to-purple-primary bg-clip-text text-transparent">
            {stepTitle.highlight2}
          </span>
        </h1>

        <div className="mb-12">
          <StepRail currentStep={step} />
          <div className="h-1.5 bg-skeleton rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {(error || submitError) && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-sm text-red-600 font-body">{error || submitError}</p>
          </div>
        )}

        <div className="mb-12">
                {step === 1 && (
                  <div className="space-y-6">
                    <SectionCard
                      title="Category"
                      description="What kind of creative work do you do best?"
                      tone="rose"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {categories.map((category) => {
                          const selected = state.category === category.id;

                          return (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => updateState({ category: category.id, subcategory: null })}
                              className={`group text-left rounded-2xl p-4 border transition-all duration-300 ${
                                selected
                                  ? "border-transparent shadow-md shadow-pink-vivid/20"
                                  : "border-border-light bg-surface hover:border-pink-vivid/40 hover:shadow-sm"
                              }`}
                              style={{
                                backgroundImage: selected
                                  ? "linear-gradient(white, white), linear-gradient(to right, #8e44ad, #ff007f, #ff9f43)"
                                  : undefined,
                                backgroundOrigin: "border-box",
                                backgroundClip: selected ? "padding-box, border-box" : undefined,
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                  selected
                                    ? "bg-gradient-to-br from-purple-primary/20 to-pink-vivid/20 text-pink-vivid"
                                    : "bg-skeleton text-gray-500 group-hover:text-pink-vivid group-hover:bg-pink-50"
                                }`}>
                                  <CategoryGlyph categoryId={category.id} />
                                </div>
                                <div>
                                  <p className="font-ui font-semibold text-ink">{category.name}</p>
                                  <p className="text-xs font-body text-muted mt-1">{category.description}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </SectionCard>

                    {selectedCategory && (
                      <SectionCard
                        title="Specialization"
                        description="Where does your talent shine the most?"
                        tone="purple"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedCategory.subcategories.map((subcategory) => {
                            const selected = state.subcategory === subcategory.value;
                            return (
                              <button
                                key={subcategory.value}
                                type="button"
                                onClick={() => updateState({ subcategory: subcategory.value })}
                                className={`text-left rounded-xl p-3.5 border transition-all ${
                                  selected
                                    ? "border-purple-primary/40 bg-accent/10/70 shadow-sm"
                                    : "border-border-light bg-surface hover:border-accent/40"
                                }`}
                              >
                                <p className="font-ui text-sm font-semibold text-ink">{subcategory.label}</p>
                                <p className="text-xs font-body text-muted mt-1">{subcategory.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </SectionCard>
                    )}

                    <SectionCard
                      title="About your service"
                      description="Help people understand what makes your creative work special."
                      tone="neutral"
                    >
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <FieldLabel text="Service title" required />
                            <span className="text-xs font-ui text-muted">{state.title.trim().length}/80</span>
                          </div>
                          <input
                            maxLength={80}
                            value={state.title}
                            onChange={(event) => updateState({ title: event.target.value })}
                            placeholder="e.g., Custom watercolor portrait of your pet, family, or loved one"
                            className="w-full px-4 py-3 rounded-xl border border-border-light bg-surface focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid transition-colors"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <FieldLabel text="Short headline" />
                            <span className="text-xs font-ui text-muted">{state.headline.trim().length}/100</span>
                          </div>
                          <input
                            maxLength={100}
                            value={state.headline}
                            onChange={(event) => updateState({ headline: event.target.value })}
                            placeholder="e.g., Handcrafted with love, delivered in high-res with full rights"
                            className="w-full px-4 py-3 rounded-xl border border-border-light bg-surface focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid transition-colors"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <FieldLabel text="Service description" required />
                            <span className="text-xs font-ui text-muted">{state.description.trim().length}/1200</span>
                          </div>
                          <textarea
                            rows={6}
                            maxLength={1200}
                            value={state.description}
                            onChange={(event) => updateState({ description: event.target.value })}
                            placeholder="Share your creative process, what inspires your work, and what makes it uniquely yours."
                            className="w-full px-4 py-3 rounded-xl border border-border-light bg-surface focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid resize-y"
                          />
                        </div>
                      </div>
                    </SectionCard>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <SectionCard
                      title="Your creative packages"
                      description="Give people clear options to commission your work — from a simple piece to something truly custom."
                      tone="purple"
                    >
                      <div className="space-y-4">
                        {state.packages.map((pkg, index) => (
                          <PackageEditor
                            key={pkg.id}
                            index={index}
                            pkg={pkg}
                            canRemove={state.packages.length > 1}
                            onRemove={() => removePackage(pkg.id)}
                            onChange={(updates) => updatePackage(pkg.id, updates)}
                          />
                        ))}

                        {state.packages.length < 3 && (
                          <button
                            type="button"
                            onClick={addPackage}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-ui font-semibold text-purple-primary bg-accent/10 hover:bg-accent/15 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add another package
                          </button>
                        )}
                      </div>
                    </SectionCard>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <SectionCard
                      title="Portfolio"
                      description="Show off your finest work — the pieces that make people stop scrolling."
                      tone="rose"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_MEDIA_TYPES.join(",")}
                        multiple
                        onChange={(event) => handleMediaUpload(event.target.files)}
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="relative w-full rounded-2xl border border-dashed border-pink-vivid/35 bg-gradient-to-br from-pink-50/70 via-white to-orange-50/70 px-6 py-10 text-center hover:border-pink-vivid transition-colors"
                      >
                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-surface shadow-sm border border-pink-vivid/15 flex items-center justify-center">
                          <svg className="w-8 h-8 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <p className="font-ui font-semibold text-ink">Upload your best work</p>
                        <p className="text-xs font-body text-muted mt-1">{state.mediaPreviews.length} / {MAX_MEDIA} added</p>
                        <p className="text-xs font-body text-muted/80 mt-1">JPG, PNG, WEBP, GIF, MP4, MOV</p>
                      </button>

                      {state.mediaPreviews.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {state.mediaPreviews.map((media, index) => (
                            <div key={media.id || media.url} className="relative rounded-xl overflow-hidden border border-border-light group bg-surface">
                              {isVideoMedia(media) ? (
                                <video
                                  src={media.url}
                                  className="w-full aspect-square object-cover"
                                  muted
                                  playsInline
                                />
                              ) : (
                                <img src={media.url} alt={`Portfolio ${index + 1}`} className="w-full aspect-square object-cover" />
                              )}

                              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent text-xs text-white flex items-center justify-between">
                                <button type="button" className="underline underline-offset-2" onClick={() => setPrimaryMedia(index)}>
                                  {media.isPrimary ? "Primary" : "Set primary"}
                                </button>
                                <button type="button" className="underline underline-offset-2" onClick={() => removeMedia(index)}>
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard
                      title="What you'll need from them"
                      description="What should someone share with you before you start creating?"
                      tone="neutral"
                    >
                      <StringListEditor
                        values={state.requirements}
                        placeholder="e.g., Reference photos, color preferences, style inspiration"
                        onChange={(values) => updateState({ requirements: values })}
                      />
                    </SectionCard>

                    <SectionCard
                      title="FAQs"
                      description="Answer the questions people are most likely to ask about your work."
                      tone="neutral"
                    >
                      <FaqEditor
                        values={state.faqs}
                        onChange={(faqs) => updateState({ faqs })}
                      />
                    </SectionCard>

                    <SectionCard
                      title="Tags"
                      description="Help people discover your work with a few keywords."
                      tone="neutral"
                    >
                      <StringListEditor
                        values={state.keywords}
                        placeholder="e.g., watercolor, portrait, fantasy art, pet illustration"
                        onChange={(values) => updateState({ keywords: values })}
                      />
                    </SectionCard>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-6">
                    <SectionCard
                      title="Your listing preview"
                      description="This is how your commission will look to the world."
                      tone="neutral"
                    >
                      <ListingPreviewCard
                        state={state}
                        selectedCategory={selectedCategory?.name || "Choose category"}
                        priceFrom={priceFrom}
                      />
                    </SectionCard>

                    <SectionCard
                      title="Almost there"
                      description="A quick look at everything before your commission goes live."
                      tone="purple"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ReviewItem label="Category" value={selectedCategory?.name || "Not set"} />
                        <ReviewItem label="Specialization" value={state.subcategory || "Not set"} />
                        <ReviewItem label="Title" value={state.title || "Not set"} />
                        <ReviewItem label="Starting price" value={priceFrom ? `$${priceFrom}` : "Not set"} />
                        <ReviewItem label="Media" value={`${state.mediaPreviews.length} files`} />
                        <ReviewItem label="Packages" value={`${state.packages.length} tier(s)`} />
                        <ReviewItem label="Requirements" value={`${state.requirements.length} question(s)`} />
                        <ReviewItem label="FAQs" value={`${state.faqs.length} item(s)`} />
                      </div>
                    </SectionCard>

                    <SectionCard
                      title="Your packages"
                      description="How your creative offerings will appear side by side."
                      tone="rose"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {state.packages.map((pkg) => {
                          const style = TIER_STYLES[pkg.tier];
                          return (
                            <div key={pkg.id} className={`rounded-2xl p-4 border border-border-light bg-gradient-to-br ${style.card}`}>
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-ui font-semibold uppercase tracking-wider text-white bg-gradient-to-r ${style.badge}`}>
                                {pkg.name || pkg.tier}
                              </span>
                              <p className="font-display text-2xl text-ink mt-3">${pkg.price ?? 0}</p>
                              <p className="text-xs font-body text-muted mt-1 line-clamp-3">{pkg.description || "Describe what this package includes."}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className={`text-[11px] font-ui font-semibold px-2 py-1 rounded-full ${style.chip}`}>
                                  {pkg.deliveryDays} day{pkg.deliveryDays === 1 ? "" : "s"}
                                </span>
                                <span className={`text-[11px] font-ui font-semibold px-2 py-1 rounded-full ${style.chip}`}>
                                  {pkg.revisions} revision{pkg.revisions === 1 ? "" : "s"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </SectionCard>

                    <div className="rounded-2xl border border-purple-primary/15 bg-gradient-to-r from-purple-primary/5 via-pink-vivid/5 to-orange-warm/5 p-5">
                      <p className="text-sm font-body text-ink">
                        Your commission is a window into your creative world. People who find you here already love what you do — clear packages and beautiful portfolio pieces help them say yes.
                      </p>
                    </div>
                  </div>
                )}
        </div>

        <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 1 || submitting}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-ui font-semibold text-ink bg-surface border border-border-light hover:bg-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm hover:shadow-lg hover:shadow-pink-vivid/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Continue
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={publishService}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm hover:shadow-lg hover:shadow-pink-vivid/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? (isEditMode ? "Saving..." : "Publishing...")
                    : (isEditMode ? "Save Changes" : "Publish Service")}
                  {!submitting && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )}
        </div>
      </div>
    </div>
  );
}

function StepRail({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-6 md:gap-8 mb-4 flex-wrap">
      {STEP_LABELS.map((label, index) => {
        const step = index + 1;
        const isCompleted = currentStep > step;
        const isCurrent = currentStep === step;
        const isActive = currentStep >= step;

        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                isActive
                  ? "bg-gradient-to-r from-orange-warm to-pink-vivid text-white"
                  : "bg-skeleton text-gray-500"
              }`}
            >
              {isCompleted ? "✓" : step}
            </div>
            <span className={`text-sm font-ui ${isCurrent || isCompleted ? "text-ink font-medium" : "text-muted"}`}>
              {label}
            </span>
          </div>
        );
      })}
      </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  tone = "neutral",
}: {
  title: string;
  description: string;
  children: ReactNode;
  tone?: "neutral" | "purple" | "rose";
}) {
  const toneClasses = {
    neutral: "border-border-light bg-surface",
    purple: "border-purple-primary/15 bg-gradient-to-br from-purple-primary/[0.06] via-white to-purple-primary/[0.04]",
    rose: "border-pink-vivid/15 bg-gradient-to-br from-pink-vivid/[0.08] via-white to-orange-warm/[0.06]",
  } as const;

  return (
    <div className={`rounded-2xl border p-5 sm:p-6 ${toneClasses[tone]}`}>
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="text-sm font-body text-muted mt-1 mb-5">{description}</p>
      {children}
    </div>
  );
}

function FieldLabel({ text, required = false }: { text: string; required?: boolean }) {
  return (
    <label className="block text-sm font-ui font-semibold text-ink">
      {text}
      {required && <span className="text-pink-vivid"> *</span>}
    </label>
  );
}

function PackageEditor({
  index,
  pkg,
  canRemove,
  onRemove,
  onChange,
}: {
  index: number;
  pkg: CommissionPackageFormState;
  canRemove: boolean;
  onRemove: () => void;
  onChange: (updates: Partial<CommissionPackageFormState>) => void;
}) {
  const style = TIER_STYLES[pkg.tier];

  return (
    <div className={`rounded-2xl border border-border-light p-4 bg-gradient-to-br ${style.card} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-ui font-semibold uppercase tracking-wider text-white bg-gradient-to-r ${style.badge}`}>
            {pkg.tier}
          </span>
          <p className="font-ui font-semibold text-ink">Package {index + 1}</p>
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-xs font-ui text-red-500 hover:text-red-600">
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FieldLabel text="Package name" required />
          <input
            value={pkg.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Package name"
            className="w-full px-3 py-2.5 rounded-lg border border-border-light bg-surface focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel text="Price" required />
          <input
            type="number"
            min={5}
            step={1}
            value={pkg.price ?? ""}
            onChange={(event) => onChange({ price: event.target.value ? Number(event.target.value) : null })}
            placeholder="Price (USD)"
            className="w-full px-3 py-2.5 rounded-lg border border-border-light bg-surface focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel text="What's included" required />
        <textarea
          rows={3}
          value={pkg.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Describe what the person will receive and the creative process involved."
          className="w-full px-3 py-2.5 rounded-lg border border-border-light bg-surface focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid resize-y"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FieldLabel text="Delivery (days)" required />
          <input
            type="number"
            min={1}
            value={pkg.deliveryDays}
            onChange={(event) => onChange({ deliveryDays: Math.max(1, Number(event.target.value || 1)) })}
            placeholder="Delivery days"
            className="w-full px-3 py-2.5 rounded-lg border border-border-light bg-surface focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel text="Revisions" required />
          <input
            type="number"
            min={0}
            value={pkg.revisions}
            onChange={(event) => onChange({ revisions: Math.max(0, Number(event.target.value || 0)) })}
            placeholder="Revisions"
            className="w-full px-3 py-2.5 rounded-lg border border-border-light bg-surface focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid"
          />
        </div>
      </div>

      <div className="pt-1">
        <FieldLabel text="Highlights" />
        <StringListEditor
          values={pkg.features}
          placeholder="e.g., High-res file, commercial license, 2 concepts"
          onChange={(features) => onChange({ features })}
          compact
        />
      </div>
    </div>
  );
}

function StringListEditor({
  values,
  placeholder,
  onChange,
  compact = false,
}: {
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
  compact?: boolean;
}) {
  const updateValue = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, idx) => idx !== index));
  };

  const addValue = () => {
    onChange([...values, ""]);
  };

  return (
    <div className="space-y-2 mt-2">
      {values.map((value, index) => (
        // Keying by index keeps the input mounted as the user types.
        // Items here are only ever appended or removed (never reordered),
        // so the index→item mapping is stable enough.
        <div key={index} className="flex items-center gap-2">
          <input
            value={value}
            onChange={(event) => updateValue(index, event.target.value)}
            placeholder={placeholder}
            className={`flex-1 rounded-lg border border-border-light bg-surface focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid ${
              compact ? "px-3 py-2 text-sm" : "px-3 py-2.5"
            }`}
          />
          <button type="button" onClick={() => removeValue(index)} className="text-xs font-ui text-red-500 hover:text-red-600">
            Remove
          </button>
        </div>
      ))}

      <button type="button" onClick={addValue} className="text-xs font-ui font-semibold text-purple-primary hover:text-pink-vivid">
        + Add line
      </button>
    </div>
  );
}

function FaqEditor({
  values,
  onChange,
}: {
  values: Array<{ question: string; answer: string }>;
  onChange: (values: Array<{ question: string; answer: string }>) => void;
}) {
  const updateItem = (index: number, updates: { question?: string; answer?: string }) => {
    onChange(values.map((item, idx) => (idx === index ? { ...item, ...updates } : item)));
  };

  const removeItem = (index: number) => {
    onChange(values.filter((_, idx) => idx !== index));
  };

  const addItem = () => {
    onChange([...values, { question: "", answer: "" }]);
  };

  return (
    <div className="space-y-3">
      {values.map((item, index) => (
        <div key={index} className="rounded-xl border border-border-light bg-surface p-3 space-y-2">
          <input
            value={item.question}
            onChange={(event) => updateItem(index, { question: event.target.value })}
            placeholder="Question"
            className="w-full px-3 py-2 rounded-lg border border-border-light focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid"
          />
          <textarea
            rows={2}
            value={item.answer}
            onChange={(event) => updateItem(index, { answer: event.target.value })}
            placeholder="Answer"
            className="w-full px-3 py-2 rounded-lg border border-border-light focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid resize-y"
          />
          <button type="button" onClick={() => removeItem(index)} className="text-xs font-ui text-red-500 hover:text-red-600">
            Remove FAQ
          </button>
        </div>
      ))}

      <button type="button" onClick={addItem} className="text-xs font-ui font-semibold text-purple-primary hover:text-pink-vivid">
        + Add FAQ
      </button>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-light bg-surface px-3 py-3">
      <p className="text-[11px] font-ui uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm font-ui font-semibold text-ink mt-1">{value}</p>
    </div>
  );
}

function ListingPreviewCard({
  state,
  selectedCategory,
  priceFrom,
}: {
  state: CommissionWizardState;
  selectedCategory: string;
  priceFrom: number | null;
}) {
  const primaryMedia = state.mediaPreviews.find((item) => item.isPrimary) ?? state.mediaPreviews[0];

  return (
    <div className="rounded-2xl border border-border-light bg-surface/90 backdrop-blur-sm shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border-light bg-gradient-to-r from-purple-primary/10 via-pink-vivid/10 to-orange-warm/10">
        <p className="text-[11px] font-ui font-semibold uppercase tracking-wider text-muted">Listing preview</p>
      </div>

      <div className="p-4 space-y-3">
        <div className="rounded-xl overflow-hidden border border-border-light bg-gradient-to-br from-orange-50 to-pink-50">
          {primaryMedia ? (
            isVideoMedia(primaryMedia) ? (
              <video src={primaryMedia.url} className="w-full aspect-[4/3] object-cover" muted playsInline />
            ) : (
              <img src={primaryMedia.url} alt="Service preview" className="w-full aspect-[4/3] object-cover" />
            )
          ) : (
            <div className="aspect-[4/3] flex items-center justify-center text-xs font-ui text-muted px-4 text-center">
              Add your portfolio to see the cover here
            </div>
          )}
        </div>

        <div>
          <p className="text-[11px] font-ui uppercase tracking-wider text-muted">{selectedCategory}</p>
          <h3 className="font-ui font-semibold text-sm text-ink mt-1 line-clamp-2">
            {state.title || "Your service title will appear here"}
          </h3>
          <p className="text-xs font-body text-muted mt-1 line-clamp-2">
            {state.headline || "A short line that captures what makes your work special."}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-body text-muted">Starting at</span>
          <span className="text-lg font-display text-ink">{priceFrom ? `$${priceFrom}` : "--"}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex px-2 py-1 rounded-full bg-skeleton text-[11px] font-ui text-gray-700">
            {state.packages.length} tier{state.packages.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex px-2 py-1 rounded-full bg-skeleton text-[11px] font-ui text-gray-700">
            {state.mediaPreviews.length} media
          </span>
        </div>
      </div>
    </div>
  );
}

function CategoryGlyph({ categoryId }: { categoryId: string }) {
  if (categoryId === "design") {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4l8 4-8 4-8-4 8-4zm0 8v8m8-8v8M4 12v8" />
      </svg>
    );
  }

  if (categoryId === "illustration") {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h10a2 2 0 012 2v14l-5-3-5 3-5-3V5a2 2 0 012-2z" />
      </svg>
    );
  }

  if (categoryId === "writing") {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    );
  }

  if (categoryId === "video") {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-10 5h8a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }

  if (categoryId === "audio_music") {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19V6l12-2v13M9 19a2 2 0 11-4 0 2 2 0 014 0zm12-2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    );
  }

  if (categoryId === "crafts") {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    );
  }

  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
    </svg>
  );
}
