"use client";

import { CategoryField } from "@/lib/store/categories";
import { NUMBER_INPUT, Help, Label } from "@/components/listing/form";

interface NumberFieldProps {
  field: CategoryField;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

export default function NumberField({ field, value, onChange }: NumberFieldProps) {
  return (
    <div>
      <Label text={field.label} required={field.required} htmlFor={`f-${field.key}`} />
      <input
        id={`f-${field.key}`}
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
        placeholder={field.placeholder}
        min={field.validation?.min}
        max={field.validation?.max}
        className={`${NUMBER_INPUT} sm:max-w-xs`}
      />
      {field.helpText && <Help>{field.helpText}</Help>}
    </div>
  );
}
