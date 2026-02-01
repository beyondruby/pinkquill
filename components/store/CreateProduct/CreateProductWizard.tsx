"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { ProductWizardState, initialWizardState, ProductDelivery } from "@/lib/types/store";
import { getCategoryConfig } from "@/lib/store/categories";
import { useCreateProduct } from "@/lib/hooks/useProducts";
import StepIndicator from "./StepIndicator";
import DeliveryTypeStep from "./steps/DeliveryTypeStep";
import CategoryStep from "./steps/CategoryStep";
import MediaUploadStep from "./steps/MediaUploadStep";
import DetailsStep from "./steps/DetailsStep";

export type WizardStep = "delivery" | "category" | "media" | "details";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "delivery", label: "Product Type" },
  { id: "category", label: "Category" },
  { id: "media", label: "Upload" },
  { id: "details", label: "Details" },
];

export default function CreateProductWizard() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { create, creating, error: createError } = useCreateProduct();

  const [currentStep, setCurrentStep] = useState<WizardStep>("delivery");
  const [wizardState, setWizardState] = useState<ProductWizardState>(initialWizardState);
  const [error, setError] = useState<string | null>(null);

  // Update wizard state
  const updateState = useCallback((updates: Partial<ProductWizardState>) => {
    setWizardState(prev => ({ ...prev, ...updates }));
    setError(null);
  }, []);

  // Get step number for display (1, 2, 3)
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

  // Get step title for header
  const getStepTitle = (step: WizardStep): { prefix: string; highlight: string; suffix: string } => {
    switch (step) {
      case "delivery":
        return { prefix: "Let's", highlight: "create", suffix: "your product" };
      case "category":
        return { prefix: "Choose your", highlight: "category", suffix: "" };
      case "media":
        return { prefix: "Show off your", highlight: "work", suffix: "" };
      case "details":
        return { prefix: "Almost there!", highlight: "Add", suffix: "the details" };
      default:
        return { prefix: "Let's", highlight: "create", suffix: "your product" };
    }
  };

  // Navigate to next step
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

  // Navigate to previous step
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

  // Validate current step before proceeding
  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case "delivery":
        if (!wizardState.deliveryType) {
          setError("Please select whether your product is physical or digital");
          return false;
        }
        return true;
      case "category":
        if (!wizardState.category) {
          setError("Please select a product category");
          return false;
        }
        return true;
      case "media":
        if (wizardState.mediaPreviews.length === 0) {
          setError("Please upload at least one image");
          return false;
        }
        return true;
      case "details":
        if (!wizardState.title.trim()) {
          setError("Please enter a title for your product");
          return false;
        }
        // Check pricing
        const hasPricing =
          (wizardState.sellOriginal && wizardState.originalPrice !== null) ||
          (wizardState.hasReproductions && wizardState.reproductions.length > 0) ||
          (wizardState.hasDigitalDownload && wizardState.digitalPrice !== null);
        if (!hasPricing) {
          setError("Please set at least one price for your product");
          return false;
        }
        return true;
      default:
        return true;
    }
  }, [currentStep, wizardState]);

  // Handle next button click
  const handleNext = useCallback(() => {
    if (validateCurrentStep()) {
      goToNextStep();
    }
  }, [validateCurrentStep, goToNextStep]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!user || !profile) {
      setError("Please sign in to create a product");
      return;
    }

    if (!validateCurrentStep()) {
      return;
    }

    try {
      const product = await create(wizardState);
      if (product) {
        router.push(`/studio/${profile.username}?tab=store`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    }
  }, [user, profile, validateCurrentStep, create, wizardState, router]);

  // Check if user is authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-purple-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-display text-ink mb-3">Sign In Required</h2>
          <p className="text-muted font-body mb-8">Please sign in to start selling your creative work</p>
        </div>
      </div>
    );
  }

  // Get category config for current selection
  const categoryConfig = wizardState.category
    ? getCategoryConfig(wizardState.category)
    : undefined;

  const stepTitle = getStepTitle(currentStep);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Step Header - Beautiful gradient text */}
        <div className="text-center mb-10">
          <p className="text-sm text-purple-primary/70 uppercase tracking-widest font-ui mb-3">
            Step {getStepNumber(currentStep)} of 3
          </p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-ink">
            {stepTitle.prefix}{" "}
            <span className="bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
              {stepTitle.highlight}
            </span>{" "}
            {stepTitle.suffix}
          </h1>
        </div>

        {/* Step Indicator - Elegant */}
        <StepIndicator currentStep={currentStep} />

        {/* Error Message - Beautiful alert */}
        {(error || createError) && (
          <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-100 rounded-xl text-red-600 text-sm font-body flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error || createError}</span>
          </div>
        )}

        {/* Step Content - Clean card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
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

        {/* Navigation Buttons - Beautiful gradient */}
        <div className="flex justify-between mt-8">
          {currentStep !== "delivery" ? (
            <button
              onClick={goToPreviousStep}
              className="group px-6 py-3.5 rounded-xl bg-gray-50 text-ink font-ui font-medium
                hover:bg-purple-50 hover:text-purple-primary transition-all duration-200
                flex items-center gap-2"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
          ) : (
            <div />
          )}

          {currentStep !== "details" ? (
            <button
              onClick={handleNext}
              className="group px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid
                text-white font-ui font-medium
                hover:shadow-lg hover:shadow-purple-primary/25 hover:scale-[1.02]
                transition-all duration-200 flex items-center gap-2"
            >
              Continue
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={creating}
              className="group px-10 py-3.5 rounded-xl bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm
                text-white font-display font-semibold text-lg
                hover:shadow-xl hover:shadow-purple-primary/30 hover:scale-[1.02]
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                disabled:hover:scale-100 disabled:hover:shadow-none
                flex items-center gap-3"
            >
              {creating ? (
                <>
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Publishing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Publish Product
                </>
              )}
            </button>
          )}
        </div>

        {/* Help text */}
        <p className="text-center text-sm text-muted mt-6 font-body">
          Your product will be visible in your store once published
        </p>
      </div>
    </div>
  );
}
