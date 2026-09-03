"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import type { CommissionAvailabilityInfo, IntakeAnswerInput, ListingIntakeField, Order, Product, ProductPricing } from "@/lib/types/store";
import { useCreateOrder } from "@/lib/hooks/useOrders";
import { useProduct } from "@/lib/hooks/useProducts";
import { useCommissionAvailability } from "@/lib/hooks/useCommissions";
import { useAddReferences } from "@/lib/hooks/useOrderWorkroom";
import { formatCurrency } from "@/lib/utils/currency";
import { formatBytes } from "@/components/orders/AttachmentGrid";
import { shortDateTime } from "@/components/orders/orderFormat";

/**
 * The one request flow (Phase 3c): package → brief and the creator's
 * questions → references → review with the real money split → outcome.
 * Used by the listing page and the Bag. Creates the order through
 * /api/orders/create (create_marketplace_order decides approval, due date
 * and slots); reference files are attached right after.
 */

export interface RequestSheetProps {
  product: Product;
  initialPricingId?: string | null;
  /** Mount the sheet only while open (`{open && <RequestSheet isOpen …/>}`) so each opening starts at step 1. */
  isOpen: boolean;
  onClose: () => void;
  /** Called once the order exists (before the outcome screen). The Bag uses it to drop the item. */
  onCreated?: (order: Order) => void;
}

interface MoneyPreview { amount: number; platform_fee: number; seller_amount: number; buyer_fee: number; total_amount: number }

/** The fee split for a package price, from the same SQL function checkout uses. */
function useMoneyPreview(amount: number | null) {
  const [money, setMoney] = useState<MoneyPreview | null>(null);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (amount == null) { setMoney(null); return; }
      const { data, error } = await supabase.rpc("compute_order_money", { p_item_amount: amount, p_shipping: 0, p_discount: 0 });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) { setMoney(null); return; }
      setMoney({
        amount: Number(row.amount), platform_fee: Number(row.platform_fee), seller_amount: Number(row.seller_amount),
        buyer_fee: Number(row.buyer_fee), total_amount: Number(row.total_amount),
      });
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [amount]);
  return money;
}

export function sortedPackages(product: Product | null | undefined): ProductPricing[] {
  return [...(product?.pricing ?? [])].sort((a, b) => a.price - b.price);
}

export function sortedIntakeFields(product: Product | null | undefined): ListingIntakeField[] {
  const fields = product?.intake_fields;
  if (!Array.isArray(fields)) return [];
  return [...fields].sort((a, b) => a.position - b.position);
}

export function estimatedDays(availability: CommissionAvailabilityInfo | null, pkg: ProductPricing | null): number {
  return (availability?.lead_time_days ?? 0) + (pkg?.delivery_days ?? 0);
}

const INPUT = "w-full px-3.5 py-2.5 rounded-xl border border-border-light bg-surface text-sm font-body text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-purple-primary/25 focus:border-purple-primary/40 transition-shadow";
const STEP_NAMES = ["Package", "Brief", "References", "Review"];

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Request steps">
      {STEP_NAMES.map((name, i) => (
        <li key={name} className={`flex items-center gap-2 ${i < STEP_NAMES.length - 1 ? "flex-1" : ""}`}>
          <span className={`w-6 h-6 rounded-full text-2xs font-ui font-semibold inline-flex items-center justify-center shrink-0 ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-purple-primary text-white" : "bg-subtle text-muted"}`} aria-current={i === step ? "step" : undefined}>
            {i < step ? "✓" : i + 1}
          </span>
          <span className={`text-2xs font-ui hidden sm:inline ${i === step ? "text-ink font-semibold" : "text-muted"}`}>{name}</span>
          {i < STEP_NAMES.length - 1 && <span className={`h-px flex-1 ${i < step ? "bg-emerald-400" : "bg-skeleton"}`} />}
        </li>
      ))}
    </ol>
  );
}

