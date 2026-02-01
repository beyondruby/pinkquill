"use client";

import { WizardStep } from "./CreateProductWizard";

interface StepIndicatorProps {
  currentStep: WizardStep;
}

const DISPLAY_STEPS = [
  { id: 1, label: "Choose the Type of the Product", wizardSteps: ["delivery", "category"] },
  { id: 2, label: "Upload Your Product", wizardSteps: ["media"] },
  { id: 3, label: "Fill the Details", wizardSteps: ["details"] },
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
    <div className="mb-8">
      {/* Step labels */}
      <div className="flex justify-between items-center mb-3">
        {DISPLAY_STEPS.map((step, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-2 text-sm transition-colors
                ${isCurrent ? "text-ink font-medium" : isActive ? "text-muted" : "text-gray-400"}`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold
                  ${isCurrent
                    ? "bg-gradient-to-r from-orange-warm to-pink-vivid text-white"
                    : isActive
                    ? "bg-purple-primary text-white"
                    : "bg-gray-200 text-gray-500"
                  }`}
              >
                {step.id}.
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="relative h-1 bg-gray-200 rounded-full overflow-hidden">
        {/* Gradient progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm
            transition-all duration-500 ease-out rounded-full"
          style={{
            width: `${((currentIndex + 1) / DISPLAY_STEPS.length) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
