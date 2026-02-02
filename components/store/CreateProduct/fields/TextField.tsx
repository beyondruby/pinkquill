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
      <label className="block text-sm font-ui font-medium text-ink mb-2">
        {field.label}
        {field.required && <span className="text-pink-vivid ml-1">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        maxLength={field.validation?.maxLength}
        className="w-full px-5 py-4 rounded-2xl
          bg-white/60 backdrop-blur-sm border border-gray-200/50
          focus:border-purple-primary/40 focus:bg-white focus:shadow-lg focus:shadow-purple-primary/5
          outline-none transition-all duration-300
          font-body text-ink placeholder:text-gray-400"
      />
      {field.helpText && (
        <p className="text-xs text-muted mt-2">{field.helpText}</p>
      )}
    </div>
  );
}
