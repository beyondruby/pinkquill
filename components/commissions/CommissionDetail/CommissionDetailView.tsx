"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useDeleteProduct, useProduct } from "@/lib/hooks/useProducts";
import { useCommissionAvailability } from "@/lib/hooks/useCommissions";
import { useSellerStats } from "@/lib/hooks/useReviews";
import { useStudioCart } from "@/lib/hooks/useStudioQueue";
import type { CommissionAvailabilityInfo, ProductPricing } from "@/lib/types/store";
import { COMMISSION_CATEGORIES, getCommissionSubcategoryLabel } from "@/lib/commissions/categories";
import { formatCurrency } from "@/lib/utils/currency";
import ProductGallery from "@/components/store/ProductDetail/ProductGallery";
import CommissionReviewsPanel from "@/components/commissions/CommissionReviewsPanel";
import RequestSheet, { PackageCard, estimatedDays, sortedIntakeFields, sortedPackages } from "@/components/commissions/RequestSheet";
import { QuillMeter } from "@/components/reviews/ReviewCard";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import ActionMenu from "@/components/ui/ActionMenu";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ShareModal from "@/components/ui/ShareModal";
import { showToast } from "@/lib/utils/toast";

/**
 * /commissions/[id] — the listing page (Phase 3c). Photo first, packages as
 * cards, and nothing the creator did not write or set: "How it works" is
 * built from the listing's real settings, reviews come from completed
 * orders, response time shows only when there is data.
 */

interface CommissionDetailViewProps {
  commissionId: string;
}

