"use client";

import { ProductDelivery, ProductWizardState } from "@/lib/types/store";
import { CategoryConfig } from "@/lib/store/categories";
import { formatCurrency } from "@/lib/utils/currency";
import { Check, CheckRow, ChipMulti, Help, Label, PriceInput, Section, Select, TagList, UnitInput } from "@/components/listing/form";
import DimensionsField from "../fields/DimensionsField";

interface PricingStepProps {
  deliveryType: ProductDelivery;
  categoryConfig: CategoryConfig;
  wizardState: ProductWizardState;
  updateState: (updates: Partial<ProductWizardState>) => void;
}

const PACKAGING = [
  { value: "box", label: "Box" }, { value: "wood_crate", label: "Wood crate" }, { value: "tube", label: "Tube" },
  { value: "envelope", label: "Envelope" }, { value: "padded_envelope", label: "Padded envelope" }, { value: "custom", label: "Custom" },
];

/** One price row: suggested price, plus an optional "name your price" floor. */
function PriceRow({ id, label, price, min, onPrice, onMin }: { id: string; label: string; price: number | null; min: number | null; onPrice: (v: number | null) => void; onMin: (v: number | null) => void }) {
  const pwyw = min !== null;
  return (
    <div className="rounded-2xl bg-subtle/70 p-4 sm:p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label text={pwyw ? `${label} · suggested price` : `${label} price`} required htmlFor={id} />
          <PriceInput id={id} value={price} onChange={onPrice} />
        </div>
        {pwyw && (
          <div>
            <Label text="Minimum they must pay" htmlFor={`${id}-min`} />
            <PriceInput id={`${id}-min`} value={min} onChange={(v) => onMin(v === null ? 0 : Math.max(0, v))} placeholder="0.00" />
            {min === 0 && <Help>Buyers can take this for free.</Help>}
            {min !== null && price !== null && min > price && <p className="text-2xs font-body text-red-600 mt-1">The minimum can&apos;t exceed the suggested price.</p>}
          </div>
        )}
      </div>
      <Check size="sm" checked={pwyw} onChange={(v) => onMin(v ? 0 : null)} label="Let buyers name their own price" />
    </div>
  );
}

export default function PricingStep({ deliveryType, categoryConfig, wizardState, updateState }: PricingStepProps) {
  const { pricingOptions } = categoryConfig;
  const s = wizardState;
  const setShipping = (patch: Partial<ProductWizardState["shipping"]>) => updateState({ shipping: { ...s.shipping, ...patch } });
  const physical = deliveryType !== "digital";

  return (
    <>
      <Section title="Pricing" description={`Pinkquill keeps 5%; you receive the rest. Set as ${formatCurrency(0)} to give it away.`}>
        <div className="space-y-2">
          {physical && pricingOptions.original && (
            <div className="py-1">
              <CheckRow label="Sell the original piece" hint="One of a kind; marked sold after the first order." checked={s.sellOriginal} onChange={(v) => updateState({ sellOriginal: v })} />
              {s.sellOriginal && <div className="pb-2 pl-8"><PriceRow id="price-original" label="Original" price={s.originalPrice} min={s.originalMin} onPrice={(v) => updateState({ originalPrice: v })} onMin={(v) => updateState({ originalMin: v })} /></div>}
            </div>
          )}

          {pricingOptions.reproduction && (
            <div className="py-1">
              <CheckRow label="Offer reproductions" hint="Prints or copies, each with its own price." checked={s.hasReproductions} onChange={(v) => updateState({ hasReproductions: v })} />
              {s.hasReproductions && (
                <div className="pb-2 pl-8 space-y-4">
                  <div>
                    <Label text="Types" />
                    <ChipMulti
                      options={pricingOptions.reproduction.types}
                      value={s.reproductions.map((r) => r.type)}
                      onChange={(types) => updateState({ reproductions: types.map((type) => s.reproductions.find((r) => r.type === type) || { type, price: 0, min: null }) })}
                    />
                  </div>
                  {s.reproductions.map((rep, index) => (
                    <PriceRow
                      key={rep.type}
                      id={`price-rep-${index}`}
                      label={pricingOptions.reproduction!.types.find((t) => t.value === rep.type)?.label || rep.type}
                      price={rep.price}
                      min={rep.min}
                      onPrice={(v) => { const next = [...s.reproductions]; next[index] = { ...rep, price: v ?? 0 }; updateState({ reproductions: next }); }}
                      onMin={(v) => { const next = [...s.reproductions]; next[index] = { ...rep, min: v }; updateState({ reproductions: next }); }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {pricingOptions.digital && (deliveryType === "digital" || deliveryType === "both") && (
            <div className="py-1">
              <CheckRow label="Digital download" hint="Buyers get the files right after paying." checked={s.hasDigitalDownload} onChange={(v) => updateState({ hasDigitalDownload: v })} />
              {s.hasDigitalDownload && (
                <div className="pb-2 pl-8 space-y-4">
                  <div className="sm:max-w-xs">
                    <Label text="Format" htmlFor="digital-format" />
                    <Select id="digital-format" value={s.digitalFormat || ""} onChange={(e) => updateState({ digitalFormat: e.target.value || null })}>
                      <option value="">Select…</option>
                      {pricingOptions.digital.formats.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </Select>
                  </div>
                  <PriceRow id="price-digital" label="Download" price={s.digitalPrice} min={s.digitalMin} onPrice={(v) => updateState({ digitalPrice: v })} onMin={(v) => updateState({ digitalMin: v })} />
                </div>
              )}
            </div>
          )}
        </div>
      </Section>

      {physical && (
        <>
          <Section title="Size and weight" description="Helps buyers picture it and you price the postage.">
            <DimensionsField shipping={s.shipping} onChange={(shipping) => updateState({ shipping })} />
          </Section>
          <Section title="Shipping">
            <div className="space-y-4">
              <div>
                <Label text="Carriers" />
                <TagList values={s.shipping.shipping_services || []} onChange={(shipping_services) => setShipping({ shipping_services })} placeholder="DHL, FedEx, UPS…" max={10} />
              </div>
              <div>
                <Label text="Ships to" />
                <TagList values={s.shipping.shipping_locations || []} onChange={(shipping_locations) => setShipping({ shipping_locations })} placeholder="United States, Canada, International…" max={20} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label text="Packaging" htmlFor="packaging" />
                  <Select id="packaging" value={s.shipping.packaging || ""} onChange={(e) => setShipping({ packaging: e.target.value || undefined })}>
                    <option value="">Select…</option>
                    {PACKAGING.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </Select>
                </div>
                <div>
                  <Label text="Shipping price" htmlFor="ship-cost" />
                  <PriceInput id="ship-cost" value={s.shipping.shipping_cost ?? 0} onChange={(v) => setShipping({ shipping_cost: v ?? 0 })} />
                </div>
                <div>
                  <Label text="Processing time" htmlFor="ship-days" />
                  <UnitInput id="ship-days" value={s.shipping.processing_days} onChange={(v) => setShipping({ processing_days: v === undefined ? undefined : Math.max(0, Math.round(v)) })} unit="days" placeholder="3" step={1} />
                </div>
              </div>
            </div>
          </Section>
        </>
      )}
    </>
  );
}
