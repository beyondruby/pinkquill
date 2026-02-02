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
      <label className="block text-sm font-ui font-semibold text-ink mb-3">
        {field.label}
        {field.required && <span className="text-pink-vivid ml-1">*</span>}
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`
            flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all duration-200
            border-2
            ${value === true
              ? "border-pink-vivid bg-pink-vivid/5"
              : "border-gray-200 bg-white hover:border-pink-vivid/30"
            }
          `}
        >
          <div
            className={`
              w-5 h-5 rounded-full flex items-center justify-center transition-all
              ${value === true
                ? "bg-gradient-to-r from-orange-warm to-pink-vivid"
                : "border-2 border-gray-300"
              }
            `}
          >
            {value === true && (
              <div className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>
          <span className={`text-sm font-ui ${value === true ? "text-pink-vivid font-medium" : "text-muted"}`}>
            Yes
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange(false)}
          className={`
            flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all duration-200
            border-2
            ${value === false
              ? "border-pink-vivid bg-pink-vivid/5"
              : "border-gray-200 bg-white hover:border-pink-vivid/30"
            }
          `}
        >
          <div
            className={`
              w-5 h-5 rounded-full flex items-center justify-center transition-all
              ${value === false
                ? "bg-gradient-to-r from-orange-warm to-pink-vivid"
                : "border-2 border-gray-300"
              }
            `}
          >
            {value === false && (
              <div className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>
          <span className={`text-sm font-ui ${value === false ? "text-pink-vivid font-medium" : "text-muted"}`}>
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
