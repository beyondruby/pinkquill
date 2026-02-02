"use client";

import { ProductDelivery } from "@/lib/types/store";

interface DeliveryTypeStepProps {
  value: ProductDelivery | null;
  onChange: (value: ProductDelivery) => void;
}

const DELIVERY_OPTIONS: {
  value: ProductDelivery;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "physical",
    label: "Physical",
    description: "Ships to customer",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    value: "digital",
    label: "Digital",
    description: "Instant download",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
  },
];

export default function DeliveryTypeStep({ value, onChange }: DeliveryTypeStepProps) {
  return (
    <div className="py-8">
      {/* Large icon cards */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12">
        {DELIVERY_OPTIONS.map((option) => {
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className="group flex flex-col items-center text-center"
            >
              {/* Large circular icon container */}
              <div
                className={`
                  relative w-32 h-32 rounded-full flex items-center justify-center
                  transition-all duration-300 mb-5
                  ${isSelected
                    ? "bg-gradient-to-br from-orange-warm/20 to-pink-vivid/20"
                    : "bg-pink-vivid/5 group-hover:bg-pink-vivid/10"
                  }
                `}
              >
                {/* Inner circle with icon */}
                <div
                  className={`
                    w-24 h-24 rounded-full flex items-center justify-center
                    transition-all duration-300
                    ${isSelected
                      ? "bg-gradient-to-br from-orange-warm/30 to-pink-vivid/30"
                      : "bg-pink-vivid/10 group-hover:bg-pink-vivid/15"
                    }
                  `}
                >
                  <span className={`
                    transition-colors duration-300
                    ${isSelected
                      ? "text-pink-vivid"
                      : "text-pink-vivid/60 group-hover:text-pink-vivid/80"
                    }
                  `}>
                    {option.icon}
                  </span>
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-orange-warm to-pink-vivid flex items-center justify-center shadow-lg">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Label */}
              <h3
                className={`
                  text-xl font-display font-bold mb-1
                  transition-colors duration-300
                  ${isSelected
                    ? "bg-gradient-to-r from-orange-warm to-pink-vivid bg-clip-text text-transparent"
                    : "text-ink group-hover:text-pink-vivid"
                  }
                `}
              >
                {option.label}
              </h3>

              {/* Description */}
              <p className={`
                text-sm font-body transition-colors duration-300
                ${isSelected ? "text-pink-vivid/70" : "text-muted"}
              `}>
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
