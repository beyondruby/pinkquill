"use client";

import { useState } from "react";
import { CategoryField } from "@/lib/store/categories";
import { ChipMulti, INPUT, Help, Label } from "@/components/listing/form";
import Button from "@/components/ui/Button";

interface MultiSelectFieldProps {
  field: CategoryField;
  value: string[];
  onChange: (value: string[]) => void;
}

/** Options as toggle chips; custom values (when allowed) become extra chips. */
export default function MultiSelectField({ field, value, onChange }: MultiSelectFieldProps) {
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const options = field.options || [];
  const extras = value.filter((v) => !options.some((o) => o.value === v)).map((v) => ({ value: v, label: v }));

  const addCustom = () => {
    const trimmed = custom.trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setCustom("");
    setShowCustom(false);
  };

  return (
    <div>
      <Label text={field.label} required={field.required} />
      <ChipMulti options={[...options, ...extras]} value={value} onChange={onChange} />
      {field.allowCustom && (
        showCustom ? (
          <div className="mt-2 flex gap-2 sm:max-w-sm">
            <input autoFocus value={custom} placeholder="Something else…" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} className={INPUT} />
            <Button size="sm" variant="secondary" onClick={addCustom}>Add</Button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowCustom(true)} className="mt-2 text-xs font-ui font-semibold text-purple-primary hover:underline">+ Add your own</button>
        )
      )}
      {field.helpText && <Help>{field.helpText}</Help>}
    </div>
  );
}
