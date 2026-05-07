"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  ProductWizardState,
  initialWizardState,
  ProductDelivery,
  Product,
  ProductPricing,
  ProductMedia,
} from "@/lib/types/store";
import { getCategoryConfig } from "@/lib/store/categories";
import { useCreateProduct, useUpdateProductListing } from "@/lib/hooks/useProducts";
import DeliveryTypeStep from "./steps/DeliveryTypeStep";
import CategoryStep from "./steps/CategoryStep";
import MediaUploadStep from "./steps/MediaUploadStep";
import DetailsStep from "./steps/DetailsStep";

export type WizardStep = "delivery" | "category" | "media" | "details";

const STEP_LABELS = [
  { number: 1, label: "Choose Type" },
  { number: 2, label: "Upload Media" },
  { number: 3, label: "Fill Details" },
];

function mapProductToWizardState(product: Product): ProductWizardState {
  const sortedMedia = [...(product.media || [])]
    .sort((a: ProductMedia, b: ProductMedia) => a.position - b.position)
    .map((item) => ({
      id: item.id,
      file: null,
      url: item.media_url,
      isPrimary: Boolean(item.is_primary),
      mediaType: item.media_type,
    }));

  if (sortedMedia.length > 0 && !sortedMedia.some((item) => item.isPrimary)) {
    sortedMedia[0].isPrimary = true;
  }

  const pricingRows = product.pricing || [];
  const originalPricing = pricingRows.find((row) => row.pricing_type === "original");
  const digitalPricing = pricingRows.find((row) => row.pricing_type === "digital_download");
  const reproductions = pricingRows
    .filter((row) => row.pricing_type === "reproduction")
    .map((row: ProductPricing, index) => ({
      type: row.variant_name || `reproduction-${index + 1}`,
      price: Number(row.price || 0),
    }));

  return {
    deliveryType: product.delivery_type,
    category: product.category || null,
    subcategory: product.subcategory || null,
    mediaFiles: [],
    mediaPreviews: sortedMedia,
    digitalFiles: (product.files || []).map((file) => ({
      id: file.id,
      file: null,
      name: file.file_name,
      type: file.file_type || undefined,
      size: file.file_size || 0,
      url: file.file_url,
    })),
    title: product.title || "",
    description: product.description || "",
    yearCreated: product.year_created || null,
    attributes: product.attributes || {},
    sellOriginal: !!originalPricing,
    originalPrice: originalPricing ? Number(originalPricing.price || 0) : null,
    hasReproductions: reproductions.length > 0,
    reproductions,
    hasDigitalDownload: !!digitalPricing,
    digitalPrice: digitalPricing ? Number(digitalPricing.price || 0) : null,
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

export default function CreateProductWizard({
  mode = "create",
  productId,
  initialProduct = null,
}: CreateProductWizardProps = {}) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { create, creating: creatingListing, error: createError } = useCreateProduct();
  const { updateListing, updating: updatingListing, error: updateError } = useUpdateProductListing();

  const isEditMode = mode === "edit";
  const [currentStep, setCurrentStep] = useState<WizardStep>("delivery");
  const [wizardState, setWizardState] = useState<ProductWizardState>(() => (
    mode === "edit" && initialProduct
      ? mapProductToWizardState(initialProduct)
      : initialWizardState
  ));
  const [error, setError] = useState<string | null>(null);

  const submitting = isEditMode ? updatingListing : creatingListing;
  const submitError = isEditMode ? updateError : createError;

  const updateState = useCallback((updates: Partial<ProductWizardState>) => {
    setWizardState(prev => ({ ...prev, ...updates }));
    setError(null);
  }, []);

  const getStepNumber = (step: WizardStep): number => {
    switch (step) {
      case "delivery":
      case "category":
        return 1;
      case "media":
        return 2;
      case "details":
        return 3;
      default:
        return 1;
    }
  };

  const getStepTitle = (step: WizardStep): { prefix: string; highlight1: string; highlight2: string } => {
    switch (step) {
      case "delivery":
        return { prefix: "Let's", highlight1: "create", highlight2: "your product" };
      case "category":
        return { prefix: "Choose a", highlight1: "category", highlight2: "for your product" };
      case "media":
        return { prefix: "Upload", highlight1: "media", highlight2: "for your product" };
      case "details":
        return { prefix: "Add the", highlight1: "final", highlight2: "details" };
      default:
        return { prefix: "Let's", highlight1: "create", highlight2: "your product" };
    }
  };

  const goToNextStep = useCallback(() => {
    switch (currentStep) {
      case "delivery":
        setCurrentStep("category");
        break;
      case "category":
        setCurrentStep("media");
        break;
      case "media":
        setCurrentStep("details");
        break;
      default:
        break;
    }
  }, [currentStep]);

  const goToPreviousStep = useCallback(() => {
    switch (currentStep) {
      case "category":
        setCurrentStep("delivery");
        break;
      case "media":
        setCurrentStep("category");
        break;
      case "details":
        setCurrentStep("media");
        break;
      default:
        break;
    }
  }, [currentStep]);

  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case "delivery":
        if (!wizardState.deliveryType) {
          setError("Please select a product type");
          return false;
        }
        return true;
      case "category":
        if (!wizardState.category) {
          setError("Please select a category");
          return false;
        }
        return true;
      case "media":
        if (wizardState.mediaPreviews.length === 0) {
          setError("Please upload at least one image");
          return false;
        }
        return true;
      case "details": {
        const trimmedTitle = wizardState.title.trim();
        if (!trimmedTitle) {
          setError("Please enter a title");
          return false;
        }
        if (trimmedTitle.length < 3) {
          setError("Title must be at least 3 characters");
          return false;
        }
        if (trimmedTitle.length > 120) {
          setError("Title must be 120 characters or fewer");
          return false;
        }
        const hasPricing =
          (wizardState.sellOriginal && wizardState.originalPrice !== null) ||
          (wizardState.hasReproductions && wizardState.reproductions.some((item) => item.price > 0)) ||
          (wizardState.hasDigitalDownload && wizardState.digitalPrice !== null);
        if (!hasPricing) {
          setError("Please set a price");
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  }, [currentStep, wizardState]);

  const handleNext = useCallback(() => {
    if (validateCurrentStep()) {
      goToNextStep();
    }
  }, [validateCurrentStep, goToNextStep]);

  const handleSubmit = async () => {
    if (!user || !profile) {
      setError(`Please sign in to ${isEditMode ? "edit" : "create"} a product`);
      return;
    }

    if (!validateCurrentStep()) {
      return;
    }

    try {
      if (isEditMode) {
        const targetProductId = productId || initialProduct?.id;
        if (!targetProductId) {
          setError("Missing product id for edit.");
          return;
        }

        const success = await updateListing(targetProductId, wizardState);
        if (success) {
          router.push(`/studio/${profile.username}?tab=store`);
        }
        return;
      }

      const product = await create(wizardState);
      if (product) {
        router.push(`/studio/${profile.username}?tab=store`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? "update" : "create"} product`);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-subtle">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-warm/20 to-pink-vivid/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-ink mb-2">
            {isEditMode ? "Sign in to edit listing" : "Sign in to sell"}
          </h2>
          <p className="text-muted font-body">
            {isEditMode ? "You need an account to edit listings" : "Create an account to start selling your work"}
          </p>
        </div>
      </div>
    );
  }

  if (isEditMode && !initialProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-subtle">
        <div className="w-10 h-10 rounded-full border-2 border-border-strong border-t-[var(--color-pink-vivid)] animate-spin" />
      </div>
    );
  }

  const categoryConfig = wizardState.category ? getCategoryConfig(wizardState.category) : undefined;
  const stepNumber = getStepNumber(currentStep);
  const stepTitle = getStepTitle(currentStep);

  // Calculate progress percentage (aligns with step indicators)
  // Step 1 = 16%, Step 2 = 50%, Step 3 = 100%
  const progressPercent = stepNumber === 1 ? 16 : stepNumber === 2 ? 50 : 100;

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Step Label */}
        <p className="text-center text-sm font-ui text-muted uppercase tracking-wider mb-4">
          STEP {stepNumber}
        </p>

        {/* Title */}
        <h1 className="text-center text-3xl md:text-4xl font-display font-bold text-ink mb-8">
          {stepTitle.prefix}{" "}
          <span className="bg-gradient-to-r from-orange-warm to-pink-vivid bg-clip-text text-transparent">
            {stepTitle.highlight1}
          </span>{" "}
          <span className="bg-gradient-to-r from-pink-vivid to-purple-primary bg-clip-text text-transparent">
            {stepTitle.highlight2}
          </span>
        </h1>

        {/* Step Indicator */}
        <div className="mb-12">
          <div className="flex items-center justify-center gap-8 mb-4">
            {STEP_LABELS.map((step) => (
              <div key={step.number} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
                    ${stepNumber >= step.number
                      ? "bg-gradient-to-r from-orange-warm to-pink-vivid text-white"
                      : "bg-skeleton text-gray-500"
                    }`}
                >
                  {step.number}
                </div>
                <span
                  className={`text-sm font-ui ${
                    stepNumber >= step.number ? "text-ink font-medium" : "text-muted"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 bg-skeleton rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Error Message */}
        {(error || submitError) && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-sm text-red-600 font-body">{error || submitError}</p>
          </div>
        )}

        {/* Content */}
        <div className="mb-12">
          {currentStep === "delivery" && (
            <DeliveryTypeStep
              value={wizardState.deliveryType}
              onChange={(deliveryType) => updateState({ deliveryType })}
            />
          )}

          {currentStep === "category" && (
            <CategoryStep
              deliveryType={wizardState.deliveryType as ProductDelivery}
              category={wizardState.category}
              subcategory={wizardState.subcategory}
              onCategoryChange={(category) =>
                updateState({ category, subcategory: null, attributes: {} })
              }
              onSubcategoryChange={(subcategory) => updateState({ subcategory })}
            />
          )}

          {currentStep === "media" && (
            <MediaUploadStep
              deliveryType={wizardState.deliveryType as ProductDelivery}
              mediaPreviews={wizardState.mediaPreviews}
              digitalFiles={wizardState.digitalFiles}
              onMediaChange={(mediaPreviews) => updateState({ mediaPreviews })}
              onDigitalFilesChange={(digitalFiles) => updateState({ digitalFiles })}
            />
          )}

          {currentStep === "details" && categoryConfig && (
            <DetailsStep
              deliveryType={wizardState.deliveryType as ProductDelivery}
              category={wizardState.category!}
              subcategory={wizardState.subcategory}
              categoryConfig={categoryConfig}
              wizardState={wizardState}
              updateState={updateState}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          {currentStep !== "delivery" ? (
            <button
              onClick={goToPreviousStep}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-purple-primary text-white font-ui font-semibold hover:bg-accent/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous Step
            </button>
          ) : (
            <div />
          )}

          {currentStep !== "details" ? (
            <button
              onClick={handleNext}
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-3 rounded-full bg-purple-primary text-white font-ui font-semibold hover:bg-accent/90 transition-colors"
            >
              Next Step
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-10 py-3 rounded-full border-2 border-transparent font-ui font-semibold text-orange-warm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(white, white) padding-box, linear-gradient(to right, #ff9f43, #ff007f) border-box",
              }}
            >
              {submitting
                ? (isEditMode ? "Saving..." : "Submitting...")
                : (isEditMode ? "Save Changes" : "Submit")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
