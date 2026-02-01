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
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-primary">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.validation?.maxLength}
          className="w-full pl-10 pr-4 py-3 border border-orange-200 rounded-xl
            focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
            transition-all"
        />
      </div>
      {field.helpText && (
        <p className="text-xs text-muted mt-1">{field.helpText}</p>
      )}
    </div>
  );
}
