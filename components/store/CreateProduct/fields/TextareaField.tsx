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
      <label className="block text-sm font-ui font-medium text-ink mb-2">
        {field.label}
        {field.required && <span className="text-pink-vivid ml-1">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        maxLength={maxLength}
        rows={4}
        className="w-full px-5 py-4 rounded-2xl resize-none
          bg-white/50 ring-1 ring-gray-200/50
          focus:ring-2 focus:ring-purple-primary/30 focus:bg-white
          outline-none transition-all duration-300
          font-body text-ink placeholder:text-gray-400"
      />
      <div className="flex justify-between mt-2">
        {field.helpText && (
          <p className="text-xs text-muted">{field.helpText}</p>
        )}
        <p className={`text-xs font-ui font-medium ml-auto ${value.length > maxLength * 0.9 ? 'text-orange-warm' : 'text-muted'}`}>
          {value.length} / {maxLength}
        </p>
      </div>
    </div>
  );
}
