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

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`
            flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all duration-200
            ${value === true
              ? "bg-gradient-to-r from-purple-primary/10 via-pink-vivid/10 to-orange-warm/10"
              : "bg-white hover:bg-pink-vivid/5"
            }
          `}
          style={{
            border: value === true
              ? "1px solid transparent"
              : "1px solid rgba(255, 0, 127, 0.2)",
            backgroundImage: value === true
              ? "linear-gradient(to right, rgba(142, 68, 173, 0.1), rgba(255, 0, 127, 0.1), rgba(255, 159, 67, 0.1)), linear-gradient(to right, #8e44ad, #ff007f, #ff9f43)"
              : undefined,
            backgroundOrigin: "border-box",
            backgroundClip: value === true ? "padding-box, border-box" : undefined,
          }}
        >
          <div
            className={`
              w-5 h-5 rounded-full flex items-center justify-center transition-all
              ${value === true
                ? "bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm"
                : "border border-pink-vivid/30"
              }
            `}
          >
            {value === true && (
              <div className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>
          <span className={`text-sm font-ui ${value === true ? "text-pink-vivid font-medium" : "text-ink"}`}>
            Yes
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange(false)}
          className={`
            flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all duration-200
            ${value === false
              ? "bg-gradient-to-r from-purple-primary/10 via-pink-vivid/10 to-orange-warm/10"
              : "bg-white hover:bg-pink-vivid/5"
            }
          `}
          style={{
            border: value === false
              ? "1px solid transparent"
              : "1px solid rgba(255, 0, 127, 0.2)",
            backgroundImage: value === false
              ? "linear-gradient(to right, rgba(142, 68, 173, 0.1), rgba(255, 0, 127, 0.1), rgba(255, 159, 67, 0.1)), linear-gradient(to right, #8e44ad, #ff007f, #ff9f43)"
              : undefined,
            backgroundOrigin: "border-box",
            backgroundClip: value === false ? "padding-box, border-box" : undefined,
          }}
        >
          <div
            className={`
              w-5 h-5 rounded-full flex items-center justify-center transition-all
              ${value === false
                ? "bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm"
                : "border border-pink-vivid/30"
              }
            `}
          >
            {value === false && (
              <div className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>
          <span className={`text-sm font-ui ${value === false ? "text-pink-vivid font-medium" : "text-ink"}`}>
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
