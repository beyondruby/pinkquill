"use client";

import { CategoryField } from "@/lib/store/categories";

interface BooleanFieldProps {
  field: CategoryField;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}

export default function BooleanField({ field, value, onChange }: BooleanFieldProps) {
  return (
    <div>
      <label className="block text-sm font-ui font-medium text-ink mb-3">
        {field.label}
        {field.required && <span className="text-pink-vivid ml-1">*</span>}
      </label>

      {/* Toggle switch style */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl transition-all duration-300
            ${value === true
              ? "bg-gradient-to-br from-purple-primary/10 via-pink-vivid/5 to-transparent border-2 border-purple-primary/30 shadow-md shadow-purple-primary/5"
              : "bg-white/50 backdrop-blur-sm border border-gray-200/50 hover:border-purple-primary/20 hover:bg-white/70"
            }`}
        >
          <span
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300
              ${value === true
                ? "border-purple-primary bg-gradient-to-r from-purple-primary to-pink-vivid"
                : "border-gray-300"
              }`}
          >
            {value === true && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          <span className={`text-sm font-ui font-medium ${value === true ? "text-purple-primary" : "text-gray-500"}`}>
            Yes
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl transition-all duration-300
            ${value === false
              ? "bg-gradient-to-br from-purple-primary/10 via-pink-vivid/5 to-transparent border-2 border-purple-primary/30 shadow-md shadow-purple-primary/5"
              : "bg-white/50 backdrop-blur-sm border border-gray-200/50 hover:border-purple-primary/20 hover:bg-white/70"
            }`}
        >
          <span
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300
              ${value === false
                ? "border-purple-primary bg-gradient-to-r from-purple-primary to-pink-vivid"
                : "border-gray-300"
              }`}
          >
            {value === false && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          <span className={`text-sm font-ui font-medium ${value === false ? "text-purple-primary" : "text-gray-500"}`}>
            No
          </span>
        </button>
      </div>

      {field.helpText && (
        <p className="text-xs text-muted mt-3">{field.helpText}</p>
      )}
    </div>
  );
}
