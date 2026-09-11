"use client";

import { CreateShippingData, DimensionsUnit } from "@/lib/types/store";
import { ChipChoice, Label, UnitInput } from "@/components/listing/form";

interface DimensionsFieldProps {
  shipping: CreateShippingData;
  onChange: (shipping: CreateShippingData) => void;
}

const UNITS: Array<{ value: DimensionsUnit; label: string }> = [
  { value: "cm", label: "cm" },
  { value: "inches", label: "in" },
];

export default function DimensionsField({ shipping, onChange }: DimensionsFieldProps) {
  const set = (key: keyof CreateShippingData, value: unknown) => onChange({ ...shipping, [key]: value });
  const unit = shipping.dimensions_unit === "inches" ? "in" : "cm";
  return (
    <div className="space-y-4">
      <div>
        <Label text="Unit" />
        <ChipChoice options={UNITS} value={shipping.dimensions_unit || "cm"} onChange={(v) => set("dimensions_unit", v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label text="Height" htmlFor="dim-h" /><UnitInput id="dim-h" value={shipping.height} onChange={(v) => set("height", v)} unit={unit} /></div>
        <div><Label text="Width" htmlFor="dim-w" /><UnitInput id="dim-w" value={shipping.width} onChange={(v) => set("width", v)} unit={unit} /></div>
        <div><Label text="Thickness" htmlFor="dim-t" /><UnitInput id="dim-t" value={shipping.thickness} onChange={(v) => set("thickness", v)} unit={unit} /></div>
        <div><Label text="Weight" htmlFor="dim-kg" /><UnitInput id="dim-kg" value={shipping.weight} onChange={(v) => set("weight", v)} unit={shipping.weight_unit || "kg"} step={0.01} /></div>
      </div>
    </div>
  );
}
