"use client";

import { CategoryField } from "@/lib/store/categories";
import { INPUT, Help, Label } from "@/components/listing/form";

interface TextFieldProps {
  field: CategoryField;
  value: string;
  onChange: (value: string) => void;
}

export default function TextField({ field, value, onChange }: TextFieldProps) {
  return (
    <div>
      <Label text={field.label} required={field.required} htmlFor={`f-${field.key}`} />
      <input id={`f-${field.key}`} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} maxLength={field.validation?.maxLength} className={INPUT} />
      {field.helpText && <Help>{field.helpText}</Help>}
    </div>
  );
}
