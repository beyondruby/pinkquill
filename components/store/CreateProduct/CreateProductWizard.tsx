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

const STEPS = [
  { id: "delivery", number: 1, label: "Choose Type" },
  { id: "category", number: 1, label: "Choose Type" },
  { id: "media", number: 2, label: "Upload Media" },
  { id: "details", number: 3, label: "Fill Details" },
];

const STEP_LABELS = [
  { number: 1, label: "Choose Type" },
  { number: 2, label: "Upload Media" },
  { number: 3, label: "Fill Details" },
];

export default function CreateProductWizard() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { create, creating, error: createError } = useCreateProduct();

  const [currentStep, setCurrentStep] = useState<WizardStep>("delivery");
  const [wizardState, setWizardState] = useState<ProductWizardState>(initialWizardState);
  const [error, setError] = useState<string | null>(null);

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

  const handleNext = useCallback(() => {
    if (validateCurrentStep()) {
      goToNextStep();
    }
  }, [validateCurrentStep, goToNextStep]);

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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-warm/20 to-pink-vivid/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-ink mb-2">Sign in to sell</h2>
          <p className="text-muted font-body">Create an account to start selling your work</p>
        </div>
      </div>
    );
  }

  const categoryConfig = wizardState.category ? getCategoryConfig(wizardState.category) : undefined;
  const stepNumber = getStepNumber(currentStep);
  const stepTitle = getStepTitle(currentStep);

  // Calculate progress percentage
  const progressPercent = stepNumber === 1 ? 33 : stepNumber === 2 ? 66 : 100;

  return (
    <div className="min-h-screen bg-white">
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
            {STEP_LABELS.map((step, index) => (
              <div key={step.number} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
                    ${stepNumber >= step.number
                      ? "bg-gradient-to-r from-orange-warm to-pink-vivid text-white"
                      : "bg-gray-200 text-gray-500"
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
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Error Message */}
        {(error || createError) && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-sm text-red-600 font-body">{error || createError}</p>
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
        <div className="flex items-center justify-between">
          {currentStep !== "delivery" ? (
            <button
              onClick={goToPreviousStep}
              className="flex items-center gap-2 px-6 py-3 rounded-full
                bg-purple-primary text-white font-ui font-semibold
                hover:bg-purple-primary/90 transition-colors"
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
              className="flex items-center gap-2 px-8 py-3 rounded-full
                bg-purple-primary text-white font-ui font-semibold
                hover:bg-purple-primary/90 transition-colors"
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
              className="px-10 py-3 rounded-full
                border-2 border-transparent bg-gradient-to-r from-orange-warm to-pink-vivid
                bg-clip-padding
                font-ui font-semibold text-orange-warm
                hover:opacity-90 transition-opacity
                disabled:opacity-50 disabled:cursor-not-allowed
                relative overflow-hidden"
              style={{
                background: "linear-gradient(white, white) padding-box, linear-gradient(to right, #ff9f43, #ff007f) border-box",
                borderColor: "transparent",
              }}
            >
              {creating ? "Submitting..." : "Submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
