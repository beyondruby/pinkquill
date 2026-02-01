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
    <div className="space-y-4">
      {/* Length unit selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Length unit
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setUnitOpen(!unitOpen)}
            className="w-48 px-4 py-3 border border-orange-200 rounded-xl bg-white
              focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
              transition-all text-left flex items-center justify-between"
          >
            <span className="text-gray-900">
              {DIMENSION_UNITS.find((u) => u.value === shipping.dimensions_unit)?.label || "Select"}
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${unitOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {unitOpen && (
            <div className="absolute z-20 w-48 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg">
              <div className="p-2 space-y-1">
                {DIMENSION_UNITS.map((unit) => (
                  <button
                    key={unit.value}
                    type="button"
                    onClick={() => {
                      updateField("dimensions_unit", unit.value);
                      setUnitOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-sm text-left transition-colors
                      flex items-center gap-2
                      ${shipping.dimensions_unit === unit.value
                        ? "bg-purple-50 text-purple-primary"
                        : "hover:bg-gray-50"
                      }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center
                        ${shipping.dimensions_unit === unit.value
                          ? "bg-purple-primary border-purple-primary"
                          : "border-gray-300"
                        }`}
                    >
                      {shipping.dimensions_unit === unit.value && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {unit.label}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Height
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-primary">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={shipping.height || ""}
              onChange={(e) =>
                updateField("height", e.target.value ? parseFloat(e.target.value) : undefined)
              }
              placeholder="0"
              className="w-full pl-10 pr-4 py-3 border border-orange-200 rounded-xl
                focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
                transition-all"
            />
          </div>
        </div>

        {/* Width */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Width
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-primary">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={shipping.width || ""}
              onChange={(e) =>
                updateField("width", e.target.value ? parseFloat(e.target.value) : undefined)
              }
              placeholder="0"
              className="w-full pl-10 pr-4 py-3 border border-orange-200 rounded-xl
                focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
                transition-all"
            />
          </div>
        </div>

        {/* Thickness */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Thickness
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-primary">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={shipping.thickness || ""}
              onChange={(e) =>
                updateField("thickness", e.target.value ? parseFloat(e.target.value) : undefined)
              }
              placeholder="0"
              className="w-full pl-10 pr-4 py-3 border border-orange-200 rounded-xl
                focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
                transition-all"
            />
          </div>
        </div>

        {/* Weight */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Weight
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-primary">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={shipping.weight || ""}
              onChange={(e) =>
                updateField("weight", e.target.value ? parseFloat(e.target.value) : undefined)
              }
              placeholder="0"
              className="w-full pl-10 pr-12 py-3 border border-orange-200 rounded-xl
                focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
                transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {shipping.weight_unit || "kg"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
