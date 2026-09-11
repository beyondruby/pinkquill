"use client";

import { CategoryField } from "@/lib/store/categories";
import { Help, Label, Select } from "@/components/listing/form";

interface SelectFieldProps {
  field: CategoryField;
  value: string;
  onChange: (value: string) => void;
}

export default function SelectField({ field, value, onChange }: SelectFieldProps) {
  const options = field.options || [];
  return (
    <div>
      <Label text={field.label} required={field.required} htmlFor={`f-${field.key}`} />
      <Select id={`f-${field.key}`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{field.placeholder || "Select…"}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
      {field.helpText && <Help>{field.helpText}</Help>}
    </div>
  );
}
