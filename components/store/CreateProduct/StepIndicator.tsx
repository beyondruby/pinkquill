"use client";

import { WizardStep } from "./CreateProductWizard";

interface StepIndicatorProps {
  currentStep: WizardStep;
}

const DISPLAY_STEPS = [
  { id: 1, label: "Choose Type", fullLabel: "Choose the Type of the Product", wizardSteps: ["delivery", "category"] },
  { id: 2, label: "Upload", fullLabel: "Upload Your Product", wizardSteps: ["media"] },
  { id: 3, label: "Details", fullLabel: "Fill the Details", wizardSteps: ["details"] },
];

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const getCurrentStepIndex = (): number => {
    const index = DISPLAY_STEPS.findIndex((step) =>
      step.wizardSteps.includes(currentStep)
    );
    return index >= 0 ? index : 0;
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <div className="mb-10">
      {/* Step indicators */}
      <div className="flex items-center justify-between relative">
        {/* Connection line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-10" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm -z-10
            transition-all duration-500 ease-out"
          style={{
            width: `${(currentIndex / (DISPLAY_STEPS.length - 1)) * 100}%`,
          }}
        />

        {DISPLAY_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isActive = index <= currentIndex;

          return (
            <div key={step.id} className="flex flex-col items-center">
              {/* Step circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                  transition-all duration-300 shadow-sm
                  ${isCurrent
                    ? "bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm text-white shadow-lg shadow-purple-primary/30 scale-110"
                    : isCompleted
                    ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white"
                    : "bg-white border-2 border-gray-200 text-gray-400"
                  }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>

              {/* Step label */}
              <span
                className={`mt-2 text-xs font-medium transition-colors hidden sm:block
                  ${isCurrent
                    ? "bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent"
                    : isActive
                    ? "text-gray-600"
                    : "text-gray-400"
                  }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current step description - mobile friendly */}
      <div className="mt-4 text-center sm:hidden">
        <span className="text-sm font-medium bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
          {DISPLAY_STEPS[currentIndex].fullLabel}
        </span>
      </div>
    </div>
  );
}
