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
    <div className="py-12">
      {/* Large icon cards with proper spacing */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-12 sm:gap-20 mb-16">
        {DELIVERY_OPTIONS.map((option) => {
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className="group flex flex-col items-center text-center"
            >
              {/* Glass circle with subtle selection */}
              <div
                className={`
                  relative w-36 h-36 rounded-full flex items-center justify-center
                  transition-all duration-300 mb-6
                  backdrop-blur-sm bg-surface/80
                  ${isSelected
                    ? "shadow-xl shadow-pink-vivid/20"
                    : "shadow-lg shadow-black/5 group-hover:shadow-xl group-hover:shadow-pink-vivid/10"
                  }
                `}
                style={{
                  border: isSelected
                    ? "2px solid transparent"
                    : "1px solid rgba(0, 0, 0, 0.05)",
                  backgroundImage: isSelected
                    ? "linear-gradient(white, white), linear-gradient(to right, #8e44ad, #ff007f, #ff9f43)"
                    : undefined,
                  backgroundOrigin: "border-box",
                  backgroundClip: isSelected ? "padding-box, border-box" : undefined,
                }}
              >
                <span className={`
                  transition-colors duration-300
                  ${isSelected
                    ? "text-pink-vivid"
                    : "text-pink-vivid/40 group-hover:text-pink-vivid/70"
                  }
                `}>
                  {option.icon}
                </span>
              </div>

              {/* Label */}
              <h3
                className={`
                  text-xl font-display font-bold mb-1
                  transition-colors duration-300
                  ${isSelected
                    ? "text-pink-vivid"
                    : "text-ink group-hover:text-pink-vivid/80"
                  }
                `}
              >
                {option.label}
              </h3>

              {/* Description */}
              <p className={`
                text-sm font-body transition-colors duration-300
                ${isSelected ? "text-pink-vivid/60" : "text-muted"}
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
