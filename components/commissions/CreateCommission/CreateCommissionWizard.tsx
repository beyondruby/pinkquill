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
import TagInput from "@/components/store/CreateProduct/fields/TagInput";
import { getCategoryIcon } from "@/lib/store/categories";
import {
  BackRow, CategoryTile, ErrorBanner, FieldLabel, GCheck, GInput, GNumber, GSelect, GTextarea, Hint, LineList, OptionBox, RemoveButton, Section, SectionHeader, StepHeader, TextLink, WizardNav,
} from "./ui";

/**
 * The commission listing wizard, shaped like the product wizard: three
 * steps. Choose Type (round category tiles, then specialization boxes),
 * Upload Media (the circular upload and slot grid), and Fill Details (one
 * sectioned form: basics, packages, questions, terms, FAQ, availability,
 * keywords). Same STEP header, gradient-bordered fields, gradient checks
 * and purple pill navigation. Drafts and the publish checks are unchanged.
 */

const MAX_MEDIA = 10;
const ACCEPTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const MIN_PACKAGE_PRICE = 5;

const STEPS = ["Choose Type", "Upload Media", "Fill Details"] as const;
type StepIndex = 1 | 2 | 3;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  design: getCategoryIcon("sparkles"),
  illustration: getCategoryIcon("palette"),
  writing: getCategoryIcon("book"),
  video: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  audio_music: getCategoryIcon("music"),
  crafts: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
    </svg>
  ),
};

const PACKAGE_PRESETS: Array<{ tier: CommissionPackageFormState["tier"]; name: string }> = [
  { tier: "basic", name: "Basic" },
  { tier: "standard", name: "Standard" },
  { tier: "premium", name: "Premium" },
];

function isVideoMedia(preview: { file?: File | null; mediaType?: string; url: string }): boolean {
  if (preview.mediaType) return preview.mediaType === "video";
  if (preview.file?.type) return preview.file.type.startsWith("video/");
  return /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(preview.url);
}

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
    <div className={index === 0 ? "" : "pt-8 border-t border-dashed border-gray-100"}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-sm font-ui font-medium text-muted">Package {index + 1}</span>
        {canRemove && <TextLink onClick={onRemove} className="text-muted hover:text-red-500">Remove</TextLink>}
      </div>
      <div className="space-y-6">
        <div>
          <FieldLabel required htmlFor={`pkg-name-${pkg.id}`}>Name</FieldLabel>
          <GInput id={`pkg-name-${pkg.id}`} value={pkg.name} maxLength={40} onChange={(name) => onChange({ name })} placeholder="Sketch, Standard, Full scene…" pencil />
          <Hint>Buyers see this name; any wording works.</Hint>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <FieldLabel required htmlFor={`pkg-price-${pkg.id}`}>Price</FieldLabel>
            <GNumber id={`pkg-price-${pkg.id}`} value={pkg.price} onChange={(price) => onChange({ price })} prefix="$" placeholder="0.00" min={MIN_PACKAGE_PRICE} step={1} className="w-full" />
            <Hint>At least {formatCurrency(MIN_PACKAGE_PRICE)}. Pinkquill keeps 5%; you receive the rest.</Hint>
          </div>
          <div>
            <FieldLabel required htmlFor={`pkg-days-${pkg.id}`}>Delivery time</FieldLabel>
            <GNumber id={`pkg-days-${pkg.id}`} value={pkg.deliveryDays} onChange={(v) => onChange({ deliveryDays: Math.max(1, Math.round(v ?? 1)) })} suffix="days" min={1} className="w-full" />
          </div>
          <div>
            <FieldLabel required htmlFor={`pkg-rev-${pkg.id}`}>Revisions</FieldLabel>
            <GNumber id={`pkg-rev-${pkg.id}`} value={pkg.revisions} onChange={(v) => onChange({ revisions: Math.max(0, Math.round(v ?? 0)) })} min={0} className="w-full" />
          </div>
        </div>
        <div>
          <FieldLabel required htmlFor={`pkg-desc-${pkg.id}`}>What the buyer gets</FieldLabel>
          <GTextarea id={`pkg-desc-${pkg.id}`} rows={2} value={pkg.description} onChange={(description) => onChange({ description })} placeholder="Half body, full render, loose background." />
        </div>
        <div>
          <FieldLabel right="short lines shown on the package card">Highlights</FieldLabel>
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
  const add = () => onChange([...fields, { key: crypto.randomUUID(), label: "", help_text: "", field_type: "short_text", options: [], required: false }]);

  return (
    <div className="space-y-6">
      {fields.length === 0 && <p className="text-sm font-body text-muted">No questions yet. Buyers will only write a brief.</p>}
      {fields.map((field, index) => {
        const hasOptions = field.field_type === "select" || field.field_type === "multi_select";
        return (
          <div key={field.key} className="rounded-2xl bg-surface shadow-md shadow-black/5 p-5 space-y-4" style={{ border: "1px solid rgba(0, 0, 0, 0.05)" }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-ui font-semibold text-pink-vivid w-6 shrink-0 tabular-nums">{index + 1}.</span>
              <GInput value={field.label} maxLength={200} placeholder="e.g. What is this piece for?" onChange={(label) => update(field.key, { label })} className="flex-1" pencil />
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up" className="w-8 h-8 rounded-lg text-muted hover:bg-pink-vivid/5 hover:text-pink-vivid disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === fields.length - 1} aria-label="Move down" className="w-8 h-8 rounded-lg text-muted hover:bg-pink-vivid/5 hover:text-pink-vivid disabled:opacity-30">↓</button>
              <RemoveButton onClick={() => remove(field.key)} label="Remove question" />
            </div>
            <div className="pl-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <GSelect value={field.field_type} onChange={(e) => update(field.key, { field_type: e.target.value as IntakeFieldDraft["field_type"] })}>
                {INTAKE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </GSelect>
              <GCheck checked={field.required} onChange={(required) => update(field.key, { required })} label="Required" />
            </div>
            <div className="pl-8 space-y-3">
              <GInput value={field.help_text} maxLength={500} placeholder="Help text (optional)" onChange={(help_text) => update(field.key, { help_text })} />
              {hasOptions && (
                <GInput value={field.options.join(", ")} placeholder="Options, separated by commas" onChange={(v) => update(field.key, { options: v.split(",").map((o) => o.trimStart()) })} />
              )}
            </div>
          </div>
        );
      })}
      <TextLink onClick={add}>+ Add a question</TextLink>
    </div>
  );
}

