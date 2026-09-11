"use client";

import { CategoryField } from "@/lib/store/categories";
import { ChipChoice, Help, Label } from "@/components/listing/form";

interface BooleanFieldProps {
  field: CategoryField;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}

export default function BooleanField({ field, value, onChange }: BooleanFieldProps) {
  const current = value === true ? "yes" : value === false ? "no" : null;
  return (
    <div>
      <Label text={field.label} required={field.required} />
      <ChipChoice options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} value={current} onChange={(v) => onChange(v === "yes")} />
      {field.helpText && <Help>{field.helpText}</Help>}
    </div>
  );
}
