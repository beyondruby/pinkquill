"use client";

import { WizardStep } from "./CreateProductWizard";

interface StepIndicatorProps {
  currentStep: WizardStep;
}

const DISPLAY_STEPS = [
  { id: 1, label: "Type", fullLabel: "Choose Type", wizardSteps: ["delivery", "category"], icon: "cube" },
  { id: 2, label: "Upload", fullLabel: "Upload Media", wizardSteps: ["media"], icon: "image" },
  { id: 3, label: "Details", fullLabel: "Add Details", wizardSteps: ["details"], icon: "sparkle" },
];

const StepIcon = ({ icon, isActive }: { icon: string; isActive: boolean }) => {
  const className = `w-4 h-4 transition-colors ${isActive ? "text-white" : "text-gray-400"}`;

  switch (icon) {
    case "cube":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    case "image":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "sparkle":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    default:
      return null;
  }
};

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
      {/* Glass container */}
      <div className="max-w-md mx-auto">
        <div className="relative flex items-center justify-between">
          {/* Connection line - background */}
          <div className="absolute top-1/2 left-[10%] right-[10%] h-[2px] -translate-y-1/2 bg-skeleton/50 rounded-full" />

          {/* Connection line - progress */}
          <div
            className="absolute top-1/2 left-[10%] h-[2px] -translate-y-1/2 bg-gradient-to-r from-purple-primary via-pink-vivid to-pink-vivid rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${currentIndex === 0 ? 0 : currentIndex === 1 ? 40 : 80}%`,
            }}
          />

          {DISPLAY_STEPS.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isActive = index <= currentIndex;

            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                {/* Step circle */}
                <div
                  className={`
                    w-12 h-12 rounded-2xl flex items-center justify-center
                    transition-all duration-500 ease-out
                    ${isCurrent
                      ? "bg-gradient-to-br from-purple-primary via-pink-vivid to-pink-vivid shadow-lg shadow-purple-primary/30 scale-110"
                      : isCompleted
                      ? "bg-gradient-to-br from-purple-primary/90 to-pink-vivid/90 shadow-md"
                      : "bg-surface/80 backdrop-blur-md border border-gray-200/50 shadow-sm"
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <StepIcon icon={step.icon} isActive={isActive} />
                  )}
                </div>

                {/* Step label */}
                <span
                  className={`
                    mt-3 text-xs font-ui font-medium transition-all duration-300
                    ${isCurrent
                      ? "text-purple-primary"
                      : isActive
                      ? "text-gray-600"
                      : "text-gray-400"
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current step description - mobile friendly */}
      <div className="mt-6 text-center sm:hidden">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface/60 backdrop-blur-md border border-white/40 text-sm font-medium text-purple-primary">
          {DISPLAY_STEPS[currentIndex].fullLabel}
        </span>
      </div>
    </div>
  );
}
