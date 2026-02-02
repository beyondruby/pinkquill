"use client";

import { useState } from "react";
import { CreateShippingData, DimensionsUnit, WeightUnit } from "@/lib/types/store";

interface DimensionsFieldProps {
  shipping: CreateShippingData;
  onChange: (shipping: CreateShippingData) => void;
}

const DIMENSION_UNITS: { value: DimensionsUnit; label: string }[] = [
  { value: "cm", label: "cm" },
  { value: "inches", label: "in" },
];

const WEIGHT_UNITS: { value: WeightUnit; label: string }[] = [
  { value: "kg", label: "kg" },
  { value: "lbs", label: "lbs" },
];

export default function DimensionsField({ shipping, onChange }: DimensionsFieldProps) {
  const updateField = (key: keyof CreateShippingData, value: unknown) => {
    onChange({ ...shipping, [key]: value });
  };

  return (
    <div className="space-y-5">
      {/* Unit selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted font-body">Unit:</span>
        <div className="flex gap-2">
          {DIMENSION_UNITS.map((unit) => (
            <button
              key={unit.value}
              type="button"
              onClick={() => updateField("dimensions_unit", unit.value)}
              className={`
                px-4 py-2 rounded-xl text-sm font-ui transition-all duration-200
                ${shipping.dimensions_unit === unit.value
                  ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white"
                  : "bg-white/50 text-muted ring-1 ring-gray-200/50 hover:ring-purple-primary/20"
                }
              `}
            >
              {unit.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dimension inputs */}
      <div className="grid grid-cols-2 gap-4">
        <DimensionInput
          label="Height"
          value={shipping.height}
          onChange={(v) => updateField("height", v)}
          unit={shipping.dimensions_unit || "cm"}
        />
        <DimensionInput
          label="Width"
          value={shipping.width}
          onChange={(v) => updateField("width", v)}
          unit={shipping.dimensions_unit || "cm"}
        />
        <DimensionInput
          label="Thickness"
          value={shipping.thickness}
          onChange={(v) => updateField("thickness", v)}
          unit={shipping.dimensions_unit || "cm"}
        />

        {/* Weight */}
        <div>
          <label className="block text-sm font-ui text-muted mb-2">Weight</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              value={shipping.weight || ""}
              onChange={(e) => updateField("weight", e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="0"
              className="w-full px-4 py-3 pr-14 rounded-xl
                bg-white/50 ring-1 ring-gray-200/50
                focus:ring-2 focus:ring-purple-primary/30 focus:bg-white
                outline-none transition-all duration-300 font-body
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

function DimensionInput({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  unit: string;
}) {
  return (
    <div>
      <label className="block text-sm font-ui text-muted mb-2">{label}</label>
      <div className="relative">
        <input
          type="number"
          min="0"
          step="0.1"
          value={value || ""}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder="0"
          className="w-full px-4 py-3 pr-12 rounded-xl
            bg-white/50 ring-1 ring-gray-200/50
            focus:ring-2 focus:ring-purple-primary/30 focus:bg-white
            outline-none transition-all duration-300 font-body
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm font-ui">
          {unit}
        </span>
      </div>
    </div>
  );
}