function availabilityPill(a: CommissionAvailabilityInfo | null): { label: string; cls: string } | null {
  if (!a) return null;
  if (!a.can_order) {
    if (a.availability === "scheduled" && a.opens_at && new Date(a.opens_at).getTime() > Date.now()) {
      return { label: `Opens ${new Date(a.opens_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, cls: "bg-subtle text-muted border-border-strong" };
    }
    return { label: a.mode === "closed" ? "Closed" : "Not taking requests", cls: "bg-subtle text-muted border-border-strong" };
  }
  if (a.mode === "waitlist") return { label: "Waitlist", cls: "bg-purple-50 text-purple-700 border-purple-200" };
  if (a.slots_total != null && a.slots_open != null) {
    return { label: `${a.slots_open} of ${a.slots_total} slot${a.slots_total === 1 ? "" : "s"} open`, cls: a.slots_open === 1 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  return { label: "Open", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
}

const QUESTION_KIND: Record<string, string> = { short_text: "text", long_text: "paragraph", number: "number", url: "link", select: "pick one", multi_select: "pick many", file: "file" };

export default function CommissionDetailView({ commissionId }: CommissionDetailViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { product, loading, error } = useProduct(commissionId);
  const { deleteProduct, deleting } = useDeleteProduct();
  const { addItem, hasItem } = useStudioCart();
  const { availability, refetch: refetchAvailability } = useCommissionAvailability(product?.id);
  const { stats } = useSellerStats(product?.seller_id);

  const [pricingId, setPricingId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const packages = useMemo(() => sortedPackages(product), [product]);
  const pkg: ProductPricing | null = packages.find((p) => p.id === pricingId) ?? packages[0] ?? null;
  const fields = useMemo(() => sortedIntakeFields(product), [product]);
  const faqs = useMemo(() => {
    const raw = product?.service_metadata?.faqs;
    return Array.isArray(raw) ? raw.filter((f): f is { question: string; answer: string } => !!f && typeof f === "object" && typeof (f as { question?: unknown }).question === "string" && typeof (f as { answer?: unknown }).answer === "string") : [];
  }, [product]);
  const includes = strings(product?.service_metadata?.includes);
  const excludes = strings(product?.service_metadata?.excludes);
  const process = strings(product?.service_metadata?.process);
  const keywords = strings(product?.keywords);
  const deliveryNotes = typeof product?.service_metadata?.delivery_notes === "string" && product.service_metadata.delivery_notes.trim() ? product.service_metadata.delivery_notes : null;
  const headline = typeof product?.service_metadata?.headline === "string" && product.service_metadata.headline.trim() ? product.service_metadata.headline : null;

  const isOwner = !!user && user.id === product?.seller_id;
  const inBag = pkg && product ? hasItem(product.id, pkg.id) : false;
  const canOrder = availability ? availability.can_order : true;
  const isWaitlist = availability?.mode === "waitlist";
  const days = estimatedDays(availability, pkg);
  const terms = availability?.terms?.trim() || product?.commission_listing?.terms?.trim() || null;
  const pill = availabilityPill(availability);

  const categoryLabel = product
    ? [COMMISSION_CATEGORIES[product.category]?.name || product.category, product.subcategory ? getCommissionSubcategoryLabel(product.category, product.subcategory) : null].filter(Boolean).join(" · ")
    : "";
  const sellerName = product?.seller?.display_name || product?.seller?.username || "Creator";
  const firstName = sellerName.split(" ")[0];

  const openRequest = () => {
    if (!product) return;
    if (!user) { router.push(`/login?redirect=${encodeURIComponent(`/commissions/${product.id}`)}`); return; }
    if (isOwner) { router.push(`/sell/edit/${product.id}`); return; }
    if (!canOrder) { showToast.info(availability?.reason || "This commission is not taking requests right now."); return; }
    setRequestOpen(true);
  };

  const saveToBag = () => {
    if (!product || !pkg) return;
    addItem({
      product_id: product.id, pricing_id: pkg.id, listing_type: "service", delivery_type: product.delivery_type,
      title: product.title, seller_name: sellerName, price: pkg.price, currency: pkg.currency,
      image_url: product.primary_image_url || product.media?.[0]?.media_url || null,
    });
    showToast.success("Saved to your Bag");
  };

  const handleDelete = async () => {
    if (!product) return;
    const result = await deleteProduct(product.id);
    if (!result) { showToast.error("Failed to delete commission", "Please try again"); return; }
    if (result.outcome === "archived") showToast.info("Commission archived", "This service has order history, so it was archived instead of deleted.");
    else showToast.success("Commission deleted");
    setShowDelete(false);
    router.push("/seller/listings");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas px-4 py-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8">
          <div className="space-y-5"><div className="aspect-[16/10] rounded-2xl bg-skeleton/70 animate-pulse" /><div className="h-8 w-2/3 rounded bg-skeleton/70 animate-pulse" /><div className="h-4 w-1/2 rounded bg-skeleton/70 animate-pulse" /></div>
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-skeleton/70 animate-pulse" />)}</div>
        </div>
      </div>
    );
  }

  if (error || !product || product.listing_type !== "service") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl text-ink mb-2">Commission not found</h1>
          <p className="font-body text-sm text-muted mb-6">This service may be private, unpublished, or removed.</p>
          <Button onClick={() => router.push("/shop?section=commissions")}>Browse commissions</Button>
        </div>
      </div>
    );
  }

  const ctaLabel = isOwner ? "Edit listing" : !canOrder ? "Not taking requests" : isWaitlist ? `Join the waitlist · ${formatCurrency(pkg?.price ?? 0)}` : `Request · ${formatCurrency(pkg?.price ?? 0)}`;

  const availabilityLine = !availability ? null : !availability.can_order ? (
    <p className="text-sm font-body text-muted">{availability.reason || "Not taking requests right now."}</p>
  ) : (
    <p className="text-sm font-body text-muted">
      {isWaitlist ? `${firstName} approves each request before you pay` : "Pinkquill holds your payment until you approve the work"}
      {pkg ? ` · about ${days} day${days === 1 ? "" : "s"}${availability.lead_time_days > 0 ? ` (includes a ${availability.lead_time_days}-day lead time)` : ""}, counted from ${availability.turnaround_starts}` : ""}
      {availability.queue_length > 0 ? ` · ${availability.queue_length} in progress` : ""}
    </p>
  );

  const howItWorks = process.length > 0 ? process.map((p, i) => [`Step ${i + 1}`, p] as const) : [
    ["Send your request", `Your brief${fields.length > 0 ? `, ${fields.length} question${fields.length === 1 ? "" : "s"}` : ""} and references.${isWaitlist ? ` ${firstName} accepts or declines first.` : " If the creator reviews requests first, you're told right away."}`],
    ["Pay", `Charged once${isWaitlist ? " the request is accepted" : ""}; Pinkquill holds it until you approve the work.`],
    ["Work", `${pkg?.delivery_days ? `${pkg.delivery_days} days` : "Delivery"} from ${availability?.turnaround_starts ?? "payment"}${availability?.lead_time_days ? ` after a ${availability.lead_time_days}-day lead time` : ""}. ${pkg?.revisions ?? 0} revision${(pkg?.revisions ?? 0) === 1 ? "" : "s"} included.`],
    ["Review", "The delivery lands on your order page. You have 3 days to approve or ask for a revision, then it auto-approves."],
    ["Done", "The creator is paid 7 days after approval. Reviews reveal together."],
  ] as const;

  const menu = (
    <ActionMenu
      buttonClassName="w-10 h-10 rounded-full bg-subtle text-muted hover:text-ink inline-flex items-center justify-center shrink-0 transition-colors"
      widthClassName="w-44"
      items={[
        { label: "Edit", onSelect: () => router.push(`/sell/edit/${product.id}`), hidden: !isOwner },
        { label: "Share", onSelect: () => setShowShare(true) },
        { label: "Delete", onSelect: () => setShowDelete(true), hidden: !isOwner, tone: "danger", dividerBefore: true },
      ]}
    />
  );

  const creatorRow = product.seller && (
    <div className="flex items-center gap-3 flex-wrap">
      <Link href={`/studio/${product.seller.username}`} className="flex items-center gap-2.5 min-w-0 group">
        <Avatar src={product.seller.avatar_url} alt="" size={40} />
        <span className="min-w-0">
          <span className="block text-sm font-ui font-semibold text-ink group-hover:text-accent transition-colors truncate">{sellerName}</span>
          <span className="block text-2xs font-body text-muted truncate">
            @{product.seller.username}
            {stats && stats.completed_orders > 0 ? ` · ${stats.completed_orders} completed` : ""}
            {stats && stats.avg_response_time_hours > 0 ? ` · replies in about ${Math.round(stats.avg_response_time_hours)}h` : ""}
          </span>
        </span>
      </Link>
      {stats && stats.total_reviews > 0 && (
        <span className="flex items-center gap-1.5 text-sm font-ui">
          <span className="font-semibold text-ink tabular-nums">{stats.avg_quill_score.toFixed(1)}</span>
          <QuillMeter score={Math.max(1, Math.min(5, Math.round(stats.avg_quill_score)))} />
          <span className="text-xs text-muted">({stats.total_reviews})</span>
        </span>
      )}
      {pill && <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-2xs font-ui font-semibold ${pill.cls}`}>{pill.label}</span>}
    </div>
  );

  const sections = (
    <div className="space-y-8">
      {product.description && (
        <Section title="About this commission"><p className="text-sm font-body text-ink/90 leading-relaxed whitespace-pre-line">{product.description}</p></Section>
      )}
      <Section title="How it works">
        <ol className="rounded-2xl bg-subtle border border-border-light divide-y divide-border-light">
          {howItWorks.map(([k, v], i) => (
            <li key={k} className="flex gap-4 px-4 py-3">
              <span className="w-6 h-6 rounded-full bg-surface border border-border-light text-2xs font-ui font-semibold text-ink inline-flex items-center justify-center shrink-0 tabular-nums">{i + 1}</span>
              <div className="min-w-0"><p className="text-sm font-ui font-semibold text-ink">{k}</p><p className="text-sm font-body text-muted mt-0.5">{v}</p></div>
            </li>
          ))}
        </ol>
      </Section>
      {(includes.length > 0 || excludes.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {includes.length > 0 && <Section title="Includes"><ul className="space-y-1.5">{includes.map((x) => <li key={x} className="text-sm font-body text-ink/85 flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{x}</li>)}</ul></Section>}
          {excludes.length > 0 && <Section title="Not included"><ul className="space-y-1.5">{excludes.map((x) => <li key={x} className="text-sm font-body text-ink/85 flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-orange-warm shrink-0" />{x}</li>)}</ul></Section>}
        </div>
      )}
      {fields.length > 0 && (
        <Section title="What you'll be asked">
          <ul className="space-y-1.5">
            {fields.map((f) => (
              <li key={f.id} className="text-sm font-body text-ink/85 flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-subtle text-3xs font-ui uppercase tracking-wider text-muted shrink-0">{QUESTION_KIND[f.field_type] ?? f.field_type}</span>
                <span>{f.label}{f.required && <span className="text-pink-vivid">*</span>}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {deliveryNotes && <Section title="Delivery notes"><p className="text-sm font-body text-ink/85 leading-relaxed whitespace-pre-line">{deliveryNotes}</p></Section>}
      {terms && (
        <Section title="Terms">
          <p className="text-sm font-body text-ink/85 leading-relaxed whitespace-pre-line">{terms}</p>
          <p className="text-2xs font-body text-muted mt-2">Written by {sellerName}. You agree to them when you send a request.</p>
        </Section>
      )}
      {faqs.length > 0 && (
        <Section title="FAQ">
          <div className="divide-y divide-border-light">
            {faqs.map((f) => <div key={f.question} className="py-3"><p className="text-sm font-ui font-semibold text-ink">{f.question}</p><p className="text-sm font-body text-muted mt-1">{f.answer}</p></div>)}
          </div>
        </Section>
      )}
      {product.seller && <CommissionReviewsPanel userId={product.seller.id} role="seller" isOwnProfile={isOwner} />}
      {keywords.length > 0 && <div className="flex flex-wrap gap-2">{keywords.map((k) => <span key={k} className="px-2.5 py-1 rounded-full bg-subtle text-xs font-ui text-muted">#{k}</span>)}</div>}
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-canvas pb-32 lg:pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
          <nav className="flex items-center justify-between gap-3 text-xs font-ui text-muted mb-4" aria-label="Breadcrumb">
            <span className="flex items-center gap-1.5 min-w-0">
              <Link href="/shop?section=commissions" className="hover:text-accent transition-colors">Commissions</Link>
              <span aria-hidden="true">›</span>
              <span className="text-ink font-medium truncate">{categoryLabel.split(" · ")[0]}</span>
            </span>
            {menu}
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8">
            <div className="space-y-6">
              <ProductGallery media={product.media || []} title={product.title} variant="service" />
              <header>
                <p className="text-2xs font-ui uppercase tracking-[0.12em] text-muted">{categoryLabel}</p>
                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink leading-tight mt-1 [text-wrap:balance]">{product.title}</h1>
                {headline && <p className="text-sm sm:text-base font-body text-muted mt-2">{headline}</p>}
                <div className="mt-4">{creatorRow}</div>
              </header>

              {/* Packages on phones: a horizontal row */}
              <div className="lg:hidden">
                <p className="font-ui text-2xs uppercase tracking-[0.12em] text-muted mb-2">Packages</p>
                <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-4 px-4 [scrollbar-width:none]">
                  {packages.map((p) => (
                    <div key={p.id} className="snap-start shrink-0 w-[78%] sm:w-[48%]"><PackageCard pkg={p} selected={pkg?.id === p.id} onSelect={() => setPricingId(p.id)} compact /></div>
                  ))}
                </div>
                <div className="mt-3">{availabilityLine}</div>
              </div>

              {sections}
            </div>

            {/* Packages on desktop: a sticky panel */}
            <aside className="hidden lg:block">
              <div className="rounded-2xl border border-border-light bg-surface p-5 sticky top-6">
                <p className="font-ui text-2xs uppercase tracking-[0.12em] text-muted mb-3">Choose a package</p>
                <div className="space-y-2.5">
                  {packages.map((p) => <PackageCard key={p.id} pkg={p} selected={pkg?.id === p.id} onSelect={() => setPricingId(p.id)} />)}
                  {packages.length === 0 && <p className="text-sm font-body text-muted">No packages yet.</p>}
                </div>
                <div className="mt-4 pt-4 border-t border-border-light space-y-3">
                  {availabilityLine}
                  <Button fullWidth size="lg" variant={isOwner || canOrder ? "primary" : "secondary"} onClick={openRequest} disabled={!isOwner && (!pkg || !canOrder)}>{ctaLabel}</Button>
                  {isOwner ? (
                    <p className="text-2xs font-body text-muted text-center">This is how people see your listing.</p>
                  ) : canOrder ? (
                    <div className="flex justify-center gap-4 text-xs font-ui">
                      <button type="button" onClick={saveToBag} disabled={!pkg || inBag} className="text-muted hover:text-ink disabled:opacity-60">{inBag ? "In your Bag" : "Save to Bag"}</button>
                      {product.seller && <Link href={`/studio/${product.seller.username}`} className="text-muted hover:text-ink">View studio</Link>}
                    </div>
                  ) : null}
                  {availability?.accepts_custom_quotes && canOrder && <p className="text-2xs font-body text-purple-primary text-center">Open to custom requests — describe it in your brief.</p>}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Phone: sticky bar above the bottom nav */}
      <div className="lg:hidden fixed inset-x-0 bottom-16 z-(--z-sticky) bg-surface/95 backdrop-blur-xl border-t border-border-light px-4 pt-3 pb-3 flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm font-ui font-semibold text-ink truncate">{pkg ? `${pkg.variant_name || "Package"} · ${formatCurrency(pkg.price)}` : product.title}</p>
          <p className="text-2xs font-body text-muted truncate">{pkg ? `${days} days · ${pkg.revisions ?? 0} revision${(pkg.revisions ?? 0) === 1 ? "" : "s"}` : ""}</p>
        </div>
        <Button className="ml-auto shrink-0" variant={isOwner || canOrder ? "primary" : "secondary"} onClick={openRequest} disabled={!isOwner && (!pkg || !canOrder)}>
          {isOwner ? "Edit" : !canOrder ? "Closed" : isWaitlist ? "Join waitlist" : "Request"}
        </Button>
      </div>

      {requestOpen && (
        <RequestSheet
          product={product}
          initialPricingId={pkg?.id ?? null}
          isOpen
          onClose={() => { setRequestOpen(false); void refetchAvailability(); }}
        />
      )}

      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        url={typeof window !== "undefined" ? window.location.href : ""}
        title={product.title}
        description={product.description || ""}
        type="service"
        authorName={sellerName}
        authorUsername={product.seller?.username || ""}
        authorAvatar={product.seller?.avatar_url || ""}
        imageUrl={product.media?.[0]?.media_url || ""}
      />

      <ConfirmationModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete this commission?"
        description="This cannot be undone. If the service has order history it is archived instead."
        confirmText="Delete"
        isDanger
        loading={deleting}
      />
    </>
  );
}