export function PackageCard({ pkg, selected, onSelect, compact = false }: { pkg: ProductPricing; selected: boolean; onSelect?: () => void; compact?: boolean }) {
  const features = Array.isArray(pkg.package_features) ? pkg.package_features.filter((f) => typeof f === "string" && f.trim()) : [];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-left rounded-2xl border p-4 transition-colors ${selected ? "border-purple-primary bg-purple-50/60" : "border-border-light bg-surface hover:border-border-strong"}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-ui text-sm font-semibold text-ink">{pkg.variant_name || "Package"}</span>
        <span className="font-display text-lg font-semibold text-ink tabular-nums">{formatCurrency(pkg.price, pkg.currency)}</span>
      </div>
      <p className="text-2xs font-body text-muted mt-0.5">
        {pkg.delivery_days ? `${pkg.delivery_days}-day delivery` : "Custom delivery"} · {pkg.revisions ?? 0} revision{(pkg.revisions ?? 0) === 1 ? "" : "s"}
      </p>
      {features.length > 0 && (
        <ul className={`mt-2.5 space-y-1 ${compact ? "max-h-24 overflow-hidden" : ""}`}>
          {features.map((f) => (
            <li key={f} className="text-xs font-body text-ink/85 flex gap-2">
              <span className={`mt-[7px] w-1 h-1 rounded-full shrink-0 ${selected ? "bg-purple-primary" : "bg-border-strong"}`} />
              {f}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

function IntakeQuestion({ field, value, onChange }: { field: ListingIntakeField; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const label = (
    <label className="block text-sm font-ui font-semibold text-ink mb-1.5">
      {field.label}
      {field.required && <span className="text-pink-vivid"> *</span>}
      {field.help_text && <span className="block text-xs font-body font-normal text-muted mt-0.5">{field.help_text}</span>}
    </label>
  );
  if (field.field_type === "file") {
    return <div>{label}<p className="text-xs font-body text-muted">Add this on the References step.</p></div>;
  }
  if (field.field_type === "select") {
    return (
      <div>{label}
        <select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={INPUT}>
          <option value="">Choose…</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (field.field_type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div>{label}
        <div className="flex flex-wrap gap-2">
          {field.options.map((o) => {
            const active = selected.includes(o);
            return (
              <button key={o} type="button" aria-pressed={active} onClick={() => onChange(active ? selected.filter((x) => x !== o) : [...selected, o])}
                className={`px-3 py-1.5 rounded-full text-sm font-ui border transition-colors ${active ? "border-purple-primary bg-purple-50 text-purple-primary" : "border-border-light text-ink hover:border-border-strong"}`}>
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (field.field_type === "long_text") {
    return <div>{label}<textarea rows={3} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={INPUT} /></div>;
  }
  return (
    <div>{label}
      <input type={field.field_type === "number" ? "number" : field.field_type === "url" ? "url" : "text"} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={INPUT} />
    </div>
  );
}

type Outcome = { kind: "approval" | "pay"; order: Order; queuePosition: number | null };

export default function RequestSheet({ product, initialPricingId, isOpen, onClose, onCreated }: RequestSheetProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { createOrder, creating, error: createError } = useCreateOrder();
  const { addReferences } = useAddReferences();
  const { availability, refetch: refetchAvailability } = useCommissionAvailability(isOpen ? product.id : null);

  const packages = useMemo(() => sortedPackages(product), [product]);
  const fields = useMemo(() => sortedIntakeFields(product), [product]);
  const [pricingId, setPricingId] = useState<string | null>(initialPricingId ?? null);
  const pkg = packages.find((p) => p.id === pricingId) ?? packages[0] ?? null;
  const money = useMoneyPreview(isOpen && pkg ? pkg.price : null);

  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  // Parents mount this component only while it is open, so every opening starts fresh.

  const sellerName = product.seller?.display_name || product.seller?.username || "the creator";
  const firstName = sellerName.split(" ")[0];
  const isWaitlist = availability?.mode === "waitlist";
  const approval = isWaitlist || false; // the server decides; the waitlist always needs approval
  const days = estimatedDays(availability, pkg);
  const terms = availability?.terms?.trim() || product.commission_listing?.terms?.trim() || null;

  const validateBrief = (): string | null => {
    if (!brief.trim()) return "Add a brief so the creator knows what you need.";
    for (const f of fields) {
      if (!f.required || f.field_type === "file") continue;
      const v = answers[f.id];
      const empty = v === undefined || (typeof v === "string" ? v.trim().length === 0 : v.length === 0);
      if (empty) return `Please answer "${f.label}".`;
    }
    return null;
  };

  const next = () => {
    setError(null);
    if (step === 0 && !pkg) { setError("Choose a package."); return; }
    if (step === 1) { const v = validateBrief(); if (v) { setError(v); return; } }
    setStep((s) => Math.min(s + 1, 3));
  };
  const back = () => { setError(null); setStep((s) => Math.max(s - 1, 0)); };

  const submit = useCallback(async () => {
    if (!pkg) return;
    setError(null);
    if (terms && !agreed) { setError(`Please confirm you've read ${firstName}'s terms.`); return; }
    const intakeAnswers: IntakeAnswerInput[] = fields
      .filter((f) => f.field_type !== "file")
      .map((f) => ({ field_id: f.id, value: answers[f.id] ?? "" }))
      .filter((a) => (typeof a.value === "string" ? a.value.trim().length > 0 : a.value.length > 0));

    const order = await createOrder({ product_id: product.id, pricing_id: pkg.id, brief: brief.trim(), requirements: { answers: intakeAnswers } });
    if (!order) { void refetchAvailability(); return; }
    onCreated?.(order);

    if (files.length > 0) {
      const result = await addReferences(order.id, files);
      if (!result) setUploadWarning("Your request was sent, but some reference files could not be uploaded. Add them from the order page.");
    }

    let queuePosition: number | null = null;
    if (order.status === "pending_acceptance" && isWaitlist) {
      const { data } = await supabase.rpc("get_order_queue_position", { p_order_id: order.id });
      const pos = (data as { position?: number } | null)?.position;
      queuePosition = typeof pos === "number" ? pos : null;
    }
    setOutcome({ kind: order.status === "pending_acceptance" ? "approval" : "pay", order, queuePosition });
  }, [pkg, terms, agreed, firstName, fields, answers, createOrder, product.id, brief, refetchAvailability, onCreated, files, addReferences, isWaitlist]);

  if (!isOpen) return null;

  // ── outcome ──
  if (outcome) {
    const { order, kind, queuePosition } = outcome;
    const total = Number(order.total_amount ?? order.amount);
    const rows: Array<[string, string]> = [["Package", `${pkg?.variant_name || "Package"} · ${formatCurrency(order.amount)}`]];
    if (kind === "approval") {
      rows.push(["If accepted, you pay", formatCurrency(total)]);
      rows.push(["Estimated delivery", `${days} days from ${availability?.turnaround_starts === "acceptance" ? "acceptance" : "payment"}`]);
    } else {
      rows.push(["Processing fee", formatCurrency(Number(order.buyer_fee ?? 0))]);
      rows.push(["Total", formatCurrency(total)]);
      if (order.due_date) rows.push(["Due", shortDateTime(order.due_date).replace(/,.*$/, "")]);
    }
    return (
      <Sheet isOpen onClose={() => router.push(`/orders/${order.id}`)} title={kind === "approval" ? "Request sent" : "Ready to pay"} size="md"
        footer={kind === "approval"
          ? <><Button variant="secondary" onClick={onClose}>Back to listing</Button><Button onClick={() => router.push(`/orders/${order.id}`)}>View request</Button></>
          : <><Button variant="secondary" onClick={() => router.push(`/orders/${order.id}`)}>Pay later</Button><Button onClick={() => router.push(`/checkout/${order.id}`)}>Pay {formatCurrency(total)}</Button></>}
      >
        <div className="text-center pt-1">
          <span className={`w-14 h-14 rounded-full border inline-flex items-center justify-center ${kind === "approval" ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`} aria-hidden="true">
            {kind === "approval" ? (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            )}
          </span>
          <p className="text-sm font-body text-muted mt-4 max-w-[40ch] mx-auto">
            {kind === "approval" ? (
              <>{sellerName} has {order.seller_response_deadline ? <>until <b className="text-ink">{shortDateTime(order.seller_response_deadline)}</b></> : "48 hours"} to accept. Nothing is charged until they do; you&apos;ll get a notification with a Pay button.{queuePosition ? <> You are <b className="text-ink">#{queuePosition} in the waitlist</b>.</> : null}</>
            ) : (
              <>Your request is saved. Pay <b className="text-ink">{formatCurrency(total)}</b> now and {firstName}&apos;s {pkg?.delivery_days ?? days}-day clock starts. Pinkquill holds the money until you approve the work.</>
            )}
          </p>
        </div>
        <div className="rounded-2xl bg-subtle border border-border-light p-4 text-sm font-body space-y-1.5">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><span className="text-muted">{k}</span><span className="text-ink tabular-nums text-right">{v}</span></div>)}
        </div>
        {uploadWarning && <p className="text-xs font-body text-amber-700">{uploadWarning}</p>}
        {kind === "pay" && <p className="text-2xs font-body text-muted">Not ready? The request waits on your Orders page and you can pay from there.</p>}
      </Sheet>
    );
  }

  // ── steps ──
  const titles = ["Choose a package", `Tell ${firstName} what you need`, "References", "Review your request"];
  const subtitles = [undefined, undefined, "Optional, up to 20 files. Sketches, mood boards, the character sheet.", undefined];
  const submitLabel = isWaitlist ? "Join the waitlist" : approval ? "Send request" : money ? `Continue · ${formatCurrency(money.total_amount)}` : "Continue";
  const busy = creating;

  return (
    <Sheet isOpen onClose={onClose} busy={busy} title={titles[step]} subtitle={subtitles[step]} size="tall"
      footer={<>
        {step === 0 ? <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button> : <Button variant="secondary" onClick={back} disabled={busy}>Back</Button>}
        {step < 3
          ? <Button onClick={next} disabled={busy || (step === 0 && !pkg)}>Continue</Button>
          : <Button onClick={submit} loading={busy} loadingText="Sending…" disabled={busy || !user}>{submitLabel}</Button>}
      </>}
    >
      <Stepper step={step} />

      {step === 0 && (
        <>
          <div className="space-y-2.5">
            {packages.map((p) => <PackageCard key={p.id} pkg={p} selected={pkg?.id === p.id} onSelect={() => setPricingId(p.id)} />)}
          </div>
          {availability?.accepts_custom_quotes && <p className="text-xs font-body text-muted">Need something outside these? {firstName} takes custom requests — describe it in the brief.</p>}
        </>
      )}

      {step === 1 && (
        <>
          <div>
            <label className="block text-sm font-ui font-semibold text-ink mb-1.5">Brief<span className="text-pink-vivid"> *</span></label>
            <textarea rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What you want, the mood, what to avoid, and what you'll use it for." className={INPUT} />
          </div>
          {fields.length > 0 && (
            <div className="space-y-4">
              <p className="font-ui text-2xs uppercase tracking-[0.12em] text-muted">{firstName} asks</p>
              {fields.map((f) => <IntakeQuestion key={f.id} field={f} value={answers[f.id]} onChange={(v) => setAnswers((prev) => ({ ...prev, [f.id]: v }))} />)}
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <label className="block rounded-xl border border-dashed border-border-strong bg-subtle p-6 text-center cursor-pointer hover:border-purple-primary/40 transition-colors">
            <span className="text-sm font-ui font-medium text-ink">Drop files or tap to choose</span>
            <span className="block text-2xs font-body text-muted mt-0.5">Images, PDFs, video · 100 MB each</span>
            <input type="file" multiple className="sr-only" onChange={(e) => { const picked = Array.from(e.target.files ?? []); e.target.value = ""; setFiles((prev) => [...prev, ...picked].slice(0, 20)); }} />
          </label>
          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-subtle text-xs font-ui">
                  <span className="truncate text-ink">{f.name}</span>
                  <span className="flex items-center gap-2 shrink-0 text-muted">{formatBytes(f.size)}<button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="hover:text-red-600">×</button></span>
                </li>
              ))}
            </ul>
          )}
          {fields.some((f) => f.field_type === "file") && (
            <p className="text-xs font-body text-muted">{firstName} asked for: {fields.filter((f) => f.field_type === "file").map((f) => f.label).join(", ")}.</p>
          )}
        </>
      )}

      {step === 3 && pkg && (
        <>
          <div className="flex items-center gap-3 rounded-2xl border border-border-light p-3">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 shrink-0">
              {(product.primary_image_url || product.media?.[0]?.media_url) && <Image src={product.primary_image_url || product.media![0].media_url} alt="" fill className="object-cover" sizes="56px" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-ui font-semibold text-ink truncate">{product.title}</p>
              <p className="text-2xs font-body text-muted">{pkg.variant_name || "Package"} · {days} days from {availability?.turnaround_starts === "acceptance" ? "acceptance" : "payment"} · {pkg.revisions ?? 0} revision{(pkg.revisions ?? 0) === 1 ? "" : "s"}</p>
            </div>
            <button type="button" onClick={() => setStep(0)} className="text-xs font-ui font-semibold text-purple-primary">Change</button>
          </div>
          <div className="rounded-2xl bg-subtle border border-border-light p-4 space-y-2 text-sm font-body">
            <div className="flex justify-between"><span className="text-muted">{pkg.variant_name || "Package"}</span><span className="tabular-nums text-ink">{formatCurrency(pkg.price)}</span></div>
            {money ? (
              <>
                <div className="flex justify-between text-muted/80"><span>Creator receives</span><span className="tabular-nums">{formatCurrency(money.seller_amount)}</span></div>
                <div className="flex justify-between text-muted/80"><span>Pinkquill fee</span><span className="tabular-nums">{formatCurrency(money.platform_fee)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Processing fee</span><span className="tabular-nums text-ink">{formatCurrency(money.buyer_fee)}</span></div>
                <div className="flex justify-between pt-2 border-t border-border-light font-ui font-semibold text-ink"><span>{approval ? "Total if accepted" : "Total"}</span><span className="tabular-nums text-base">{formatCurrency(money.total_amount)}</span></div>
              </>
            ) : (
              <div className="h-16 rounded-lg bg-skeleton/60 animate-pulse" />
            )}
            <p className="text-2xs font-body text-muted pt-1">Held by Pinkquill until you approve the work. Your card may be charged in its local currency at checkout.</p>
          </div>
          <div className="text-sm font-body text-ink/90">
            <p className="font-ui text-2xs uppercase tracking-[0.12em] text-muted mb-1">Your brief</p>
            <p className="line-clamp-3 whitespace-pre-wrap">{brief}</p>
            <p className="text-2xs text-muted mt-1">{fields.filter((f) => f.field_type !== "file" && answers[f.id] && String(answers[f.id]).length > 0).length} answer{fields.length === 1 ? "" : "s"} · {files.length} reference file{files.length === 1 ? "" : "s"}</p>
          </div>
          {terms && (
            <label className="flex items-start gap-3 text-sm font-body text-ink cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 w-4 h-4 accent-[var(--color-purple-primary)]" />
              <span>I&apos;ve read {firstName}&apos;s terms. <details className="inline"><summary className="inline text-purple-primary font-ui text-xs cursor-pointer">Read terms</summary><span className="block mt-2 text-xs text-muted whitespace-pre-line max-h-40 overflow-y-auto">{terms}</span></details></span>
            </label>
          )}
          {!user && <p className="text-sm font-body text-amber-700">Sign in to send this request.</p>}
        </>
      )}

      {(error || createError) && <p className="text-sm font-body text-red-600" role="alert">{error || createError}</p>}
    </Sheet>
  );
}

/** Loads the product first — for places that only know the id (the Bag). */
export function RequestSheetForProduct({ productId, ...rest }: Omit<RequestSheetProps, "product"> & { productId: string }) {
  const { product, loading } = useProduct(rest.isOpen ? productId : undefined);
  if (!rest.isOpen) return null;
  if (loading || !product) {
    return (
      <Sheet isOpen onClose={rest.onClose} title="Loading…" size="tall">
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-skeleton/60 animate-pulse" />)}</div>
      </Sheet>
    );
  }
  return <RequestSheet product={product} {...rest} />;
}
