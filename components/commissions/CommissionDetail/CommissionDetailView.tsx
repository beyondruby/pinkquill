"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useDeleteProduct, useProduct } from "@/lib/hooks/useProducts";
import { useCreateOrder } from "@/lib/hooks/useOrders";
import { useStudioCart } from "@/lib/hooks/useStudioQueue";
import { getCommissionSubcategoryLabel } from "@/lib/commissions/categories";
import { PLATFORM_FEES } from "@/lib/types/store";
import ProductGallery from "@/components/store/ProductDetail/ProductGallery";
import SellerRating from "@/components/reviews/SellerRating";
import ActionMenu from "@/components/ui/ActionMenu";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ShareModal from "@/components/ui/ShareModal";
import { showToast } from "@/lib/utils/toast";

interface CommissionDetailViewProps {
  commissionId: string;
}

export default function CommissionDetailView({ commissionId }: CommissionDetailViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { product, loading, error } = useProduct(commissionId);
  const { deleteProduct, deleting } = useDeleteProduct();
  const { createOrder, creating: hiring, error: hireError } = useCreateOrder();
  const { addItem, hasItem } = useStudioCart();

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const isOwner = !!user && user.id === product?.seller_id;

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
      // If the seller requires approval, the order is created in
      // pending_acceptance and the buyer waits on the order page until
      // the seller accepts. Otherwise jump straight into checkout for
      // immediate payment — keeps the hire flow consistent with the
      // direct-buy product flow and the cart checkout path.
      if (order.status === "pending_acceptance") {
        router.push(`/orders/${order.id}`);
      } else {
        router.push(`/checkout/${order.id}`);
      }
    }
  };

  const handleDelete = async () => {
    if (!product) return;

    const result = await deleteProduct(product.id);
    if (!result) {
      showToast.error("Failed to delete commission", "Please try again");
      return;
    }

    if (result.outcome === "archived") {
      showToast.info(
        "Commission archived",
        "This service has order history, so it was archived instead of permanently deleted."
      );
    } else {
      showToast.success("Commission deleted");
    }

    setShowDeleteConfirm(false);
    router.push("/seller/listings");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#fff9fb_100%)] px-4 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="h-8 w-52 rounded bg-skeleton animate-pulse" />
          <div className="mt-4 h-10 w-4/5 max-w-xl rounded bg-skeleton animate-pulse" />
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_360px] gap-10">
            <div className="aspect-square rounded-[28px] bg-gradient-to-br from-pink-50 to-orange-50 animate-pulse" />
            <div className="space-y-4">
              <div className="h-10 w-full rounded bg-skeleton animate-pulse" />
              <div className="h-10 w-full rounded bg-skeleton animate-pulse" />
              <div className="h-10 w-full rounded bg-skeleton animate-pulse" />
            </div>
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
      <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#fff9fb_48%,#fff7f2_100%)] pb-16">
        <div className="max-w-6xl mx-auto px-4 pt-8">
          <div className="pb-6 border-b border-border-light">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-4xl">
                <p className="text-[11px] font-ui uppercase tracking-[0.15em] text-muted">Commission Service</p>
                <h1 className="mt-3 font-display text-3xl md:text-4xl leading-tight text-ink max-w-4xl">{product.title}</h1>

                {product.service_metadata?.headline && (
                  <p className="mt-3 text-sm md:text-base font-body text-muted max-w-3xl">
                    {String(product.service_metadata.headline)}
                  </p>
                )}

                {product.seller && (
                  <div className="mt-3">
                    <p className="text-sm font-body text-muted">
                      by{" "}
                      <Link
                        href={`/studio/${product.seller.username}`}
                        className="font-ui font-semibold text-ink hover:text-pink-vivid transition-colors"
                      >
                        {product.seller.display_name || product.seller.username}
                      </Link>
                    </p>
                    <div className="mt-1">
                      <SellerRating sellerId={product.seller.id} compact />
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-body text-muted">
                  <span>{categoryLabel}</span>
                  <span>•</span>
                  <span>{product.service_metadata?.response_time_hours ?? 24}h average response</span>
                  <span>•</span>
                  <span>
                    {minDeliveryDays ? `${minDeliveryDays} day${minDeliveryDays === 1 ? "" : "s"} fastest delivery` : "Custom delivery"}
                  </span>
                  <span>•</span>
                  <span>{maxRevisions !== undefined ? `${maxRevisions} max revisions` : "Custom revisions"}</span>
                </div>
              </div>

              <ActionMenu
                buttonClassName="w-10 h-10 rounded-full border border-border-light bg-surface text-muted hover:text-ink hover:bg-subtle transition-colors flex items-center justify-center"
                buttonIconClassName="w-5 h-5"
                widthClassName="w-44"
                items={[
                  {
                    label: "Edit",
                    onSelect: () => router.push(`/sell/edit/${product.id}`),
                    hidden: !isOwner,
                    icon: (
                      <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    ),
                  },
                  {
                    label: "Share",
                    onSelect: () => setShowShareModal(true),
                    icon: (
                      <svg className="w-4 h-4 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
                        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                        <path d="M16 6l-4-4-4 4" />
                        <path d="M12 2v13" />
                      </svg>
                    ),
                  },
                  {
                    label: "Delete",
                    onSelect: () => setShowDeleteConfirm(true),
                    hidden: !isOwner,
                    tone: "danger",
                    dividerBefore: true,
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    ),
                  },
                ]}
              />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_360px] gap-10">
            <div className="space-y-10">
              <ProductGallery media={product.media || []} title={product.title} variant="service" />

              {product.description && (
                <section className="pt-8 border-t border-border-light">
                  <h2 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Overview</h2>
                  <p className="mt-3 text-sm md:text-base font-body leading-relaxed text-ink/85">
                    {product.description}
                  </p>
                </section>
              )}

              <section className="pt-8 border-t border-border-light">
                <h2 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Process</h2>
                <ol className="mt-4 space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="text-sm font-ui text-pink-vivid">01</span>
                    <p className="text-sm font-body text-ink/85">You submit your brief, references, and constraints in the hire form.</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-sm font-ui text-pink-vivid">02</span>
                    <p className="text-sm font-body text-ink/85">I deliver according to package scope and timeline.</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-sm font-ui text-pink-vivid">03</span>
                    <p className="text-sm font-body text-ink/85">Revisions are handled based on the selected package.</p>
                  </li>
                </ol>
              </section>

              {(serviceIncludes.length > 0 || serviceExcludes.length > 0) && (
                <section className="pt-8 border-t border-border-light grid grid-cols-1 md:grid-cols-2 gap-8">
                  {serviceIncludes.length > 0 && (
                    <div>
                      <h3 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Includes</h3>
                      <ul className="mt-3 space-y-2">
                        {serviceIncludes.map((item) => (
                          <li key={item} className="text-sm font-body text-ink/85 flex items-start gap-2">
                            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {serviceExcludes.length > 0 && (
                    <div>
                      <h3 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Not Included</h3>
                      <ul className="mt-3 space-y-2">
                        {serviceExcludes.map((item) => (
                          <li key={item} className="text-sm font-body text-ink/85 flex items-start gap-2">
                            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-orange-warm" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {(serviceRequirements.length > 0 || serviceFaqs.length > 0 || Boolean(deliveryNotes) || serviceKeywords.length > 0) && (
                <section className="pt-8 border-t border-border-light space-y-8">
                  {serviceRequirements.length > 0 && (
                    <div>
                      <h3 className="text-base font-ui uppercase tracking-[0.14em] text-muted">What I Need From You</h3>
                      <ol className="mt-3 space-y-2">
                        {serviceRequirements.map((item, index) => (
                          <li key={item} className="flex items-start gap-3 text-sm font-body text-ink/85">
                            <span className="font-ui text-pink-vivid">{index + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {serviceFaqs.length > 0 && (
                    <div>
                      <h3 className="text-base font-ui uppercase tracking-[0.14em] text-muted">FAQs</h3>
                      <div className="mt-3 divide-y divide-black/[0.08]">
                        {serviceFaqs.map((faq) => (
                          <article key={faq.question} className="py-3">
                            <h4 className="font-ui text-sm font-semibold text-ink">{faq.question}</h4>
                            <p className="font-body text-sm text-muted mt-1">{faq.answer}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {deliveryNotes && (
                    <div>
                      <h3 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Delivery Notes</h3>
                      <p className="mt-3 text-sm font-body text-ink/85 leading-relaxed">{deliveryNotes}</p>
                    </div>
                  )}

                  {serviceKeywords.length > 0 && (
                    <div>
                      <h3 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Tags</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {serviceKeywords.map((keyword) => (
                          <span key={keyword} className="text-sm font-body text-muted">#{keyword}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-8 lg:self-start lg:pl-8 lg:border-l lg:border-border-light">
              <div>
                <h2 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Commission Planner</h2>

                <div className="mt-4 divide-y divide-black/[0.08]">
                  {packages.map((pkg) => {
                    const selected = selectedPackage?.id === pkg.id;

                    return (
                      <button
                        key={pkg.id}
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className="w-full py-3 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <span className={`mt-1 inline-flex w-2.5 h-2.5 rounded-full ${selected ? "bg-pink-vivid" : "bg-border-strong"}`} />
                            <div>
                              <p className={`text-sm font-ui ${selected ? "text-ink" : "text-muted"}`}>
                                {pkg.variant_name || "Package"}
                              </p>
                              <p className="text-xs font-body text-muted mt-0.5">
                                {pkg.delivery_days ?? 7} day delivery · {pkg.revisions ?? 0} revision
                                {(pkg.revisions ?? 0) === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>
                          <p className={`text-sm font-display ${selected ? "text-pink-vivid" : "text-ink"}`}>
                            ${pkg.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedPackage && Array.isArray(selectedPackage.package_features) && selectedPackage.package_features.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-ui uppercase tracking-[0.14em] text-muted">This Package Covers</p>
                    <ul className="mt-2 space-y-1.5">
                      {selectedPackage.package_features.map((feature) => (
                        <li key={feature} className="text-sm font-body text-ink/85 flex items-start gap-2">
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
                  className="mt-6 w-full py-3.5 rounded-full text-white font-display font-semibold text-lg bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm disabled:opacity-60"
                >
                  Hire Creator
                </button>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      if (!selectedPackage || !product) return;
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
                    className="w-full py-2.5 rounded-full border border-border-strong text-ink text-sm font-ui font-medium hover:border-pink-vivid/40 transition-colors"
                  >
                    {isQueued ? "In Cart" : "Add to Cart"}
                  </button>
                  <button
                    onClick={() => router.push("/cart")}
                    className="w-full py-2.5 rounded-full border border-border-strong text-ink text-sm font-ui font-medium hover:border-accent/40 transition-colors"
                  >
                    Open Cart
                  </button>
                </div>

                {(localError || hireError) && (
                  <p className="mt-3 text-sm font-body text-red-500">{localError || hireError}</p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {showHireModal && selectedPackage && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto rounded-3xl bg-surface shadow-2xl border border-border-light overflow-hidden">
            <div className="px-6 py-4 border-b border-border-light bg-gradient-to-r from-purple-primary/6 to-pink-vivid/6 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-ink">Hire this package</h2>
                <p className="text-sm font-body text-muted mt-1">
                  {selectedPackage.variant_name || "Selected package"} · ${selectedPackage.price}
                </p>
              </div>
              <button
                onClick={() => setShowHireModal(false)}
                className="w-9 h-9 rounded-full hover:bg-skeleton/60 text-muted"
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
                  className="w-full px-4 py-3 rounded-xl border border-border-light focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
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
                    className="w-full px-4 py-3 rounded-xl border border-border-light focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-ui font-semibold text-ink mb-2">Extra notes</label>
                  <input
                    value={requirementsText}
                    onChange={(event) => setRequirementsText(event.target.value)}
                    placeholder="Links, files, constraints"
                    className="w-full px-4 py-3 rounded-xl border border-border-light focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
                  />
                </div>
              </div>

              {(localError || hireError) && <p className="text-sm font-body text-red-500">{localError || hireError}</p>}

              <button
                onClick={submitHire}
                disabled={hiring || !brief.trim()}
                className="w-full py-3.5 rounded-xl text-white font-ui font-semibold bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {hiring ? "Submitting..." : "Confirm & Start Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={typeof window !== "undefined" ? window.location.href : ""}
        title={product.title}
        description={product.description || ""}
        type="service"
        authorName={product.seller?.display_name || product.seller?.username || ""}
        authorUsername={product.seller?.username || ""}
        authorAvatar={product.seller?.avatar_url || ""}
        imageUrl={product.media?.[0]?.media_url || ""}
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Commission?"
        description="This action cannot be undone. This will permanently delete your commission listing and remove its associated data. If the service has order history, it will be archived instead."
        confirmText="Delete"
        isDanger
        loading={deleting}
      />
    </>
  );
}
