"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { ProductWizardState, initialWizardState, ProductDelivery } from "@/lib/types/store";
import { getCategoryConfig } from "@/lib/store/categories";
import { useCreateProduct } from "@/lib/hooks/useProducts";
import DeliveryTypeStep from "./steps/DeliveryTypeStep";
import CategoryStep from "./steps/CategoryStep";
import MediaUploadStep from "./steps/MediaUploadStep";
import DetailsStep from "./steps/DetailsStep";

export type WizardStep = "delivery" | "category" | "media" | "details";

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

  // Get step info
  const getStepInfo = (step: WizardStep) => {
    switch (step) {
      case "delivery":
        return { number: 1, total: 3, title: "What are you selling?" };
      case "category":
        return { number: 1, total: 3, title: "Choose a category" };
      case "media":
        return { number: 2, total: 3, title: "Add your images" };
      case "details":
        return { number: 3, total: 3, title: "Final details" };
      default:
        return { number: 1, total: 3, title: "" };
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

  // Validate current step
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
      case "details":
        if (!wizardState.title.trim()) {
          setError("Please enter a title");
          return false;
        }
        const hasPricing =
          (wizardState.sellOriginal && wizardState.originalPrice !== null) ||
          (wizardState.hasReproductions && wizardState.reproductions.length > 0) ||
          (wizardState.hasDigitalDownload && wizardState.digitalPrice !== null);
        if (!hasPricing) {
          setError("Please set a price");
          return false;
        }
        return true;
      default:
        return true;
    }
  }, [currentStep, wizardState]);

  // Handle next button
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

  // Auth check
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {/* Ambient */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-15%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-br from-purple-primary/12 via-pink-vivid/8 to-transparent blur-[150px]" />
          <div className="absolute bottom-[-20%] right-[-15%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-orange-warm/10 via-pink-vivid/6 to-transparent blur-[130px]" />
        </div>

        <div className="relative z-10 text-center px-6">
          <div className="w-20 h-20 mx-auto mb-8 rounded-3xl bg-white/80 backdrop-blur-2xl border border-white/60 shadow-2xl shadow-purple-primary/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-purple-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-semibold text-ink mb-3">Sign in to sell</h2>
          <p className="text-muted font-body">Create an account to start selling your work</p>
        </div>
      </div>
    );
  }

  const categoryConfig = wizardState.category ? getCategoryConfig(wizardState.category) : undefined;
  const stepInfo = getStepInfo(currentStep);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient Background - Large, soft, prominent */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-25%] left-[-20%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-br from-purple-primary/15 via-pink-vivid/10 to-transparent blur-[180px]" />
        <div className="absolute bottom-[-20%] right-[-15%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-tl from-orange-warm/12 via-pink-vivid/8 to-transparent blur-[150px]" />
        <div className="absolute top-[20%] right-[5%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-bl from-purple-primary/8 to-transparent blur-[120px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Minimal Header */}
        <header className="pt-12 pb-8 px-6">
          <div className="max-w-2xl mx-auto text-center">
            {/* Step dots */}
            <div className="flex items-center justify-center gap-3 mb-8">
              {[1, 2, 3].map((num) => (
                <div
                  key={num}
                  className={`
                    h-2 rounded-full transition-all duration-500
                    ${num === stepInfo.number
                      ? "w-8 bg-gradient-to-r from-purple-primary to-pink-vivid"
                      : num < stepInfo.number
                      ? "w-2 bg-purple-primary/40"
                      : "w-2 bg-gray-200/60"
                    }
                  `}
                />
              ))}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-display font-semibold text-ink">
              {stepInfo.title}
            </h1>
          </div>
        </header>

        {/* Error */}
        {(error || createError) && (
          <div className="px-6 pb-6">
            <div className="max-w-lg mx-auto">
              <div className="px-5 py-4 bg-red-50/80 backdrop-blur-xl rounded-2xl border border-red-100/50">
                <p className="text-sm text-red-600 font-body text-center">{error || createError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Glass Container */}
        <main className="flex-1 px-6 pb-8">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white/80 backdrop-blur-3xl rounded-[2.5rem] border border-white/70 shadow-[0_20px_80px_-20px_rgba(142,68,173,0.12)]">
              <div className="p-8 md:p-12">
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

              {/* Navigation inside card */}
              <div className="px-8 md:px-12 pb-8 md:pb-12">
                <div className="pt-8 border-t border-gray-100/50">
                  <div className="flex items-center justify-between">
                    {currentStep !== "delivery" ? (
                      <button
                        onClick={goToPreviousStep}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl
                          text-muted font-ui font-medium
                          hover:text-ink hover:bg-gray-50/50
                          transition-all duration-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                      </button>
                    ) : (
                      <div />
                    )}

                    {currentStep !== "details" ? (
                      <button
                        onClick={handleNext}
                        className="flex items-center gap-2 px-8 py-3.5 rounded-2xl
                          bg-gradient-to-r from-purple-primary to-pink-vivid
                          text-white font-ui font-semibold
                          shadow-lg shadow-purple-primary/25
                          hover:shadow-xl hover:shadow-purple-primary/30 hover:scale-[1.02]
                          active:scale-[0.98]
                          transition-all duration-300"
                      >
                        Continue
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        disabled={creating}
                        className="flex items-center gap-3 px-10 py-4 rounded-2xl
                          bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm
                          bg-[length:200%_auto] hover:bg-[position:right_center]
                          text-white font-display font-semibold text-lg
                          shadow-xl shadow-purple-primary/25
                          hover:shadow-2xl hover:shadow-purple-primary/30 hover:scale-[1.02]
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
                            Publishing...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Publish
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
