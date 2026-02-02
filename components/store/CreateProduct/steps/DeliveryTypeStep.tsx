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
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "physical",
    label: "Physical",
    description: "A tangible product that will be shipped",
    hint: "Artwork, prints, crafts, and handmade items",
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="6" width="24" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="7" y="9" width="18" height="14" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M7 18L12 13L16 17L22 11L25 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20" cy="13" r="2" fill="currentColor" opacity="0.4" />
      </svg>
    ),
  },
  {
    value: "digital",
    label: "Digital",
    description: "A digital file for instant download",
    hint: "Music, ebooks, templates, and digital art",
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
        <rect x="6" y="4" width="20" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 10h12M10 14h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="16" cy="21" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16 19v4M14 21h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function DeliveryTypeStep({ value, onChange }: DeliveryTypeStepProps) {
  return (
    <div className="py-6">
      {/* Subtitle */}
      <p className="text-center text-muted font-body mb-10 max-w-md mx-auto">
        Choose how your product will be delivered to customers
      </p>

      {/* Options */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
        {DELIVERY_OPTIONS.map((option) => {
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`
                group relative w-full sm:w-56 p-8 rounded-3xl
                transition-all duration-500 ease-out
                ${isSelected
                  ? "bg-gradient-to-br from-purple-primary/10 via-pink-vivid/5 to-orange-warm/5 border-2 border-purple-primary/30 shadow-xl shadow-purple-primary/10"
                  : "bg-white/50 backdrop-blur-sm border border-gray-200/50 hover:border-purple-primary/20 hover:bg-white/70 hover:shadow-lg"
                }
              `}
            >
              {/* Selection indicator */}
              <div
                className={`
                  absolute top-4 right-4 w-6 h-6 rounded-full
                  flex items-center justify-center
                  transition-all duration-300
                  ${isSelected
                    ? "bg-gradient-to-br from-purple-primary to-pink-vivid scale-100"
                    : "bg-gray-100 scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100"
                  }
                `}
              >
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Icon */}
              <div
                className={`
                  w-20 h-20 mx-auto rounded-2xl
                  flex items-center justify-center mb-6
                  transition-all duration-500
                  ${isSelected
                    ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white shadow-lg shadow-purple-primary/20"
                    : "bg-gray-50 text-gray-400 group-hover:bg-gradient-to-br group-hover:from-purple-50 group-hover:to-pink-50 group-hover:text-purple-primary"
                  }
                `}
              >
                {option.icon}
              </div>

              {/* Label */}
              <h3
                className={`
                  text-xl font-display font-semibold text-center mb-2
                  transition-colors duration-300
                  ${isSelected
                    ? "bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent"
                    : "text-ink group-hover:text-purple-primary"
                  }
                `}
              >
                {option.label}
              </h3>

              {/* Description */}
              <p className="text-sm text-muted text-center font-body leading-relaxed">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Dynamic hint */}
      <div className="mt-10 text-center">
        <div
          className={`
            inline-flex items-center gap-2 px-5 py-2.5 rounded-full
            bg-white/60 backdrop-blur-md border border-white/40
            transition-all duration-500
            ${value ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
          `}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid" />
          <span className="text-sm text-muted font-body">
            {value === "physical"
              ? "Perfect for artwork, prints, crafts, and handmade items"
              : value === "digital"
              ? "Great for music, ebooks, templates, and downloadable content"
              : "Select a product type to continue"}
          </span>
        </div>
      </div>
    </div>
  );
}
