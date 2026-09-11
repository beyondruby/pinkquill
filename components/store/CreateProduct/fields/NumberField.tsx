"use client";

import { CategoryField } from "@/lib/store/categories";

interface NumberFieldProps {
  field: CategoryField;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

export default function NumberField({ field, value, onChange }: NumberFieldProps) {
  return (
    <div>
      <label className="block text-sm font-ui font-semibold text-ink mb-3">
        {field.label}
        {field.required && <span className="text-pink-vivid ml-1">*</span>}
      </label>

      {/* Gradient border wrapper */}
      <div className="relative w-48">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm p-[1px]">
          <div className="w-full h-full rounded-xl bg-surface" />
        </div>
        <div className="relative flex items-center">
          <input
            type="number"
            value={value ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              onChange(val === "" ? undefined : parseFloat(val));
            }}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            className="w-full px-4 py-3.5 pr-12 rounded-xl
              bg-transparent
              outline-none transition-all duration-300
              font-body text-ink placeholder:text-muted/60
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {/* Number icon */}
          <div className="absolute right-4 text-orange-warm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </div>
        </div>
      </div>

      {field.helpText && (
        <p className="text-xs text-muted mt-2">{field.helpText}</p>
      )}
    </div>
  );
}
