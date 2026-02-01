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
    description: "A tangible product that will be shipped",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id="physical-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff007f" />
            <stop offset="100%" stopColor="#ff9f43" />
          </linearGradient>
        </defs>
        {/* Frame */}
        <rect x="8" y="12" width="48" height="40" rx="2" stroke="url(#physical-gradient)" strokeWidth="2" fill="none" />
        {/* Inner border */}
        <rect x="12" y="16" width="40" height="32" rx="1" stroke="url(#physical-gradient)" strokeWidth="1.5" fill="none" />
        {/* Mountain landscape */}
        <path d="M12 40 L24 28 L32 36 L44 24 L52 32 L52 48 L12 48 Z" fill="url(#physical-gradient)" fillOpacity="0.2" />
        <path d="M12 40 L24 28 L32 36 L44 24 L52 32" stroke="url(#physical-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Sun */}
        <circle cx="44" cy="24" r="4" fill="url(#physical-gradient)" fillOpacity="0.6" />
      </svg>
    ),
  },
  {
    value: "digital",
    label: "Digital",
    description: "A digital file available for instant download",
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id="digital-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8e44ad" />
            <stop offset="100%" stopColor="#ff007f" />
          </linearGradient>
        </defs>
        {/* Browser window */}
        <rect x="8" y="12" width="48" height="40" rx="3" stroke="url(#digital-gradient)" strokeWidth="2" fill="none" />
        {/* Browser header */}
        <line x1="8" y1="22" x2="56" y2="22" stroke="url(#digital-gradient)" strokeWidth="1.5" />
        {/* Browser dots */}
        <circle cx="14" cy="17" r="2" fill="url(#digital-gradient)" fillOpacity="0.6" />
        <circle cx="22" cy="17" r="2" fill="url(#digital-gradient)" fillOpacity="0.6" />
        <circle cx="30" cy="17" r="2" fill="url(#digital-gradient)" fillOpacity="0.6" />
        {/* Content preview - mountain image */}
        <rect x="14" y="28" width="20" height="16" rx="1" stroke="url(#digital-gradient)" strokeWidth="1.5" fill="none" />
        <path d="M14 40 L20 34 L26 38 L34 32 L34 44 L14 44 Z" fill="url(#digital-gradient)" fillOpacity="0.2" />
        {/* Magnifying glass */}
        <circle cx="44" cy="36" r="8" stroke="url(#digital-gradient)" strokeWidth="2" fill="none" />
        <line x1="50" y1="42" x2="54" y2="46" stroke="url(#digital-gradient)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function DeliveryTypeStep({ value, onChange }: DeliveryTypeStepProps) {
  return (
    <div className="py-4">
      <h2 className="text-xl font-semibold text-center mb-8">
        Is this a ready product, or a service you wish to provide?
      </h2>

      <div className="flex justify-center gap-8 md:gap-16">
        {DELIVERY_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`flex flex-col items-center group transition-all duration-300`}
          >
            {/* Circle container */}
            <div
              className={`w-32 h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center
                transition-all duration-300 mb-4
                ${value === option.value
                  ? "bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg ring-2 ring-purple-primary/30"
                  : "bg-gray-50 hover:bg-gradient-to-br hover:from-purple-50/50 hover:to-pink-50/50"
                }
                group-hover:shadow-md group-hover:scale-105`}
            >
              <div
                className={`transition-transform duration-300
                  ${value === option.value ? "scale-110" : "group-hover:scale-105"}`}
              >
                {option.icon}
              </div>
            </div>

            {/* Label */}
            <span
              className={`text-lg font-medium transition-colors
                ${value === option.value
                  ? "bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent"
                  : "text-gray-700 group-hover:text-purple-primary"
                }`}
            >
              {option.label}
            </span>

            {/* Selection indicator */}
            {value === option.value && (
              <div className="mt-2 w-2 h-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid" />
            )}
          </button>
        ))}
      </div>

      {/* Hint text */}
      <p className="text-center text-sm text-muted mt-8">
        {value === "physical"
          ? "Perfect for artwork, prints, crafts, and other tangible items"
          : value === "digital"
          ? "Great for music, ebooks, templates, and downloadable content"
          : "Select the type that best describes your product"}
      </p>
    </div>
  );
}