function FaqEditor({ values, onChange }: { values: Array<{ question: string; answer: string }>; onChange: (v: Array<{ question: string; answer: string }>) => void }) {
  return (
    <div className="space-y-6">
      {values.map((item, index) => (
        <div key={index} className="rounded-2xl bg-surface shadow-md shadow-black/5 p-5 space-y-3" style={{ border: "1px solid rgba(0, 0, 0, 0.05)" }}>
          <div className="flex items-center gap-2">
            <GInput value={item.question} placeholder="Question" onChange={(question) => onChange(values.map((v, i) => (i === index ? { ...v, question } : v)))} className="flex-1" pencil />
            <RemoveButton onClick={() => onChange(values.filter((_, i) => i !== index))} />
          </div>
          <GTextarea rows={2} value={item.answer} placeholder="Answer" onChange={(answer) => onChange(values.map((v, i) => (i === index ? { ...v, answer } : v)))} />
        </div>
      ))}
      <TextLink onClick={() => onChange([...values, { question: "", answer: "" }])}>+ Add a question</TextLink>
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
    <div className="space-y-8">
      <div>
        <FieldLabel>Requests</FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {AVAILABILITY_OPTIONS.map((o) => (
            <OptionBox key={o.value} selected={state.availability === o.value} onClick={() => onChange({ availability: o.value })} label={o.label} hint={o.hint} />
          ))}
        </div>
        {state.availability === "scheduled" && (
          <div className="mt-6">
            <FieldLabel required htmlFor="opens-at">Opens on</FieldLabel>
            <GInput id="opens-at" type="date" value={state.opensAt} min={new Date().toISOString().slice(0, 10)} onChange={(opensAt) => onChange({ opensAt })} className="w-48" />
          </div>
        )}
      </div>

      {state.availability !== "closed" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <FieldLabel htmlFor="slots">Slots at once</FieldLabel>
              <GNumber id="slots" value={unlimited ? null : state.slotsTotal} onChange={(v) => onChange({ slotsTotal: v && v > 0 ? Math.min(500, Math.round(v)) : null })} placeholder={unlimited ? "Unlimited" : "e.g. 3"} min={1} />
              <div className="mt-3"><GCheck small checked={unlimited} onChange={(v) => onChange({ slotsTotal: v ? null : 3 })} label="Unlimited" /></div>
              <Hint>Active orders count against this. The request that would go over is refused.</Hint>
            </div>
            <div>
              <FieldLabel htmlFor="lead">Lead time</FieldLabel>
              <GNumber id="lead" value={state.leadTimeDays} onChange={(v) => onChange({ leadTimeDays: Math.max(0, Math.min(365, Math.round(v ?? 0))) })} suffix="days" min={0} />
              <Hint>Added before the package days when the due date is set.</Hint>
            </div>
          </div>
        </div>
      )}

      <div>
        <FieldLabel>Clock starts</FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <OptionBox selected={state.turnaroundStarts === "payment"} onClick={() => onChange({ turnaroundStarts: "payment" })} label="When the buyer pays" />
          <OptionBox selected={state.turnaroundStarts === "acceptance"} onClick={() => onChange({ turnaroundStarts: "acceptance" })} label="When I accept the request" />
        </div>
        <div className="mt-6">
          <GCheck checked={state.acceptsCustomQuotes} onChange={(acceptsCustomQuotes) => onChange({ acceptsCustomQuotes })} label="Open to custom requests" hint="Buyers can describe something outside your packages in the brief." />
        </div>
      </div>
    </div>
  );
}

