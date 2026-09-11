"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCreateCommission, useUpdateCommission, type SaveCommissionOptions } from "@/lib/hooks/useCommissions";
import {
  type CommissionPackageFormState,
  type CommissionWizardState,
  type IntakeFieldDraft,
  type Product,
  initialCommissionWizardState,
} from "@/lib/types/store";
import { COMMISSION_CATEGORIES, getAllCommissionCategories, getCommissionSubcategoryLabel } from "@/lib/commissions/categories";
import { formatCurrency } from "@/lib/utils/currency";
import { showToast } from "@/lib/utils/toast";
import Button from "@/components/ui/Button";
import Loading from "@/components/ui/Loading";
import ListingShell, { SignInGate, type ListingHeadline } from "@/components/listing/ListingShell";
import { Check, ChipChoice, Help, INPUT, Label, LineList, Section, TagList } from "@/components/listing/form";
import MediaPicker, { isVideoMedia } from "@/components/listing/MediaPicker";

/**
 * The commission listing wizard (Phase 3f). Six short steps on the shared
 * listing shell, a draft you can leave and come back to, packages with
 * names you choose, the question builder, terms, availability, and a
 * preview of the listing before publishing.
 */

const MAX_MEDIA = 10;
const ACCEPTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const MIN_PACKAGE_PRICE = 5;

const STEPS = ["Basics", "Packages", "Portfolio", "Details", "Availability", "Preview"] as const;
const HEADLINES: ListingHeadline[] = [
  { prefix: "Let's open a", highlight: "commission" },
  { prefix: "Set your", highlight: "packages" },
  { prefix: "Show your", highlight: "work" },
  { prefix: "Add the", highlight: "details" },
  { prefix: "Set your", highlight: "availability" },
  { prefix: "Here's your", highlight: "listing" },
];
type StepIndex = 1 | 2 | 3 | 4 | 5 | 6;

const PACKAGE_PRESETS: Array<{ tier: CommissionPackageFormState["tier"]; name: string }> = [
  { tier: "basic", name: "Basic" },
  { tier: "standard", name: "Standard" },
  { tier: "premium", name: "Premium" },
];

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
}

export function mapProductToCommissionState(product: Product): CommissionWizardState {
  const meta = product.service_metadata && typeof product.service_metadata === "object" ? product.service_metadata : {};
  const requirements = strings(meta.requirements);
  const faqs = Array.isArray(meta.faqs)
    ? meta.faqs
      .filter((item): item is { question: string; answer: string } => !!item && typeof item === "object" && typeof (item as { question?: unknown }).question === "string" && typeof (item as { answer?: unknown }).answer === "string")
      .map((faq) => ({ question: faq.question, answer: faq.answer }))
    : [];
  const packages = (product.pricing || [])
    .filter((pricing) => pricing.pricing_type === "service_package")
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .map((pricing, index) => {
      const packageMeta = pricing.reproduction_options && typeof pricing.reproduction_options === "object" && !Array.isArray(pricing.reproduction_options)
        ? (pricing.reproduction_options as { description?: unknown })
        : {};
      return {
        id: pricing.id,
        pricing_id: pricing.id,
        tier: pricing.package_tier || PACKAGE_PRESETS[index]?.tier || "custom",
        name: pricing.variant_name || PACKAGE_PRESETS[index]?.name || `Package ${index + 1}`,
        description: typeof packageMeta.description === "string" ? packageMeta.description : "",
        price: Number(pricing.price || 0),
        deliveryDays: pricing.delivery_days || 7,
        revisions: pricing.revisions || 0,
        features: strings(pricing.package_features),
      } satisfies CommissionPackageFormState;
    });
  const mediaPreviews = [...(product.media || [])]
    .sort((a, b) => a.position - b.position)
    .map((media) => ({ id: media.id, file: null, url: media.media_url, isPrimary: Boolean(media.is_primary), mediaType: media.media_type }));
  if (mediaPreviews.length > 0 && !mediaPreviews.some((m) => m.isPrimary)) mediaPreviews[0].isPrimary = true;

  return {
    category: product.category || null,
    subcategory: product.subcategory || null,
    title: product.title || "",
    headline: typeof meta.headline === "string" ? meta.headline : "",
    description: product.description || "",
    mediaPreviews,
    packages: packages.length > 0 ? packages : initialCommissionWizardState.packages,
    requirements,
    faqs,
    keywords: Array.isArray(product.keywords) ? product.keywords : [],
    includes: strings(meta.includes),
    excludes: strings(meta.excludes),
    intakeFields: product.intake_fields && product.intake_fields.length > 0
      ? [...product.intake_fields].sort((a, b) => a.position - b.position).map((f) => ({
          id: f.id, key: f.id, label: f.label, help_text: f.help_text ?? "", field_type: f.field_type, options: Array.isArray(f.options) ? f.options : [], required: f.required,
        }))
      : requirements.map((label) => ({ key: crypto.randomUUID(), label, help_text: "", field_type: "long_text" as const, options: [], required: false })),
    availability: product.commission_listing?.availability ?? "open",
    opensAt: product.commission_listing?.opens_at ? product.commission_listing.opens_at.slice(0, 10) : "",
    slotsTotal: product.commission_listing?.slots_total ?? null,
    leadTimeDays: product.commission_listing?.lead_time_days ?? 0,
    turnaroundStarts: product.commission_listing?.turnaround_starts ?? "payment",
    terms: product.commission_listing?.terms ?? "",
    acceptsCustomQuotes: product.commission_listing?.accepts_custom_quotes ?? false,
  };
}

