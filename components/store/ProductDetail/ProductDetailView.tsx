"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProduct, useToggleSaveProduct } from "@/lib/hooks/useProducts";
import { useCreateOrder } from "@/lib/hooks/useOrders";
import { useStudioCart } from "@/lib/hooks/useStudioQueue";
import { useAuth } from "@/components/providers/AuthProvider";
import { ProductPricing, PLATFORM_FEES, ShippingAddress } from "@/lib/types/store";
import {
  getCategoryConfig,
  formatAttributeValue,
  getFieldsForDelivery,
} from "@/lib/store/categories";
import ProductGallery from "./ProductGallery";
import SellerCard from "./SellerCard";
import SellerRating from "@/components/reviews/SellerRating";
import ProductReviewsSection from "@/components/reviews/ProductReviewsSection";
import ShareModal from "@/components/ui/ShareModal";

interface ProductDetailViewProps {
  productId: string;
}

export default function ProductDetailView({ productId }: ProductDetailViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { product, loading, error } = useProduct(productId);
  const { toggle: toggleSave, checkIsSaved } = useToggleSaveProduct();
  const { createOrder, creating: buying, error: buyError } = useCreateOrder();
  const { addItem, hasItem } = useStudioCart();

  const [selectedPricing, setSelectedPricing] = useState<ProductPricing | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState<Partial<ShippingAddress>>({
    name: "",
    line1: "",
    city: "",
    postal_code: "",
    country: "",
  });

  useEffect(() => {
    if (user && productId) {
      checkIsSaved(productId, user.id).then(setIsSaved);
    }
  }, [user, productId, checkIsSaved]);

  useEffect(() => {
    if (product?.listing_type === "service") {
      router.replace(`/commissions/${product.id}`);
    }
  }, [product, router]);

  const handleToggleSave = async () => {
    if (!user) return;

    const nextSavedState = !isSaved;
    setIsSaved(nextSavedState);

    const success = await toggleSave(productId, user.id, isSaved);
    if (!success) {
      setIsSaved(isSaved);
    }
  };

  if (loading || product?.listing_type === "service") {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="h-8 w-48 rounded bg-gray-100 animate-pulse" />
          <div className="mt-4 h-10 w-4/5 max-w-xl rounded bg-gray-100 animate-pulse" />
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_340px] gap-10">
            <div className="aspect-square rounded-[28px] bg-gradient-to-br from-pink-50 to-orange-50 animate-pulse" />
            <div className="space-y-4">
              <div className="h-7 w-2/3 rounded bg-gray-100 animate-pulse" />
              <div className="h-10 w-full rounded bg-gray-100 animate-pulse" />
              <div className="h-10 w-full rounded bg-gray-100 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-display text-ink">Product Not Found</h2>
          <p className="mt-2 text-sm font-body text-muted">This product may have been removed or doesn&apos;t exist.</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const categoryConfig = getCategoryConfig(product.category);
  const activePricing = selectedPricing || product.pricing?.[0];
  const isQueued = activePricing ? hasItem(product.id, activePricing.id) : false;
  const shippingCost = product.delivery_type !== "digital"
    ? Number(product.shipping?.shipping_cost || 0)
    : 0;

  const formatPrice = (price: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const getDisplayAttributes = () => {
    if (!categoryConfig || !product.attributes) return [];

    const effectiveDelivery = product.delivery_type === "both" ? "physical" : product.delivery_type;
    const fields = getFieldsForDelivery(product.category, effectiveDelivery);

    return fields
      .filter((field) => {
        const value = product.attributes[field.key];
        return (
          value !== undefined &&
          value !== null &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0)
        );
      })
      .map((field) => ({
        label: field.label,
        value: formatAttributeValue(field, product.attributes[field.key]),
      }));
  };

  const displayAttributes = getDisplayAttributes();

  const dimensions =
    product.delivery_type !== "digital" && product.shipping
      ? [
          { label: "Height", value: product.shipping.height, unit: product.shipping.dimensions_unit },
          { label: "Width", value: product.shipping.width, unit: product.shipping.dimensions_unit },
          { label: "Depth", value: product.shipping.thickness, unit: product.shipping.dimensions_unit },
          { label: "Weight", value: product.shipping.weight, unit: product.shipping.weight_unit },
        ].filter((item) => item.value)
      : [];
  const shippingServices = (product.shipping?.shipping_services || []).filter(Boolean);
  const shippingLocations = (product.shipping?.shipping_locations || []).filter(Boolean);
  const supportsInternational = shippingLocations.some((location) =>
    /(international|worldwide|global|all countries)/i.test(location)
  );
  const shippingCoverageLabel = supportsInternational
    ? "International shipping"
    : shippingLocations.length > 0
    ? "Regional shipping"
    : "Coverage not specified";
  const normalizedPackaging = product.shipping?.packaging
    ? product.shipping.packaging.replace(/_/g, " ")
    : null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#fffefc_45%,#fff9f2_100%)] pb-16">
      <div className="max-w-6xl mx-auto px-4 pt-8">
        <div className="pb-6 border-b border-black/[0.08]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 max-w-4xl">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-ui uppercase tracking-[0.15em] text-muted">
                <span>Marketplace</span>
                <span className="text-black/20">•</span>
                <span>{product.category}</span>
                <span className="text-black/20">•</span>
                <span>
                  {product.delivery_type === "digital"
                    ? "Digital"
                    : product.delivery_type === "both"
                    ? "Physical + Digital"
                    : "Physical"}
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-display font-semibold text-ink leading-tight">
                {product.title}
              </h1>

              {product.seller && (
                <div>
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
            </div>

            <MoreMenu
              onShare={() => setShowShareModal(true)}
              onSave={handleToggleSave}
              isSaved={isSaved}
              isLoggedIn={!!user}
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_340px] gap-10">
          <div className="space-y-10">
            <ProductGallery
              media={product.media || []}
              title={product.title}
              variant="product"
              isLiked={isLiked}
              onLike={() => setIsLiked(!isLiked)}
            />

            {product.description && (
              <section className="pt-8 border-t border-black/[0.08]">
                <h2 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Artist Note</h2>
                <p className="mt-3 text-sm md:text-base font-body leading-relaxed text-ink/85 max-w-3xl">
                  {product.description}
                </p>
              </section>
            )}

            {displayAttributes.length > 0 && (
              <section className="pt-8 border-t border-black/[0.08]">
                <h2 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Specifications</h2>
                <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  {displayAttributes.map((attr, index) => (
                    <div key={`${attr.label}-${index}`} className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] pb-2">
                      <dt className="text-sm font-body text-muted">{attr.label}</dt>
                      <dd className="text-sm font-ui text-ink text-right">{attr.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {(dimensions.length > 0 || product.delivery_type !== "digital" || (product.keywords && product.keywords.length > 0)) && (
              <section className="pt-8 border-t border-black/[0.08] space-y-7">
                {dimensions.length > 0 && (
                  <div>
                    <h3 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Dimensions</h3>
                    <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                      {dimensions.map((item) => (
                        <div key={item.label} className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] pb-2">
                          <dt className="text-sm font-body text-muted">{item.label}</dt>
                          <dd className="text-sm font-ui text-ink text-right">
                            {item.value} {item.unit}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {product.delivery_type !== "digital" && (
                  <div>
                    <h3 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Shipping</h3>
                    {product.shipping ? (
                      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                        <div className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] pb-2">
                          <dt className="text-sm font-body text-muted">Shipping price</dt>
                          <dd className="text-sm font-ui text-ink text-right">
                            {shippingCost > 0 ? formatPrice(shippingCost, activePricing?.currency || "USD") : "Free"}
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] pb-2">
                          <dt className="text-sm font-body text-muted">Coverage</dt>
                          <dd className="text-sm font-ui text-ink text-right">{shippingCoverageLabel}</dd>
                        </div>
                        {shippingServices.length > 0 && (
                          <div className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] pb-2">
                            <dt className="text-sm font-body text-muted">Shipping service</dt>
                            <dd className="text-sm font-ui text-ink text-right">{shippingServices.join(", ")}</dd>
                          </div>
                        )}
                        {shippingLocations.length > 0 && (
                          <div className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] pb-2">
                            <dt className="text-sm font-body text-muted">Ships to</dt>
                            <dd className="text-sm font-ui text-ink text-right">{shippingLocations.join(", ")}</dd>
                          </div>
                        )}
                        {product.shipping.processing_days && (
                          <div className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] pb-2">
                            <dt className="text-sm font-body text-muted">Processing</dt>
                            <dd className="text-sm font-ui text-ink text-right">{product.shipping.processing_days} business days</dd>
                          </div>
                        )}
                        {normalizedPackaging && (
                          <div className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] pb-2">
                            <dt className="text-sm font-body text-muted">Packaging</dt>
                            <dd className="text-sm font-ui text-ink text-right capitalize">{normalizedPackaging}</dd>
                          </div>
                        )}
                      </dl>
                    ) : (
                      <p className="mt-3 text-sm font-body text-muted">
                        Shipping details will be provided by the seller.
                      </p>
                    )}
                  </div>
                )}

                {product.keywords && product.keywords.length > 0 && (
                  <div>
                    <h3 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Tags</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.keywords.map((keyword) => (
                        <span key={keyword} className="text-sm font-body text-muted">#{keyword}</span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <ProductReviewsSection productId={product.id} />

            {product.seller && (
              <div className="lg:hidden pt-8 border-t border-black/[0.08]">
                <SellerCard seller={product.seller} />
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-8 lg:self-start lg:pl-8 lg:border-l lg:border-black/[0.08]">
            {activePricing ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-ui uppercase tracking-[0.14em] text-muted">Price</p>
                  <p className="mt-1 text-4xl font-display text-ink">
                    {formatPrice(activePricing.price, activePricing.currency)}
                  </p>
                  {activePricing.pricing_type === "original" && (
                    <p className="text-xs font-ui text-orange-warm mt-1">Original piece</p>
                  )}
                </div>

                {product.pricing && product.pricing.length > 1 && (
                  <div>
                    <p className="text-xs font-ui uppercase tracking-[0.14em] text-muted mb-2">Options</p>
                    <div className="divide-y divide-black/[0.08]">
                      {product.pricing.map((pricing) => {
                        const isActive = activePricing?.id === pricing.id;

                        return (
                          <button
                            key={pricing.id}
                            onClick={() => setSelectedPricing(pricing)}
                            className="w-full py-2.5 text-left"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2">
                                <span className={`mt-1 inline-flex w-2.5 h-2.5 rounded-full ${isActive ? "bg-pink-vivid" : "bg-black/15"}`} />
                                <div>
                                  <p className={`text-sm font-ui ${isActive ? "text-ink" : "text-muted"}`}>
                                    {pricing.variant_name || getPricingTypeLabel(pricing.pricing_type)}
                                  </p>
                                  <p className="text-xs font-body text-muted">{getPricingTypeLabel(pricing.pricing_type)}</p>
                                </div>
                              </div>
                              <p className={`text-sm font-display ${isActive ? "text-pink-vivid" : "text-ink"}`}>
                                {formatPrice(pricing.price, pricing.currency)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={async () => {
                    if (!activePricing) return;
                    if (!user) {
                      router.push("/login");
                      return;
                    }
                    setCheckoutError(null);
                    if (product.delivery_type !== "digital") {
                      setShowBuyModal(true);
                      return;
                    }
                    const order = await createOrder({
                      product_id: product.id,
                      pricing_id: activePricing.id,
                      listing_type: "product",
                    });

                    if (order) {
                      router.push(`/checkout/${order.id}`);
                    }
                  }}
                  disabled={!activePricing || activePricing.stock === 0 || buying}
                  className="w-full py-3.5 rounded-full text-white font-ui font-semibold bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {buying ? "Starting Checkout..." : "Start Checkout"}
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      addItem({
                        product_id: product.id,
                        pricing_id: activePricing.id,
                        listing_type: "product",
                        delivery_type: product.delivery_type,
                        title: product.title,
                        seller_name: product.seller?.display_name || product.seller?.username || "Creator",
                        price: activePricing.price,
                        currency: activePricing.currency,
                        image_url: product.primary_image_url || product.media?.[0]?.media_url || null,
                      });
                    }}
                    className="w-full py-2.5 rounded-full border border-black/[0.12] text-ink text-sm font-ui font-medium hover:border-pink-vivid/40 transition-colors"
                  >
                    {isQueued ? "In Cart" : "Add to Cart"}
                  </button>
                  <button
                    onClick={() => router.push("/cart")}
                    className="w-full py-2.5 rounded-full border border-black/[0.12] text-ink text-sm font-ui font-medium hover:border-purple-primary/40 transition-colors"
                  >
                    Open Cart
                  </button>
                </div>

                {product.seller && (
                  <Link
                    href="/messages"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-ui font-medium text-pink-vivid hover:text-orange-warm transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M8 3.5C4.5 3.5 2 6 2 9c0 1.4.5 2.6 1.4 3.6L2 16l2.8-1.3c.7.5 1.6.8 2.5.8.7 0 1.3-.1 1.9-.3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M15 6.5c-3 0-5.5 2.5-5.5 5.5s2.5 5.5 5.5 5.5c.8 0 1.5-.1 2.2-.4L21 19l-1.5-3c.7-1 1.1-2.2 1.1-3.5 0-3-2.4-5.5-5.6-5.5z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12 10.5h6M12 13h4" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Ask the artist a question
                  </Link>
                )}

                {product.delivery_type === "digital" && (
                  <p className="text-xs font-body text-muted">Instant digital access after payment confirmation.</p>
                )}

                {(checkoutError || buyError) && (
                  <p className="text-sm font-body text-red-500">{checkoutError || buyError}</p>
                )}
              </div>
            ) : (
              <p className="text-sm font-body text-muted">No available pricing options.</p>
            )}
          </aside>
        </div>
      </div>

      <ShareModal
        isOpen={showShareModal}
        url={typeof window !== "undefined" ? window.location.href : ""}
        title={product.title}
        onClose={() => setShowShareModal(false)}
      />

      {showBuyModal && activePricing && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="max-w-xl mx-auto rounded-3xl bg-white shadow-2xl border border-black/[0.08] overflow-hidden">
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-ink">Order Composer</h2>
                <p className="text-sm font-body text-muted mt-1">
                  {activePricing.variant_name || product.title}
                </p>
              </div>
              <button
                onClick={() => setShowBuyModal(false)}
                className="w-9 h-9 rounded-full hover:bg-black/[0.04] text-muted"
                aria-label="Close"
              >
                <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 space-y-2">
                <div className="flex justify-between text-sm font-body">
                  <span className="text-muted">Subtotal</span>
                  <span className="text-ink font-semibold">{formatPrice(activePricing.price, activePricing.currency)}</span>
                </div>
                {shippingCost > 0 && (
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-muted">Shipping</span>
                    <span className="text-ink font-semibold">{formatPrice(shippingCost, activePricing.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-body">
                  <span className="text-muted">Platform fee ({Math.round(PLATFORM_FEES.product * 100)}%)</span>
                  <span className="text-ink">
                    {formatPrice(activePricing.price * PLATFORM_FEES.product, activePricing.currency)}
                  </span>
                </div>
                <div className="border-t border-black/[0.06] pt-2 flex justify-between">
                  <span className="font-ui font-semibold text-ink">Total</span>
                  <span className="font-display text-xl font-semibold text-ink">
                    {formatPrice(activePricing.price + shippingCost, activePricing.currency)}
                  </span>
                </div>
              </div>

              {product.delivery_type !== "digital" && (
                <div className="space-y-3">
                  <h3 className="font-ui font-semibold text-ink text-sm">Shipping Address</h3>
                  <input
                    placeholder="Full name"
                    value={shippingAddress.name || ""}
                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
                  />
                  <input
                    placeholder="Address line 1"
                    value={shippingAddress.line1 || ""}
                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, line1: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="City"
                      value={shippingAddress.city || ""}
                      onChange={(e) => setShippingAddress((prev) => ({ ...prev, city: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
                    />
                    <input
                      placeholder="Postal code"
                      value={shippingAddress.postal_code || ""}
                      onChange={(e) => setShippingAddress((prev) => ({ ...prev, postal_code: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
                    />
                  </div>
                  <input
                    placeholder="Country"
                    value={shippingAddress.country || ""}
                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, country: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
                  />
                </div>
              )}

              {(checkoutError || buyError) && (
                <p className="text-sm font-body text-red-500">{checkoutError || buyError}</p>
              )}

              <button
                onClick={async () => {
                  const isPhysical = product.delivery_type !== "digital";
                  setCheckoutError(null);

                  if (
                    isPhysical &&
                    (!shippingAddress.name ||
                      !shippingAddress.line1 ||
                      !shippingAddress.city ||
                      !shippingAddress.country)
                  ) {
                    setCheckoutError("Complete all required shipping fields before continuing.");
                    return;
                  }

                  const order = await createOrder({
                    product_id: product.id,
                    pricing_id: activePricing.id,
                    listing_type: "product",
                    shipping_address: isPhysical ? (shippingAddress as ShippingAddress) : undefined,
                  });

                  if (order) {
                    setShowBuyModal(false);
                    router.push(`/checkout/${order.id}`);
                  }
                }}
                disabled={buying}
                className="w-full py-3.5 rounded-xl text-white font-ui font-semibold bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm disabled:opacity-60"
              >
                {buying ? "Creating..." : "Start Checkout"}
              </button>

              <p className="text-xs text-center font-body text-muted">Next: complete payment and then continue to your order page.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getPricingTypeLabel(type: string): string {
  switch (type) {
    case "original":
      return "Original Piece";
    case "reproduction":
      return "Reproduction";
    case "digital_download":
      return "Digital Download";
    default:
      return type;
  }
}

function MoreMenu({
  onShare,
  onSave,
  isSaved,
  isLoggedIn,
}: {
  onShare: () => void;
  onSave: () => void;
  isSaved: boolean;
  isLoggedIn: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="More actions"
        className="w-10 h-10 rounded-full border border-black/[0.08] bg-white text-muted hover:text-ink hover:bg-black/[0.02] transition-colors"
      >
        <svg className="w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-2xl shadow-xl border border-black/[0.08] overflow-hidden z-20">
            {isLoggedIn && (
              <button
                onClick={() => {
                  onSave();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-sm font-ui text-ink hover:bg-black/[0.03] flex items-center gap-3 transition-colors"
              >
                <svg
                  className="w-4 h-4 text-purple-primary"
                  fill={isSaved ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {isSaved ? "Saved" : "Save"}
              </button>
            )}

            <button
              onClick={() => {
                onShare();
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-sm font-ui text-ink hover:bg-black/[0.03] flex items-center gap-3 transition-colors"
            >
              <svg className="w-4 h-4 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                <path d="M16 6l-4-4-4 4" />
                <path d="M12 2v13" />
              </svg>
              Share
            </button>

            <button
              onClick={() => setIsOpen(false)}
              className="w-full px-4 py-3 text-left text-sm font-ui text-red-500 hover:bg-red-50 flex items-center gap-3 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
              Report
            </button>
          </div>
        </>
      )}
    </div>
  );
}
