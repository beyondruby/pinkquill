"use client";

import { CategoryField } from "@/lib/store/categories";

interface TextFieldProps {
  field: CategoryField;
  value: string;
  onChange: (value: string) => void;
}

export default function TextField({ field, value, onChange }: TextFieldProps) {
  return (
    <div>
      <label className="block text-sm font-ui font-semibold text-ink mb-3">
        {field.label}
        {field.required && <span className="text-pink-vivid ml-1">*</span>}
      </label>

      {/* Gradient border wrapper */}
      <div className="relative">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm p-[1px]">
          <div className="w-full h-full rounded-xl bg-white" />
        </div>
        <div className="relative flex items-center">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            maxLength={field.validation?.maxLength}
            className="w-full px-4 py-3.5 pr-12 rounded-xl
              bg-transparent
              outline-none transition-all duration-300
              font-body text-ink placeholder:text-muted/60"
          />
          {/* Pencil icon */}
          <div className="absolute right-4 text-orange-warm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
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