// ─── editors ────────────────────────────────────────────────────────

function PackageEditor({ index, pkg, canRemove, onRemove, onChange }: { index: number; pkg: CommissionPackageFormState; canRemove: boolean; onRemove: () => void; onChange: (u: Partial<CommissionPackageFormState>) => void }) {
  return (
    <div className="rounded-2xl bg-subtle/70 p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="px-3 py-1 rounded-full bg-gradient-to-r from-orange-warm/10 to-pink-vivid/10 text-xs font-ui font-semibold text-pink-vivid">Tier {index + 1}</span>
        {canRemove && <button type="button" onClick={onRemove} className="text-xs font-ui text-muted hover:text-red-600">Remove</button>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label text="Name" required htmlFor={`pkg-name-${pkg.id}`} />
          <input id={`pkg-name-${pkg.id}`} value={pkg.name} maxLength={40} onChange={(e) => onChange({ name: e.target.value })} placeholder="Sketch, Standard, Full scene…" className={INPUT} />
          <Help>Buyers see this name; any wording works.</Help>
        </div>
        <div>
          <Label text="Price (USD)" required htmlFor={`pkg-price-${pkg.id}`} />
          <input id={`pkg-price-${pkg.id}`} type="number" min={MIN_PACKAGE_PRICE} step={1} inputMode="decimal" value={pkg.price ?? ""} onChange={(e) => onChange({ price: e.target.value ? Number(e.target.value) : null })} className={`${INPUT} tabular-nums`} />
          <Help>At least {formatCurrency(MIN_PACKAGE_PRICE)}. Pinkquill keeps 5%; you receive the rest.</Help>
        </div>
        <div>
          <Label text="Delivery days" required htmlFor={`pkg-days-${pkg.id}`} />
          <input id={`pkg-days-${pkg.id}`} type="number" min={1} value={pkg.deliveryDays} onChange={(e) => onChange({ deliveryDays: Math.max(1, Number(e.target.value || 1)) })} className={`${INPUT} tabular-nums`} />
        </div>
        <div>
          <Label text="Revisions" required htmlFor={`pkg-rev-${pkg.id}`} />
          <input id={`pkg-rev-${pkg.id}`} type="number" min={0} value={pkg.revisions} onChange={(e) => onChange({ revisions: Math.max(0, Number(e.target.value || 0)) })} className={`${INPUT} tabular-nums`} />
        </div>
        <div className="sm:col-span-2">
          <Label text="What the buyer gets" required htmlFor={`pkg-desc-${pkg.id}`} />
          <textarea id={`pkg-desc-${pkg.id}`} rows={2} value={pkg.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Half body, full render, loose background." className={INPUT} />
        </div>
        <div className="sm:col-span-2">
          <Label text="Highlights" right="short lines shown on the package card" />
          <LineList values={pkg.features} placeholder="e.g. 3000 × 4000 px PNG" onChange={(features) => onChange({ features })} addLabel="Add highlight" />
        </div>
      </div>
    </div>
  );
}

const INTAKE_TYPES: Array<{ value: IntakeFieldDraft["field_type"]; label: string }> = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Paragraph" },
  { value: "number", label: "Number" },
  { value: "url", label: "Link" },
  { value: "select", label: "Pick one" },
  { value: "multi_select", label: "Pick many" },
  { value: "file", label: "File" },
];

function IntakeFieldsEditor({ fields, onChange }: { fields: IntakeFieldDraft[]; onChange: (fields: IntakeFieldDraft[]) => void }) {
  const update = (key: string, patch: Partial<IntakeFieldDraft>) => onChange(fields.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const remove = (key: string) => onChange(fields.filter((f) => f.key !== key));
  const move = (index: number, dir: -1 | 1) => {
    const next = [...fields];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const add = (field_type: IntakeFieldDraft["field_type"]) =>
    onChange([...fields, { key: crypto.randomUUID(), label: "", help_text: "", field_type, options: [], required: false }]);

  return (
    <div className="space-y-3">
      {fields.length === 0 && <p className="text-sm font-body text-muted">No questions yet. Buyers will only write a brief.</p>}
      {fields.map((field, index) => {
        const hasOptions = field.field_type === "select" || field.field_type === "multi_select";
        return (
          <div key={field.key} className="rounded-2xl bg-subtle/70 p-3 sm:p-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="mt-2.5 text-xs font-ui text-muted w-5 shrink-0 tabular-nums">{index + 1}.</span>
              <input value={field.label} maxLength={200} placeholder="e.g. What is this piece for?" onChange={(e) => update(field.key, { label: e.target.value })} className={INPUT} />
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up" className="w-8 h-8 rounded-lg text-muted hover:bg-subtle disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === fields.length - 1} aria-label="Move down" className="w-8 h-8 rounded-lg text-muted hover:bg-subtle disabled:opacity-30">↓</button>
                <button type="button" onClick={() => remove(field.key)} aria-label="Remove question" className="w-8 h-8 rounded-lg text-muted hover:bg-red-50 hover:text-red-600">×</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-7">
              <ChipChoice options={INTAKE_TYPES} value={field.field_type} onChange={(field_type) => update(field.key, { field_type })} />
              <span className="ml-auto whitespace-nowrap"><Check size="sm" checked={field.required} onChange={(required) => update(field.key, { required })} label="Required" /></span>
            </div>
            <div className="pl-7 space-y-2">
              <input value={field.help_text} maxLength={500} placeholder="Help text (optional)" onChange={(e) => update(field.key, { help_text: e.target.value })} className={`${INPUT} text-xs`} />
              {hasOptions && (
                <input value={field.options.join(", ")} placeholder="Options, separated by commas" onChange={(e) => update(field.key, { options: e.target.value.split(",").map((o) => o.trimStart()) })} onBlur={(e) => update(field.key, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })} className={`${INPUT} text-xs`} />
              )}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        {INTAKE_TYPES.map((t) => (
          <button key={t.value} type="button" onClick={() => add(t.value)} className="pq-chip px-3.5 py-2 text-sm font-ui">+ {t.label}</button>
        ))}
      </div>
    </div>
  );
}

function FaqEditor({ values, onChange }: { values: Array<{ question: string; answer: string }>; onChange: (v: Array<{ question: string; answer: string }>) => void }) {
  return (
    <div className="space-y-3">
      {values.map((item, index) => (
        <div key={index} className="rounded-2xl bg-subtle/70 p-3 sm:p-4 space-y-2">
          <input value={item.question} placeholder="Question" onChange={(e) => onChange(values.map((v, i) => (i === index ? { ...v, question: e.target.value } : v)))} className={INPUT} />
          <textarea rows={2} value={item.answer} placeholder="Answer" onChange={(e) => onChange(values.map((v, i) => (i === index ? { ...v, answer: e.target.value } : v)))} className={INPUT} />
          <button type="button" onClick={() => onChange(values.filter((_, i) => i !== index))} className="text-xs font-ui text-muted hover:text-red-600">Remove</button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={() => onChange([...values, { question: "", answer: "" }])}>Add a question</Button>
    </div>
  );
}

const AVAILABILITY_OPTIONS: Array<{ value: CommissionWizardState["availability"]; label: string; hint: string }> = [
  { value: "open", label: "Open", hint: "Buyers can request while slots are free." },
  { value: "waitlist", label: "Waitlist", hint: "Requests come in; you approve each one before payment." },
  { value: "scheduled", label: "Opens on a date", hint: "Closed until the date you pick, then open." },
  { value: "closed", label: "Closed", hint: "Listing stays visible; nobody can request." },
];

function AvailabilityEditor({ state, onChange }: { state: CommissionWizardState; onChange: (u: Partial<CommissionWizardState>) => void }) {
  const unlimited = state.slotsTotal === null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {AVAILABILITY_OPTIONS.map((o) => {
          const active = state.availability === o.value;
          return (
            <button key={o.value} type="button" aria-pressed={active} onClick={() => onChange({ availability: o.value })} className={`text-left rounded-2xl px-4 py-3.5 transition-all ${active ? "pq-ring" : "border border-border-light bg-surface hover:border-pink-vivid/30 shadow-sm"}`}>
              <p className={`text-sm font-ui font-semibold ${active ? "text-pink-vivid" : "text-ink"}`}>{o.label}</p>
              <p className="text-xs font-body text-muted mt-0.5">{o.hint}</p>
            </button>
          );
        })}
      </div>
      {state.availability === "scheduled" && (
        <div>
          <Label text="Opens on" required htmlFor="opens-at" />
          <input id="opens-at" type="date" value={state.opensAt} min={new Date().toISOString().slice(0, 10)} onChange={(e) => onChange({ opensAt: e.target.value })} className={INPUT} />
        </div>
      )}
      {state.availability !== "closed" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label text="Slots at once" htmlFor="slots" right={<Check size="sm" checked={unlimited} onChange={(v) => onChange({ slotsTotal: v ? null : 3 })} label="Unlimited" />} />
            <input id="slots" type="number" min={1} max={500} disabled={unlimited} value={unlimited ? "" : state.slotsTotal ?? ""} placeholder={unlimited ? "Unlimited" : "e.g. 3"} onChange={(e) => { const v = Number(e.target.value); onChange({ slotsTotal: Number.isFinite(v) && v > 0 ? Math.min(500, Math.round(v)) : null }); }} className={`${INPUT} tabular-nums disabled:opacity-60`} />
            <Help>Active orders count against this. The request that would go over is refused.</Help>
          </div>
          <div>
            <Label text="Lead time (days)" htmlFor="lead" />
            <input id="lead" type="number" min={0} max={365} value={state.leadTimeDays} onChange={(e) => onChange({ leadTimeDays: Math.max(0, Math.min(365, Math.round(Number(e.target.value) || 0))) })} className={`${INPUT} tabular-nums`} />
            <Help>Added before the package days when the due date is set.</Help>
          </div>
        </div>
      )}
      <div>
        <Label text="Clock starts" />
        <ChipChoice options={[{ value: "payment", label: "When the buyer pays" }, { value: "acceptance", label: "When I accept the request" }]} value={state.turnaroundStarts} onChange={(turnaroundStarts) => onChange({ turnaroundStarts })} />
      </div>
      <div className="py-2"><Check checked={state.acceptsCustomQuotes} onChange={(acceptsCustomQuotes) => onChange({ acceptsCustomQuotes })} label="Open to custom requests" hint="Buyers can describe something outside your packages in the brief." /></div>
    </div>
  );
}

// ─── preview ────────────────────────────────────────────────────────

function ListingPreview({ state }: { state: CommissionWizardState }) {
  const cover = state.mediaPreviews.find((m) => m.isPrimary) ?? state.mediaPreviews[0];
  const others = state.mediaPreviews.filter((m) => m !== cover).slice(0, 2);
  const packages = [...state.packages].filter((p) => p.price != null).sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const [sel, setSel] = useState(0);
  const pkg = packages[Math.min(sel, Math.max(packages.length - 1, 0))];
  const category = state.category ? [COMMISSION_CATEGORIES[state.category]?.name || state.category, state.subcategory ? getCommissionSubcategoryLabel(state.category, state.subcategory) : null].filter(Boolean).join(" · ") : "";
  const days = (pkg?.deliveryDays ?? 0) + state.leadTimeDays;
  const slotsLine = state.availability === "closed" ? "Closed" : state.availability === "waitlist" ? "Waitlist" : state.availability === "scheduled" ? `Opens ${state.opensAt || "…"}` : state.slotsTotal ? `${state.slotsTotal} of ${state.slotsTotal} slots open` : "Open";
  const tile = (m: CommissionWizardState["mediaPreviews"][number] | undefined, cls: string) => (
    <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 ${cls}`}>
      {m && (isVideoMedia(m) ? <video src={m.url} muted playsInline className="absolute inset-0 w-full h-full object-cover" /> : <Image src={m.url} alt="" fill unoptimized className="object-cover" sizes="600px" />)}
    </div>
  );
  return (
    <div className="pq-ring rounded-3xl p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-6">
      <div>
        <div className="grid grid-cols-4 grid-rows-2 gap-2 aspect-[16/9]">
          {tile(cover, "col-span-3 row-span-2")}
          {tile(others[0], "")}
          {tile(others[1], "")}
        </div>
        <p className="text-xs font-ui text-muted mt-4">{category}</p>
        <h3 className="font-display text-xl font-semibold text-ink mt-1">{state.title || "Untitled listing"}</h3>
        {state.headline && <p className="text-sm font-body text-muted mt-1">{state.headline}</p>}
        <div className="mt-4 space-y-2 text-sm font-body text-ink/90">
          {state.description && <p className="whitespace-pre-line line-clamp-4">{state.description}</p>}
          <p><span className="font-ui font-semibold">How it works</span> · Send your request · Pay · {pkg?.deliveryDays ?? 0} days from {state.turnaroundStarts} · 3-day review · paid 7 days after approval</p>
          {state.intakeFields.length > 0 && <p><span className="font-ui font-semibold">You&apos;ll be asked</span> · {state.intakeFields.map((f) => `${f.label || "…"}${f.required ? "*" : ""}`).join(" · ")}</p>}
          {state.includes.filter(Boolean).length > 0 && <p><span className="font-ui font-semibold">Includes</span> · {state.includes.filter(Boolean).join(" · ")}</p>}
          {state.excludes.filter(Boolean).length > 0 && <p><span className="font-ui font-semibold">Not included</span> · {state.excludes.filter(Boolean).join(" · ")}</p>}
          {state.terms.trim() && <p><span className="font-ui font-semibold">Terms</span> · <span className="line-clamp-2">{state.terms}</span></p>}
        </div>
      </div>
      <aside>
        <div className="space-y-2">
          {packages.length === 0 && <p className="text-sm font-body text-muted">No priced packages yet.</p>}
          {packages.map((p, i) => (
            <button key={p.id} type="button" onClick={() => setSel(i)} className={`w-full text-left rounded-2xl p-3 ${i === sel ? "pq-ring" : "border border-border-light"}`}>
              <div className="flex justify-between gap-3"><span className="text-sm font-ui font-semibold text-ink">{p.name || "Package"}</span><span className="font-display font-semibold text-ink tabular-nums">{formatCurrency(p.price ?? 0)}</span></div>
              <p className="text-2xs font-body text-muted">{p.deliveryDays}-day delivery · {p.revisions} revision{p.revisions === 1 ? "" : "s"}</p>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs font-body text-muted">{slotsLine}{pkg ? ` · about ${days} days from ${state.turnaroundStarts}` : ""}</p>
        <div className="mt-3"><Button fullWidth disabled>Request{pkg ? ` · ${formatCurrency(pkg.price ?? 0)}` : ""}</Button></div>
      </aside>
    </div>
  );
}

// ─── wizard ─────────────────────────────────────────────────────────

interface CreateCommissionWizardProps {
  mode?: "create" | "edit";
  productId?: string;
  initialProduct?: Product | null;
}

export default function CreateCommissionWizard({ mode = "create", productId, initialProduct = null }: CreateCommissionWizardProps = {}) {
  const router = useRouter();
  const mediaUrlsRef = useRef<string[]>([]);
  const { user, loading: authLoading } = useAuth();
  const { createCommission, creating, error: createError } = useCreateCommission();
  const { updateCommission, updating, error: updateError } = useUpdateCommission();

  const isEdit = mode === "edit";
  const [savedId, setSavedId] = useState<string | null>(productId ?? initialProduct?.id ?? null);
  const [savedStatus, setSavedStatus] = useState<string | null>(initialProduct?.status ?? null);
  const [step, setStep] = useState<StepIndex>(1);
  const [furthest, setFurthest] = useState<number>(isEdit ? 6 : 1);
  const [error, setError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [state, setState] = useState<CommissionWizardState>(() => (isEdit && initialProduct ? mapProductToCommissionState(initialProduct) : initialCommissionWizardState));

  const busy = creating || updating || savingDraft;
  const submitError = createError || updateError;
  const categories = useMemo(() => getAllCommissionCategories(), []);
  const selectedCategory = state.category ? COMMISSION_CATEGORIES[state.category] : null;

  // Object URLs minted by the picker live as long as the wizard does.
  useEffect(() => {
    mediaUrlsRef.current = state.mediaPreviews.filter((m) => m.file instanceof File).map((m) => m.url);
  }, [state.mediaPreviews]);
  useEffect(() => () => { mediaUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const update = useCallback((patch: Partial<CommissionWizardState>) => { setState((prev) => ({ ...prev, ...patch })); setError(null); }, []);
  const updatePackage = useCallback((id: string, patch: Partial<CommissionPackageFormState>) => {
    setState((prev) => ({ ...prev, packages: prev.packages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
    setError(null);
  }, []);
  const addPackage = () => {
    if (state.packages.length >= 3) return;
    const used = new Set(state.packages.map((p) => p.tier));
    const preset = PACKAGE_PRESETS.find((p) => !used.has(p.tier)) ?? { tier: "custom" as const, name: "" };
    update({ packages: [...state.packages, { id: crypto.randomUUID(), tier: preset.tier, name: preset.name, description: "", price: null, deliveryDays: 7, revisions: 1, features: [] }] });
  };
  const removePackage = (id: string) => { if (state.packages.length > 1) update({ packages: state.packages.filter((p) => p.id !== id) }); };

  /** The publish checks, per step. Returns the first problem or null. */
  const problemFor = useCallback((target: number): string | null => {
    if (target === 1) {
      if (!state.category) return "Pick a category.";
      if (!state.title.trim()) return "Give the listing a title.";
      if (!state.description.trim()) return "Describe the commission.";
    }
    if (target === 2) {
      if (state.packages.length === 0) return "Add at least one package.";
      for (let i = 0; i < state.packages.length; i += 1) {
        const p = state.packages[i];
        const label = p.name.trim() || `Package ${i + 1}`;
        if (!p.name.trim()) return `Name package ${i + 1}, or remove it.`;
        if (p.price === null || !Number.isFinite(p.price)) return `Set a price for "${label}", or remove it.`;
        if (p.price < MIN_PACKAGE_PRICE) return `"${label}" must be ${formatCurrency(MIN_PACKAGE_PRICE)} or more.`;
        if (!p.description.trim()) return `Say what "${label}" includes, or remove it.`;
        if (!Number.isFinite(p.deliveryDays) || p.deliveryDays < 1) return `"${label}" needs a delivery time of at least 1 day.`;
      }
    }
    if (target === 3 && state.mediaPreviews.length === 0) return "Add at least one image or video.";
    if (target === 5 && state.availability === "scheduled" && !state.opensAt) return "Pick the date this commission opens.";
    return null;
  }, [state]);

  const scrollTop = () => { if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const goNext = () => {
    const problem = problemFor(step);
    if (problem) { setError(problem); scrollTop(); return; }
    const next = Math.min(6, step + 1) as StepIndex;
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    scrollTop();
  };
  const goBack = () => { setStep((s) => Math.max(1, s - 1) as StepIndex); scrollTop(); };
  const jump = (target: number) => { setStep(target as StepIndex); scrollTop(); };

  const canSaveDraft = Boolean(state.category && state.title.trim()) && (savedStatus === null || savedStatus === "draft");

  /** Save what exists as a draft: no publish checks, packages without a price are skipped. */
  const saveDraft = async () => {
    if (!canSaveDraft) { setError("Pick a category and give the listing a title to save a draft."); scrollTop(); return; }
    setSavingDraft(true);
    setError(null);
    try {
      if (savedId) {
        const ok = await updateCommission(savedId, state, { status: "draft" });
        if (ok) showToast.success("Draft saved");
        else scrollTop();
      } else {
        const created = await createCommission(state, { status: "draft" });
        if (created) {
          setSavedId(created.id);
          setSavedStatus("draft");
          showToast.success("Draft saved", "Find it under Listings whenever you want to continue.");
          // Continue editing the saved row so later saves update instead of duplicating.
          window.history.replaceState(null, "", `/sell/edit/${created.id}`);
        } else scrollTop();
      }
    } finally {
      setSavingDraft(false);
    }
  };

  const publish = async () => {
    if (!user) { setError("Sign in to publish."); scrollTop(); return; }
    for (let i = 1; i <= 5; i += 1) {
      const problem = problemFor(i);
      if (problem) { setError(problem); setStep(i as StepIndex); scrollTop(); return; }
    }
    const options: SaveCommissionOptions = { status: "active" };
    if (savedId) {
      const ok = await updateCommission(savedId, state, savedStatus === "active" ? {} : options);
      if (!ok) { scrollTop(); return; }
      showToast.success(savedStatus === "active" ? "Changes saved" : "Published — your listing is live");
      router.push(`/commissions/${savedId}`);
      return;
    }
    const created = await createCommission(state, options);
    if (!created) { scrollTop(); return; }
    showToast.success("Published — your listing is live");
    router.push(`/commissions/${created.id}`);
  };

  if (isEdit && !initialProduct) {
    return <div className="min-h-[60vh] flex items-center justify-center px-6"><Loading text="Opening your listing" /></div>;
  }

  if (!authLoading && !user) {
    return <SignInGate title="Sign in to open commissions" description="Set your packages, questions and availability, and let people who love your work request it directly." redirect="/sell/service" />;
  }

  const isLive = savedStatus === "active";
  const eyebrow = isEdit ? (isLive ? "Edit listing" : "Draft") : savedId ? "Draft" : "New commission";
  const priceFrom = state.packages.map((p) => p.price).filter((p): p is number => typeof p === "number" && p > 0).sort((a, b) => a - b)[0];

  return (
    <ListingShell
      eyebrow={eyebrow}
      steps={STEPS}
      step={step}
      furthest={furthest}
      onJump={jump}
      headline={HEADLINES[step - 1]}
      error={error || submitError}
      onBack={goBack}
      onNext={goNext}
      onPublish={publish}
      onSaveDraft={saveDraft}
      canSaveDraft={canSaveDraft}
      savingDraft={savingDraft}
      publishing={creating || updating}
      busy={busy}
      isLive={isLive}
    >
      {step === 1 && (
        <Section title="Basics" description="What you make and how you describe it.">
          <div className="space-y-4">
            <div>
              <Label text="Category" required />
              <ChipChoice options={categories.map((c) => ({ value: c.id, label: c.name }))} value={state.category} onChange={(category) => update({ category, subcategory: null })} />
            </div>
            {selectedCategory && (
              <div>
                <Label text="Specialization" />
                <ChipChoice options={selectedCategory.subcategories.map((s) => ({ value: s.value, label: s.label }))} value={state.subcategory} onChange={(subcategory) => update({ subcategory })} />
              </div>
            )}
            <div>
              <Label text="Title" required htmlFor="title" right={`${state.title.trim().length}/80`} />
              <input id="title" maxLength={80} value={state.title} onChange={(e) => update({ title: e.target.value })} placeholder="Character illustration, full colour" className={INPUT} />
            </div>
            <div>
              <Label text="Headline" htmlFor="headline" right={`${state.headline.trim().length}/100`} />
              <input id="headline" maxLength={100} value={state.headline} onChange={(e) => update({ headline: e.target.value })} placeholder="One line under the title on cards and the listing." className={INPUT} />
            </div>
            <div>
              <Label text="Description" required htmlFor="description" right={`${state.description.trim().length}/1200`} />
              <textarea id="description" rows={6} maxLength={1200} value={state.description} onChange={(e) => update({ description: e.target.value })} placeholder="How you work, what you love making, what a buyer can expect." className={INPUT} />
            </div>
          </div>
        </Section>
      )}

      {step === 2 && (
        <Section title="Packages" description="Up to three. Name them however you like.">
          <div className="space-y-3">
            {state.packages.map((pkg, index) => (
              <PackageEditor key={pkg.id} index={index} pkg={pkg} canRemove={state.packages.length > 1} onRemove={() => removePackage(pkg.id)} onChange={(patch) => updatePackage(pkg.id, patch)} />
            ))}
            {state.packages.length < 3 && (
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" onClick={addPackage}>Add a package</Button>
                <span className="text-xs font-body text-muted">{3 - state.packages.length} more possible</span>
              </div>
            )}
          </div>
        </Section>
      )}

      {step === 3 && (
        <Section title="Portfolio" description={`Up to ${MAX_MEDIA} images or videos. The cover is what people see first.`}>
          <MediaPicker previews={state.mediaPreviews} onChange={(mediaPreviews) => update({ mediaPreviews })} onError={setError} max={MAX_MEDIA} accept={ACCEPTED_MEDIA_TYPES} maxImageBytes={MAX_IMAGE_SIZE} maxVideoBytes={MAX_VIDEO_SIZE} hint="JPG, PNG, WEBP, GIF up to 10 MB · MP4, MOV up to 200 MB" />
        </Section>
      )}

      {step === 4 && (
        <>
          <Section title="Questions for the buyer" description="Asked in the request sheet, before they pay. Answers land on the order page.">
            <IntakeFieldsEditor fields={state.intakeFields} onChange={(intakeFields) => update({ intakeFields })} />
          </Section>
          <Section title="Includes and not included">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label text="Includes" /><LineList values={state.includes} placeholder="e.g. A sketch for approval first" onChange={(includes) => update({ includes })} /></div>
              <div><Label text="Not included" /><LineList values={state.excludes} placeholder="e.g. Commercial use" onChange={(excludes) => update({ excludes })} /></div>
            </div>
          </Section>
          <Section title="Terms" description="Shown on your listing. Buyers agree to them when they send a request." right={<span className="text-xs font-ui text-muted tabular-nums">{state.terms.length}/5000</span>}>
            <textarea rows={5} maxLength={5000} value={state.terms} onChange={(e) => update({ terms: e.target.value })} placeholder="Usage rights, what counts as a revision, cancellation, anything buyers agree to before ordering." className={INPUT} />
          </Section>
          <Section title="FAQ">
            <FaqEditor values={state.faqs} onChange={(faqs) => update({ faqs })} />
          </Section>
          <Section title="Tags" description="A few words that help people find this.">
            <TagList values={state.keywords} onChange={(keywords) => update({ keywords })} placeholder="character, portrait, painterly" normalize />
          </Section>
        </>
      )}

      {step === 5 && (
        <Section title="Availability" description="The database enforces this: the request that would break it is refused.">
          <AvailabilityEditor state={state} onChange={update} />
        </Section>
      )}

      {step === 6 && (
        <>
          <div className="rounded-2xl bg-gradient-to-r from-orange-warm/10 via-pink-vivid/10 to-purple-primary/10 px-5 py-3.5 text-sm font-body text-ink/80">
            {isLive ? "This is your listing as buyers see it. Save changes to update it." : "This is your listing page as buyers will see it. Nothing is live until you publish."}
            {priceFrom != null ? ` From ${formatCurrency(priceFrom)}.` : ""}
          </div>
          <ListingPreview state={state} />
        </>
      )}
    </ListingShell>
  );
}
