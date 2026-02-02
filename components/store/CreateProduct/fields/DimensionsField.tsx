"use client";

import { useState } from "react";
import { CreateShippingData, DimensionsUnit, WeightUnit } from "@/lib/types/store";

interface DimensionsFieldProps {
  shipping: CreateShippingData;
  onChange: (shipping: CreateShippingData) => void;
}

const DIMENSION_UNITS: { value: DimensionsUnit; label: string }[] = [
  { value: "cm", label: "Centimeter" },
  { value: "inches", label: "Inches" },
];

const WEIGHT_UNITS: { value: WeightUnit; label: string }[] = [
  { value: "kg", label: "kg" },
  { value: "lbs", label: "lbs" },
];

export default function DimensionsField({ shipping, onChange }: DimensionsFieldProps) {
  const [unitOpen, setUnitOpen] = useState(false);

  const updateField = (key: keyof CreateShippingData, value: unknown) => {
    onChange({ ...shipping, [key]: value });
  };

  return (
    <div className="space-y-5">
      {/* Length unit selector */}
      <div>
        <label className="block text-sm font-ui font-medium text-ink mb-2">
          Length unit
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setUnitOpen(!unitOpen)}
            className={`w-56 px-5 py-4 rounded-2xl
              bg-white/60 backdrop-blur-sm border
              transition-all duration-300 text-left flex items-center justify-between
              ${unitOpen
                ? "border-purple-primary/40 bg-white shadow-lg shadow-purple-primary/5"
                : "border-gray-200/50 hover:border-purple-primary/30 hover:bg-white/80"
              }`}
          >
            <span className="text-ink font-body">
              {DIMENSION_UNITS.find((u) => u.value === shipping.dimensions_unit)?.label || "Select"}
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${unitOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {unitOpen && (
            <div className="absolute z-20 w-56 mt-2 bg-white/95 backdrop-blur-xl border border-gray-100/50 rounded-2xl shadow-xl">
              <div className="p-2 space-y-1">
                {DIMENSION_UNITS.map((unit) => (
                  <button
                    key={unit.value}
                    type="button"
                    onClick={() => {
                      updateField("dimensions_unit", unit.value);
                      setUnitOpen(false);
                    }}
                    className={`w-full px-4 py-3 rounded-xl text-sm text-left transition-all duration-300
                      flex items-center gap-3
                      ${shipping.dimensions_unit === unit.value
                        ? "bg-gradient-to-br from-purple-primary/10 to-pink-vivid/5 text-purple-primary"
                        : "hover:bg-gray-50"
                      }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
                        ${shipping.dimensions_unit === unit.value
                          ? "bg-gradient-to-r from-purple-primary to-pink-vivid border-purple-primary"
                          : "border-gray-300"
                        }`}
                    >
                      {shipping.dimensions_unit === unit.value && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="font-medium">{unit.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {unitOpen && (
            <div className="fixed inset-0 z-10" onClick={() => setUnitOpen(false)} />
          )}
        </div>
      </div>

      {/* Dimension inputs */}
      <div className="grid grid-cols-2 gap-4">
        {/* Height */}
        <div>
          <label className="block text-sm font-ui font-medium text-ink mb-2">
            Height
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={shipping.height || ""}
            onChange={(e) =>
              updateField("height", e.target.value ? parseFloat(e.target.value) : undefined)
            }
            placeholder="0"
            className="w-full px-5 py-4 rounded-2xl
              bg-white/60 backdrop-blur-sm border border-gray-200/50
              focus:border-purple-primary/40 focus:bg-white focus:shadow-lg
              outline-none transition-all duration-300 font-body"
          />
        </div>

        {/* Width */}
        <div>
          <label className="block text-sm font-ui font-medium text-ink mb-2">
            Width
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={shipping.width || ""}
            onChange={(e) =>
              updateField("width", e.target.value ? parseFloat(e.target.value) : undefined)
            }
            placeholder="0"
            className="w-full px-5 py-4 rounded-2xl
              bg-white/60 backdrop-blur-sm border border-gray-200/50
              focus:border-purple-primary/40 focus:bg-white focus:shadow-lg
              outline-none transition-all duration-300 font-body"
          />
        </div>

        {/* Thickness */}
        <div>
          <label className="block text-sm font-ui font-medium text-ink mb-2">
            Thickness
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={shipping.thickness || ""}
            onChange={(e) =>
              updateField("thickness", e.target.value ? parseFloat(e.target.value) : undefined)
            }
            placeholder="0"
            className="w-full px-5 py-4 rounded-2xl
              bg-white/60 backdrop-blur-sm border border-gray-200/50
              focus:border-purple-primary/40 focus:bg-white focus:shadow-lg
              outline-none transition-all duration-300 font-body"
          />
        </div>

        {/* Weight */}
        <div>
          <label className="block text-sm font-ui font-medium text-ink mb-2">
            Weight
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              value={shipping.weight || ""}
              onChange={(e) =>
                updateField("weight", e.target.value ? parseFloat(e.target.value) : undefined)
              }
              placeholder="0"
              className="w-full px-5 py-4 pr-14 rounded-2xl
                bg-white/60 backdrop-blur-sm border border-gray-200/50
                focus:border-purple-primary/40 focus:bg-white focus:shadow-lg
                outline-none transition-all duration-300 font-body"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm font-ui">
              {shipping.weight_unit || "kg"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