// ─── media ──────────────────────────────────────────────────────────

function MediaStep({ previews, onChange, onError }: { previews: CommissionWizardState["mediaPreviews"]; onChange: (p: CommissionWizardState["mediaPreviews"]) => void; onError: (m: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const full = previews.length >= MAX_MEDIA;

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    onError(null);
    const accepted: CommissionWizardState["mediaPreviews"] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) { onError("Use JPG, PNG, WEBP, GIF, or MP4/MOV files."); continue; }
      const isVideo = file.type.startsWith("video/");
      const limit = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      if (file.size > limit) { onError(`${isVideo ? "Videos" : "Images"} must be under ${Math.round(limit / 1048576)} MB.`); continue; }
      if (previews.length + accepted.length >= MAX_MEDIA) { onError(`Up to ${MAX_MEDIA} files.`); break; }
      accepted.push({ file, url: URL.createObjectURL(file), isPrimary: previews.length === 0 && accepted.length === 0, mediaType: isVideo ? "video" : "image" });
    }
    if (accepted.length) onChange([...previews, ...accepted]);
  };
  const setCover = (index: number) => onChange(previews.map((m, i) => ({ ...m, isPrimary: i === index })));
  const remove = (index: number) => {
    const item = previews[index];
    if (item?.file) URL.revokeObjectURL(item.url);
    const next = previews.filter((_, i) => i !== index);
    if (next.length && !next.some((m) => m.isPrimary)) next[0].isPrimary = true;
    onChange(next);
  };
  const onDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === "dragenter" || e.type === "dragover"); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (!full) addFiles(e.dataTransfer.files); };

  return (
    <div className="py-4">
      <div className="flex flex-col items-center">
        <div
          onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative w-48 h-48 rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center ${dragActive ? "bg-gradient-to-br from-orange-warm/20 to-pink-vivid/20" : "bg-pink-vivid/5 hover:bg-pink-vivid/10"} ${full ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className={`w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 ${dragActive ? "bg-gradient-to-br from-orange-warm/30 to-pink-vivid/30" : "bg-pink-vivid/10"}`}>
            <svg className={`w-12 h-12 mb-2 transition-colors ${dragActive ? "text-pink-vivid" : "text-pink-vivid/50"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`text-sm font-ui font-medium ${dragActive ? "text-pink-vivid" : "text-pink-vivid/60"}`}>{dragActive ? "Drop here" : "Upload"}</span>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPTED_MEDIA_TYPES.join(",")} multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} className="hidden" />
        </div>
        <p className="text-sm text-muted font-body mt-4">Click or drag to upload</p>
        <p className="text-xs text-muted/70 font-body mt-1">JPG, PNG, WEBP, GIF up to 10 MB • MP4, MOV up to 200 MB</p>
        <div className="mt-3">
          <span className="text-sm text-muted font-body"><span className={previews.length > 0 ? "text-pink-vivid font-medium" : ""}>{previews.length}</span> / {MAX_MEDIA} files</span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-4 sm:grid-cols-5 gap-3">
        {previews.map((media, index) => (
          <div key={media.id || media.url} className="relative group">
            <div className={`aspect-square rounded-xl overflow-hidden transition-all duration-300 border-2 ${media.isPrimary ? "border-pink-vivid" : "border-transparent"} relative bg-subtle`}>
              {isVideoMedia(media)
                ? <video src={media.url} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                : <Image src={media.url} alt="" fill unoptimized className="object-cover" sizes="200px" />}
              {media.isPrimary && <div className="absolute top-2 left-2 px-2 py-0.5 bg-gradient-to-r from-orange-warm to-pink-vivid text-white text-xs font-ui rounded-full">Cover</div>}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!media.isPrimary && <button type="button" onClick={(e) => { e.stopPropagation(); setCover(index); }} className="px-2 py-1 bg-surface/90 rounded-lg text-xs font-ui text-pink-vivid">Set cover</button>}
                <button type="button" onClick={(e) => { e.stopPropagation(); remove(index); }} aria-label="Remove" className="p-1.5 bg-surface/90 rounded-lg text-red-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          </div>
        ))}
        {Array.from({ length: MAX_MEDIA - previews.length }).map((_, index) => (
          <button key={`empty-${index}`} type="button" onClick={() => inputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-pink-200 hover:bg-pink-vivid/5 transition-all flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        ))}
      </div>
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
  const [showSpecializations, setShowSpecializations] = useState<boolean>(Boolean(initialProduct?.category));
  const [error, setError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [state, setState] = useState<CommissionWizardState>(() => (isEdit && initialProduct ? mapProductToCommissionState(initialProduct) : initialCommissionWizardState));

  const busy = creating || updating || savingDraft;
  const submitError = createError || updateError;
  const categories = useMemo(() => getAllCommissionCategories(), []);
  const selectedCategory = state.category ? COMMISSION_CATEGORIES[state.category] : null;

  // Object URLs minted for new files live as long as the wizard does.
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
    if (target === 1 && !state.category) return "Please select a category";
    if (target === 2 && state.mediaPreviews.length === 0) return "Please upload at least one image or video";
    if (target === 3) {
      if (!state.title.trim()) return "Please enter a title";
      if (!state.description.trim()) return "Please describe the commission";
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
      if (state.availability === "scheduled" && !state.opensAt) return "Pick the date this commission opens.";
    }
    return null;
  }, [state]);

  const scrollTop = () => { if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const goNext = () => {
    const problem = problemFor(step);
    if (problem) { setError(problem); scrollTop(); return; }
    setStep((s) => Math.min(3, s + 1) as StepIndex);
    scrollTop();
  };
  const goBack = () => { setStep((s) => Math.max(1, s - 1) as StepIndex); scrollTop(); };

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
    for (let i = 1; i <= 3; i += 1) {
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

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-subtle">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-warm/20 to-pink-vivid/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-ink mb-2">{isEdit ? "Sign in to edit listing" : "Sign in to open commissions"}</h2>
          <p className="text-muted font-body">{isEdit ? "You need an account to edit listings" : "Set your packages, questions and availability, and let people request your work directly"}</p>
        </div>
      </div>
    );
  }

  if (isEdit && !initialProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-subtle">
        <div className="w-10 h-10 rounded-full border-2 border-border-strong border-t-[var(--color-pink-vivid)] animate-spin" />
      </div>
    );
  }

  const isLive = savedStatus === "active";
  const title = step === 1
    ? (showSpecializations && selectedCategory
      ? { prefix: "Choose a", highlight1: "specialization", highlight2: "for your commission" }
      : { prefix: "Let's", highlight1: "create", highlight2: "your commission" })
    : step === 2
      ? { prefix: "Upload", highlight1: "media", highlight2: "for your commission" }
      : { prefix: "Add the", highlight1: "final", highlight2: "details" };

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <StepHeader step={step} labels={STEPS} prefix={title.prefix} highlight1={title.highlight1} highlight2={title.highlight2} />

        {(error || submitError) && <ErrorBanner message={(error || submitError) as string} />}

        <div className="mb-12">
          {step === 1 && (
            <div className="py-4">
              {!showSpecializations || !selectedCategory ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                  {categories.map((c) => (
                    <CategoryTile key={c.id} icon={CATEGORY_ICONS[c.id] ?? getCategoryIcon("sparkles")} label={c.name} selected={state.category === c.id} onClick={() => { update({ category: c.id, subcategory: null }); setShowSpecializations(true); }} />
                  ))}
                </div>
              ) : (
                <div>
                  <BackRow onBack={() => setShowSpecializations(false)} icon={CATEGORY_ICONS[selectedCategory.id] ?? getCategoryIcon("sparkles")} label={selectedCategory.name} />
                  <p className="text-muted font-body text-sm mb-6 text-center">Select a more specific type</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedCategory.subcategories.map((sub) => (
                      <OptionBox key={sub.value} selected={state.subcategory === sub.value} onClick={() => update({ subcategory: sub.value })} label={sub.label} />
                    ))}
                  </div>
                  <div className="mt-8 text-center">
                    <button type="button" onClick={() => { update({ subcategory: null }); goNext(); }} className="text-sm text-muted hover:text-pink-vivid transition-colors font-body">Skip this step</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && <MediaStep previews={state.mediaPreviews} onChange={(mediaPreviews) => update({ mediaPreviews })} onError={setError} />}

          {step === 3 && (
            <div className="space-y-10">
              <div>
                <FieldLabel required htmlFor="title">Title</FieldLabel>
                <GInput id="title" strong pencil maxLength={80} value={state.title} onChange={(title) => update({ title })} placeholder={`Name your ${state.subcategory ? getCommissionSubcategoryLabel(state.category || "", state.subcategory).toLowerCase() : "commission"}`} />
              </div>
              <div>
                <FieldLabel htmlFor="headline">Headline</FieldLabel>
                <GInput id="headline" maxLength={100} value={state.headline} onChange={(headline) => update({ headline })} placeholder="One line under the title on cards and the listing." />
              </div>

              <Section>
                <SectionHeader>Packages:</SectionHeader>
                <div className="space-y-8">
                  {state.packages.map((pkg, index) => (
                    <PackageEditor key={pkg.id} index={index} pkg={pkg} canRemove={state.packages.length > 1} onRemove={() => removePackage(pkg.id)} onChange={(patch) => updatePackage(pkg.id, patch)} />
                  ))}
                  {state.packages.length < 3 && <TextLink onClick={addPackage}>+ Add a package</TextLink>}
                </div>
              </Section>

              <Section>
                <SectionHeader>Questions for the buyer:</SectionHeader>
                <p className="text-sm font-body text-muted -mt-4 mb-6">Asked in the request sheet, before they pay. Answers land on the order page.</p>
                <IntakeFieldsEditor fields={state.intakeFields} onChange={(intakeFields) => update({ intakeFields })} />
              </Section>

              <Section>
                <SectionHeader>Includes and not included:</SectionHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div><FieldLabel>Includes</FieldLabel><LineList values={state.includes} placeholder="e.g. A sketch for approval first" onChange={(includes) => update({ includes })} /></div>
                  <div><FieldLabel>Not included</FieldLabel><LineList values={state.excludes} placeholder="e.g. Commercial use" onChange={(excludes) => update({ excludes })} /></div>
                </div>
              </Section>

              <Section>
                <SectionHeader>Availability:</SectionHeader>
                <AvailabilityEditor state={state} onChange={update} />
              </Section>

              <Section>
                <SectionHeader>Terms:</SectionHeader>
                <p className="text-sm font-body text-muted -mt-4 mb-6">Shown on your listing. Buyers agree to them when they send a request.</p>
                <GTextarea strong rows={5} maxLength={5000} value={state.terms} onChange={(terms) => update({ terms })} placeholder="Usage rights, what counts as a revision, cancellation, anything buyers agree to before ordering." />
                <div className="flex justify-end mt-2"><p className={`text-xs font-ui ${state.terms.length > 4500 ? "text-orange-warm" : "text-muted"}`}>{state.terms.length} / 5000</p></div>
              </Section>

              <Section>
                <SectionHeader>FAQ:</SectionHeader>
                <FaqEditor values={state.faqs} onChange={(faqs) => update({ faqs })} />
              </Section>

              <Section>
                <SectionHeader>Description:</SectionHeader>
                <GTextarea id="description" strong rows={6} maxLength={1200} value={state.description} onChange={(description) => update({ description })} placeholder="How you work, what you love making, what a buyer can expect." />
                <div className="flex justify-end mt-2"><p className={`text-xs font-ui ${state.description.length > 1080 ? "text-orange-warm" : "text-muted"}`}>{state.description.length} / 1200</p></div>
              </Section>

              <Section>
                <SectionHeader>Keywords:</SectionHeader>
                <TagInput values={state.keywords} onChange={(keywords) => update({ keywords })} placeholder="Add keywords…" helperText="Press Enter or comma to add" max={10} lowercase chipPrefix="#" />
              </Section>
            </div>
          )}
        </div>

        <WizardNav onBack={goBack} onNext={goNext} onPublish={publish} onSaveDraft={saveDraft} canSaveDraft={canSaveDraft} savingDraft={savingDraft} busy={busy} isFirst={step === 1} isLast={step === 3} isLive={isLive} />
      </div>
    </div>
  );
}
