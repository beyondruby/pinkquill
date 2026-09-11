"use client";

import { ProductDelivery } from "@/lib/types/store";
import { getAllCategories, getCategoriesByDelivery, getCategoryConfig, getCategoryIcon } from "@/lib/store/categories";
import { ChipChoice, ChoiceTile } from "@/components/listing/form";

interface TypeStepProps {
  deliveryType: ProductDelivery | null;
  category: string | null;
  subcategory: string | null;
  onDeliveryChange: (v: ProductDelivery) => void;
  onCategoryChange: (v: string) => void;
  onSubcategoryChange: (v: string | null) => void;
}

const DELIVERY: Array<{ value: ProductDelivery; label: string; hint: string; icon: React.ReactNode }> = [
  {
    value: "physical", label: "Physical", hint: "Ships to the buyer",
    icon: <svg className="w-11 h-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  },
  {
    value: "digital", label: "Digital", hint: "Instant download",
    icon: <svg className="w-11 h-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>,
  },
];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-center text-sm font-ui font-medium text-ink">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Delivery, category and specialization on one screen, revealed as each is chosen. */
export default function TypeStep({ deliveryType, category, subcategory, onDeliveryChange, onCategoryChange, onSubcategoryChange }: TypeStepProps) {
  const categories = deliveryType === "both" ? getAllCategories() : deliveryType ? getCategoriesByDelivery(deliveryType) : [];
  const config = category ? getCategoryConfig(category) : undefined;

  return (
    <div className="space-y-12 py-2">
      <Group title="How does it reach the buyer?">
        <div className="flex justify-center gap-6 sm:gap-14">
          {DELIVERY.map((o) => (
            <ChoiceTile key={o.value} size="lg" icon={o.icon} label={o.label} hint={o.hint} selected={deliveryType === o.value} onClick={() => onDeliveryChange(o.value)} />
          ))}
        </div>
      </Group>

      {deliveryType && (
        <Group title="What kind of work is it?">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
            {categories.map((c) => (
              <ChoiceTile key={c.id} icon={<span className="scale-110">{getCategoryIcon(c.icon)}</span>} label={c.name} selected={category === c.id} onClick={() => onCategoryChange(c.id)} />
            ))}
          </div>
        </Group>
      )}

      {config && config.subcategories.length > 0 && (
        <Group title="More specifically (optional)">
          <div className="flex justify-center">
            <ChipChoice options={config.subcategories.map((s) => ({ value: s.value, label: s.label }))} value={subcategory} onChange={(v) => onSubcategoryChange(v === subcategory ? null : v)} />
          </div>
        </Group>
      )}
    </div>
  );
}
