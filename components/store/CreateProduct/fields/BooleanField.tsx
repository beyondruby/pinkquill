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

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`
            flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all duration-200
            ${value === true
              ? "bg-purple-primary/10 ring-2 ring-purple-primary/30"
              : "bg-white/50 ring-1 ring-gray-200/50 hover:ring-purple-primary/20"
            }
          `}
        >
          <div
            className={`
              w-4 h-4 rounded-full flex items-center justify-center transition-all
              ${value === true
                ? "bg-gradient-to-r from-purple-primary to-pink-vivid"
                : "ring-2 ring-gray-300"
              }
            `}
          >
            {value === true && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className={`text-sm font-ui ${value === true ? "text-purple-primary font-medium" : "text-muted"}`}>
            Yes
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange(false)}
          className={`
            flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all duration-200
            ${value === false
              ? "bg-purple-primary/10 ring-2 ring-purple-primary/30"
              : "bg-white/50 ring-1 ring-gray-200/50 hover:ring-purple-primary/20"
            }
          `}
        >
          <div
            className={`
              w-4 h-4 rounded-full flex items-center justify-center transition-all
              ${value === false
                ? "bg-gradient-to-r from-purple-primary to-pink-vivid"
                : "ring-2 ring-gray-300"
              }
            `}
          >
            {value === false && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className={`text-sm font-ui ${value === false ? "text-purple-primary font-medium" : "text-muted"}`}>
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
