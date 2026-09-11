"use client";

import Image from "next/image";
import { ProductWizardState } from "@/lib/types/store";
import { CategoryConfig, getSubcategoryLabel } from "@/lib/store/categories";
import { formatCurrency } from "@/lib/utils/currency";
import { isVideoMedia } from "@/components/listing/MediaPicker";
import Button from "@/components/ui/Button";

interface PreviewStepProps {
  wizardState: ProductWizardState;
  categoryConfig: CategoryConfig;
  isLive: boolean;
}

interface PriceLine { label: string; price: number; min: number | null }

export function priceLines(s: ProductWizardState, config: CategoryConfig): PriceLine[] {
  const lines: PriceLine[] = [];
  if (s.sellOriginal && s.originalPrice !== null) lines.push({ label: "Original", price: s.originalPrice, min: s.originalMin });
  if (s.hasReproductions) s.reproductions.forEach((r) => lines.push({ label: config.pricingOptions.reproduction?.types.find((t) => t.value === r.type)?.label || r.type, price: r.price, min: r.min }));
  if (s.hasDigitalDownload && s.digitalPrice !== null) lines.push({ label: config.pricingOptions.digital?.formats.find((f) => f.value === s.digitalFormat)?.label || "Digital download", price: s.digitalPrice, min: s.digitalMin });
  return lines;
}

export default function PreviewStep({ wizardState: s, categoryConfig, isLive }: PreviewStepProps) {
  const cover = s.mediaPreviews.find((m) => m.isPrimary) ?? s.mediaPreviews[0];
  const others = s.mediaPreviews.filter((m) => m !== cover).slice(0, 2);
  const lines = priceLines(s, categoryConfig);
  const from = lines.length ? Math.min(...lines.map((l) => (l.min !== null && l.min < l.price ? l.min : l.price))) : null;
  const category = [categoryConfig.name, s.subcategory ? getSubcategoryLabel(categoryConfig.id, s.subcategory) : null].filter(Boolean).join(" · ");
  const shipping = s.deliveryType !== "digital"
    ? [s.shipping.shipping_locations?.length ? `Ships to ${s.shipping.shipping_locations.join(", ")}` : null, s.shipping.shipping_cost ? `${formatCurrency(s.shipping.shipping_cost)} shipping` : "Free shipping", s.shipping.processing_days ? `${s.shipping.processing_days}-day processing` : null].filter(Boolean).join(" · ")
    : "Instant download after payment";

  const tile = (m: ProductWizardState["mediaPreviews"][number] | undefined, cls: string) => (
    <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 ${cls}`}>
      {m && (isVideoMedia(m) ? <video src={m.url} muted playsInline className="absolute inset-0 w-full h-full object-cover" /> : <Image src={m.url} alt="" fill unoptimized className="object-cover" sizes="600px" />)}
    </div>
  );

  return (
    <>
      <div className="rounded-2xl border border-border-light bg-subtle px-4 py-3 text-sm font-body text-muted">
        {isLive ? "This is your listing as buyers see it. Save changes to update it." : "This is your listing as buyers will see it. Nothing is live until you publish."}
        {from !== null ? ` From ${formatCurrency(from)}.` : ""}
      </div>
      <div className="rounded-2xl border border-border-light bg-surface p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-6">
        <div>
          <div className="grid grid-cols-4 grid-rows-2 gap-2 aspect-[16/9]">
            {tile(cover, "col-span-3 row-span-2")}
            {tile(others[0], "")}
            {tile(others[1], "")}
          </div>
          <p className="text-xs font-ui text-muted mt-4">{category}{s.yearCreated ? ` · ${s.yearCreated}` : ""}</p>
          <h3 className="font-display text-xl font-semibold text-ink mt-1">{s.title || "Untitled piece"}</h3>
          {s.description && <p className="mt-3 text-sm font-body text-ink/90 whitespace-pre-line line-clamp-5">{s.description}</p>}
          <p className="mt-3 text-sm font-body text-muted">{shipping}</p>
          {s.keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">{s.keywords.map((k) => <span key={k} className="px-2.5 py-1 rounded-full bg-subtle text-xs font-ui text-muted">#{k}</span>)}</div>
          )}
        </div>
        <aside>
          <div className="space-y-2">
            {lines.length === 0 && <p className="text-sm font-body text-muted">No prices set yet.</p>}
            {lines.map((l, i) => (
              <div key={l.label} className={`rounded-2xl border p-3 ${i === 0 ? "border-purple-primary bg-purple-50/60" : "border-border-light"}`}>
                <div className="flex justify-between gap-3"><span className="text-sm font-ui font-semibold text-ink">{l.label}</span><span className="font-display font-semibold text-ink tabular-nums">{formatCurrency(l.price)}</span></div>
                {l.min !== null && l.min < l.price && <p className="text-2xs font-body text-muted">Pay what you want · from {formatCurrency(l.min)}</p>}
              </div>
            ))}
          </div>
          <div className="mt-3"><Button fullWidth disabled>{lines.length ? `Buy · ${formatCurrency(lines[0].price)}` : "Buy"}</Button></div>
        </aside>
      </div>
    </>
  );
}
