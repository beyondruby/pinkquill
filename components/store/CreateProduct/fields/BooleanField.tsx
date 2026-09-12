"use client";

import formStyles from "@/components/ui/CreationForm.module.css";
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

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(true)}
          aria-pressed={value === true}
          className={`${formStyles.choice} flex items-center gap-2.5 px-5 py-3 rounded-xl transition-colors duration-200`}
        >
          <div
            className={`
              w-5 h-5 rounded-full flex items-center justify-center transition-all
              ${value === true
                ? "bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm"
                : "border border-muted/30"
              }
            `}
          >
            {value === true && (
              <div className="w-2 h-2 rounded-full bg-surface" />
            )}
          </div>
          <span className={`text-sm font-ui ${value === true ? "text-ink font-medium" : "text-ink"}`}>
            Yes
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange(false)}
          aria-pressed={value === false}
          className={`${formStyles.choice} flex items-center gap-2.5 px-5 py-3 rounded-xl transition-colors duration-200`}
        >
          <div
            className={`
              w-5 h-5 rounded-full flex items-center justify-center transition-all
              ${value === false
                ? "bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm"
                : "border border-muted/30"
              }
            `}
          >
            {value === false && (
              <div className="w-2 h-2 rounded-full bg-surface" />
            )}
          </div>
          <span className={`text-sm font-ui ${value === false ? "text-ink font-medium" : "text-ink"}`}>
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
