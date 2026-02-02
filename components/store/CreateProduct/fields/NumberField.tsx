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
        className="w-56 px-5 py-4 rounded-2xl
          bg-white/60 backdrop-blur-sm border border-gray-200/50
          focus:border-purple-primary/40 focus:bg-white focus:shadow-lg
          outline-none transition-all duration-300
          font-body text-ink placeholder:text-gray-400
          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {field.helpText && (
        <p className="text-xs text-muted mt-2">{field.helpText}</p>
      )}
    </div>
  );
}
