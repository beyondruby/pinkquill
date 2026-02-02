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
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    value: "digital",
    label: "Digital",
    description: "Instant download",
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
  },
];

export default function DeliveryTypeStep({ value, onChange }: DeliveryTypeStepProps) {
  return (
    <div className="py-4">
      {/* Simple two-column layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {DELIVERY_OPTIONS.map((option) => {
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`
                group relative p-8 rounded-3xl text-left
                transition-all duration-300
                ${isSelected
                  ? "bg-gradient-to-br from-purple-primary/8 to-pink-vivid/5 ring-2 ring-purple-primary/30"
                  : "bg-white/40 hover:bg-white/60 ring-1 ring-gray-200/50 hover:ring-purple-primary/20"
                }
              `}
            >
              {/* Check mark */}
              <div
                className={`
                  absolute top-5 right-5 w-6 h-6 rounded-full
                  flex items-center justify-center
                  transition-all duration-300
                  ${isSelected
                    ? "bg-gradient-to-br from-purple-primary to-pink-vivid scale-100 opacity-100"
                    : "bg-gray-100 scale-90 opacity-0 group-hover:opacity-50"
                  }
                `}
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              {/* Icon */}
              <div
                className={`
                  w-14 h-14 rounded-2xl flex items-center justify-center mb-5
                  transition-all duration-300
                  ${isSelected
                    ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white"
                    : "bg-gray-100/80 text-gray-400 group-hover:text-purple-primary group-hover:bg-purple-primary/10"
                  }
                `}
              >
                {option.icon}
              </div>

              {/* Text */}
              <h3
                className={`
                  text-xl font-display font-semibold mb-1
                  transition-colors duration-300
                  ${isSelected ? "text-purple-primary" : "text-ink group-hover:text-purple-primary"}
                `}
              >
                {option.label}
              </h3>
              <p className="text-sm text-muted font-body">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
