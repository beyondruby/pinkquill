"use client";

import { CategoryField } from "@/lib/store/categories";

interface TextareaFieldProps {
  field: CategoryField;
  value: string;
  onChange: (value: string) => void;
}

export default function TextareaField({ field, value, onChange }: TextareaFieldProps) {
  const maxLength = field.validation?.maxLength || 2000;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-3 text-purple-primary">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </span>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={maxLength}
          rows={4}
          className="w-full pl-10 pr-4 py-3 border border-orange-200 rounded-xl
            focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
            transition-all resize-none"
        />
      </div>
      <div className="flex justify-between mt-1">
        {field.helpText && (
          <p className="text-xs text-muted">{field.helpText}</p>
        )}
        <p className="text-xs text-muted ml-auto">
          {value.length} / {maxLength}
        </p>
      </div>
    </div>
  );
}
