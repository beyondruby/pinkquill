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
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        {/* Ambient Background */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-purple-primary/8 via-pink-vivid/5 to-transparent blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tl from-orange-warm/8 via-pink-vivid/4 to-transparent blur-[80px]" />
        </div>

        <div className="relative z-10 text-center max-w-md">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-3xl bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-purple-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-display text-ink mb-3">Sign In Required</h2>
          <p className="text-muted font-body">Please sign in to start selling your creative work</p>
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
    <div className="min-h-screen relative overflow-hidden selection:bg-purple-primary/20 selection:text-purple-primary">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-5%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-purple-primary/10 via-pink-vivid/6 to-transparent blur-[120px] opacity-70" />
        <div className="absolute bottom-[-10%] right-[-8%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-tl from-orange-warm/10 via-pink-vivid/5 to-transparent blur-[100px] opacity-60" />
        <div className="absolute top-[30%] right-[10%] w-[25vw] h-[25vw] rounded-full bg-gradient-to-bl from-purple-primary/5 to-transparent blur-[80px] opacity-50" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 py-8 md:py-12 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Header Section */}
          <div className="text-center mb-12">
            {/* Step Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-md border border-white/40 shadow-sm mb-6">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                <span className="text-xs font-bold text-white">{getStepNumber(currentStep)}</span>
              </div>
              <span className="text-sm font-ui text-muted">of 3</span>
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-5xl font-display font-semibold text-ink leading-tight">
              {stepTitle.prefix}{" "}
              <span className="bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
                {stepTitle.highlight}
              </span>
              {stepTitle.suffix && <> {stepTitle.suffix}</>}
            </h1>
          </div>

          {/* Step Indicator */}
          <StepIndicator currentStep={currentStep} />

          {/* Error Message */}
          {(error || createError) && (
            <div className="mb-8 mx-auto max-w-2xl">
              <div className="p-4 bg-white/70 backdrop-blur-xl border border-red-200/50 rounded-2xl shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                    </svg>
                  </div>
                  <p className="text-sm text-red-600 font-body pt-1.5">{error || createError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Main Glass Card */}
          <div className="bg-white/70 backdrop-blur-2xl rounded-[2rem] border border-white/50 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] p-6 md:p-10 mb-8">
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
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {currentStep !== "delivery" ? (
              <button
                onClick={goToPreviousStep}
                className="group flex items-center gap-2 px-5 py-3 rounded-xl
                  bg-white/50 backdrop-blur-md border border-white/40
                  text-ink font-ui font-medium
                  hover:bg-white/70 hover:border-purple-primary/20
                  transition-all duration-300"
              >
                <svg className="w-4 h-4 text-muted group-hover:text-purple-primary group-hover:-translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">Back</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep !== "details" ? (
              <button
                onClick={handleNext}
                className="group flex items-center gap-2 px-8 py-3.5 rounded-xl
                  bg-gradient-to-r from-purple-primary via-pink-vivid to-pink-vivid
                  text-white font-ui font-semibold
                  shadow-lg shadow-purple-primary/20
                  hover:shadow-xl hover:shadow-purple-primary/30 hover:scale-[1.02]
                  active:scale-[0.98]
                  transition-all duration-300"
              >
                <span>Continue</span>
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={creating}
                className="group flex items-center gap-3 px-10 py-4 rounded-xl
                  bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm
                  bg-[length:200%_auto] hover:bg-[position:right_center]
                  text-white font-display font-semibold text-lg
                  shadow-xl shadow-purple-primary/25
                  hover:shadow-2xl hover:shadow-purple-primary/35 hover:scale-[1.02]
                  active:scale-[0.98]
                  transition-all duration-500
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {creating ? (
                  <>
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Publish Product</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Footer hint */}
          <p className="text-center text-sm text-muted/60 mt-8 font-body">
            Your product will be visible in your store once published
          </p>
        </div>
      </div>
    </div>
  );
}
