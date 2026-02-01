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
      <label className="block text-sm font-ui font-medium text-ink mb-2">
        {field.label}
        {field.required && <span className="text-pink-vivid ml-1">*</span>}
      </label>
      <div className="relative w-48 group">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-primary/60 group-focus-within:text-purple-primary transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        </span>
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
          className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl bg-white
            focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
            transition-all font-body placeholder:text-gray-400
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      {field.helpText && (
        <p className="text-xs text-muted mt-1.5 pl-1">{field.helpText}</p>
      )}
    </div>
  );
}
