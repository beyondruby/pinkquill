"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProduct } from "@/lib/hooks/useProducts";
import { useCreateOrder } from "@/lib/hooks/useOrders";
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
      router.push(`/orders/${order.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="aspect-square rounded-2xl bg-gray-100 animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 bg-gray-100 rounded animate-pulse" />
            <div className="h-6 w-1/3 bg-gray-100 rounded animate-pulse" />
            <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product || product.listing_type !== "service") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-3xl text-ink mb-3">Commission Not Found</h1>
          <p className="font-body text-muted mb-6">This service may be private, unpublished, or removed.</p>
          <Link href="/shop?section=commissions" className="inline-flex px-5 py-3 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid">
            Browse Commissions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background pt-8">
        <div className="max-w-6xl mx-auto px-4 pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <div className="lg:sticky lg:top-8 lg:self-start">
              <ProductGallery media={product.media || []} title={product.title} />
            </div>

            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-50 text-pink-vivid text-xs font-ui font-semibold uppercase tracking-wider">
                Commission Service
              </div>

              <div>
                <h1 className="font-display text-3xl text-ink leading-tight">{product.title}</h1>
                {product.service_metadata?.headline && (
                  <p className="font-body text-muted mt-2">{String(product.service_metadata.headline)}</p>
                )}
                {product.seller && (
                  <div className="mt-3">
                    <p className="text-sm font-body text-muted">
                      by{" "}
                      <Link href={`/studio/${product.seller.username}`} className="text-pink-vivid hover:text-orange-warm">
                        {product.seller.display_name || product.seller.username}
                      </Link>
                    </p>
                    <div className="mt-1.5">
                      <SellerRating sellerId={product.seller.id} compact />
                    </div>
                  </div>
                )}
              </div>

              {product.description && (
                <p className="font-body text-sm leading-relaxed text-ink/90">{product.description}</p>
              )}

              <section className="rounded-2xl border border-black/[0.06] overflow-hidden">
                <div className="px-5 py-4 border-b border-black/[0.06] bg-gradient-to-r from-purple-50/50 to-pink-50/50">
                  <h2 className="font-display text-xl text-ink">Packages</h2>
                </div>
                <div className="divide-y divide-black/[0.06]">
                  {packages.map((pkg) => {
                    const selected = selectedPackage?.id === pkg.id;

                    return (
                      <button
                        key={pkg.id}
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className={`w-full text-left px-5 py-4 transition-colors ${selected ? "bg-pink-50/40" : "hover:bg-gray-50/70"}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-ui font-semibold text-ink">{pkg.variant_name || "Package"}</p>
                            <p className="text-sm font-body text-muted mt-1">
                              {pkg.delivery_days ?? 7} day delivery • {pkg.revisions ?? 0} revision{(pkg.revisions ?? 0) === 1 ? "" : "s"}
                            </p>
                            {Array.isArray(pkg.package_features) && pkg.package_features.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {pkg.package_features.map((feature) => (
                                  <li key={feature} className="text-xs font-body text-ink/80 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-pink-vivid/70" />
                                    {feature}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="text-right">
                            <p className="font-display text-2xl bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
                              ${pkg.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                            </p>
                            <span className={`inline-flex mt-2 w-5 h-5 rounded-full border-2 ${selected ? "border-pink-vivid" : "border-gray-300"} items-center justify-center`}>
                              {selected && <span className="w-2 h-2 rounded-full bg-pink-vivid" />}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {selectedPackage && Array.isArray(selectedPackage.package_features) && selectedPackage.package_features.length > 0 && (
                <section className="rounded-2xl border border-black/[0.06] p-5 bg-white">
                  <h3 className="font-display text-xl text-ink">
                    What&apos;s included in {selectedPackage.variant_name || "this package"}
                  </h3>
                  <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedPackage.package_features.map((feature) => (
                      <li key={feature} className="text-sm font-body text-ink/90 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-vivid mt-2" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <button
                onClick={openHireModal}
                disabled={!selectedPackage}
                className="w-full py-4 rounded-xl text-white font-display font-bold text-lg bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm hover:shadow-xl hover:shadow-pink-vivid/20 transition-all disabled:opacity-60"
              >
                Hire Creator
              </button>

              {localError && (
                <p className="text-sm font-body text-red-500">{localError}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <InfoCard title="Response Speed" value={`${product.service_metadata?.response_time_hours ?? 24}h avg reply`} />
                <InfoCard title="Category" value={categoryLabel} />
                <InfoCard title="Fastest Delivery" value={minDeliveryDays ? `${minDeliveryDays} day${minDeliveryDays === 1 ? "" : "s"}` : "Custom timeline"} />
                <InfoCard title="Revisions" value={maxRevisions !== undefined ? `${maxRevisions} max` : "Custom"} />
              </div>
            </div>
          </div>

          {(serviceRequirements.length > 0 || serviceFaqs.length > 0 || serviceIncludes.length > 0 || serviceExcludes.length > 0 || serviceKeywords.length > 0 || Boolean(deliveryNotes)) && (
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {serviceIncludes.length > 0 && (
                <section className="rounded-2xl border border-black/[0.06] p-5 bg-white">
                  <h3 className="font-display text-xl text-ink mb-3">Includes</h3>
                  <ul className="space-y-2">
                    {serviceIncludes.map((item) => (
                      <li key={item} className="font-body text-sm text-ink/90 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {serviceExcludes.length > 0 && (
                <section className="rounded-2xl border border-black/[0.06] p-5 bg-white">
                  <h3 className="font-display text-xl text-ink mb-3">Not included</h3>
                  <ul className="space-y-2">
                    {serviceExcludes.map((item) => (
                      <li key={item} className="font-body text-sm text-ink/90 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-warm mt-2" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {serviceRequirements.length > 0 && (
                <section className="rounded-2xl border border-black/[0.06] p-5 bg-white">
                  <h3 className="font-display text-xl text-ink mb-3">What the creator needs</h3>
                  <ul className="space-y-2">
                    {serviceRequirements.map((item) => (
                      <li key={item} className="font-body text-sm text-ink/90 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-vivid mt-2" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {serviceFaqs.length > 0 && (
                <section className="rounded-2xl border border-black/[0.06] p-5 bg-white">
                  <h3 className="font-display text-xl text-ink mb-3">FAQs</h3>
                  <div className="space-y-3">
                    {serviceFaqs.map((faq) => (
                      <article key={faq.question} className="rounded-xl border border-black/[0.06] px-3 py-2.5">
                        <h4 className="font-ui text-sm font-semibold text-ink">{faq.question}</h4>
                        <p className="font-body text-sm text-muted mt-1">{faq.answer}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {serviceKeywords.length > 0 && (
                <section className="rounded-2xl border border-black/[0.06] p-5 bg-white">
                  <h3 className="font-display text-xl text-ink mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {serviceKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-xs font-ui text-gray-700"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {deliveryNotes && (
                <section className="rounded-2xl border border-black/[0.06] p-5 bg-white lg:col-span-2">
                  <h3 className="font-display text-xl text-ink mb-2">Delivery notes</h3>
                  <p className="font-body text-sm text-ink/90 leading-relaxed">{deliveryNotes}</p>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {showHireModal && selectedPackage && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto rounded-2xl bg-white shadow-2xl border border-black/[0.08]">
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl text-ink">Hire this package</h2>
                <p className="text-sm font-body text-muted mt-1">{selectedPackage.variant_name || "Selected package"} · ${selectedPackage.price}</p>
              </div>
              <button
                onClick={() => setShowHireModal(false)}
                className="w-9 h-9 rounded-full hover:bg-gray-100 text-muted"
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
                    onChange={(event) => setTimelineDays(Math.max(selectedPackage.delivery_days || 1, Number(event.target.value || 1)))}
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

              {(localError || hireError) && (
                <p className="text-sm font-body text-red-500">{localError || hireError}</p>
              )}

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

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-4">
      <p className="text-xs font-ui uppercase tracking-wider text-muted">{title}</p>
      <p className="font-ui font-semibold text-ink mt-1">{value}</p>
    </div>
  );
}
