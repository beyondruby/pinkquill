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
  { id: "delivery", label: "Choose the Type of the Product" },
  { id: "category", label: "Upload Your Product" },
  { id: "media", label: "Upload Your Product" },
  { id: "details", label: "Fill the Details" },
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
  const getStepTitle = (step: WizardStep): string => {
    switch (step) {
      case "delivery":
        return "Let's create your product";
      case "category":
        return "Let's create your product";
      case "media":
        return "Let's start to create your product";
      case "details":
        return "We're almost create your product";
      default:
        return "Let's create your product";
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
          <p className="text-muted">Please sign in to sell your products</p>
        </div>
      </div>
    );
  }

  // Get category config for current selection
  const categoryConfig = wizardState.category
    ? getCategoryConfig(wizardState.category)
    : undefined;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Step Header */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted uppercase tracking-wider mb-2">
            STEP {getStepNumber(currentStep)}
          </p>
          <h1 className="text-2xl md:text-3xl font-display">
            {getStepTitle(currentStep).split("create").map((part, i, arr) =>
              i < arr.length - 1 ? (
                <span key={i}>
                  {part}
                  <span className="bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
                    create
                  </span>
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </h1>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Error Message */}
        {(error || createError) && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error || createError}
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-border-light p-6 md:p-8">
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

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          {currentStep !== "delivery" ? (
            <button
              onClick={goToPreviousStep}
              className="px-6 py-3 rounded-full bg-gray-100 text-gray-700 font-medium
                hover:bg-gray-200 transition-colors flex items-center gap-2"
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
              className="px-6 py-3 rounded-full bg-purple-primary text-white font-medium
                hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              Next Step
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={creating}
              className="px-8 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid
                text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50
                disabled:cursor-not-allowed flex items-center gap-2"
            >
              {creating ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </>
              ) : (
                "Submit"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
