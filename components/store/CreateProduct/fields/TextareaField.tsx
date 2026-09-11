"use client";

import { CategoryField } from "@/lib/store/categories";
import { INPUT, Help, Label } from "@/components/listing/form";

interface TextareaFieldProps {
  field: CategoryField;
  value: string;
  onChange: (value: string) => void;
}

export default function TextareaField({ field, value, onChange }: TextareaFieldProps) {
  const maxLength = field.validation?.maxLength || 2000;
  return (
    <div>
      <Label text={field.label} required={field.required} htmlFor={`f-${field.key}`} right={`${value.length}/${maxLength}`} />
      <textarea id={`f-${field.key}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} maxLength={maxLength} rows={4} className={INPUT} />
      {field.helpText && <Help>{field.helpText}</Help>}
    </div>
  );
}
