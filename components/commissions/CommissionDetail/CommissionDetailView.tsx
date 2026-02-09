"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProduct } from "@/lib/hooks/useProducts";
import { useCreateOrder } from "@/lib/hooks/useOrders";
import { useStudioQueue } from "@/lib/hooks/useStudioQueue";
import { getCommissionSubcategoryLabel } from "@/lib/commissions/categories";
import { PLATFORM_FEES } from "@/lib/types/store";
import ProductGallery from "@/components/store/ProductDetail/ProductGallery";
import SellerRating from "@/components/reviews/SellerRating";

interface CommissionDetailViewProps {
  commissionId: string;
}

export default function CommissionDetailView({ commissionId }: CommissionDetailViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { product, loading, error } = useProduct(commissionId);
  const { createOrder, creating: hiring, error: hireError } = useCreateOrder();
  const { addItem, hasItem } = useStudioQueue();

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [brief, setBrief] = useState("");
  const [timelineDays, setTimelineDays] = useState(7);
  const [requirementsText, setRequirementsText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const packages = useMemo(() => {
    if (!product?.pricing) return [];
    return [...product.pricing].sort((a, b) => a.price - b.price);
  }, [product]);

  const selectedPackage = useMemo(() => {
    if (!packages.length) return null;
    if (!selectedPackageId) return packages[0];
    return packages.find((pkg) => pkg.id === selectedPackageId) || packages[0];
  }, [packages, selectedPackageId]);

  const isQueued = selectedPackage && product ? hasItem(product.id, selectedPackage.id) : false;

  const serviceFaqs = useMemo(() => {
    const faqs = product?.service_metadata?.faqs;
    if (!Array.isArray(faqs)) return [];
    return faqs.filter((item): item is { question: string; answer: string } => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as { question?: unknown; answer?: unknown };
      return typeof candidate.question === "string" && typeof candidate.answer === "string";
    });
  }, [product]);

  const serviceRequirements = useMemo(() => {
    const items = product?.service_metadata?.requirements;
    if (!Array.isArray(items)) return [];
    return items.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }, [product]);

  const serviceKeywords = useMemo(() => {
    const items = product?.keywords;
    if (!Array.isArray(items)) return [];
    return items.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }, [product]);

  const serviceIncludes = useMemo(() => {
    const items = product?.service_metadata?.includes;
    if (!Array.isArray(items)) return [];
    return items.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }, [product]);

  const serviceExcludes = useMemo(() => {
    const items = product?.service_metadata?.excludes;
    if (!Array.isArray(items)) return [];
    return items.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }, [product]);

  const deliveryNotes = useMemo(() => {
    const value = product?.service_metadata?.delivery_notes;
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }, [product]);

  const minDeliveryDays = useMemo(() => {
    return packages
      .map((pkg) => pkg.delivery_days)
      .filter((days): days is number => days !== null && days !== undefined)
      .sort((a, b) => a - b)[0];
  }, [packages]);

  const maxRevisions = useMemo(() => {
    return packages
      .map((pkg) => pkg.revisions)
      .filter((count): count is number => count !== null && count !== undefined)
      .sort((a, b) => b - a)[0];
  }, [packages]);

  const categoryLabel = useMemo(() => {
    if (!product) return "";
    if (!product.subcategory) return product.category;
    return `${product.category} · ${getCommissionSubcategoryLabel(product.category, product.subcategory)}`;
  }, [product]);

  const openHireModal = () => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!selectedPackage) {
      setLocalError("Select a package before hiring.");
      return;
    }

    setShowHireModal(true);
    setLocalError(null);
  };

  const submitHire = async () => {
    if (!selectedPackage || !product) return;

    if (!brief.trim()) {
      setLocalError("Add a project brief so the creator can start quickly.");
      return;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Math.max(1, timelineDays));

    const order = await createOrder({
      product_id: product.id,
      pricing_id: selectedPackage.id,
      listing_type: "service",
      amount: selectedPackage.price,
      platform_fee: Math.round(selectedPackage.price * PLATFORM_FEES.service * 100) / 100,
      seller_amount: Math.round(selectedPackage.price * (1 - PLATFORM_FEES.service) * 100) / 100,
      currency: selectedPackage.currency,
      brief,
      due_date: dueDate.toISOString(),
      max_revisions: selectedPackage.revisions || undefined,
      requirements: {
        notes: requirementsText,
      },
    });

    if (order) {
      setShowHireModal(false);
      router.push(`/orders/${order.id}?payment=start`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f4fb] px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="h-48 rounded-3xl bg-[#1b122a] animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
            <div className="aspect-square rounded-[28px] bg-[#1f172f] animate-pulse" />
            <div className="rounded-3xl bg-white border border-black/[0.06] p-6 space-y-4">
              <div className="h-8 w-2/3 bg-gray-100 rounded animate-pulse" />
              <div className="h-20 w-full bg-gray-100 rounded-2xl animate-pulse" />
              <div className="h-12 w-full bg-gray-100 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product || product.listing_type !== "service") {
    return (
      <div className="min-h-screen bg-[#f6f4fb] flex items-center justify-center px-4">
        <div className="max-w-md text-center rounded-3xl border border-black/[0.06] bg-white p-8 shadow-sm">
          <h1 className="font-display text-3xl text-ink mb-3">Commission Not Found</h1>
          <p className="font-body text-sm text-muted mb-6">This service may be private, unpublished, or removed.</p>
          <Link
            href="/shop?section=commissions"
            className="inline-flex px-5 py-3 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid"
          >
            Browse Commissions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#f6f4fb] pb-16">
        <section className="relative overflow-hidden bg-[#1a1229] text-white">
          <div className="absolute -top-24 left-0 w-80 h-80 rounded-full bg-pink-vivid/20 blur-3xl" />
          <div className="absolute -bottom-24 right-0 w-80 h-80 rounded-full bg-purple-primary/35 blur-3xl" />

          <div className="relative max-w-6xl mx-auto px-4 pt-10 pb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-ui font-semibold uppercase tracking-[0.14em] text-pink-100">
              Commission Service
            </div>

            <h1 className="mt-4 font-display text-3xl md:text-4xl leading-tight text-white max-w-4xl">
              {product.title}
            </h1>

            {product.service_metadata?.headline && (
              <p className="mt-3 text-sm md:text-base font-body text-white/80 max-w-3xl">
                {String(product.service_metadata.headline)}
              </p>
            )}

            {product.seller && (
              <div className="mt-4">
                <p className="text-sm font-body text-white/70">
                  by{" "}
                  <Link
                    href={`/studio/${product.seller.username}`}
                    className="text-pink-200 hover:text-orange-warm transition-colors font-ui font-semibold"
                  >
                    {product.seller.display_name || product.seller.username}
                  </Link>
                </p>
                <div className="mt-1.5">
                  <SellerRating sellerId={product.seller.id} compact />
                </div>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              <HeroMetric
                title="Response"
                value={`${product.service_metadata?.response_time_hours ?? 24}h avg`}
              />
              <HeroMetric
                title="Fastest Delivery"
                value={minDeliveryDays ? `${minDeliveryDays} day${minDeliveryDays === 1 ? "" : "s"}` : "Custom"}
              />
              <HeroMetric
                title="Revisions"
                value={maxRevisions !== undefined ? `${maxRevisions} max` : "Custom"}
              />
              <HeroMetric title="Category" value={categoryLabel} />
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 -mt-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 lg:gap-8">
            <div className="space-y-6">
              <section className="rounded-[30px] border border-white/15 bg-[#120d1d] p-3 sm:p-4 shadow-2xl shadow-black/30">
                <ProductGallery media={product.media || []} title={product.title} variant="service" />
              </section>

              {product.description && (
                <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-6 shadow-sm">
                  <h2 className="font-display text-xl text-ink">Service Overview</h2>
                  <p className="mt-3 text-sm font-body leading-relaxed text-ink/85">{product.description}</p>
                </section>
              )}

              {(serviceIncludes.length > 0 || serviceExcludes.length > 0) && (
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {serviceIncludes.length > 0 && (
                    <article className="rounded-3xl border border-emerald-500/20 bg-white p-5 shadow-sm">
                      <h3 className="font-display text-lg text-ink">Included</h3>
                      <ul className="mt-3 space-y-2">
                        {serviceIncludes.map((item) => (
                          <li key={item} className="text-sm font-body text-ink/90 flex items-start gap-2">
                            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  )}

                  {serviceExcludes.length > 0 && (
                    <article className="rounded-3xl border border-orange-warm/25 bg-white p-5 shadow-sm">
                      <h3 className="font-display text-lg text-ink">Not Included</h3>
                      <ul className="mt-3 space-y-2">
                        {serviceExcludes.map((item) => (
                          <li key={item} className="text-sm font-body text-ink/90 flex items-start gap-2">
                            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-orange-warm" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  )}
                </section>
              )}

              {(serviceRequirements.length > 0 || serviceFaqs.length > 0 || serviceKeywords.length > 0 || Boolean(deliveryNotes)) && (
                <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-6 shadow-sm space-y-6">
                  {serviceRequirements.length > 0 && (
                    <div>
                      <h3 className="font-display text-lg text-ink">What I Need From You</h3>
                      <ol className="mt-3 space-y-2">
                        {serviceRequirements.map((item, index) => (
                          <li key={item} className="flex items-start gap-3">
                            <span className="inline-flex w-6 h-6 rounded-full bg-pink-50 text-pink-vivid text-xs font-ui font-semibold items-center justify-center mt-0.5">
                              {index + 1}
                            </span>
                            <span className="text-sm font-body text-ink/90">{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {serviceFaqs.length > 0 && (
                    <div>
                      <h3 className="font-display text-lg text-ink">FAQs</h3>
                      <div className="mt-3 space-y-2.5">
                        {serviceFaqs.map((faq) => (
                          <article key={faq.question} className="rounded-2xl border border-black/[0.07] px-4 py-3">
                            <h4 className="font-ui text-sm font-semibold text-ink">{faq.question}</h4>
                            <p className="font-body text-sm text-muted mt-1">{faq.answer}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {deliveryNotes && (
                    <div>
                      <h3 className="font-display text-lg text-ink">Delivery Notes</h3>
                      <p className="mt-2 text-sm font-body text-ink/90 leading-relaxed">{deliveryNotes}</p>
                    </div>
                  )}

                  {serviceKeywords.length > 0 && (
                    <div>
                      <h3 className="font-display text-lg text-ink">Tags</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {serviceKeywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-50 text-purple-primary text-xs font-ui border border-purple-primary/15"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-8 lg:self-start space-y-4">
              <section className="rounded-3xl border border-black/[0.08] bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-xl text-ink">Choose a Package</h2>
                  <span className="text-xs font-ui text-muted">
                    {packages.length} option{packages.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5">
                  {packages.map((pkg) => {
                    const selected = selectedPackage?.id === pkg.id;

                    return (
                      <button
                        key={pkg.id}
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className={`w-full text-left rounded-2xl border px-3.5 py-3 transition-colors ${
                          selected
                            ? "border-pink-vivid/35 bg-pink-50/70"
                            : "border-black/[0.08] hover:bg-black/[0.02]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-ui text-sm font-semibold text-ink">{pkg.variant_name || "Package"}</p>
                            <p className="text-xs font-body text-muted mt-1">
                              {pkg.delivery_days ?? 7} day delivery · {pkg.revisions ?? 0} revision
                              {(pkg.revisions ?? 0) === 1 ? "" : "s"}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="font-display text-xl text-ink">
                              ${pkg.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                            </p>
                            <span
                              className={`inline-flex mt-2 w-5 h-5 rounded-full border-2 items-center justify-center ${
                                selected ? "border-pink-vivid" : "border-gray-300"
                              }`}
                            >
                              {selected && <span className="w-2 h-2 rounded-full bg-pink-vivid" />}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedPackage && Array.isArray(selectedPackage.package_features) && selectedPackage.package_features.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-black/[0.07] bg-black/[0.02] p-3.5">
                    <p className="text-xs font-ui uppercase tracking-[0.14em] text-muted">Included in this package</p>
                    <ul className="mt-2 space-y-1.5">
                      {selectedPackage.package_features.map((feature) => (
                        <li key={feature} className="text-sm font-body text-ink/90 flex items-start gap-2">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-pink-vivid" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={openHireModal}
                  disabled={!selectedPackage}
                  className="mt-5 w-full py-3.5 rounded-xl text-white font-display font-semibold text-lg bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm hover:shadow-lg hover:shadow-pink-vivid/20 transition-all disabled:opacity-60"
                >
                  Hire Creator
                </button>

                {selectedPackage && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      onClick={() => {
                        if (!product) return;
                        addItem({
                          product_id: product.id,
                          pricing_id: selectedPackage.id,
                          listing_type: "service",
                          delivery_type: product.delivery_type,
                          title: product.title,
                          seller_name: product.seller?.display_name || product.seller?.username || "Creator",
                          price: selectedPackage.price,
                          currency: selectedPackage.currency,
                          image_url: product.primary_image_url || product.media?.[0]?.media_url || null,
                        });
                      }}
                      className="w-full py-2.5 rounded-xl border border-purple-primary/30 bg-purple-50 text-purple-primary font-ui font-semibold text-sm hover:bg-purple-100 transition-colors"
                    >
                      {isQueued ? "In Studio Queue" : "Add to Studio Queue"}
                    </button>
                    <button
                      onClick={() => router.push("/queue")}
                      className="w-full py-2.5 rounded-xl border border-black/[0.08] bg-white text-ink font-ui font-semibold text-sm hover:bg-black/[0.02] transition-colors"
                    >
                      Open Studio Queue
                    </button>
                  </div>
                )}

                {(localError || hireError) && (
                  <p className="mt-3 text-sm font-body text-red-500">{localError || hireError}</p>
                )}
              </section>

              <section className="rounded-3xl border border-black/[0.08] bg-white p-5 shadow-sm">
                <h3 className="font-display text-lg text-ink">Service Snapshot</h3>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <InfoCard title="Response Speed" value={`${product.service_metadata?.response_time_hours ?? 24}h avg reply`} />
                  <InfoCard title="Category" value={categoryLabel} />
                  <InfoCard
                    title="Fastest Delivery"
                    value={minDeliveryDays ? `${minDeliveryDays} day${minDeliveryDays === 1 ? "" : "s"}` : "Custom timeline"}
                  />
                  <InfoCard title="Revisions" value={maxRevisions !== undefined ? `${maxRevisions} max` : "Custom"} />
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>

      {showHireModal && selectedPackage && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto rounded-3xl bg-white shadow-2xl border border-black/[0.08] overflow-hidden">
            <div className="px-6 py-4 border-b border-black/[0.06] bg-gradient-to-r from-purple-primary/6 to-pink-vivid/6 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-ink">Hire this package</h2>
                <p className="text-sm font-body text-muted mt-1">
                  {selectedPackage.variant_name || "Selected package"} · ${selectedPackage.price}
                </p>
              </div>
              <button
                onClick={() => setShowHireModal(false)}
                className="w-9 h-9 rounded-full hover:bg-black/[0.04] text-muted"
                aria-label="Close"
              >
                <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-ui font-semibold text-ink mb-2">Project brief</label>
                <textarea
                  rows={6}
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  placeholder="Describe goals, style references, scope, and must-have deliverables."
                  className="w-full px-4 py-3 rounded-xl border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-ui font-semibold text-ink mb-2">Target timeline (days)</label>
                  <input
                    type="number"
                    min={selectedPackage.delivery_days || 1}
                    value={timelineDays}
                    onChange={(event) =>
                      setTimelineDays(Math.max(selectedPackage.delivery_days || 1, Number(event.target.value || 1)))
                    }
                    className="w-full px-4 py-3 rounded-xl border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-ui font-semibold text-ink mb-2">Extra notes</label>
                  <input
                    value={requirementsText}
                    onChange={(event) => setRequirementsText(event.target.value)}
                    placeholder="Links, files, constraints"
                    className="w-full px-4 py-3 rounded-xl border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
                  />
                </div>
              </div>

              {(localError || hireError) && <p className="text-sm font-body text-red-500">{localError || hireError}</p>}

              <button
                onClick={submitHire}
                disabled={hiring}
                className="w-full py-3.5 rounded-xl text-white font-ui font-semibold bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm disabled:opacity-60"
              >
                {hiring ? "Submitting..." : "Confirm & Start Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HeroMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 backdrop-blur-sm">
      <p className="text-[11px] font-ui uppercase tracking-[0.14em] text-white/60">{title}</p>
      <p className="mt-1 text-sm font-ui font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-3.5">
      <p className="text-[11px] font-ui uppercase tracking-[0.13em] text-muted">{title}</p>
      <p className="font-ui font-semibold text-ink mt-1 text-sm">{value}</p>
    </div>
  );
}
